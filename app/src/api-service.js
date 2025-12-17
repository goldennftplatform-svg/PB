// API Service - Backend API client for heavy operations
// Offloads expensive operations from frontend to backend

class ApiService {
    constructor(baseUrl = '/api') {
        this.baseUrl = baseUrl;
        this.cache = new Map();
        this.cacheTTL = 5000; // 5 seconds
    }

    // Get lottery state (cached)
    async getLotteryState() {
        const cacheKey = 'lottery-state';
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }

        try {
            const response = await fetch(`${this.baseUrl}/lottery/state`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-cache'
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            this.cache.set(cacheKey, { data, timestamp: Date.now() });
            return data;
        } catch (error) {
            console.error('API service error:', error);
            return null;
        }
    }

    // Get token price (cached)
    async getTokenPrice(tokenMint) {
        const cacheKey = `price-${tokenMint}`;
        const cached = this.cache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            return cached.data;
        }

        try {
            const response = await fetch(`${this.baseUrl}/price/${tokenMint}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            this.cache.set(cacheKey, { data, timestamp: Date.now() });
            return data;
        } catch (error) {
            console.error('API service error:', error);
            return null;
        }
    }

    // Get participant count
    async getParticipantCount() {
        try {
            const response = await fetch(`${this.baseUrl}/lottery/participants/count`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            return data.count || 0;
        } catch (error) {
            console.error('API service error:', error);
            return 0;
        }
    }

    // Batch get multiple token balances
    async batchGetTokenBalances(walletAddresses, tokenMint) {
        try {
            const response = await fetch(`${this.baseUrl}/tokens/balances`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    wallets: walletAddresses,
                    tokenMint
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            return data.balances || {};
        } catch (error) {
            console.error('API service error:', error);
            return {};
        }
    }

    // Clear cache
    clearCache(key = null) {
        if (key) {
            this.cache.delete(key);
        } else {
            this.cache.clear();
        }
    }
}

// Export
if (typeof window !== 'undefined') {
    window.ApiService = ApiService;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ApiService;
}

