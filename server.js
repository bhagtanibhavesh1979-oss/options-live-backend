// Add this to your server.js - Fix the sessionExpiry issue
app.post('/api/login', async (req, res) => {
  try {
    const { apiKey, clientCode, pin, totpSecret, saveSession } = req.body;

    // Validate input
    if (!apiKey || !clientCode || !pin || !totpSecret) {
      return res.status(400).json({
        success: false,
        message: 'All credentials are required'
      });
    }

    // Create auth instance and login
    const auth = new AngelOneAuth(apiKey, clientCode, pin, totpSecret);
    const loginResult = await auth.login();

    if (loginResult.success) {
      const responseData = {
        success: true,
        message: loginResult.message,
        jwtToken: loginResult.jwtToken
      };

      // Add session expiry if requested
      if (saveSession) {
        const sessionExpiry = getMidnight();
        responseData.sessionExpiry = sessionExpiry.toISOString();
        
        // Store session
        activeSessions.set(loginResult.jwtToken, {
          expiry: sessionExpiry,
          clientCode: clientCode
        });
      }

      console.log('Login successful for client:', clientCode);
      return res.json(responseData);
    } else {
      console.log('Login failed:', loginResult.message);
      return res.status(401).json({
        success: false,
        message: loginResult.message
      });
    }

  } catch (error) {
    console.error('Server login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});
