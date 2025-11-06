// PEPEBALL Frontend - Clean Rebuild
// No wallet connection for average users - Admin whitelist only

class PEPEBALLApp {
    constructor() {
        this.connection = null;
        this.wallet = null;
        this.programIds = {
            token: "HArmxo4FBfy7RiT3iS7erxvC23L1AreU9AskyXc3iuhR",
            lottery: "ytKyH7viyfRmqYtS7Y3nCa8kCJXAPTN6MA8a3EmtSn1",
            lpManager: "G5WidJNwmdp33kQ6AeTcrsKJdP9rvuecfyZXCmQ6oSNG"
        };
        this.priceService = typeof PriceService !== 'undefined' ? new PriceService() : null;
        this.cluster = "devnet";
        // Admin whitelist - only this address can access admin/reporting
        this.adminWhitelist = ["Hefy8JLP947zsUACbCAtgd3TuvWDJmZDhZmob1xWdbbJ"];
        this.isAdminAuthenticated = false;
        this.adminWalletAddress = null;
        this.init();
    }

    async init() {
        console.log("🎰 Initializing PEPEBALL App...");
        this.setupEventListeners();
        await this.loadSolanaWeb3();
        if (this.priceService) {
            this.priceService.setTokenMint(this.programIds.token);
            this.startPriceUpdates();
        }
        this.updateUI();
        this.startAnimations();
    }

    async loadSolanaWeb3() {
        try {
            if (typeof window.solanaWeb3 === 'undefined' && typeof window.anchor === 'undefined') {
                await this.loadSolanaWeb3FromCDN();
            }
            const solanaWeb3 = window.solanaWeb3 || window.anchor?.web3;
            if (solanaWeb3) {
                this.connection = new solanaWeb3.Connection(
                    solanaWeb3.clusterApiUrl('devnet'),
                    'confirmed'
                );
                console.log("✅ Connected to Solana Devnet");
            }
            if (typeof window.solana !== 'undefined') {
                console.log("✅ Phantom wallet detected (admin access available)");
            }
        } catch (error) {
            console.error("❌ Error loading Solana Web3:", error);
        }
    }

    async loadSolanaWeb3FromCDN() {
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
        document.getElementById('admin-access-btn')?.addEventListener('click', () => this.handleAdminAccess());
        document.getElementById('admin-disconnect')?.addEventListener('click', () => this.disconnectAdmin());
        document.getElementById('admin-refresh')?.addEventListener('click', () => this.refreshAdminData());
        document.getElementById('enter-lottery')?.addEventListener('click', () => this.enterLottery());
        document.getElementById('buy-tokens')?.addEventListener('click', () => this.buyTokens());
        document.getElementById('add-to-wallet')?.addEventListener('click', () => this.addToWallet());
        document.getElementById('refresh-data')?.addEventListener('click', () => this.refreshData());
    }

    async handleAdminAccess() {
        try {
            if (!window.solana || !window.solana.isPhantom) {
                this.showNotification("⚠️ Please install Phantom wallet first!", "warning");
                return;
            }
            const response = await window.solana.connect();
            const walletAddress = response.publicKey.toString();
            const isAdmin = this.adminWhitelist.includes(walletAddress);
            
            if (!isAdmin) {
                this.showNotification("❌ Access Denied: This wallet is not authorized for admin access", "error");
                await window.solana.disconnect();
                return;
            }

            this.wallet = window.solana;
            this.isAdminAuthenticated = true;
            this.adminWalletAddress = walletAddress;
            this.showAdminSection();
            this.showNotification("✅ Admin access granted!", "success");
            await this.loadAdminData();
        } catch (error) {
            console.error("❌ Admin access failed:", error);
            this.showNotification("❌ Admin access failed: " + error.message, "error");
        }
    }

    async disconnectAdmin() {
        try {
            if (this.wallet && this.wallet.disconnect) {
                await this.wallet.disconnect();
            }
            this.isAdminAuthenticated = false;
            this.adminWalletAddress = null;
            this.wallet = null;
            this.hideAdminSection();
            this.showNotification("👋 Admin disconnected", "info");
        } catch (error) {
            console.error("❌ Admin disconnection failed:", error);
        }
    }

    showAdminSection() {
        const adminSection = document.getElementById('admin-section');
        if (adminSection) adminSection.classList.add('active');
    }

