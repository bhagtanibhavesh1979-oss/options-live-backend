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
      return speakeasy.totp({
        secret: this.totpSecret,
        encoding: 'base32'
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

  async getMarketData(jwtToken) {
    try {
      const headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "X-UserType": "USER",
        "X-SourceID": "WEB",
        "X-ClientLocalIP": "192.168.0.1",
        "X-ClientPublicIP": "106.193.147.98",
        "X-MACAddress": "00-1B-44-11-3A-B7",
        "X-PrivateKey": this.apiKey,
        "Authorization": `Bearer ${jwtToken}`
      };

      const ltpUrl = "https://apiconnect.angelbroking.com/rest/secure/angelbroking/market/v1/quote/";
      const payload = {
        "mode": "LTP",
        "exchangeTokens": {
          "NSE": ["99926000"] // NIFTY 50
        }
      };

      const response = await axios.post(ltpUrl, payload, { headers, timeout: 10000 });
      
      if (response.data.status === true) {
        return {
          success: true,
          spotPrice: response.data.data.fetched[0]?.ltp,
          data: response.data
        };
      } else {
        return {
          success: false,
          error: response.data.message
        };
      }

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

function getMidnight() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
}

// ==================== ROUTES ====================

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Angel One API Server is running!',
    endpoints: {
      webTest: '/web-test',
      apiTest: '/api/test',
      loginTest: '/api/test-login (POST)',
      marketData: '/api/market-data (GET)'
    },
    timestamp: new Date().toISOString()
  });
});

// Simple test endpoint
app.get('/api/test', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'API is working!',
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
    <title>Angel One API Test</title>
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
        code { background: #eee; padding: 2px 4px; border-radius: 3px; }
    </style>
</head>
<body>
    <h1>🔐 Angel One API Test</h1>
    <p>Test your Angel One credentials and market data connection</p>
    
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
    
    <button id="testBtn" onclick="testLogin()">Test Login & Market Data</button>
    
    <div id="result"></div>

    <script>
        const API_BASE_URL = '${baseUrl}';
        
        async function testLogin() {
            const apiKey = document.getElementById('apiKey').value;
            const clientCode = document.getElementById('clientCode').value;
            const pin = document.getElementById('pin').value;
            const totpSecret = document.getElementById('totpSecret').value;
            
            const testBtn = document.getElementById('testBtn');
            const resultDiv = document.getElementById('result');
            
            // Validation
            if (!apiKey || !clientCode || !pin || !totpSecret) {
                resultDiv.innerHTML = '<div class="result error">Please fill all fields</div>';
                return;
            }
            
            testBtn.disabled = true;
            testBtn.textContent = 'Testing...';
            resultDiv.innerHTML = '<div class="result loading">Testing connection to Angel One... ⏳</div>';
            
            try {
                const response = await fetch(API_BASE_URL + '/api/test-login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        apiKey,
                        clientCode, 
                        pin,
                        totpSecret
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    resultDiv.innerHTML = \`
                        <div class="result success">
                            <h3>✅ SUCCESS!</h3>
                            <p><strong>Login:</strong> \${data.message}</p>
                            \${data.marketData && data.marketData.spotPrice ? 
                                \`<p><strong>NIFTY Spot Price:</strong> ₹\${data.marketData.spotPrice}</p>\` : 
                                \`<p><strong>Market Data:</strong> \${data.marketData?.message || 'Not available'}</p>\`
                            }
                            <p><strong>Token:</strong> <code>\${data.jwtToken?.substring(0, 50)}...</code></p>
                            <p><em>Your credentials are working correctly! 🎉</em></p>
                        </div>
                    \`;
                } else {
                    resultDiv.innerHTML = \`
                        <div class="result error">
                            <h3>❌ LOGIN FAILED</h3>
                            <p><strong>Error:</strong> \${data.message}</p>
                            <p><em>Check your credentials and try again</em></p>
                        </div>
                    \`;
                }
                
            } catch (error) {
                resultDiv.innerHTML = \`
                    <div class="result error">
                        <h3>❌ NETWORK ERROR</h3>
                        <p><strong>Error:</strong> \${error.message}</p>
                        <p><em>Check if your Render service is running</em></p>
                        <p><strong>Debug Info:</strong></p>
                        <ul>
                            <li>API URL: \${API_BASE_URL + '/api/test-login'}</li>
                            <li>Status: \${error.status || 'Unknown'}</li>
                        </ul>
                    </div>
                \`;
            } finally {
                testBtn.disabled = false;
                testBtn.textContent = 'Test Login & Market Data';
            }
        }
        
        // Allow Enter key to submit
        document.addEventListener('keypress', function(event) {
            if (event.key === 'Enter') {
                testLogin();
            }
        });
        
        console.log('Web test loaded. API Base URL:', API_BASE_URL);
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
      // Get market data
      const marketData = await auth.getMarketData(loginResult.jwtToken);
      
      res.json({
        success: true,
        message: loginResult.message,
        jwtToken: loginResult.jwtToken,
        marketData: marketData.success ? {
          spotPrice: marketData.spotPrice,
          message: 'Market data fetched successfully'
        } : { 
          message: marketData.error,
          spotPrice: null
        }
      });
    } else {
      res.status(401).json({
        success: false,
        message: loginResult.message
      });
    }

  } catch (error) {
    console.error('Server login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error: ' + error.message
    });
  }
});

// Market data endpoint (protected)
app.get('/api/market-data', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }

    // Check if session is valid
    const session = activeSessions.get(token);
    if (!session || new Date() > session.expiry) {
      activeSessions.delete(token);
      return res.status(401).json({ error: 'Session expired' });
    }

    // Mock market data for testing
    res.json({
      spotPrice: 19500,
      expiry: "15DEC2024",
      daysToExpiry: 5,
      message: "Market data fetched successfully"
    });

  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch market data' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📍 Local: http://localhost:${PORT}`);
  console.log(`📍 Web Test: https://options-live-backend.onrender.com/web-test`);
});
