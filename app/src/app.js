// PEPEBALL Frontend - Advanced Wallet Integration
// 8-bit South Park PEPE Theme with Solana Integration

class PEPEBALLApp {
    constructor() {
        this.connection = null;
        this.wallet = null;
        this.programIds = {
            token: "HArmxo4FBfy7RiT3iS7erxvC23L1AreU9AskyXc3iuhR",
            lottery: "ytKyH7viyfRmqYtS7Y3nCa8kCJXAPTN6MA8a3EmtSn1", // Updated with new program ID
            lpManager: "G5WidJNwmdp33kQ6AeTcrsKJdP9rvuecfyZXCmQ6oSNG"
        };
        // Initialize price service for dynamic USD conversion
        this.priceService = typeof PriceService !== 'undefined' ? new PriceService() : null;
        this.cluster = "devnet"; // Set to devnet for public testing
        this.connection = null;
        this.init();
    }

    async init() {
        console.log("🎰 Initializing PEPEBALL App...");
        this.setupEventListeners();
        await this.loadSolanaWeb3();
        
        // Initialize price service if available
        if (this.priceService) {
            // Set token mint address from contract
            // TODO: Fetch from contract or config
            this.priceService.setTokenMint(this.programIds.token);
            
            // Start price updates
            this.startPriceUpdates();
        }
        
        this.updateUI();
        this.startAnimations();
    }

    async startPriceUpdates() {
        if (!this.priceService) return;
        
        // Update price every 30 seconds
        setInterval(async () => {
            try {
                const price = await this.priceService.getTokenPriceInUSDC();
                const minTokens = await this.priceService.getMinimumTokensForEntry();
                
                // Update UI with current price and minimum tokens
                const priceDisplay = document.getElementById('token-price');
                if (priceDisplay) {
                    priceDisplay.textContent = `$${price.toFixed(6)} per token`;
                }
                
                const minTokensDisplay = document.getElementById('min-tokens-entry');
                if (minTokensDisplay) {
                    minTokensDisplay.textContent = `${(minTokens / 1e9).toLocaleString()} tokens ($20 min)`;
                }
            } catch (error) {
                console.error('Error updating price:', error);
            }
        }, 30000);
        
        // Initial update
        if (this.priceService) {
            await this.priceService.getTokenPriceInUSDC();
        }
    }

    async loadSolanaWeb3() {
        try {
            // Check if Solana Web3.js is loaded (via CDN or bundler)
            if (typeof window.solanaWeb3 === 'undefined' && typeof window.anchor === 'undefined') {
                // Try loading from CDN
                await this.loadSolanaWeb3FromCDN();
            }
            
            // Connect to devnet - use global if available
            const solanaWeb3 = window.solanaWeb3 || window.anchor?.web3;
            if (solanaWeb3) {
                this.connection = new solanaWeb3.Connection(
                    solanaWeb3.clusterApiUrl('devnet'),
                    'confirmed'
                );
                console.log("✅ Connected to Solana Devnet");
            } else {
                console.log("⚠️ Solana Web3.js not loaded - will use wallet provider only");
            }
            
            // Load Phantom wallet
            if (typeof window.solana !== 'undefined') {
                this.wallet = window.solana;
                console.log("✅ Phantom wallet detected");
                
                // Auto-connect if already authorized
                if (this.wallet.isConnected) {
                    await this.loadUserData();
                }
            } else {
                console.log("⚠️ No Solana wallet detected - Please install Phantom!");
                this.showNotification("⚠️ Please install Phantom wallet and switch to Devnet!", "warning");
            }
        } catch (error) {
            console.error("❌ Error loading Solana Web3:", error);
            this.showNotification("❌ Error connecting to Solana. Make sure you're on Devnet!", "error");
        }
    }

