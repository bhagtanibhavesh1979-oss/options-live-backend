const express = require('express');
const cors = require('cors');
const axios = require('axios');
const WebSocket = require('ws');
const app = express();
const http = require('http').createServer(app);
const wss = new WebSocket.Server({ server: http });

app.use(cors());
app.use(express.json());

let livePrices = {};
let liveOptionPrices = {}; // { "NIFTY": { "25500-CE": 120.25, "25500-PE": 58.15 } }
let clientConnections = new Map();

// Helper: find option tokens for expiry/strikes
async function fetchOptionTokens(symbol, expiry, spot, numStrikes, apiKey) {
    const url = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json";
    const d = (await axios.get(url)).data;
    // Find strikes (±numStrikes * interval, around ATM)
    const strikeInterval = symbol === 'NIFTY' ? 50 : 100;
    const atmStrike = Math.round(spot / strikeInterval) * strikeInterval;
    let desiredStrikes = [];
    for (let i = -numStrikes; i <= numStrikes; i++) {
        desiredStrikes.push(atmStrike + i * strikeInterval);
    }
    const tokens = [];
    d.forEach(item => {
        if (
            item.name === symbol && item.instrumenttype === "OPTIDX" &&
            String(item.expiry).startsWith(expiry) && desiredStrikes.includes(Number(item.strike))
        ) {
            tokens.push({ token: item.token, strike: Number(item.strike), optiontype: item.optiontype });
        }
    });
    return tokens;
}

// Angel One login function
async function loginAngelOne(clientCode, pin, totp, apiKey) {
    const res = await axios.post(
        'https://apiconnect.angelbroking.com/rest/auth/angelbroking/user/v1/loginByPassword',
        { clientcode: clientCode, password: pin, totp },
        { headers: {
            "Content-Type": "application/json",
            "Accept": "application/json",
            "X-UserType": "USER",
            "X-SourceID": "WEB",
            "X-ClientLocalIP": "192.168.0.1",
            "X-ClientPublicIP": "106.193.147.98",
            "X-MACAddress": "00-1B-44-11-3A-B7",
            "X-PrivateKey": apiKey
        } }
    );
    if (!res.data.data?.jwtToken) throw new Error('Angel One login failed');
    return res.data.data.jwtToken;
}

// Client requests connection (with expiry/numStrikes/etc)
app.post('/api/connect', async (req, res) => {
    const { api_key, client_code, pin, totp, symbol, expiry, numStrikes } = req.body;
    if (!api_key || !client_code || !pin || !totp || !symbol || !expiry || !numStrikes) {
        return res.status(400).json({ success: false, error: 'Missing fields' });
    }
    try {
        // Dummy spot for now—better to call live prices (see below)
        const spotPrice = livePrices[symbol] ? Number(livePrices[symbol]) : (symbol === 'NIFTY' ? 23500 : 50000);
        const tokens = await fetchOptionTokens(symbol, expiry, spotPrice, numStrikes, api_key);
        const jwtToken = await loginAngelOne(client_code, pin, totp, api_key);
        const connectionId = Math.random().toString(36).substring(7);
        // Store session (if needed)
        clientConnections.set(connectionId, { symbol, expiry, numStrikes, tokens, jwtToken });
        res.json({ success: true, connectionId, token: jwtToken, tokens });
    } catch (e) {
        res.status(500).json({ success: false, error: e.toString() });
    }
});

// REST endpoint: returns latest option chain and spot (best for Expo app)
app.get('/api/prices', (req, res) => {
    const symbol = req.query.symbol || "NIFTY";
    const optionData = [];
    if (liveOptionPrices[symbol]) {
        Object.entries(liveOptionPrices[symbol]).forEach(([key, ltp]) => {
            let [strike, type] = key.split('-');
            let record = optionData.find(r => r.strike === Number(strike));
            if (!record) {
                record = { strike: Number(strike), call: {}, put: {} };
                optionData.push(record);
            }
            if (type === "CE") record.call.ltp = Number(ltp);
            if (type === "PE") record.put.ltp = Number(ltp);
        });
    }
    res.json({
        success: true,
        prices: livePrices,
        optionChain: { [symbol]: optionData },
        timestamp: new Date().toISOString()
    });
});

// When client connects to WS, start an Angel One WS for price and options
wss.on('connection', async (ws, req) => {
    const params = new URLSearchParams(req.url.split('?')[1]);
    const connectionId = params.get('connectionId');
    const jwtToken = params.get('token');
    const clientSession = clientConnections.get(connectionId);
    if (!jwtToken || !clientSession) return ws.close();

    const angelWs = new WebSocket(`wss://smartapisocket.angelbroking.com/websocket?jwttoken=${jwtToken}`);
    angelWs.on('open', () => {
        // Subscribe to index and options
        let subscribeMsg = {
            task: "mw",
            channel: "1",
            token: [
                clientSession.symbol === 'NIFTY' ? "26000" : "26009", // Index token
                ...clientSession.tokens.map(t => t.token)
            ]
        };
        angelWs.send(JSON.stringify(subscribeMsg));
    });

    angelWs.on('message', (data) => {
        try {
            const message = JSON.parse(data);
            // Index tokens (e.g. spot price)
            if (message.tk && message.ltp) {
                // Save index price
                if (["26000","26009","26017"].includes(String(message.tk))) {
                    livePrices[clientSession.symbol] = Number(message.ltp).toFixed(2);
                    ws.send(JSON.stringify({
                        index: clientSession.symbol,
                        spot: Number(message.ltp),
                        timestamp: new Date().toISOString()
                    }));
                } else {
                    // Option token
                    const tokenObj = clientSession.tokens.find(t => t.token == message.tk);
                    if (tokenObj) {
                        // Store as liveOptionPrices[symbol]["strike-type"] = ltp
                        const priceKey = `${tokenObj.strike}-${tokenObj.optiontype}`;
                        if (!liveOptionPrices[clientSession.symbol]) liveOptionPrices[clientSession.symbol] = {};
                        liveOptionPrices[clientSession.symbol][priceKey] = Number(message.ltp).toFixed(2);
                        ws.send(JSON.stringify({
                            index: clientSession.symbol,
                            strike: tokenObj.strike,
                            type: tokenObj.optiontype,
                            ltp: Number(message.ltp),
                            timestamp: new Date().toISOString()
                        }));
                    }
                }
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        angelWs.close();
    });
});

// Static endpoint and server start
app.get('/', (req, res) => {
    res.json({ message: '✅ Options Trading - LIVE', timestamp: new Date().toISOString() });
});
const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => { console.log(`✅ Server running on port ${PORT}`); });
