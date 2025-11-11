// Client requests connection (with expiry/numStrikes/etc)
app.post('/api/connect', async (req, res) => {
  const { api_key, client_code, pin, totp } = req.body;
  
  console.log('📥 Received login request:', req.body);
  
  if (!api_key || !client_code || !pin || !totp) {
    console.log('❌ Missing fields detected');
    return res.json({ success: false, error: "Missing fields" });
  }

  try {
    console.log('🔐 Attempting Angel One login...');
    
    // Dummy values for testing - you can make these configurable later
    const symbol = "NIFTY";
    const expiry = "2024-DEC"; // You might want to make this dynamic
    const numStrikes = 3;
    
    // Get spot price or use default
    const spotPrice = livePrices[symbol] ? Number(livePrices[symbol]) : (symbol === 'NIFTY' ? 23500 : 50000);
    
    // Fetch option tokens
    const tokens = await fetchOptionTokens(symbol, expiry, spotPrice, numStrikes, api_key);
    
    // Login to Angel One
    const jwtToken = await loginAngelOne(client_code, pin, totp, api_key);
    
    const connectionId = Math.random().toString(36).substring(7);
    
    // Store session
    clientConnections.set(connectionId, { symbol, expiry, numStrikes, tokens, jwtToken });
    
    console.log('✅ Login successful for client:', client_code);
    
    res.json({ 
      success: true, 
      connectionId, 
      token: jwtToken, 
      tokens,
      message: "Connected to Angel One successfully"
    });
    
  } catch (e) {
    console.error('❌ Login error:', e.toString());
    res.status(500).json({ success: false, error: e.toString() });
  }
});
