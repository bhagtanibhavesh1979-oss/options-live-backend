const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();

app.use(cors());
app.use(express.json());

const ANGEL_ONE_SCRIP_MASTER_URL = 'https://margincalculator.angelone.in/OpenAPI_File/files/OpenAPIScripMaster.json';

let scriptMasterData = null;
let lastFetchTime = null;

async function fetchScriptMasterData() {
  try {
    const response = await axios.get(ANGEL_ONE_SCRIP_MASTER_URL);
    scriptMasterData = response.data;
    lastFetchTime = Date.now();
    console.log('✅ Script master data fetched successfully');
    return scriptMasterData;
  } catch (error) {
    console.error('❌ Failed to fetch script master data:', error.message);
    throw error;
  }
}

// Get real previous close prices from Angel One API
app.get('/api/prices', async (req, res) => {
  try {
    // Always fetch fresh data
    await fetchScriptMasterData();

    // Find the actual index data from Angel One
    const nifty = scriptMasterData.find(item => 
      item.name === 'NIFTY' && item.exch_seg === 'NSE'
    );
    
    const banknifty = scriptMasterData.find(item => 
      item.name === 'BANKNIFTY' && item.exch_seg === 'NSE'
    );
    
    const finnifty = scriptMasterData.find(item => 
      item.name === 'FINNIFTY' && item.exch_seg === 'NSE'
    );
    
    const sensex = scriptMasterData.find(item => 
      item.name === 'SENSEX' && item.exch_seg === 'BSE'
    );

    // Use ACTUAL previous close prices from Angel One
    const prices = {
      'NIFTY': nifty ? parseFloat(nifty.prev_close).toFixed(2) : '0',
      'BANKNIFTY': banknifty ? parseFloat(banknifty.prev_close).toFixed(2) : '0',
      'FINNIFTY': finnifty ? parseFloat(finnifty.prev_close).toFixed(2) : '0',
      'SENSEX': sensex ? parseFloat(sensex.prev_close).toFixed(2) : '0'
    };

    res.json({
      success: true,
      prices: prices,
      source: 'Angel One Previous Close Prices',
      timestamp: new Date().toISOString(),
      dataSource: 'Real API Data'
    });

  } catch (error) {
    console.error('Error fetching real prices:', error);
    
    res.json({
      success: false,
      prices: {
        'NIFTY': '0',
        'BANKNIFTY': '0', 
        'FINNIFTY': '0',
        'SENSEX': '0'
      },
      source: 'API Failed',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'SUCCESS',
    message: 'Server with REAL Angel One data',
    timestamp: new Date().toISOString()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: '✅ Options Trading - Real Angel One Data',
    timestamp: new Date().toISOString(),
    endpoints: ['/', '/api/test', '/api/prices']
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log('📡 Fetching real data from Angel One API');
});
