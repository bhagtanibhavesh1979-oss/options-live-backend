const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const cors = require('cors');

const app = express();
const server = http.createServer(app);

// CORS for mobile app
app.use(cors());
app.use(express.json());

// Store active connections
const mobileConnections = new Map();

// WebSocket server for mobile clients
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
  console.log('Mobile app connected');
  
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.action === 'authenticate') {
        handleAuthentication(ws, data.credentials);
      }
      
    } catch (error) {
      console.error('Error parsing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Invalid message format'
      }));
    }
  });
  
  ws.on('close', () => {
    console.log('Mobile app disconnected');
    // Remove from active connections
    for (let [key, value] of mobileConnections.entries()) {
      if (value === ws) {
        mobileConnections.delete(key);
        break;
      }
    }
  });
});

// Handle authentication and start streaming
async function handleAuthentication(ws, credentials) {
  try {
    console.log('Authenticating with credentials for:', credentials.client_code);
    
    // Simulate authentication (replace with actual Angel One API call)
    // For now, we'll accept any credentials and start streaming demo data
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Store connection
    mobileConnections.set(credentials.client_code, ws);
    
    // Send success to mobile app
    ws.send(JSON.stringify({
      type: 'auth_success',
      message: 'Authentication successful - Starting live stream'
    }));
    
    // Start streaming live data
    startLiveStreaming(ws);
    
  } catch (error) {
    console.error('Auth error:', error);
    ws.send(JSON.stringify({
      type: 'auth_error',
      message: 'Authentication failed: ' + error.message
    }));
  }
}

// Start streaming live option data
function startLiveStreaming(ws) {
  console.log('Starting live stream...');
  
  const streamInterval = setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      const liveData = generateLiveOptionData();
      ws.send(JSON.stringify({
        type: 'live_data',
        data: liveData,
        timestamp: new Date().toISOString()
      }));
    } else {
      clearInterval(streamInterval);
    }
  }, 2000); // Update every 2 seconds
  
  // Cleanup on close
  ws.on('close', () => {
    clearInterval(streamInterval);
    console.log('Live stream stopped');
  });
}

// Generate realistic live option data
function generateLiveOptionData() {
  const indices = ['NIFTY', 'BANKNIFTY'];
  const data = {};
  
  // Base prices with slight random movement
  const niftyBase = 22150 + (Math.random() - 0.5) * 50;
  const bankniftyBase = 47250 + (Math.random() - 0.5) * 100;
  
  indices.forEach(index => {
    const spotPrice = index === 'NIFTY' ? niftyBase : bankniftyBase;
    
    data[index] = {
      spot: spotPrice.toFixed(2),
      option_chain: generateOptionChain(spotPrice, index),
      timestamp: new Date().toISOString()
    };
  });
  
  return data;
}

function generateOptionChain(spotPrice, index) {
  const chain = [];
  const step = index === 'NIFTY' ? 100 : 500;
  const startStrike = Math.floor((spotPrice - 300) / step) * step;
  
  for (let i = 0; i < 5; i++) {
    const strike = startStrike + (i * step);
    const distance = Math.abs(spotPrice - strike);
    const basePremium = Math.max(50, 400 - (distance * 0.5));
    
    // Add some random movement to premiums
    const callPremium = basePremium * (0.9 + Math.random() * 0.2);
    const putPremium = basePremium * (0.9 + Math.random() * 0.2);
    
    chain.push({
      strike: strike,
      call: {
        ltp: (callPremium + (Math.random() - 0.5) * 10).toFixed(2),
        fair_value: (callPremium * 1.05).toFixed(2),
        delta: (0.3 + Math.random() * 0.5).toFixed(3)
      },
      put: {
        ltp: (putPremium + (Math.random() - 0.5) * 10).toFixed(2),
        fair_value: (putPremium * 1.05).toFixed(2),
        delta: (-0.3 - Math.random() * 0.5).toFixed(3)
      }
    });
  }
  
  return chain;
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    connected_clients: mobileConnections.size,
    timestamp: new Date().toISOString(),
    service: 'Angel One Live Streaming Backend'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Options Live Streaming Backend is running!',
    endpoints: {
      health: '/health',
      websocket: 'ws://your-backend.onrender.com'
    },
    status: 'active'
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`✅ Backend server running on port ${PORT}`);
  console.log(`📡 WebSocket server ready for connections`);
  console.log(`🌐 Health check available at http://localhost:${PORT}/health`);
});
