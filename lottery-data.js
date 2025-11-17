// Lottery Data Fetcher - Fetches real winners and payout data from Solana
// Uses @solana/web3.js to connect and fetch lottery account data

const LOTTERY_PROGRAM_ID = '8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7';
const NETWORK = 'devnet'; // Testnet/Devnet for pre-live testing
const RPC_URL = 'https://api.devnet.solana.com';

// Use Helius for faster RPC (works on devnet)
const HELIUS_API_KEY = '431ca765-2f35-4b23-8abd-db03796bd85f';
const HELIUS_RPC_URL = `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`;

// Explorer URLs for testnet
const EXPLORER_BASE = `https://explorer.solana.com`;
const EXPLORER_CLUSTER = `?cluster=${NETWORK}`;

class LotteryDataFetcher {
    constructor() {
        this.connection = null;
        this.lotteryPDA = null;
        this.cache = {
            lotteryState: null,
            timestamp: 0,
            ttl: 10000 // 10 seconds cache
        };
    }

    async init() {
        try {
            // Dynamically import @solana/web3.js
            const { Connection, PublicKey } = await import('https://cdn.jsdelivr.net/npm/@solana/web3.js@1.87.6/+esm');
            
            this.connection = new Connection(HELIUS_RPC_URL || RPC_URL, 'confirmed');
            
            // Derive lottery PDA
            const [lotteryPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('lottery')],
                new PublicKey(LOTTERY_PROGRAM_ID)
            );
            this.lotteryPDA = lotteryPDA;
            
            return true;
        } catch (error) {
            console.error('Failed to initialize:', error);
            // Fallback: Use browser fetch API
            return false;
        }
    }

    /**
     * Fetch lottery state from Solana
     * Returns: { jackpot, winners, lastSnapshot, payoutTx, etc. }
     */
    async fetchLotteryState() {
        // Check cache
        if (this.cache.lotteryState && Date.now() - this.cache.timestamp < this.cache.ttl) {
            return this.cache.lotteryState;
        }

        try {
            // Try backend API first
            const apiData = await this.fetchViaAPI();
            if (apiData && !apiData.error) {
                this.cache.lotteryState = apiData;
                this.cache.timestamp = Date.now();
                return apiData;
            }

            // Fallback: Use direct RPC (may have CORS issues)
            if (!this.connection) {
                await this.init();
            }

            // Fetch account data
            const accountInfo = await this.connection.getAccountInfo(this.lotteryPDA);
            if (!accountInfo) {
                return { error: 'Lottery not initialized' };
            }

            // Parse account data (simplified - would need full IDL parsing)
            const data = await this.parseAccountData(accountInfo);
            
            this.cache.lotteryState = data;
            this.cache.timestamp = Date.now();
            
            return data;
        } catch (error) {
            console.error('Error fetching lottery state:', error);
            return { error: error.message };
        }
    }

    /**
     * Fetch via backend API
     */
    async fetchViaAPI() {
        try {
            const response = await fetch('/api/lottery/state', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (error) {
            // API not available, continue to fallback
            return null;
        }
    }

    /**
     * Parse account data (simplified - full parsing would need IDL)
     */
    async parseAccountData(accountInfo) {
        // This is a placeholder - full implementation would deserialize using IDL
        // For now, return structure that matches expected format
        return {
            jackpot: 0,
            winners: { mainWinner: null, minorWinners: [] },
            lastSnapshot: null,
            payoutTx: null,
            error: 'Full parsing requires IDL - use backend API'
        };
    }

    /**
     * Fetch via RPC with account data parsing
     */
    async fetchViaRPC() {
        try {
            // Use fetch to call a backend API or use RPC directly
            const response = await fetch('/api/lottery/state', {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });

            if (response.ok) {
                return await response.json();
            }

            // Fallback: Try direct RPC call (requires CORS)
            return await this.fetchDirectRPC();
        } catch (error) {
            console.error('RPC fetch error:', error);
            return { error: 'Failed to fetch lottery data' };
        }
    }

    /**
     * Direct RPC call (may have CORS issues)
     */
    async fetchDirectRPC() {
        const response = await fetch(HELIUS_RPC_URL || RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getAccountInfo',
                params: [
                    this.lotteryPDA.toString(),
                    { encoding: 'base64' }
                ]
            })
        });

        const data = await response.json();
        if (data.error) {
            throw new Error(data.error.message);
        }

        // Parse account data (would need IDL for proper deserialization)
        // For now, return placeholder
        return {
            jackpot: 0,
            winners: { mainWinner: null, minorWinners: [] },
            lastSnapshot: null,
            payoutTx: null
        };
    }

    /**
     * Format wallet address for display
     */
    formatAddress(address) {
        if (!address) return 'N/A';
        if (typeof address === 'object' && address.toString) {
            address = address.toString();
        }
        return address.substring(0, 4) + '...' + address.substring(address.length - 4);
    }

    /**
     * Format SOL amount
     */
    formatSOL(lamports) {
        if (!lamports) return '0.0000';
        const sol = lamports / 1e9;
        return sol.toFixed(4);
    }

    /**
     * Format date
     */
    formatDate(timestamp) {
        if (!timestamp) return 'N/A';
        const date = new Date(timestamp * 1000);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    }
}

