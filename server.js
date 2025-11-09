const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// Angel One API proxy - to avoid CORS issues on mobile
app.post('/api/get-price', async (req, res) => {
  try {
    const { symbol, authToken } = req.body;
    
    const response = await fetch('https://apiconnect.angelbroking.com/rest/secure/angelbroking/market/v1/quote/', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: "FULL",
        exchange: "NSE",
        tradingSymbol: symbol,
        symbolToken: getSymbolToken(symbol)
      })
    });
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

function getSymbolToken(symbol) {
  const tokens = {
    'NIFTY': '99926000',
    'BANKNIFTY': '99926009', 
    'FINNIFTY': '99926037'
  };
  return tokens[symbol] || '99926000';
}

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
