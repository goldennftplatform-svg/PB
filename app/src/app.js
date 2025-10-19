// PEPEBALL Frontend - Advanced Wallet Integration
// 8-bit South Park PEPE Theme with Solana Integration

class PEPEBALLApp {
    constructor() {
        this.connection = null;
        this.wallet = null;
        this.programIds = {
            token: "PEPEBALL111111111111111111111111111111111111",
            lottery: "LOTTERY111111111111111111111111111111111111",
            lpManager: "LPMANAGER111111111111111111111111111111111"
        };
        this.init();
    }

    async init() {
        console.log("🎰 Initializing PEPEBALL App...");
        this.setupEventListeners();
        await this.loadSolanaWeb3();
        this.updateUI();
        this.startAnimations();
    }

    async loadSolanaWeb3() {
        try {
            // Load Solana Web3.js
            if (typeof window.solana !== 'undefined') {
                this.wallet = window.solana;
                console.log("✅ Phantom wallet detected");
            } else {
                console.log("⚠️ No Solana wallet detected");
            }
        } catch (error) {
            console.error("❌ Error loading Solana Web3:", error);
        }
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
            this.showNotification("🎲 Entering lottery...", "info");
            
            // Mock lottery entry - replace with actual contract interaction
            await this.simulateLotteryEntry();
            
            this.showNotification("🎉 Successfully entered lottery!", "success");
            this.updateLotteryUI();
            
        } catch (error) {
            console.error("❌ Lottery entry failed:", error);
            this.showNotification("❌ Lottery entry failed", "error");
        }
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
`;
document.head.appendChild(style);