// Global instance
const lotteryFetcher = new LotteryDataFetcher();

// Initialize on page load
document.addEventListener('DOMContentLoaded', async () => {
    await lotteryFetcher.init();
    await updateLotteryDisplay();
    
    // Update every 30 seconds
    setInterval(updateLotteryDisplay, 30000);
});

    /**
     * Update the HTML with real lottery data
     */
async function updateLotteryDisplay() {
    const state = await lotteryFetcher.fetchLotteryState();
    
    if (state.error) {
        console.warn('Lottery data error:', state.error);
        // Show error message in UI
        const errorEl = document.querySelector('.draw-date');
        if (errorEl) {
            errorEl.textContent = 'Error loading lottery data. Using backend API...';
        }
        return;
    }

    // Update jackpot
    const jackpotEl = document.getElementById('jackpot');
    if (jackpotEl && state.jackpot) {
        jackpotEl.textContent = lotteryFetcher.formatSOL(state.jackpot) + ' SOL';
    }

    // Update jackpot amount
    const jackpotAmountEl = document.getElementById('jackpot-amount');
    if (jackpotAmountEl && state.jackpot) {
        jackpotAmountEl.textContent = `${lotteryFetcher.formatSOL(state.jackpot)} SOL`;
    }

    // Update winners section
    updateWinnersDisplay(state);

    // Update last snapshot date
    const snapshotDateEl = document.querySelector('.draw-date');
    if (snapshotDateEl && state.lastSnapshot) {
        snapshotDateEl.textContent = 'Snapshot: ' + lotteryFetcher.formatDate(state.lastSnapshot);
    }

    // Update payout transaction
    updatePayoutTransaction(state);
}

/**
 * Copy address helper
 */
async function copyAddressToClipboard(address) {
    try {
        await navigator.clipboard.writeText(address);
        return true;
    } catch (error) {
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = address;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        return true;
    }
}

/**
 * Update winners display with copy buttons
 */
