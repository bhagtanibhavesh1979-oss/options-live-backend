const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: '✅ Backend is working!',
    service: 'Options Trading Backend',
    timestamp: new Date().toISOString(),
    endpoints: [
      '/api/test',
      '/api/prices'
    ]
  });
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'SUCCESS',
    message: 'Server is working correctly',
    timestamp: new Date().toISOString()
  });
});

// Mock prices endpoint
app.get('/api/prices', (req, res) => {
  res.json({
    success: true,
    prices: {
      NIFTY: '22540.75',
      BANKNIFTY: '48520.30', 
      FINNIFTY: '21280.45',
      SENSEX: '74520.60'
    },
    timestamp: new Date().toISOString()
  });
});

// Health check for Render
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Use Render's port or default
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
});