    async loadSolanaWeb3FromCDN() {
        // Load Solana Web3.js from CDN for browser use
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/@solana/web3.js@latest/lib/index.iife.min.js';
            script.onload = () => {
                window.solanaWeb3 = window.solana;
                resolve();
            };
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    setupEventListeners() {
        // Wallet connection
        document.getElementById('connect-wallet')?.addEventListener('click', () => this.connectWallet());
        
        // Lottery entry
        document.getElementById('enter-lottery')?.addEventListener('click', () => this.enterLottery());
        
        // Token purchase
        document.getElementById('buy-tokens')?.addEventListener('click', () => this.buyTokens());
        
        // Refresh data
        document.getElementById('refresh-data')?.addEventListener('click', () => this.refreshData());
    }

    async connectWallet() {
        try {
            if (!this.wallet) {
                this.showNotification("⚠️ Please install Phantom wallet first!", "warning");
                return;
            }

            const response = await this.wallet.connect();
            console.log("✅ Wallet connected:", response.publicKey.toString());
            
            this.updateWalletUI(true);
            this.showNotification("🎉 Wallet connected successfully!", "success");
            
            // Load user data
            await this.loadUserData();
            
        } catch (error) {
            console.error("❌ Wallet connection failed:", error);
            this.showNotification("❌ Wallet connection failed", "error");
        }
    }

    async disconnectWallet() {
        try {
            await this.wallet.disconnect();
            this.updateWalletUI(false);
            this.showNotification("👋 Wallet disconnected", "info");
        } catch (error) {
            console.error("❌ Wallet disconnection failed:", error);
        }
    }

    updateWalletUI(connected) {
        const connectBtn = document.getElementById('connect-wallet');
        const walletInfo = document.getElementById('wallet-info');
        
        if (connected) {
            connectBtn.textContent = "👛 Wallet Connected";
            connectBtn.className = "wallet-btn connected";
            walletInfo.style.display = "block";
            walletInfo.innerHTML = `
                <div class="wallet-address">
                    ${this.wallet.publicKey.toString().slice(0, 8)}...${this.wallet.publicKey.toString().slice(-8)}
                </div>
                <button onclick="app.disconnectWallet()" class="disconnect-btn">Disconnect</button>
            `;
        } else {
            connectBtn.textContent = "🔗 Connect Wallet";
            connectBtn.className = "wallet-btn";
            walletInfo.style.display = "none";
        }
    }

    async loadUserData() {
        if (!this.wallet) return;

        try {
            // Load user's PEPEBALL balance
            const balance = await this.getTokenBalance();
            document.getElementById('user-balance').textContent = `${balance} PEPE`;
            
            // Load lottery participation
            const participation = await this.getLotteryParticipation();
            document.getElementById('lottery-tickets').textContent = `${participation} tickets`;
            
        } catch (error) {
            console.error("❌ Error loading user data:", error);
        }
    }

    async getTokenBalance() {
        // Mock balance - replace with actual Solana RPC call
        return "1,000,000";
    }

    async getLotteryParticipation() {
        // Mock participation - replace with actual contract call
        return "5";
    }

    async enterLottery() {
        if (!this.wallet) {
            this.showNotification("⚠️ Please connect wallet first!", "warning");
            return;
        }

        try {
            // Show pricing options
            const pricingOptions = this.getPricingOptions();
            const selectedOption = await this.showPricingModal(pricingOptions);
            
            if (!selectedOption) return;
            
            this.showNotification(`🎲 Entering lottery with ${selectedOption.tickets} tickets ($${selectedOption.usdValue})...`, "info");
            
            // Mock lottery entry - replace with actual contract interaction
            await this.simulateLotteryEntry();
            
            this.showNotification(`🎉 Successfully entered lottery with ${selectedOption.tickets} tickets!`, "success");
            this.updateLotteryUI();
            
        } catch (error) {
            console.error("❌ Lottery entry failed:", error);
            this.showNotification("❌ Lottery entry failed", "error");
        }
    }

    getPricingOptions() {
        return [
            {
                usdValue: 20,
                tickets: 1,
                description: "Basic Entry",
                bonus: "0%"
            },
            {
                usdValue: 100,
                tickets: 4,
                description: "Value Pack",
                bonus: "100% bonus"
            },
            {
                usdValue: 500,
                tickets: 10,
                description: "Whale Pack",
                bonus: "400% bonus"
            }
        ];
    }

    async showPricingModal(options) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'pricing-modal';
            modal.innerHTML = `
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>🎰 Choose Your Lottery Entry 🎰</h2>
                        <button class="close-btn" onclick="this.closest('.pricing-modal').remove()">×</button>
                    </div>
                    <div class="pricing-options">
                        ${options.map(option => `
                            <div class="pricing-option" data-usd="${option.usdValue}" data-tickets="${option.tickets}">
                                <div class="option-header">
                                    <span class="option-title">${option.description}</span>
                                    <span class="option-bonus">${option.bonus}</span>
                                </div>
                                <div class="option-price">$${option.usdValue}</div>
                                <div class="option-tickets">${option.tickets} tickets</div>
                                <div class="option-value">$${(option.usdValue / option.tickets).toFixed(2)} per ticket</div>
                            </div>
                        `).join('')}
                    </div>
                    <div class="modal-footer">
                        <button class="cancel-btn" onclick="this.closest('.pricing-modal').remove()">Cancel</button>
                    </div>
                </div>
            `;
            
            document.body.appendChild(modal);
            
            // Add click handlers
            modal.querySelectorAll('.pricing-option').forEach(option => {
                option.addEventListener('click', () => {
                    const usdValue = parseInt(option.dataset.usd);
                    const tickets = parseInt(option.dataset.tickets);
                    modal.remove();
                    resolve({ usdValue, tickets });
                });
            });
        });
    }

    async simulateLotteryEntry() {
        // Simulate transaction delay
        return new Promise(resolve => setTimeout(resolve, 2000));
    }

    async buyTokens() {
        if (!this.wallet) {
            this.showNotification("⚠️ Please connect wallet first!", "warning");
            return;
        }

        try {
            this.showNotification("💰 Opening token purchase...", "info");
            
            // Open Pump.Fun or DEX
            window.open("https://pump.fun", "_blank");
            
        } catch (error) {
            console.error("❌ Token purchase failed:", error);
            this.showNotification("❌ Token purchase failed", "error");
        }
    }

    async refreshData() {
        this.showNotification("🔄 Refreshing data...", "info");
        
        // Refresh lottery data
        await this.updateLotteryData();
        
        // Refresh user data
        if (this.wallet) {
            await this.loadUserData();
        }
        
        this.showNotification("✅ Data refreshed!", "success");
    }

    async updateLotteryData() {
        // Mock lottery data - replace with actual contract calls
        const jackpot = "25.5";
        const nextDraw = "48h 23m";
        const participants = "127";
        
        document.getElementById('jackpot-amount').textContent = `${jackpot} SOL`;
        document.getElementById('jackpot-timer').textContent = `Next draw in: ${nextDraw}`;
        document.getElementById('participants-count').textContent = `${participants} participants`;
    }

    updateLotteryUI() {
        // Update lottery UI after entry
        const enterBtn = document.getElementById('enter-lottery');
        enterBtn.textContent = "🎫 Entered!";
        enterBtn.disabled = true;
        
        setTimeout(() => {
            enterBtn.textContent = "🎫 ENTER LOTTERY 🎫";
            enterBtn.disabled = false;
        }, 5000);
    }

    updateUI() {
        // Update all UI elements
        this.updateLotteryData();
        this.updateStats();
        this.updateTheme();
    }

    updateStats() {
        // Update statistics
        const stats = {
            totalSupply: "1,000,000,000",
            holders: "1,247",
            volume24h: "45.2K",
            marketCap: "125K"
        };
        
        document.getElementById('total-supply').textContent = stats.totalSupply;
        document.getElementById('holders-count').textContent = stats.holders;
        document.getElementById('volume-24h').textContent = stats.volume24h;
        document.getElementById('market-cap').textContent = stats.marketCap;
    }

    updateTheme() {
        // Apply dynamic theme based on jackpot size
        const jackpotElement = document.getElementById('jackpot-amount');
        const jackpotValue = parseFloat(jackpotElement.textContent);
        
        if (jackpotValue >= 200) {
            // Fast draw theme (36 hours)
            document.body.classList.add('fast-draw');
            document.getElementById('draw-timing').textContent = "36-hour draws";
        } else {
            // Normal draw theme (72 hours)
            document.body.classList.remove('fast-draw');
            document.getElementById('draw-timing').textContent = "72-hour draws";
        }
    }

    startAnimations() {
        // Start bubble animations
        this.createBubbles();
        
        // Start lottery countdown
        this.startCountdown();
        
        // Start random animations
        this.startRandomAnimations();
    }

    createBubbles() {
        const bubbleContainer = document.querySelector('.bubble-container') || document.body;
        
        setInterval(() => {
            const bubble = document.createElement('div');
            bubble.className = 'bubble';
            bubble.style.left = Math.random() * 100 + '%';
            bubble.style.animationDuration = (Math.random() * 3 + 2) + 's';
            bubbleContainer.appendChild(bubble);
            
            setTimeout(() => bubble.remove(), 5000);
        }, 2000);
    }

    startCountdown() {
        setInterval(() => {
            const timerElement = document.getElementById('jackpot-timer');
            if (timerElement) {
                // Mock countdown - replace with actual lottery timing
                const currentTime = timerElement.textContent;
                // Update countdown logic here
            }
        }, 1000);
    }

    startRandomAnimations() {
        // Random PEPE animations
        setInterval(() => {
            const pepeEmoji = document.querySelector('.pepe-emoji');
            if (pepeEmoji) {
                pepeEmoji.style.transform = `rotate(${Math.random() * 360}deg)`;
                setTimeout(() => {
                    pepeEmoji.style.transform = 'rotate(0deg)';
                }, 1000);
            }
        }, 10000);
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Utility methods
    formatNumber(num) {
        return new Intl.NumberFormat().format(num);
    }

    formatSOL(lamports) {
        return (lamports / 1e9).toFixed(2);
    }

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        return `${hours}h ${minutes}m`;
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PEPEBALLApp();
});

