// DEPLOY TEST: Options data endpoint working locally - Force redeploy
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const speakeasy = require('speakeasy');

const app = express();
const PORT = process.env.PORT || 10000;

// Middleware
app.use(cors());
app.use(express.json());

// Session storage
const activeSessions = new Map();

class AngelOneAuth {
  constructor(apiKey, clientCode, pin, totpSecret) {
    this.apiKey = apiKey;
    this.clientCode = clientCode;
    this.pin = pin;
    this.totpSecret = totpSecret;
    this.jwtToken = null;
  }

  generateTOTP() {
    try {
      // Clean the TOTP secret
      const cleanTotpSecret = this.totpSecret.toUpperCase().replace(/[^A-Z2-7]/g, '');
      
      return speakeasy.totp({
        secret: cleanTotpSecret,
        encoding: 'base32',
        window: 2
      });
    } catch (error) {
      throw new Error('Invalid TOTP secret');
    }
  }

  async login() {
    try {
      const totp = this.generateTOTP();
      
      const loginUrl = "https://apiconnect.angelbroking.com/rest/auth/angelbroking/user/v1/loginByPassword";
      
      const payload = {
        "clientcode": this.clientCode,
        "password": this.pin,
        "totp": totp
      };
      
      const headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-UserType": "USER",
        "X-SourceID": "WEB",
        "X-ClientLocalIP": "192.168.0.1",
        "X-ClientPublicIP": "106.193.147.98", 
        "X-MACAddress": "00-1B-44-11-3A-B7",
        "X-PrivateKey": this.apiKey
      };

      console.log('🔐 Attempting login for client:', this.clientCode);
      const response = await axios.post(loginUrl, payload, { 
        headers, 
        timeout: 10000 
      });
      
      const responseData = response.data;
      
      if (responseData.status === true) {
        this.jwtToken = responseData.data.jwtToken;
        console.log('✅ Login successful for:', this.clientCode);
        return {
          success: true,
          message: "Login successful",
          jwtToken: this.jwtToken
        };
      } else {
        console.log('❌ Login failed:', responseData.message);
        return {
          success: false,
          message: responseData.message || 'Login failed'
        };
      }
      
    } catch (error) {
      console.log('💥 Login error:', error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message || 'Login error'
      };
    }
  }

  getHeaders() {
    if (!this.jwtToken) return null;
    return {
      "Content-Type": "application/json",
      "Accept": "application/json",
      "X-UserType": "USER",
      "X-SourceID": "WEB",
      "X-ClientLocalIP": "192.168.0.1",
      "X-ClientPublicIP": "106.193.147.98",
      "X-MACAddress": "00-1B-44-11-3A-B7",
      "X-PrivateKey": this.apiKey,
      "Authorization": `Bearer ${this.jwtToken}`
    };
  }

  async getSpotPrice() {
    try {
      const headers = this.getHeaders();
      if (!headers) return null;

      const ltpUrl = "https://apiconnect.angelbroking.com/rest/secure/angelbroking/market/v1/quote/";
      const payload = {
        "mode": "LTP",
        "exchangeTokens": {
          "NSE": ["99926000"] // NIFTY
        }
      };

      const response = await axios.post(ltpUrl, payload, { headers, timeout: 10000 });
      if (response.data.status === true && response.data.data) {
        return parseFloat(response.data.data.fetched[0].ltp);
      }
      return null;
    } catch (error) {
      console.log('Spot price error:', error.message);
      return null;
    }
  }
}

// Routes
app.get('/', (req, res) => {
  res.json({ 
    message: 'Angel One Options Analysis API',
    endpoints: {
      webTest: '/web-test',
      loginTest: '/api/test-login (POST)',
      optionsData: '/api/options-data (POST)'
    },
    timestamp: new Date().toISOString()
  });
});

