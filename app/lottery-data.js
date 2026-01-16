// Lottery Data Fetcher - Fetches real winners and payout data from Solana
// Uses @solana/web3.js to connect and fetch lottery account data

// PROGRAM ID - Verified working in test scripts
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
            let Connection, PublicKey;
            
            // Try to use global if available
            if (window.solanaWeb3) {
                Connection = window.solanaWeb3.Connection;
                PublicKey = window.solanaWeb3.PublicKey;
            } else if (window.web3) {
                Connection = window.web3.Connection;
                PublicKey = window.web3.PublicKey;
            } else {
                // Import from CDN
                const solana = await import('https://cdn.jsdelivr.net/npm/@solana/web3.js@1.87.6/+esm');
                Connection = solana.Connection;
                PublicKey = solana.PublicKey;
                // Store globally for reuse
                window.solanaWeb3 = { Connection, PublicKey };
            }
            
            if (!Connection || !PublicKey) {
                throw new Error('Solana Web3.js not loaded');
            }
            
            // Use Helius RPC (faster) with fallback to public RPC
            const rpcUrl = HELIUS_RPC_URL || RPC_URL;
            console.log(`🔗 Connecting to: ${rpcUrl.includes('helius') ? 'Helius RPC' : 'Public RPC'}`);
            this.connection = new Connection(rpcUrl, 'confirmed');
            
            // Test connection
            const version = await this.connection.getVersion();
            console.log(`✅ Connected to Solana ${NETWORK} (${version['solana-core']})`);
            
            // Derive lottery PDA
            const [lotteryPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('lottery')],
                new PublicKey(LOTTERY_PROGRAM_ID)
            );
            this.lotteryPDA = lotteryPDA;
            console.log(`✅ Lottery PDA: ${lotteryPDA.toString()}`);
            
            // Verify program exists first
            const programInfo = await this.connection.getAccountInfo(new PublicKey(LOTTERY_PROGRAM_ID));
            if (!programInfo) {
                console.error(`❌ CRITICAL: Program ${LOTTERY_PROGRAM_ID} NOT FOUND on ${NETWORK}!`);
                console.error(`   The program needs to be deployed to devnet first.`);
                console.error(`   Check: https://explorer.solana.com/address/${LOTTERY_PROGRAM_ID}?cluster=devnet`);
                return false;
            }
            console.log(`✅ Program verified on-chain`);
            
            // Verify account exists
            const accountInfo = await this.connection.getAccountInfo(lotteryPDA);
            if (accountInfo) {
                console.log(`✅ Lottery account found (${accountInfo.lamports / 1e9} SOL)`);
            } else {
                console.warn(`⚠️  Lottery account not initialized yet`);
                console.warn(`   Run: node scripts/quick-test-real-data.js to initialize`);
            }
            
            return true;
        } catch (error) {
            console.error('❌ Failed to initialize blockchain connection:', error);
            console.error('   Error details:', error.message);
            console.error('   Stack:', error.stack);
            
            // Show user-friendly error
            const errorEl = document.getElementById('blockchain-error');
            if (errorEl) {
                errorEl.innerHTML = `
                    <div style="padding: 20px; background: rgba(248, 81, 73, 0.1); border: 2px solid #f85149; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #f85149; margin: 0 0 10px 0;">⚠️ Blockchain Connection Error</h3>
                        <p style="margin: 0; color: #c9d1d9;">${error.message}</p>
                        <p style="margin: 10px 0 0 0; font-size: 0.9em; color: #8b949e;">
                            Check browser console for details. Verify program is deployed to devnet.
                        </p>
                    </div>
                `;
            }
            
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

            // Fallback: Use direct RPC to fetch real winners from transactions
            if (!this.connection) {
                await this.init();
            }

            // Fetch account data for jackpot
            const accountInfo = await this.connection.getAccountInfo(this.lotteryPDA);
            if (!accountInfo) {
                return { error: 'Lottery not initialized' };
            }

            // Fetch real winners from payout transactions
            const winnersData = await this.fetchRealWinnersFromTransactions();
            
            // Also fetch snapshot/participant data from transactions
            const snapshotData = await this.fetchSnapshotData();
            
            // Get jackpot from account balance (simplified)
            const jackpot = accountInfo.lamports || 0;
            
            const data = {
                jackpot: jackpot,
                winners: winnersData.winners || { mainWinner: null, minorWinners: [] },
                lastSnapshot: winnersData.lastSnapshot || snapshotData.lastSnapshot || null,
                payoutTx: winnersData.payoutTx || null,
                payoutTime: winnersData.payoutTime || null,
                payouts: winnersData.payouts || null,
                participantCount: snapshotData.participantCount || 0,
                snapshotTx: snapshotData.snapshotTx || null,
                snapshotTime: snapshotData.snapshotTime || null
            };
            
            this.cache.lotteryState = data;
            this.cache.timestamp = Date.now();
            
            return data;
        } catch (error) {
            console.error('Error fetching lottery state:', error);
            return { error: error.message };
        }
    }

    /**
     * Fetch real winners from payout transactions on-chain
     */
    async fetchRealWinnersFromTransactions() {
        try {
            if (!this.connection || !this.lotteryPDA) {
                await this.init();
            }

            // Get recent transactions for the lottery PDA
            const signatures = await this.connection.getSignaturesForAddress(
                this.lotteryPDA,
                { limit: 100 }
            );

            let mainWinner = null;
            const minorWinners = [];
            let payoutTx = null;
            let payoutTime = null;
            let lastSnapshot = null;
            let payouts = null;

            // Look for payout transactions
            for (const sig of signatures) {
                try {
                    const tx = await this.connection.getTransaction(sig.signature, {
                        commitment: 'confirmed',
                        maxSupportedTransactionVersion: 0
                    });

                    if (!tx || !tx.meta || !tx.meta.logMessages) continue;

                    // Check if this is a payout transaction
                    const isPayout = tx.meta.logMessages.some(log => 
                        log.includes('PayoutWinners') || 
                        log.includes('payout_winners') ||
                        log.includes('Winner') ||
                        (log.includes('Transfer') && log.includes('SOL'))
                    );

                    if (isPayout && tx.meta.postBalances) {
                        // Extract winner addresses from account keys
                        const accountKeys = tx.transaction.message.accountKeys;
                        const preBalances = tx.meta.preBalances || [];
                        const postBalances = tx.meta.postBalances || [];

                        // Find accounts that received SOL (balance increased significantly)
                        const recipientAccounts = [];
                        for (let i = 0; i < accountKeys.length; i++) {
                            const preBalance = preBalances[i] || 0;
                            const postBalance = postBalances[i] || 0;
                            const increase = postBalance - preBalance;

                            // If balance increased significantly (more than just fees)
                            if (increase > 1000000) { // More than 0.001 SOL
                                const account = accountKeys[i];
                                if (account && typeof account === 'object' && account.toString) {
                                    const address = account.toString();
                                    // Skip system program
                                    if (address !== '11111111111111111111111111111111') {
                                        recipientAccounts.push({
                                            address: address,
                                            amount: increase
                                        });
                                    }
                                }
                            }
                        }

                        // Sort by amount (largest first)
                        recipientAccounts.sort((a, b) => b.amount - a.amount);

                        if (recipientAccounts.length > 0) {
                            // Main winner is the one who received the most
                            mainWinner = recipientAccounts[0].address;
                            
                            // Next 8 are minor winners
                            const minors = recipientAccounts.slice(1, 9).map(w => w.address);
                            minorWinners.push(...minors);

                            payoutTx = sig.signature;
                            payoutTime = sig.blockTime;
                            
                            // Calculate payouts
                            const mainPayout = recipientAccounts[0].amount;
                            const minorPayout = recipientAccounts.length > 1 ? recipientAccounts[1].amount : 0;
                            
                            payouts = {
                                mainPayout: mainPayout,
                                minorPayout: minorPayout
                            };

                            // Found the most recent payout, break
                            break;
                        }
                    }
                } catch (e) {
                    console.error('Error processing transaction:', e);
                    continue;
                }
            }

            return {
                winners: {
                    mainWinner: mainWinner,
                    minorWinners: minorWinners
                },
                payoutTx: payoutTx,
                payoutTime: payoutTime,
                lastSnapshot: lastSnapshot,
                payouts: payouts
            };
        } catch (error) {
            console.error('Error fetching real winners:', error);
            return {
                winners: { mainWinner: null, minorWinners: [] },
                payoutTx: null,
                payoutTime: null,
                lastSnapshot: null,
                payouts: null
            };
        }
    }

    /**
     * Fetch snapshot data and participant info from transactions
     */
    async fetchSnapshotData() {
        try {
            if (!this.connection || !this.lotteryPDA) {
                await this.init();
            }

            const signatures = await this.connection.getSignaturesForAddress(
                this.lotteryPDA,
                { limit: 50 }
            );

            let lastSnapshot = null;
            let snapshotTx = null;
            let snapshotTime = null;
            let participantCount = 0;

            // Look for snapshot and entry transactions
            for (const sig of signatures) {
                try {
                    const tx = await this.connection.getTransaction(sig.signature, {
                        commitment: 'confirmed',
                        maxSupportedTransactionVersion: 0
                    });

                    if (!tx || !tx.meta || !tx.meta.logMessages) continue;

                    const logs = tx.meta.logMessages.join(' ');

                    // Check for snapshot
                    if (logs.includes('take_snapshot') || logs.includes('TakeSnapshot')) {
                        if (!lastSnapshot || sig.blockTime > lastSnapshot) {
                            lastSnapshot = sig.blockTime;
                            snapshotTx = sig.signature;
                            snapshotTime = sig.blockTime;
                        }
                    }

                    // Count entry transactions
                    if (logs.includes('enter_lottery') || logs.includes('EnterLottery')) {
                        participantCount++;
                    }
                } catch (e) {
                    continue;
                }
            }

            return {
                lastSnapshot: lastSnapshot,
                snapshotTx: snapshotTx,
                snapshotTime: snapshotTime,
                participantCount: participantCount
            };
        } catch (error) {
            console.error('Error fetching snapshot data:', error);
            return {
                lastSnapshot: null,
                snapshotTx: null,
                snapshotTime: null,
                participantCount: 0
            };
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
    // Show loading state
    const mainWinnerEl = document.getElementById('main-winner-display');
    const minorWinnersEl = document.getElementById('minor-winners-display');
    if (mainWinnerEl) mainWinnerEl.innerHTML = '<div style="color: #666; font-size: 1.2em;">Loading real data from blockchain...</div>';
    if (minorWinnersEl) minorWinnersEl.innerHTML = '<div style="color: #666;">Loading real data from blockchain...</div>';
    
    // Fetch real data from blockchain with timeout
    const loadData = async () => {
        try {
            const initPromise = lotteryFetcher.init();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Initialization timeout')), 8000)
            );
            
            await Promise.race([initPromise, timeoutPromise]);
            
            const updatePromise = updateLotteryDisplay();
            const updateTimeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Update timeout')), 10000)
            );
            
            await Promise.race([updatePromise, updateTimeout]);
            
            // Update every 30 seconds
            setInterval(updateLotteryDisplay, 30000);
        } catch (error) {
            console.error('Failed to load real data:', error);
            // Show "no data" instead of fake data
            if (mainWinnerEl) mainWinnerEl.innerHTML = '<div style="color: #666; font-size: 1.2em;">No winners yet - waiting for first payout</div>';
            if (minorWinnersEl) minorWinnersEl.innerHTML = '<div style="color: #666;">No winners yet - waiting for first payout</div>';
        }
    };
    
    loadData();
});