function updateWinnersDisplay(state) {
    const mainWinnerEl = document.getElementById('main-winner-display');
    const minorWinnersEl = document.getElementById('minor-winners-display');
    
    if (!state.winners) {
        if (mainWinnerEl) mainWinnerEl.textContent = 'No winners yet';
        if (minorWinnersEl) minorWinnersEl.textContent = 'No winners yet';
        return;
    }

    // Main winner
    if (mainWinnerEl) {
        if (state.winners.mainWinner) {
            const mainWinnerAddress = typeof state.winners.mainWinner === 'string' 
                ? state.winners.mainWinner 
                : state.winners.mainWinner.toString();
            const mainPayout = state.payouts?.mainPayout || (Number(state.jackpot) * 0.68);
            mainWinnerEl.innerHTML = `
                <span style="font-family: 'Courier New', monospace; color: #003087;">
                    ${lotteryFetcher.formatAddress(mainWinnerAddress)}
                </span>
                <button class="copy-btn" onclick="copyAddressToClipboard('${mainWinnerAddress}').then(() => { this.textContent='✅'; setTimeout(() => this.textContent='📋', 2000); })" style="margin-left: 10px; padding: 3px 10px; font-size: 0.8em;">📋</button>
                <span style="color: #DC143C; font-weight: bold; margin-left: 10px;">
                    (${lotteryFetcher.formatSOL(mainPayout)} SOL)
                </span>
                <a href="${EXPLORER_BASE}/address/${mainWinnerAddress}${EXPLORER_CLUSTER}" 
                   target="_blank" style="color: #003087; text-decoration: none; margin-left: 10px;">🔗</a>
            `;
        } else {
            mainWinnerEl.textContent = 'No main winner yet';
        }
    }

    // Minor winners - Show all 8 minor winners
    if (minorWinnersEl) {
        if (state.winners.minorWinners && state.winners.minorWinners.length > 0) {
            const validWinners = state.winners.minorWinners
                .filter(w => w && w !== '11111111111111111111111111111111');
            
            if (validWinners.length > 0) {
                const minorWinners = validWinners
                    .map((w, idx) => {
                        const address = typeof w === 'string' ? w : w.toString();
                        const payout = state.payouts?.minorPayout || (Number(state.jackpot) * 0.03);
                        return `
                            <div style="margin: 8px 0; padding: 10px; background: #f9f9f9; border-radius: 5px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                                <span style="font-weight: bold; color: #003087;">#${idx + 1}:</span>
                                <span style="font-family: 'Courier New', monospace; color: #003087;">
                                    ${lotteryFetcher.formatAddress(address)}
                                </span>
                                <button class="copy-btn" onclick="copyAddressToClipboard('${address}').then(() => { this.textContent='✅'; setTimeout(() => this.textContent='📋', 2000); })" style="padding: 3px 10px; font-size: 0.8em;">📋</button>
                                <span style="color: #DC143C; font-weight: bold;">
                                    ${lotteryFetcher.formatSOL(payout)} SOL
                                </span>
                                <a href="${EXPLORER_BASE}/address/${address}${EXPLORER_CLUSTER}" 
                                   target="_blank" style="color: #003087; text-decoration: none;">🔗 View</a>
                            </div>
                        `;
                    })
                    .join('');
                
                minorWinnersEl.innerHTML = `<div style="margin-top: 10px;"><strong>8 Minor Winners (3% each):</strong></div>${minorWinners}`;
            } else {
                minorWinnersEl.textContent = 'No minor winners yet';
            }
        } else {
            minorWinnersEl.textContent = 'No minor winners yet';
        }
    }
}

// Make copyAddressToClipboard global
window.copyAddressToClipboard = copyAddressToClipboard;

/**
 * Update payout transaction display
 */
function updatePayoutTransaction(state) {
    // Find or create payout transaction section
    let payoutSection = document.getElementById('payout-transaction');
    
    if (!payoutSection) {
        // Create payout section if it doesn't exist
        const winnersSection = document.querySelector('.winning-numbers-section');
        if (winnersSection) {
            payoutSection = document.createElement('div');
            payoutSection.id = 'payout-transaction';
            payoutSection.className = 'payout-tx-section';
            payoutSection.style.cssText = `
                margin-top: 20px;
                padding: 15px;
                background: rgba(52, 152, 219, 0.1);
                border-radius: 10px;
                border: 1px solid #3498db;
            `;
            winnersSection.appendChild(payoutSection);
        }
    }

    // Update payout transaction in winners section
    const payoutTxSection = document.getElementById('payout-tx-section');
    const payoutTxDisplay = document.getElementById('payout-tx-display');
    
    if (payoutTxSection && payoutTxDisplay) {
        if (state.payoutTx) {
            payoutTxSection.style.display = 'block';
            payoutTxDisplay.innerHTML = `
                <span style="font-family: 'Courier New', monospace; color: #003087;">
                    ${state.payoutTx.substring(0, 20)}...${state.payoutTx.substring(state.payoutTx.length - 8)}
                </span>
                <button class="copy-btn" onclick="copyAddressToClipboard('${state.payoutTx}').then(() => { this.textContent='✅'; setTimeout(() => this.textContent='📋', 2000); })" style="margin-left: 10px; padding: 3px 10px; font-size: 0.8em;">📋</button>
                <a href="${EXPLORER_BASE}/tx/${state.payoutTx}${EXPLORER_CLUSTER}" 
                   target="_blank" style="color: #003087; text-decoration: none; margin-left: 10px;">🔗 View</a>
                ${state.payoutTime ? `<span style="color: #666; margin-left: 10px;">(${lotteryFetcher.formatDate(state.payoutTime)})</span>` : ''}
            `;
        } else {
            payoutTxSection.style.display = 'none';
        }
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LotteryDataFetcher, lotteryFetcher };
}

