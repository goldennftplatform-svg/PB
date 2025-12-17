// Shared State Manager - Broadcasts updates to all connected users
// Reduces redundant API calls for 100k+ concurrent users

class SharedStateManager {
    constructor() {
        this.state = {
            tokenPrice: null,
            jackpot: null,
            participants: null,
            lastUpdate: null,
            lotteryState: null
        };
        
        this.subscribers = new Set();
        this.updateInterval = null;
        this.wsConnection = null;
        this.wsUrl = null; // Will be set if WebSocket server available
        
        // Fallback polling if WebSocket unavailable
        this.pollingInterval = 30000; // 30 seconds
        this.isPolling = false;
    }

    // Subscribe to state updates
    subscribe(callback) {
        this.subscribers.add(callback);
        
        // Immediately send current state
        if (this.state.lastUpdate) {
            callback(this.state);
        }
        
        // Start updates if first subscriber
        if (this.subscribers.size === 1) {
            this.startUpdates();
        }
        
        // Return unsubscribe function
        return () => {
            this.subscribers.delete(callback);
            if (this.subscribers.size === 0) {
                this.stopUpdates();
            }
        };
    }

    // Start update mechanism (WebSocket or polling)
    startUpdates() {
        // Try WebSocket first
        if (this.wsUrl) {
            this.connectWebSocket();
        } else {
            // Fallback to polling
            this.startPolling();
        }
    }

    stopUpdates() {
        if (this.wsConnection) {
            this.wsConnection.close();
            this.wsConnection = null;
        }
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
        this.isPolling = false;
    }

    // WebSocket connection for real-time updates
    connectWebSocket() {
        if (!this.wsUrl || this.wsConnection) return;

        try {
            this.wsConnection = new WebSocket(this.wsUrl);
            
            this.wsConnection.onopen = () => {
                console.log('✅ Shared state WebSocket connected');
                // Request initial state
                this.wsConnection.send(JSON.stringify({ type: 'getState' }));
            };

            this.wsConnection.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'stateUpdate') {
                        this.updateState(data.state);
                    }
                } catch (error) {
                    console.error('WebSocket message error:', error);
                }
            };

            this.wsConnection.onerror = (error) => {
                console.error('WebSocket error:', error);
                // Fallback to polling
                this.startPolling();
            };

            this.wsConnection.onclose = () => {
                console.log('WebSocket closed, falling back to polling');
                this.wsConnection = null;
                this.startPolling();
            };
        } catch (error) {
            console.error('WebSocket connection failed:', error);
            this.startPolling();
        }
    }

    // Polling fallback
    startPolling() {
        if (this.isPolling) return;
        this.isPolling = true;

        // Initial fetch
        this.fetchState();

        // Set up interval
        this.updateInterval = setInterval(() => {
            this.fetchState();
        }, this.pollingInterval);
    }

    // Fetch state from API
    async fetchState() {
        try {
            // Try to fetch from backend API if available
            const apiUrl = window.API_BASE_URL || '/api/state';
            
            const response = await fetch(apiUrl, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-cache'
            });

            if (response.ok) {
                const data = await response.json();
                this.updateState(data);
            } else {
                // Fallback: use local price service
                this.updateLocalState();
            }
        } catch (error) {
            console.error('State fetch error:', error);
            // Fallback: use local price service
            this.updateLocalState();
        }
    }

    // Update state from local services
    async updateLocalState() {
        // This would integrate with PriceService and other services
        // For now, just update timestamp
        this.state.lastUpdate = Date.now();
        this.broadcast();
    }

    // Update state and broadcast to all subscribers
    updateState(newState) {
        this.state = {
            ...this.state,
            ...newState,
            lastUpdate: Date.now()
        };
        this.broadcast();
    }

    // Broadcast state to all subscribers
    broadcast() {
        this.subscribers.forEach(callback => {
            try {
                callback(this.state);
            } catch (error) {
                console.error('Subscriber callback error:', error);
            }
        });
    }

    // Get current state (synchronous)
    getState() {
        return { ...this.state };
    }

    // Set WebSocket URL
    setWebSocketUrl(url) {
        this.wsUrl = url;
        if (this.subscribers.size > 0 && !this.wsConnection) {
            this.connectWebSocket();
        }
    }

    // Update specific state property
    updateProperty(key, value) {
        this.state[key] = value;
        this.state.lastUpdate = Date.now();
        this.broadcast();
    }
}

// Export singleton instance
const sharedState = new SharedStateManager();

if (typeof window !== 'undefined') {
    window.SharedStateManager = SharedStateManager;
    window.sharedState = sharedState;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SharedStateManager, sharedState };
}