/**
 * Update display with data (works with test or real data)
 */
function updateLotteryDisplayWithData(state) {
    // Update jackpot
    const jackpotAmountEl = document.getElementById('jackpot-amount');
    if (jackpotAmountEl && state.jackpot) {
        jackpotAmountEl.textContent = `${(state.jackpot / 1e9).toFixed(2)} SOL`;
    }

    // Update winners
    updateWinnersDisplay(state);
    
    // Update snapshot date
    const snapshotDateEl = document.querySelector('.draw-date');
    if (snapshotDateEl && state.lastSnapshot) {
        snapshotDateEl.textContent = 'Snapshot: ' + lotteryFetcher.formatDate(state.lastSnapshot);
    }
    
    // Update payout transaction
    updatePayoutTransaction(state);
}

    /**
     * Update the HTML with real lottery data
     */
async function updateLotteryDisplay() {
    const state = await lotteryFetcher.fetchLotteryState();
    
    if (state.error) {
        console.warn('Lottery data error:', state.error);
        // Show error but also try to show what we have
        const mainWinnerEl = document.getElementById('main-winner-display');
        const minorWinnersEl = document.getElementById('minor-winners-display');
        if (mainWinnerEl) {
            mainWinnerEl.innerHTML = `<div style="color: #f85149; font-size: 1.2em;">Error: ${state.error}</div>`;
        }
        return;
    }

    // Log what we found for debugging
    console.log('📊 Lottery State:', {
        jackpot: state.jackpot,
        hasMainWinner: !!state.winners?.mainWinner,
        minorWinnersCount: state.winners?.minorWinners?.length || 0,
        participantCount: state.participantCount,
        snapshotTx: state.snapshotTx,
        payoutTx: state.payoutTx
    });

    // Update with real data
    updateLotteryDisplayWithData(state);
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

    // Main winner - BIG AND VISIBLE
    if (mainWinnerEl) {
        if (state.winners?.mainWinner) {
            const mainWinnerAddress = typeof state.winners.mainWinner === 'string' 
                ? state.winners.mainWinner 
                : state.winners.mainWinner.toString();
            const mainPayout = state.payouts?.mainPayout || (Number(state.jackpot) * 0.5);
            mainWinnerEl.innerHTML = `
                <div style="display: flex; align-items: center; justify-content: center; gap: 15px; flex-wrap: wrap;">
                    <span style="font-family: 'Courier New', monospace; color: var(--accent-green); font-size: 1.1em; font-weight: bold;">
                        ${lotteryFetcher.formatAddress(mainWinnerAddress)}
                    </span>
                    <button class="copy-btn" onclick="copyAddressToClipboard('${mainWinnerAddress}').then(() => { this.textContent='✅ COPIED!'; this.style.background='#28a745'; setTimeout(() => { this.textContent='📋 Copy'; this.style.background=''; }, 2000); })" style="padding: 8px 20px; font-size: 1em; font-weight: bold; background: var(--accent-green); color: var(--bg-primary); border: 2px solid var(--accent-green);">📋 Copy</button>
                    <span style="color: var(--accent-green); font-weight: bold; font-size: 1.3em; background: var(--bg-secondary); padding: 10px 20px; border-radius: 4px; border: 2px solid var(--accent-green);">
                        ${lotteryFetcher.formatSOL(mainPayout)} SOL
                    </span>
                    <a href="${EXPLORER_BASE}/address/${mainWinnerAddress}${EXPLORER_CLUSTER}" 
                       target="_blank" style="color: var(--accent-green); text-decoration: none; font-size: 1.2em; font-weight: bold; background: var(--bg-secondary); padding: 10px 20px; border-radius: 4px; border: 2px solid var(--accent-green);">🔗 View</a>
                </div>
            `;
        } else if (state.snapshotTx) {
            // Show snapshot info if no payout yet
            mainWinnerEl.innerHTML = `
                <div style="text-align: center; color: var(--accent-green); font-family: 'Courier New', monospace;">
                    <div style="font-size: 1.2em; margin-bottom: 10px;">📸 Snapshot Taken</div>
                    <div style="font-size: 0.9em; color: var(--text-secondary); margin-bottom: 10px;">
                        ${state.participantCount || '?'} Participants
                    </div>
                    <a href="${EXPLORER_BASE}/tx/${state.snapshotTx}${EXPLORER_CLUSTER}" 
                       target="_blank" style="color: var(--accent-green); text-decoration: none; font-size: 0.9em;">View Snapshot TX</a>
                </div>
            `;
        } else {
            mainWinnerEl.innerHTML = '<div style="color: var(--text-secondary); font-size: 1.2em; font-family: monospace;">No main winner yet</div>';
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
                            <div style="margin: 12px 0; padding: 15px; background: linear-gradient(135deg, #ffffff 0%, #f0f0f0 100%); border-radius: 10px; border: 2px solid #003087; display: flex; align-items: center; gap: 15px; flex-wrap: wrap; box-shadow: 0 3px 10px rgba(0,0,0,0.1);">
                                <span style="font-weight: bold; color: #DC143C; font-size: 1.3em; background: #fff3cd; padding: 8px 15px; border-radius: 50%; width: 50px; height: 50px; display: flex; align-items: center; justify-content: center; border: 3px solid #DC143C;">#${idx + 1}</span>
                                <span style="font-family: 'Courier New', monospace; color: #003087; font-size: 1.1em; font-weight: bold; flex: 1;">
                                    ${lotteryFetcher.formatAddress(address)}
                                </span>
                                <button class="copy-btn" onclick="copyAddressToClipboard('${address}').then(() => { this.textContent='✅'; this.style.background='#28a745'; setTimeout(() => { this.textContent='📋 Copy'; this.style.background=''; }, 2000); })" style="padding: 8px 15px; font-size: 0.9em; font-weight: bold; background: #003087; color: white;">📋 Copy</button>
                                <span style="color: #DC143C; font-weight: bold; font-size: 1.2em; background: white; padding: 8px 15px; border-radius: 8px; border: 2px solid #DC143C;">
                                    ${lotteryFetcher.formatSOL(payout)} SOL
                                </span>
                                <a href="${EXPLORER_BASE}/address/${address}${EXPLORER_CLUSTER}" 
                                   target="_blank" style="color: #003087; text-decoration: none; font-weight: bold; background: white; padding: 8px 15px; border-radius: 8px; border: 2px solid #003087;">🔗 View</a>
                            </div>
                        `;
                    })
                    .join('');
                
                minorWinnersEl.innerHTML = minorWinners;
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

