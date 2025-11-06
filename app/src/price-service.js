// Price Service - Dynamic Token Price to USDC Conversion
// Uses Helius API for optimized data retrieval + Jupiter for price

class PriceService {
    constructor() {
        // Helius API key - set via environment variable or default
        this.heliusApiKey = process.env.HELIUS_API_KEY || '431ca765-2f35-4b23-8abd-db03796bd85f';
        this.heliusRpcUrl = this.heliusApiKey 
            ? `https://rpc.helius.xyz/?api-key=${this.heliusApiKey}`
            : null;
        this.jupiterPriceApi = 'https://price.jup.ag/v4/price';
        this.tokenMint = null; // Will be set from contract
        this.usdcMint = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'; // USDC on Solana
        this.priceCache = { price: 0, timestamp: 0, ttl: 30000 }; // 30s cache
    }

    /**
     * Initialize with token mint address
     */
    setTokenMint(mintAddress) {
        this.tokenMint = mintAddress;
        console.log('✅ Price service initialized for token:', mintAddress);
    }

    /**
     * Get token price in USDC using Jupiter Price API
     */
    async getTokenPriceInUSDC() {
        try {
            // Check cache first
            const now = Date.now();
            if (this.priceCache.timestamp > 0 && (now - this.priceCache.timestamp) < this.priceCache.ttl) {
                return this.priceCache.price;
            }

            if (!this.tokenMint) {
                throw new Error('Token mint not set. Call setTokenMint() first.');
            }

            // Fetch price from Jupiter
            const response = await fetch(`${this.jupiterPriceApi}?ids=${this.tokenMint}`);
            const data = await response.json();
            
            if (data.data && data.data[this.tokenMint]) {
                const priceData = data.data[this.tokenMint];
                // Jupiter returns price in USD (not USDC, but close enough for our use)
                const price = parseFloat(priceData.price || 0);
                
                // Update cache
                this.priceCache = {
                    price,
                    timestamp: now,
                    ttl: 30000
                };
                
                console.log(`💰 Token price: $${price.toFixed(6)}`);
                return price;
            }
            
            throw new Error('Price data not found');
        } catch (error) {
            console.error('❌ Error fetching token price:', error);
            // Fallback to default price for testing
            return 0.000004; // Default pump.fun starting price
        }
    }

    /**
     * Calculate USD value of token amount
     */
    async calculateUSDValue(tokenAmount, decimals = 9) {
        const price = await this.getTokenPriceInUSDC();
        const tokenAmountFloat = parseFloat(tokenAmount) / Math.pow(10, decimals);
        return tokenAmountFloat * price;
    }

    /**
     * Calculate token amount needed for USD value
     */
    async calculateTokenAmountForUSD(usdValue, decimals = 9) {
        const price = await this.getTokenPriceInUSDC();
        if (price === 0) {
            throw new Error('Price is zero - cannot calculate');
        }
        const tokenAmountFloat = usdValue / price;
        return Math.ceil(tokenAmountFloat * Math.pow(10, decimals));
    }

    /**
     * Get minimum tokens required for $20 USD entry (dynamic)
     */
    async getMinimumTokensForEntry() {
        const minUSD = 20.00;
        try {
            const tokens = await this.calculateTokenAmountForUSD(minUSD);
            return tokens;
        } catch (error) {
            console.error('Error calculating minimum tokens:', error);
            // Fallback: assume $0.000004 per token = 5M tokens for $20
            return 5000000 * Math.pow(10, 9);
        }
    }

    /**
     * Use Helius API for enhanced data retrieval
     */
    async getTokenAccountData(accountAddress) {
        if (!this.heliusRpcUrl) {
            console.warn('⚠️ Helius API key not set - using standard RPC');
            return null;
        }

        try {
            const response = await fetch(this.heliusRpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getAccountInfo',
                    params: [
                        accountAddress,
                        { encoding: 'jsonParsed' }
                    ]
                })
            });

            const data = await response.json();
            return data.result;
        } catch (error) {
            console.error('❌ Helius API error:', error);
            return null;
        }
    }

    /**
     * Get enhanced transaction data via Helius
     */
    async getTransactionData(signature) {
        if (!this.heliusRpcUrl) {
            return null;
        }

        try {
            const response = await fetch(this.heliusRpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'getTransaction',
                    params: [
                        signature,
                        { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 }
                    ]
                })
            });

            const data = await response.json();
            return data.result;
        } catch (error) {
            console.error('❌ Helius transaction error:', error);
            return null;
        }
    }

    /**
     * Get token balance and USD value
     */
    async getTokenBalanceWithUSD(walletAddress, tokenMint) {
        try {
            // Use Helius if available for better data
            const accountData = await this.getTokenAccountData(walletAddress);
            
            if (accountData && accountData.value) {
                const balance = accountData.value.data.parsed.info.tokenAmount.uiAmount;
                const usdValue = await this.calculateUSDValue(
                    accountData.value.data.parsed.info.tokenAmount.amount,
                    accountData.value.data.parsed.info.tokenAmount.decimals
                );
                
                return {
                    balance,
                    usdValue,
                    rawAmount: accountData.value.data.parsed.info.tokenAmount.amount
                };
            }
            
            return null;
        } catch (error) {
            console.error('❌ Error getting token balance:', error);
            return null;
        }
    }
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PriceService;
} else {
    window.PriceService = PriceService;
}

