// Simple options data endpoint - return mock data first
app.post('/api/options-data', async (req, res) => {
  try {
    const { apiKey, clientCode, pin, totpSecret } = req.body;

    console.log('📊 Options data request received');
    console.log('Client:', clientCode);
    console.log('API Key present:', !!apiKey);

    if (!apiKey || !clientCode || !pin || !totpSecret) {
      return res.status(400).json({
        success: false,
        message: 'All credentials are required'
      });
    }

    // Return mock data for testing
    const mockData = {
      success: true,
      data: {
        spot_price: 25694.95,
        expiry: "15DEC2024",
        days_to_expiry: 5,
        option_data: [
          {
            strike: 25500,
            ce_live: 150.25,
            ce_fair: 145.80,
            ce_delta: 0.523,
            ce_diff: 4.45,
            pe_live: 95.75,
            pe_fair: 98.20,
            pe_delta: -0.477,
            pe_diff: -2.45
          },
          {
            strike: 25600,
            ce_live: 120.50,
            ce_fair: 115.25,
            ce_delta: 0.456,
            ce_diff: 5.25,
            pe_live: 105.75,
            pe_fair: 110.20,
            pe_delta: -0.544,
            pe_diff: -4.45
          },
          {
            strike: 25700,
            ce_live: 95.25,
            ce_fair: 90.80,
            ce_delta: 0.389,
            ce_diff: 4.45,
            pe_live: 125.50,
            pe_fair: 122.25,
            pe_delta: -0.611,
            pe_diff: 3.25
          }
        ],
        trading_signals: {
          undervalued: [
            {
              strike: 25600,
              ce_live: 120.50,
              ce_fair: 115.25,
              pe_live: 105.75, 
              pe_fair: 110.20
            }
          ],
          overvalued: [
            {
              strike: 25700,
              pe_live: 125.50,
              pe_fair: 122.25
            }
          ]
        },
        timestamp: new Date().toISOString()
      }
    };

    console.log('✅ Returning mock options data');
    res.json(mockData);

  } catch (error) {
    console.log('💥 Options data error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});
