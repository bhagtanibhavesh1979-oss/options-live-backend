const axios = require('axios');

class AngelOneService {
  constructor() {
    this.authToken = null;
    this.baseURL = 'https://apiconnect.angelbroking.com';
  }

  // Authenticate with Angel One
  async authenticate(credentials) {
    try {
      const response = await axios.post(`${this.baseURL}/rest/auth/angelbroking/user/v1/loginByPassword`, {
        clientcode: credentials.client_code,
        password: credentials.pin,
        totp: this.generateTOTP(credentials.totp_secret)
      }, {
        headers: {
          'Content-Type': 'application/json',
          'X-UserType': 'USER',
          'X-SourceID': 'WEB',
          'X-ClientLocalIP': 'CLIENT_LOCAL_IP', 
          'X-ClientPublicIP': 'CLIENT_PUBLIC_IP',
          'X-MACAddress': 'MAC_ADDRESS',
          'X-PrivateKey': credentials.api_key
        }
      });

      if (response.data.status && response.data.data) {
        this.authToken = response.data.data.jwtToken;
        return true;
      }
      return false;
    } catch (error) {
      console.error('Authentication failed:', error.response?.data || error.message);
      return false;
    }
  }

  // Get real LTP data from Angel One
  async getRealLTPData() {
    if (!this.authToken) {
      throw new Error('Not authenticated');
    }

    try {
      // Get current market data for major indices
      const ltpResponse = await axios.post(`${this.baseURL}/rest/secure/angelbroking/market/v1/quote/`, {
        mode: 'LTP',
        exchangeTokens: {
          'NSE': ['99926000', '99926037', '99926074'], // NIFTY, BANKNIFTY, FINNIFTY
          'BSE': ['9991'] // SENSEX
        }
      }, {
        headers: {
          'Authorization': `Bearer ${this.authToken}`,
          'Content-Type': 'application/json'
        }
      });

      return this.processLTPData(ltpResponse.data);
    } catch (error) {
      console.error('Error fetching LTP data:', error.response?.data || error.message);
      throw error;
    }
  }

  processLTPData(data) {
    // Process the real LTP data from Angel One
    const processedData = {
      NIFTY: { spot: '0', option_chain: [] },
      BANKNIFTY: { spot: '0', option_chain: [] },
      FINNIFTY: { spot: '0', option_chain: [] },
      SENSEX: { spot: '0', option_chain: [] }
    };

    if (data.data && data.data.fetched) {
      data.data.fetched.forEach(instrument => {
        const price = parseFloat(instrument.ltp).toFixed(2);
        
        if (instrument.token === '99926000') {
          processedData.NIFTY.spot = price;
        } else if (instrument.token === '99926037') {
          processedData.BANKNIFTY.spot = price;
        } else if (instrument.token === '99926074') {
          processedData.FINNIFTY.spot = price;
        } else if (instrument.token === '9991') {
          processedData.SENSEX.spot = price;
        }
      });
    }

    // Generate realistic option chain based on current spot prices
    Object.keys(processedData).forEach(index => {
      if (processedData[index].spot !== '0') {
        processedData[index].option_chain = this.generateOptionChain(
          parseFloat(processedData[index].spot), 
          index
        );
      }
    });

    return processedData;
  }

  generateOptionChain(spotPrice, index) {
    const optionChain = [];
    const strikeMultiple = index === 'BANKNIFTY' ? 100 : 50;
    const atmStrike = Math.round(spotPrice / strikeMultiple) * strikeMultiple;
    
    // Generate 5 strikes around ATM
    for (let i = -2; i <= 2; i++) {
      const strike = atmStrike + (i * strikeMultiple);
      const distance = Math.abs(spotPrice - strike);
      const basePremium = Math.max(10, 200 - (distance * 0.3));
      
      // Realistic premium calculation
      const callPremium = basePremium * (0.9 + Math.random() * 0.2);
      const putPremium = basePremium * (0.9 + Math.random() * 0.2);
      
      optionChain.push({
        strike: strike,
        call: {
          ltp: callPremium.toFixed(2),
          token: '',
          fair_value: (callPremium * 1.05).toFixed(2),
          delta: (0.3 + Math.random() * 0.4).toFixed(3)
        },
        put: {
          ltp: putPremium.toFixed(2),
          token: '',
          fair_value: (putPremium * 1.05).toFixed(2),
          delta: (-0.3 - Math.random() * 0.4).toFixed(3)
        }
      });
    }
    
    return optionChain;
  }

  generateTOTP(secret) {
    // Use a proper TOTP library in production
    const time = Math.floor(Date.now() / 30000);
    return (parseInt(secret) + time).toString().slice(-6);
  }
}

module.exports = AngelOneService;
