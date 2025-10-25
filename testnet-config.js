// Testnet Dashboard Configuration
const TESTNET_CONFIG = {
    // Devnet cluster
    cluster: 'devnet',
    
    // Test wallet (will be updated after deployment)
    walletAddress: 'TBD',
    
    // Token mint (will be updated after deployment)
    tokenMint: 'TBD',
    
    // Contract addresses (will be updated after deployment)
    contracts: {
        pepballToken: 'TBD',
        lottery: 'TBD',
        lpManager: 'TBD'
    },
    
    // Testnet settings
    settings: {
        initialJackpot: 20, // SOL
        qualificationAmount: 20, // USD
        taxRate: 2.5, // %
        creatorFundRate: 0.05, // %
        jackpotRate: 2.45, // %
        baseSnapshotInterval: 72, // hours
        fastSnapshotInterval: 48, // hours
        fastModeThreshold: 200 // SOL
    },
    
    // Testnet RPC
    rpcUrl: 'https://api.devnet.solana.com',
    
    // Explorer links
    explorer: 'https://explorer.solana.com/?cluster=devnet'
};

// Function to update dashboard with testnet data
function updateDashboardForTestnet() {
    console.log('🧪 Updating dashboard for testnet...');
    
    // Update cluster indicator
    const clusterIndicator = document.getElementById('clusterIndicator');
    if (clusterIndicator) {
        clusterIndicator.textContent = 'TESTNET';
        clusterIndicator.style.color = '#f39c12';
        clusterIndicator.style.backgroundColor = '#f39c12';
    }
    
    // Update wallet connection for testnet
    const connectBtn = document.getElementById('connectBtn');
    if (connectBtn) {
        connectBtn.textContent = 'Connect Testnet Wallet';
    }
    
    // Update stats with testnet values
    const jackpot = document.getElementById('jackpot');
    if (jackpot) {
        jackpot.textContent = TESTNET_CONFIG.settings.initialJackpot + ' SOL';
    }
    
    // Add testnet warning
    const warning = document.createElement('div');
    warning.style.cssText = `
        background: linear-gradient(145deg, #f39c12, #e67e22);
        color: white;
        padding: 15px;
        border-radius: 10px;
        margin: 20px 0;
        text-align: center;
        font-weight: bold;
        box-shadow: 0 4px 12px rgba(243, 156, 18, 0.3);
    `;
    warning.innerHTML = `
        🧪 TESTNET MODE 🧪<br>
        This is a test environment. Use devnet SOL only!<br>
        <small>Cluster: ${TESTNET_CONFIG.cluster} | Explorer: <a href="${TESTNET_CONFIG.explorer}" target="_blank" style="color: white;">View on Explorer</a></small>
    `;
    
    const container = document.querySelector('.container');
    if (container) {
        container.insertBefore(warning, container.firstChild);
    }
    
    console.log('✅ Dashboard updated for testnet');
}

// Function to load deployment info
async function loadDeploymentInfo() {
    try {
        const response = await fetch('/deployment-info.json');
        const data = await response.json();
        
        // Update config with real deployment data
        TESTNET_CONFIG.walletAddress = data.wallet_address;
        TESTNET_CONFIG.tokenMint = data.token_mint;
        TESTNET_CONFIG.contracts.pepballToken = data.token_mint;
        
        console.log('📊 Deployment info loaded:', data);
        
        // Update dashboard
        updateDashboardForTestnet();
        
        return data;
    } catch (error) {
        console.log('⚠️ Deployment info not found, using defaults');
        updateDashboardForTestnet();
        return null;
    }
}

// Initialize testnet mode
document.addEventListener('DOMContentLoaded', () => {
    // Check if we're in testnet mode
    const urlParams = new URLSearchParams(window.location.search);
    const mode = urlParams.get('mode');
    
    if (mode === 'testnet' || window.location.hostname.includes('testnet')) {
        loadDeploymentInfo();
    }
});

// Export for use in other scripts
window.TESTNET_CONFIG = TESTNET_CONFIG;
window.updateDashboardForTestnet = updateDashboardForTestnet;