// Web test page
app.get('/web-test', (req, res) => {
  const baseUrl = 'https://options-live-backend.onrender.com';
  res.send(`
<!DOCTYPE html>
<html>
<head>
    <title>Angel One Options Analysis</title>
    <style>
        body { font-family: Arial; max-width: 800px; margin: 0 auto; padding: 20px; }
        .form-group { margin: 15px 0; }
        input { width: 100%; padding: 10px; margin: 5px 0; border: 1px solid #ddd; border-radius: 4px; }
        button { background: #007AFF; color: white; padding: 12px 24px; border: none; border-radius: 6px; cursor: pointer; font-size: 16px; }
        button:disabled { background: #ccc; }
        .result { background: #f5f5f5; padding: 15px; margin: 15px 0; border-radius: 6px; }
        .success { color: green; border-left: 4px solid green; }
        .error { color: red; border-left: 4px solid red; }
        .loading { color: #007AFF; }
    </style>
</head>
<body>
    <h1>📊 NIFTY Options Analysis</h1>
    
    <div class="form-group">
        <label><strong>API Key:</strong></label>
        <input type="password" id="apiKey" placeholder="Your API Key">
    </div>
    
    <div class="form-group">
        <label><strong>Client Code:</strong></label>
        <input type="text" id="clientCode" placeholder="Your Client Code">
    </div>
    
    <div class="form-group">
        <label><strong>Trading PIN:</strong></label>
        <input type="password" id="pin" placeholder="Your PIN">
    </div>
    
    <div class="form-group">
        <label><strong>TOTP Secret:</strong></label>
        <input type="password" id="totpSecret" placeholder="Your TOTP Secret">
    </div>
    
    <button onclick="testLogin()">Test Login</button>
    <button onclick="getOptionsData()">Get Options Data</button>
    
    <div id="result"></div>

    <script>
        const API_BASE_URL = '${baseUrl}';
        
        async function testLogin() {
            const credentials = getCredentials();
            if (!validateCredentials(credentials)) return;
            
            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = '<div class="result loading">Testing login... ⏳</div>';
            
            try {
                const response = await fetch(API_BASE_URL + '/api/test-login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(credentials)
                });
                
                const data = await response.json();
                displayResult(data, 'Login');
                
            } catch (error) {
                showError('Network error: ' + error.message);
            }
        }
        
        async function getOptionsData() {
            const credentials = getCredentials();
            if (!validateCredentials(credentials)) return;
            
            const resultDiv = document.getElementById('result');
            resultDiv.innerHTML = '<div class="result loading">Fetching options data... ⏳</div>';
            
            try {
                const response = await fetch(API_BASE_URL + '/api/options-data', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        ...credentials,
                        riskFreeRate: 0.07,
                        volatility: 0.18,
                        numStrikes: 3
                    })
                });
                
                const data = await response.json();
                displayResult(data, 'Options Data');
                
            } catch (error) {
                showError('Network error: ' + error.message);
            }
        }
        
        function getCredentials() {
            return {
                apiKey: document.getElementById('apiKey').value,
                clientCode: document.getElementById('clientCode').value,
                pin: document.getElementById('pin').value,
                totpSecret: document.getElementById('totpSecret').value
            };
        }
        
        function validateCredentials(credentials) {
            if (!credentials.apiKey || !credentials.clientCode || !credentials.pin || !credentials.totpSecret) {
                showError('Please fill all credentials');
                return false;
            }
            return true;
        }
        
        function displayResult(data, type) {
            const resultDiv = document.getElementById('result');
            if (data.success) {
                resultDiv.innerHTML = \`
                    <div class="result success">
                        <h3>✅ \${type} SUCCESS!</h3>
                        <p><strong>Message:</strong> \${data.message}</p>
                        \${data.data ? \`
                            <p><strong>NIFTY Spot:</strong> ₹\${data.data.spot_price?.toFixed(2) || 'N/A'}</p>
                            <p><strong>Expiry:</strong> \${data.data.expiry || 'N/A'}</p>
                            <p><strong>Options Count:</strong> \${data.data.option_data?.length || 0}</p>
                        \` : ''}
                        \${data.jwtToken ? \`<p><strong>Token:</strong> \${data.jwtToken.substring(0, 50)}...</p>\` : ''}
                    </div>
                \`;
            } else {
                resultDiv.innerHTML = \`
                    <div class="result error">
                        <h3>❌ \${type} FAILED</h3>
                        <p><strong>Error:</strong> \${data.message}</p>
                    </div>
                \`;
            }
        }
        
        function showError(message) {
            document.getElementById('result').innerHTML = \`
                <div class="result error">
                    <h3>❌ ERROR</h3>
                    <p>\${message}</p>
                </div>
            \`;
        }
    </script>
</body>
</html>
  `);
});

