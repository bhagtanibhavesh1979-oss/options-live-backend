const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'Server is working!',
    message: 'Backend is running correctly'
  });
});

// Mock prices endpoint for testing
app.get('/api/prices', (req, res) => {
  const mockPrices = {
    'NIFTY': '22540.75',
    'BANKNIFTY': '48520.30', 
    'FINNIFTY': '21280.45',
    'SENSEX': '74520.60'
  };
  
  res.json({ prices: mockPrices });
});

// Health check
app.get('/', (req, res) => {
  res.json({ 
    message: 'Options Trading Backend is running!',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
