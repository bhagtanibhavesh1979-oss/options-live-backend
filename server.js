const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

const ANGEL_ONE_SCRIP_MASTER_URL = 'https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json';

app.get('/api/prices', async (req, res) => {
  try {
    console.log('📡 Fetching REAL prices from Angel One API...');
    const response = await axios.get(ANGEL_ONE_SCRIP_MASTER_URL);
    const scriptData = response.data;

    // Find REAL prices from Angel One API only
    const findPrice = (name, exch) => {
      const item = scriptData.find(script => 
        script.name === name && script.exch_seg === exch
      );
      if (!item || !item.prev_close) {
        throw new Error(`Price not found for ${name}`);
      }
      return parseFloat(item.prev_close).toFixed(2);
    };

    // Get ONLY real prices from Angel One API
    const prices = {
      'NIFTY': findPrice('NIFTY', 'NSE'),
      'BANKNIFTY': findPrice('BANKNIFTY', 'NSE'),
      'FINNIFTY': findPrice('FINNIFTY', 'NSE'),
      'SENSEX': findPrice('SENSEX', 'BSE')
    };

    console.log('✅ REAL prices fetched:', prices);

    res.json({
      success: true,
      prices: prices,
      source: 'Angel One Live API - Real Data',
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Failed to fetch real prices:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch real prices from Angel One API',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

app.get('/', (req, res) => {
  res.json({ 
    message: '✅ Options Trading - REAL Angel One Data Only',
    timestamp: new Date().toISOString()
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log('📡 Fetching ONLY REAL data from: https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json');
});
