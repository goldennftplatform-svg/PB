// Rate Limiter - Prevents API overload with 100k+ concurrent users

class RateLimiter {
    constructor(options = {}) {
        this.maxRequests = options.maxRequests || 100;
        this.windowMs = options.windowMs || 1000; // 1 second window
        this.requests = [];
        this.queue = [];
        this.processing = false;
    }

    // Check if request can be made
    canMakeRequest() {
        const now = Date.now();
        
        // Remove old requests outside window
        this.requests = this.requests.filter(
            timestamp => now - timestamp < this.windowMs
        );

        return this.requests.length < this.maxRequests;
    }

    // Execute request with rate limiting
    async execute(fn, priority = 0) {
        return new Promise((resolve, reject) => {
            const request = {
                fn,
                resolve,
                reject,
                priority,
                timestamp: Date.now()
            };

            if (this.canMakeRequest()) {
                this.executeRequest(request);
            } else {
                // Add to queue with priority
                this.queue.push(request);
                this.queue.sort((a, b) => b.priority - a.priority);
                this.processQueue();
            }
        });
    }

    executeRequest(request) {
        const now = Date.now();
        this.requests.push(now);

        // Execute the function
        Promise.resolve(request.fn())
            .then(request.resolve)
            .catch(request.reject);
    }

    processQueue() {
        if (this.processing || this.queue.length === 0) return;
        
        this.processing = true;

        const processNext = () => {
            if (this.queue.length === 0) {
                this.processing = false;
                return;
            }

            if (this.canMakeRequest()) {
                const request = this.queue.shift();
                this.executeRequest(request);
            }

            // Check again after a short delay
            setTimeout(processNext, 10);
        };

        processNext();
    }

    // Get current rate limit status
    getStatus() {
        const now = Date.now();
        this.requests = this.requests.filter(
            timestamp => now - timestamp < this.windowMs
        );

        return {
            current: this.requests.length,
            max: this.maxRequests,
            remaining: Math.max(0, this.maxRequests - this.requests.length),
            queued: this.queue.length
        };
    }

    // Reset rate limiter
    reset() {
        this.requests = [];
        this.queue = [];
        this.processing = false;
    }
}

// Export
if (typeof window !== 'undefined') {
    window.RateLimiter = RateLimiter;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = RateLimiter;
}