    hideAdminSection() {
        const adminSection = document.getElementById('admin-section');
        if (adminSection) adminSection.classList.remove('active');
    }

    async loadAdminData() {
        if (!this.isAdminAuthenticated) return;
        try {
            const walletAddressEl = document.getElementById('admin-wallet-address');
            const adminStatusEl = document.getElementById('admin-status');
            if (walletAddressEl) {
                walletAddressEl.textContent = `${this.adminWalletAddress.slice(0, 8)}...${this.adminWalletAddress.slice(-8)}`;
            }
            if (adminStatusEl) {
                adminStatusEl.textContent = "✅ Authorized";
                adminStatusEl.style.color = "#00ff00";
            }
            await this.updateAdminStats();
        } catch (error) {
            console.error("❌ Error loading admin data:", error);
        }
    }

    async updateAdminStats() {
        const totalVolumeEl = document.getElementById('admin-total-volume');
        const totalParticipantsEl = document.getElementById('admin-total-participants');
        if (totalVolumeEl) totalVolumeEl.textContent = "1,234.56 SOL";
        if (totalParticipantsEl) totalParticipantsEl.textContent = "1,247";
    }

    async refreshAdminData() {
        if (!this.isAdminAuthenticated) {
            this.showNotification("⚠️ Please authenticate as admin first", "warning");
            return;
        }
        this.showNotification("🔄 Refreshing admin data...", "info");
        await this.loadAdminData();
        this.showNotification("✅ Admin data refreshed!", "success");
    }

    async enterLottery() {
        this.showNotification("🎰 Lottery participation is automatic! Just hold $20 worth of PEPE tokens to qualify! 🎰", "info");
    }

    async buyTokens() {
        try {
            this.showNotification("💰 Opening token purchase...", "info");
            window.open("https://pump.fun", "_blank");
        } catch (error) {
            console.error("❌ Token purchase failed:", error);
            this.showNotification("❌ Token purchase failed", "error");
        }
    }

    async addToWallet() {
        try {
            const tokenMint = this.programIds.token;
            
            // Copy token address to clipboard first
            await navigator.clipboard.writeText(tokenMint);
            this.showNotification("📋 Token address copied to clipboard!", "info");
            
            // Check if Phantom wallet is available
            if (typeof window.solana !== 'undefined' && window.solana.isPhantom) {
                // Try to connect and add token
                try {
                    // Connect wallet if not already connected
                    if (!window.solana.isConnected) {
                        await window.solana.connect();
                    }
                    
                    // Phantom doesn't have a direct addToken method, so we provide instructions
                    const message = `✅ Token address copied!\n\nTo add PEPEBALL to Phantom:\n\n1. Open Phantom wallet\n2. Go to your token list\n3. Click the "+" or "Add Token" button\n4. Paste the address (already copied)\n5. Click "Add"\n\nToken Address:\n${tokenMint}`;
                    
                    alert(message);
                    
                    // Also open Solana Explorer for reference
                    window.open(`https://solscan.io/token/${tokenMint}?cluster=devnet`, '_blank');
                    
                } catch (error) {
                    console.error("Wallet connection error:", error);
                    this.showManualInstructions(tokenMint);
                }
            } else {
                // No wallet detected - show manual instructions
                this.showManualInstructions(tokenMint);
            }
        } catch (error) {
            console.error("❌ Add to wallet failed:", error);
            this.showNotification("❌ Failed to add token. Token address: " + this.programIds.token, "error");
        }
    }

    showManualInstructions(tokenMint) {
        const message = `✅ Token address copied to clipboard!\n\nTo add PEPEBALL to your wallet:\n\n1. Open your Solana wallet (Phantom, Solflare, etc.)\n2. Click "Add Token" or "Import Token"\n3. Paste this address (already copied):\n${tokenMint}\n4. Click "Add" or "Import"\n\nClick OK to open Solana Explorer for more info.`;
        
        if (confirm(message)) {
            window.open(`https://solscan.io/token/${tokenMint}?cluster=devnet`, '_blank');
        }
    }

    async refreshData() {
        this.showNotification("🔄 Refreshing data...", "info");
        await this.updateLotteryData();
        if (this.isAdminAuthenticated) {
            await this.loadAdminData();
        }
        this.showNotification("✅ Data refreshed!", "success");
    }