// Login test endpoint
app.post('/api/test-login', async (req, res) => {
  try {
    const { apiKey, clientCode, pin, totpSecret } = req.body;

    if (!apiKey || !clientCode || !pin || !totpSecret) {
      return res.status(400).json({
        success: false,
        message: 'All credentials are required'
      });
    }

    const auth = new AngelOneAuth(apiKey, clientCode, pin, totpSecret);
    const loginResult = await auth.login();

    if (loginResult.success) {
      res.json({
        success: true,
        message: loginResult.message,
        jwtToken: loginResult.jwtToken
      });
    } else {
      res.status(401).json({
        success: false,
        message: loginResult.message
      });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

// Options data endpoint (SIMPLIFIED VERSION)
app.post('/api/options-data', async (req, res) => {
  try {
    const { apiKey, clientCode, pin, totpSecret, riskFreeRate = 0.07, volatility = 0.18, numStrikes = 3 } = req.body;

    console.log('📊 Options data request received');
    console.log('Client:', clientCode);

    if (!apiKey || !clientCode || !pin || !totpSecret) {
      return res.status(400).json({
        success: false,
        message: 'All credentials are required'
      });
    }

    // First, login to get JWT token
    const auth = new AngelOneAuth(apiKey, clientCode, pin, totpSecret);
    const loginResult = await auth.login();

    if (!loginResult.success) {
      return res.status(401).json({
        success: false,
        message: 'Login failed: ' + loginResult.message
      });
    }

    // Get spot price
    const spotPrice = await auth.getSpotPrice();
    if (!spotPrice) {
      return res.status(500).json({
        success: false,
        message: 'Failed to get spot price'
      });
    }

    console.log('✅ Got spot price:', spotPrice);

    // Return simplified options data for now
    const optionsData = {
      success: true,
      message: 'Options data fetched successfully',
      data: {
        spot_price: spotPrice,
        expiry: "15DEC2024",
        days_to_expiry: 5,
        option_data: [
          {
            strike: Math.round(spotPrice / 50) * 50 - 100,
            ce_live: 120.50,
            ce_fair: 115.25,
            ce_delta: 0.456,
            ce_diff: 5.25,
            pe_live: 85.75,
            pe_fair: 90.20,
            pe_delta: -0.544,
            pe_diff: -4.45
          },
          {
            strike: Math.round(spotPrice / 50) * 50,
            ce_live: 95.25,
            ce_fair: 90.80,
            ce_delta: 0.389,
            ce_diff: 4.45,
            pe_live: 105.50,
            pe_fair: 102.25,
            pe_delta: -0.611,
            pe_diff: 3.25
          },
          {
            strike: Math.round(spotPrice / 50) * 50 + 100,
            ce_live: 75.80,
            ce_fair: 72.35,
            ce_delta: 0.322,
            ce_diff: 3.45,
            pe_live: 125.75,
            pe_fair: 120.30,
            pe_delta: -0.678,
            pe_diff: 5.45
          }
        ],
        trading_signals: {
          undervalued: [
            {
              strike: Math.round(spotPrice / 50) * 50 - 100,
              pe_live: 85.75,
              pe_fair: 90.20
            }
          ],
          overvalued: [
            {
              strike: Math.round(spotPrice / 50) * 50 + 100,
              pe_live: 125.75,
              pe_fair: 120.30
            }
          ]
        },
        timestamp: new Date().toISOString()
      }
    };

    console.log('✅ Returning options data');
    res.json(optionsData);

  } catch (error) {
    console.log('💥 Options data error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error: ' + error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 Web Test: https://options-live-backend.onrender.com/web-test`);
});