// Add CSS for notifications and animations
const style = document.createElement('style');
style.textContent = `
    .notification {
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 8px;
        color: white;
        font-family: 'Press Start 2P', monospace;
        font-size: 0.8rem;
        z-index: 1000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
    }
    
    .notification.show {
        transform: translateX(0);
    }
    
    .notification.success {
        background: #00ff00;
        color: #000;
    }
    
    .notification.error {
        background: #ff0000;
        color: #fff;
    }
    
    .notification.warning {
        background: #ffff00;
        color: #000;
    }
    
    .notification.info {
        background: #00ffff;
        color: #000;
    }
    
    .wallet-btn {
        background: linear-gradient(45deg, #ff69b4, #ff1493);
        border: 3px solid #ffff00;
        color: #000;
        font-family: 'Press Start 2P', monospace;
        font-size: 1rem;
        padding: 15px 30px;
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.3s ease;
    }
    
    .wallet-btn:hover {
        transform: translateY(-3px);
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
    }
    
    .wallet-btn.connected {
        background: linear-gradient(45deg, #00ff00, #00cc00);
    }
    
    .wallet-info {
        margin-top: 10px;
        padding: 10px;
        background: rgba(0, 0, 0, 0.8);
        border-radius: 8px;
        text-align: center;
    }
    
    .wallet-address {
        font-family: 'Press Start 2P', monospace;
        font-size: 0.8rem;
        color: #00ffff;
        margin-bottom: 10px;
    }
    
    .disconnect-btn {
        background: #ff0000;
        border: 2px solid #fff;
        color: #fff;
        font-family: 'Press Start 2P', monospace;
        font-size: 0.7rem;
        padding: 8px 16px;
        border-radius: 5px;
        cursor: pointer;
    }
    
    .fast-draw {
        animation: fastPulse 2s infinite;
    }
    
    @keyframes fastPulse {
        0%, 100% { filter: hue-rotate(0deg); }
        50% { filter: hue-rotate(180deg); }
    }
    
    .bubble {
        position: absolute;
        background: rgba(255, 255, 255, 0.1);
        border-radius: 50%;
        animation: float 6s ease-in-out infinite;
        pointer-events: none;
    }
    
    @keyframes float {
        0%, 100% { transform: translateY(0px); }
        50% { transform: translateY(-20px); }
    }
    
    .pricing-modal {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2000;
    }
    
    .modal-content {
        background: linear-gradient(45deg, #ff69b4, #ff1493);
        border: 4px solid #ffff00;
        border-radius: 15px;
        padding: 30px;
        max-width: 600px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
    }
    
    .modal-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 20px;
    }
    
    .modal-header h2 {
        font-family: 'Press Start 2P', monospace;
        font-size: 1.2rem;
        color: #000;
        margin: 0;
    }
    
    .close-btn {
        background: #ff0000;
        border: 2px solid #fff;
        color: #fff;
        font-family: 'Press Start 2P', monospace;
        font-size: 1rem;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .pricing-options {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 15px;
        margin-bottom: 20px;
    }
    
    .pricing-option {
        background: rgba(0, 0, 0, 0.8);
        border: 3px solid #00ff00;
        border-radius: 10px;
        padding: 20px;
        text-align: center;
        cursor: pointer;
        transition: all 0.3s ease;
        font-family: 'Press Start 2P', monospace;
    }
    
    .pricing-option:hover {
        transform: translateY(-5px);
        border-color: #ffff00;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
    }
    
    .option-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
    }
    
    .option-title {
        font-size: 0.8rem;
        color: #ffff00;
    }
    
    .option-bonus {
        font-size: 0.6rem;
        color: #00ffff;
        background: rgba(0, 255, 255, 0.2);
        padding: 2px 6px;
        border-radius: 3px;
    }
    
    .option-price {
        font-size: 1.5rem;
        color: #ff69b4;
        margin-bottom: 5px;
    }
    
    .option-tickets {
        font-size: 1rem;
        color: #00ffff;
        margin-bottom: 5px;
    }
    
    .option-value {
        font-size: 0.7rem;
        color: #ffff00;
    }
    
    .modal-footer {
        text-align: center;
    }
    
    .cancel-btn {
        background: #666;
        border: 2px solid #fff;
        color: #fff;
        font-family: 'Press Start 2P', monospace;
        font-size: 0.8rem;
        padding: 10px 20px;
        border-radius: 5px;
        cursor: pointer;
    }
    
    .cancel-btn:hover {
        background: #888;
    }
`;
document.head.appendChild(style);

