const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Test endpoint - FIXED
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'Server is working!',
    message: 'Backend is running correctly',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint - FIXED
app.get('/', (req, res) => {
  res.json({ 
    message: 'Options Trading Backend is running!',
    endpoints: {
      test: '/api/test',
      prices: '/api/prices'
    },
    timestamp: new Date().toISOString()
  });
});

// Mock prices endpoint
app.get('/api/prices', (req, res) => {
  const mockPrices = {
    'NIFTY': '22540.75',
    'BANKNIFTY': '48520.30', 
    'FINNIFTY': '21280.45',
    'SENSEX': '74520.60'
  };
  
  res.json({ 
    success: true,
    prices: mockPrices,
    timestamp: new Date().toISOString()
  });
});

// Handle 404 errors
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: ['/', '/api/test', '/api/prices']
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
