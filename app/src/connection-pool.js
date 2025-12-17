// Connection Pool Manager - Optimized for 100k+ concurrent users
// Reuses RPC connections and implements request batching

class ConnectionPool {
    constructor(options = {}) {
        this.maxConnections = options.maxConnections || 10;
        this.maxRequestsPerSecond = options.maxRequestsPerSecond || 100;
        this.requestTimeout = options.requestTimeout || 30000;
        this.connections = [];
        this.requestQueue = [];
        this.activeRequests = 0;
        this.requestCount = 0;
        this.lastResetTime = Date.now();
        this.cluster = options.cluster || 'devnet';
        this.heliusApiKey = options.heliusApiKey;
        this.rpcUrl = this.heliusApiKey 
            ? `https://rpc.helius.xyz/?api-key=${this.heliusApiKey}`
            : `https://api.${this.cluster}.solana.com`;
        
        // Shared cache for all users
        this.cache = new Map();
        this.cacheTimestamps = new Map();
        this.cacheTTL = 5000; // 5 seconds default TTL
        
        // Request batching
        this.batchQueue = [];
        this.batchTimeout = 100; // Batch requests within 100ms
        this.batchTimer = null;
        
        this.init();
    }

    init() {
        // Pre-create connection pool
        for (let i = 0; i < this.maxConnections; i++) {
            this.createConnection();
        }
        
        // Start batch processor
        this.startBatchProcessor();
        
        // Reset rate limit counter every second
        setInterval(() => {
            this.requestCount = 0;
            this.lastResetTime = Date.now();
        }, 1000);
    }

    createConnection() {
        // Create a lightweight connection object
        const connection = {
            id: this.connections.length,
            inUse: false,
            lastUsed: Date.now(),
            requestCount: 0
        };
        this.connections.push(connection);
        return connection;
    }

    getAvailableConnection() {
        // Find available connection or create new one if under limit
        let connection = this.connections.find(c => !c.inUse);
        
        if (!connection && this.connections.length < this.maxConnections) {
            connection = this.createConnection();
        }
        
        // If still no connection, wait for one to become available
        if (!connection) {
            connection = this.connections.reduce((oldest, current) => {
                return current.lastUsed < oldest.lastUsed ? current : oldest;
            });
        }
        
        return connection;
    }

    async executeRequest(method, params, useCache = true) {
        // Check cache first
        const cacheKey = `${method}_${JSON.stringify(params)}`;
        if (useCache && this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            const timestamp = this.cacheTimestamps.get(cacheKey);
            if (Date.now() - timestamp < this.cacheTTL) {
                return cached;
            }
        }

        // Rate limiting
        if (this.requestCount >= this.maxRequestsPerSecond) {
            return new Promise((resolve) => {
                this.requestQueue.push({ method, params, resolve, useCache });
            });
        }

        // Get available connection
        const connection = this.getAvailableConnection();
        connection.inUse = true;
        connection.lastUsed = Date.now();
        connection.requestCount++;
        this.requestCount++;

        try {
            const result = await this.makeRPCRequest(method, params);
            
            // Cache result
            if (useCache) {
                this.cache.set(cacheKey, result);
                this.cacheTimestamps.set(cacheKey, Date.now());
            }
            
            return result;
        } finally {
            connection.inUse = false;
            this.processQueue();
        }
    }

    async makeRPCRequest(method, params) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.requestTimeout);

        try {
            const response = await fetch(this.rpcUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: Date.now(),
                    method,
                    params
                }),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`RPC request failed: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.error) {
                throw new Error(data.error.message || 'RPC error');
            }

            return data.result;
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error('Request timeout');
            }
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }

    // Batch multiple requests together
    async batchRequest(requests) {
        return new Promise((resolve) => {
            this.batchQueue.push({ requests, resolve });
            
            if (!this.batchTimer) {
                this.batchTimer = setTimeout(() => {
                    this.processBatch();
                }, this.batchTimeout);
            }
        });
    }

    async processBatch() {
        if (this.batchQueue.length === 0) {
            this.batchTimer = null;
            return;
        }

        const batch = this.batchQueue.shift();
        this.batchTimer = null;

        try {
            // Execute all requests in parallel
            const results = await Promise.allSettled(
                batch.requests.map(req => this.executeRequest(req.method, req.params, req.useCache))
            );

            batch.resolve(results.map(r => r.status === 'fulfilled' ? r.value : null));
        } catch (error) {
            console.error('Batch request error:', error);
            batch.resolve(batch.requests.map(() => null));
        }

        // Process next batch if any
        if (this.batchQueue.length > 0) {
            this.batchTimer = setTimeout(() => this.processBatch(), this.batchTimeout);
        }
    }

    startBatchProcessor() {
        // Process queue every 50ms
        setInterval(() => {
            if (this.requestQueue.length > 0 && this.requestCount < this.maxRequestsPerSecond) {
                this.processQueue();
            }
        }, 50);
    }

    processQueue() {
        if (this.requestQueue.length === 0 || this.requestCount >= this.maxRequestsPerSecond) {
            return;
        }

        const next = this.requestQueue.shift();
        this.executeRequest(next.method, next.params, next.useCache)
            .then(next.resolve)
            .catch(() => next.resolve(null));
    }

    // Clear cache for specific key or all
    clearCache(key = null) {
        if (key) {
            this.cache.delete(key);
            this.cacheTimestamps.delete(key);
        } else {
            this.cache.clear();
            this.cacheTimestamps.clear();
        }
    }

    // Get cache statistics
    getStats() {
        return {
            totalConnections: this.connections.length,
            activeConnections: this.connections.filter(c => c.inUse).length,
            queuedRequests: this.requestQueue.length,
            batchedRequests: this.batchQueue.length,
            cacheSize: this.cache.size,
            requestsPerSecond: this.requestCount
        };
    }
}

// Export singleton instance
if (typeof window !== 'undefined') {
    window.ConnectionPool = ConnectionPool;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ConnectionPool;
}

