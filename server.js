const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Root endpoint - SIMPLE TEST
app.get('/', (req, res) => {
  res.send('Backend is working!');
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
    NIFTY: '22540.75',
    BANKNIFTY: '48520.30', 
    FINNIFTY: '21280.45'
  });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
