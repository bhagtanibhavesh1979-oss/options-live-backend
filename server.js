const express = require('express');
const cors = require('cors');
const axios = require('axios');
const WebSocket = require('ws');
const app = express();
const http = require('http').createServer(app);
const wss = new WebSocket.Server({ server: http });

app.use(cors());
app.use(express.json());

// Store live prices in memory
let livePrices = {};

// Angel One WebSocket connection
let angelWs = null;
let reconnectTimeout = null;

// Function to connect to Angel One WebSocket
async function connectAngelOneWebSocket() {
    try {
        console.log('📡 Connecting to Angel One WebSocket...');
        
        // First get the JWT token
        const response = await axios.post('https://apiconnect.angelbroking.com/rest/auth/angelbroking/user/v1/loginByPassword', 
            {
                "clientcode": process.env.ANGEL_CLIENT_CODE,
                "password": process.env.ANGEL_PIN,
                "totp": process.env.ANGEL_TOTP
            },
            {
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json",
                    "X-UserType": "USER",
                    "X-SourceID": "WEB",
                    "X-ClientLocalIP": "192.168.0.1",
                    "X-ClientPublicIP": "106.193.147.98",
                    "X-MACAddress": "00-1B-44-11-3A-B7",
                    "X-PrivateKey": process.env.ANGEL_API_KEY
                }
            }
        );

        if (!response.data.data?.jwtToken) {
            throw new Error('Failed to get JWT token');
        }

        const jwtToken = response.data.data.jwtToken;
        const wsUrl = `wss://smartapisocket.angelbroking.com/websocket?jwttoken=${jwtToken}&clientcode=${process.env.ANGEL_CLIENT_CODE}&apikey=${process.env.ANGEL_API_KEY}`;
        
        angelWs = new WebSocket(wsUrl);

        angelWs.on('open', () => {
            console.log('✅ Connected to Angel One WebSocket');
            // Subscribe to indices
            const subscribeMsg = {
                "task": "mw",
                "channel": "1",
                "token": [
                    "26000",  // NIFTY
                    "26009",  // BANKNIFTY
                    "26017",  // FINNIFTY
                    "26074",  // MIDCPNIFTY
                    "26001"   // SENSEX
                ],
                "user": process.env.ANGEL_CLIENT_CODE,
                "acctid": process.env.ANGEL_CLIENT_CODE
            };
            angelWs.send(JSON.stringify(subscribeMsg));
        });

        angelWs.on('message', (data) => {
            try {
                const message = JSON.parse(data);
                if (message.tk && message.ltp) {
                    // Map token to index name
                    const tokenMap = {
                        '26000': 'NIFTY',
                        '26009': 'BANKNIFTY',
                        '26017': 'FINNIFTY',
                        '26074': 'MIDCPNIFTY',
                        '26001': 'SENSEX'
                    };

                    const indexName = tokenMap[message.tk];
                    if (indexName) {
                        livePrices[indexName] = parseFloat(message.ltp).toFixed(2);
                        console.log(`💹 ${indexName}: ${livePrices[indexName]}`);
                        
                        // Broadcast to all connected clients
                        wss.clients.forEach(client => {
                            if (client.readyState === WebSocket.OPEN) {
                                client.send(JSON.stringify({
                                    index: indexName,
                                    price: livePrices[indexName],
                                    timestamp: new Date().toISOString()
                                }));
                            }
                        });
                    }
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        });

        angelWs.on('close', () => {
            console.log('❌ Angel One WebSocket closed. Reconnecting in 5s...');
            // Try to reconnect after 5 seconds
            clearTimeout(reconnectTimeout);
            reconnectTimeout = setTimeout(connectAngelOneWebSocket, 5000);
        });

        angelWs.on('error', (error) => {
            console.error('WebSocket error:', error);
        });

    } catch (error) {
        console.error('Failed to connect to Angel One:', error);
        // Try to reconnect after 5 seconds
        clearTimeout(reconnectTimeout);
        reconnectTimeout = setTimeout(connectAngelOneWebSocket, 5000);
    }
}

// Handle client WebSocket connections
wss.on('connection', (ws) => {
    console.log('📱 Client connected');
    
    // Send current prices immediately
    if (Object.keys(livePrices).length > 0) {
        ws.send(JSON.stringify({
            type: 'snapshot',
            prices: livePrices,
            timestamp: new Date().toISOString()
        }));
    }

    ws.on('close', () => {
        console.log('📱 Client disconnected');
    });
});

// REST endpoint for current prices
app.get('/api/prices', (req, res) => {
    res.json({
        success: true,
        prices: livePrices,
        source: 'Angel One Live WebSocket',
        timestamp: new Date().toISOString()
    });
});

app.get('/', (req, res) => {
    res.json({ 
        message: '✅ Options Trading - LIVE Angel One Data',
        timestamp: new Date().toISOString()
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    // Connect to Angel One WebSocket
    connectAngelOneWebSocket();
});
