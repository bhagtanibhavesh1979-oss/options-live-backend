const express = require('express');
const cors = require('cors');
const axios = require('axios');
const WebSocket = require('ws');
const app = express();
const http = require('http').createServer(app);
const wss = new WebSocket.Server({ server: http });

app.use(cors());
app.use(express.json());

// Store live prices and client connections in memory
let livePrices = {};
let clientConnections = new Map(); // Store WebSocket connections and their credentials

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

// Handle client authentication and WebSocket connection
app.post('/api/connect', async (req, res) => {
    const { api_key, client_code, pin, totp } = req.body;
    
    if (!api_key || !client_code || !pin || !totp) {
        return res.status(400).json({ 
            success: false, 
            error: 'Missing credentials' 
        });
    }

    try {
        const response = await axios.post(
            'https://apiconnect.angelbroking.com/rest/auth/angelbroking/user/v1/loginByPassword',
            {
                "clientcode": client_code,
                "password": pin,
                "totp": totp
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
                    "X-PrivateKey": api_key
                }
            }
        );

        if (response.data.status && response.data.data?.jwtToken) {
            // Generate a unique connection ID
            const connectionId = Math.random().toString(36).substring(7);
            
            res.json({
                success: true,
                connectionId,
                token: response.data.data.jwtToken
            });
        } else {
            res.status(401).json({
                success: false,
                error: response.data.message || 'Authentication failed'
            });
        }
    } catch (error) {
        console.error('Login error:', error.message);
        res.status(500).json({
            success: false,
            error: 'Authentication failed'
        });
    }
});

// Handle client WebSocket connections
wss.on('connection', async (ws, req) => {
    console.log('📱 Client attempting to connect...');
    
    // Parse connection parameters
    const params = new URLSearchParams(req.url.split('?')[1]);
    const connectionId = params.get('connectionId');
    const jwtToken = params.get('token');
    
    if (!connectionId || !jwtToken) {
        ws.close(1008, 'Missing authentication');
        return;
    }

    console.log('📱 Client authenticated, setting up connection...');
    clientConnections.set(connectionId, ws);

    // Start Angel One WebSocket connection for this client
    try {
        const angelWs = new WebSocket(`wss://smartapisocket.angelbroking.com/websocket?jwttoken=${jwtToken}`);
        
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
                ]
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
                        // Send update to this specific client
                        ws.send(JSON.stringify({
                            index: indexName,
                            price: livePrices[indexName],
                            timestamp: new Date().toISOString()
                        }));
                    }
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        });

        ws.on('close', () => {
            console.log('📱 Client disconnected');
            clientConnections.delete(connectionId);
            angelWs.close();
        });

    } catch (error) {
        console.error('Error setting up Angel One connection:', error);
        ws.close(1011, 'Failed to connect to Angel One');
    }
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
