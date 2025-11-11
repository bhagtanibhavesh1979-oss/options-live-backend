// Serve the web test page - UPDATED VERSION
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
