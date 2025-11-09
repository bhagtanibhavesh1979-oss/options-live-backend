const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

const ANGEL_ONE_SCRIP_MASTER_URL = 'https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json';

app.get('/api/prices', async (req, res) => {
  try {
    console.log('📡 Fetching real prices from Angel One...');
    const response = await axios.get(ANGEL_ONE_SCRIP_MASTER_URL);
    const scriptData = response.data;

    // Find real index data from Angel One API
    const findIndexPrice = (name, exch) => {
      const item = scriptData.find(script => 
        script.name === name && script.exch_seg === exch
      );
      return item ? parseFloat(item.prev_close).toFixed(2) : null;
    };

    // Get REAL prices from Angel One API
    const prices = {
      'NIFTY': findIndexPrice('NIFTY', 'NSE'),
      'BANKNIFTY': findIndexPrice('BANKNIFTY', 'NSE'),
      'FINNIFTY': findIndexPrice('FINNIFTY', 'NSE'),
      'SENSEX': findIndexPrice('SENSEX', 'BSE')
    };

    console.log('✅ Real prices fetched:', prices);

    res.json({
      success: true,
      prices: prices,
      source: 'Angel One Live API',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to fetch real prices:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch real prices from Angel One',
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'SUCCESS', 
    message: 'Backend with REAL Angel One data',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.json({ 
    message: '✅ Options Trading - Real Angel One Data',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log('📡 Ready to fetch REAL prices from Angel One');
});