    async updateLotteryData() {
        const jackpot = "25.5";
        const nextDraw = "48h 23m";
        const participants = "127";
        const jackpotEl = document.getElementById('jackpot-amount');
        const timerEl = document.getElementById('jackpot-timer');
        const participantsEl = document.getElementById('participants-count');
        if (jackpotEl) jackpotEl.textContent = `${jackpot} SOL`;
        if (timerEl) timerEl.textContent = `Next draw in: ${nextDraw}`;
        if (participantsEl) participantsEl.textContent = `${participants} participants`;
    }

    updateUI() {
        this.updateLotteryData();
        this.updateTheme();
    }

    updateTheme() {
        const jackpotElement = document.getElementById('jackpot-amount');
        if (!jackpotElement) return;
        const jackpotValue = parseFloat(jackpotElement.textContent);
        const drawTimingEl = document.getElementById('draw-timing');
        if (drawTimingEl) {
            if (jackpotValue >= 200) {
                document.body.classList.add('fast-draw');
                drawTimingEl.textContent = "36-hour draws";
            } else {
                document.body.classList.remove('fast-draw');
                drawTimingEl.textContent = "72-hour draws";
            }
        }
    }

    startAnimations() {
        this.createBubbles();
    }

    createBubbles() {
        setInterval(() => {
            const bubble = document.createElement('div');
            bubble.className = 'bubble';
            bubble.style.left = Math.random() * 100 + '%';
            bubble.style.animationDuration = (Math.random() * 3 + 2) + 's';
            document.body.appendChild(bubble);
            setTimeout(() => bubble.remove(), 5000);
        }, 2000);
    }

    async startPriceUpdates() {
        if (!this.priceService) {
            // Fallback: use mock price if price service not available
            this.updateTokenCounts(0.000020); // Default price
            return;
        }
        
        // Update immediately
        await this.updatePricingWithTokenCounts();
        
        // Update every 30 seconds
        setInterval(async () => {
            await this.updatePricingWithTokenCounts();
        }, 30000);
    }

    async updatePricingWithTokenCounts() {
        try {
            let tokenPrice = 0.000020; // Default fallback price
            
            if (this.priceService) {
                try {
                    tokenPrice = await this.priceService.getTokenPriceInUSDC();
                } catch (error) {
                    console.error('Error getting token price:', error);
                    // Use fallback price
                }
            }
            
            this.updateTokenCounts(tokenPrice);
        } catch (error) {
            console.error('Error updating pricing:', error);
        }
    }

    updateTokenCounts(tokenPriceUSD) {
        if (!tokenPriceUSD || tokenPriceUSD <= 0) {
            tokenPriceUSD = 0.000020; // Fallback price
        }
        
        // Calculate tokens needed for each tier
        const tokens20 = Math.ceil(20 / tokenPriceUSD);
        const tokens100 = Math.ceil(100 / tokenPriceUSD);
        const tokens500 = Math.ceil(500 / tokenPriceUSD);
        
        // Format token amounts
        const formatTokens = (amount) => {
            if (amount >= 1000000) {
                return (amount / 1000000).toFixed(2) + 'M';
            } else if (amount >= 1000) {
                return (amount / 1000).toFixed(1) + 'K';
            } else {
                return amount.toLocaleString();
            }
        };
        
        // Update DOM
        const tier20El = document.getElementById('tier-20-tokens');
        const tier100El = document.getElementById('tier-100-tokens');
        const tier500El = document.getElementById('tier-500-tokens');
        
        if (tier20El) {
            tier20El.textContent = `≈ ${formatTokens(tokens20)} PEPE`;
        }
        if (tier100El) {
            tier100El.textContent = `≈ ${formatTokens(tokens100)} PEPE`;
        }
        if (tier500El) {
            tier500El.textContent = `≈ ${formatTokens(tokens500)} PEPE`;
        }
    }

    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        document.body.appendChild(notification);
        setTimeout(() => notification.classList.add('show'), 100);
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new PEPEBALLApp();
});

// Add CSS for notifications
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
    .fast-draw {
        animation: fastPulse 2s infinite;
    }
    @keyframes fastPulse {
        0%, 100% { filter: hue-rotate(0deg); }
        50% { filter: hue-rotate(180deg); }
    }
`;
document.head.appendChild(style);
