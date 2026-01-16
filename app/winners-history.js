// Fetch REAL winners from on-chain data - no test data
const LOTTERY_PROGRAM_ID = '8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7';
const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const HELIUS_API_KEY = '431ca765-2f35-4b23-8abd-db03796bd85f';
const HELIUS_RPC_URL = `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`;

class WinnersHistory {
    constructor() {
        this.connection = null;
        this.lotteryPDA = null;
        this.winners = [];
    }

    async init() {
        try {
            // Wait for Solana Web3.js to load
            let Connection, PublicKey;
            
            // Try multiple ways to get the library
            if (window.solanaWeb3 && window.solanaWeb3.Connection) {
                Connection = window.solanaWeb3.Connection;
                PublicKey = window.solanaWeb3.PublicKey;
            } else if (window.web3 && window.web3.Connection) {
                Connection = window.web3.Connection;
                PublicKey = window.web3.PublicKey;
            } else {
                // Dynamically import if not available
                const solana = await import('https://cdn.jsdelivr.net/npm/@solana/web3.js@1.87.6/+esm');
                Connection = solana.Connection;
                PublicKey = solana.PublicKey;
            }
            
            if (!Connection || !PublicKey) {
                console.error('Solana Web3.js not loaded');
                return false;
            }

            // Use Helius for better RPC performance
            this.connection = new Connection(HELIUS_RPC_URL || RPC_URL, 'confirmed');
            const [lotteryPDA] = PublicKey.findProgramAddressSync(
                [Buffer.from('lottery')],
                new PublicKey(LOTTERY_PROGRAM_ID)
            );
            this.lotteryPDA = lotteryPDA;
            return true;
        } catch (error) {
            console.error('Failed to initialize:', error);
            return false;
        }
    }

    async fetchRealWinners() {
        try {
            if (!this.connection || !this.lotteryPDA) {
                await this.init();
            }

            // Get lottery account to check for winners
            const accountInfo = await this.connection.getAccountInfo(this.lotteryPDA);
            if (!accountInfo) {
                return [];
            }

            // Get recent transactions for the lottery PDA
            const signatures = await this.connection.getSignaturesForAddress(
                this.lotteryPDA,
                { limit: 200 }
            );

            const winners = [];
            const processedTxs = new Set();

            for (const sig of signatures) {
                if (winners.length >= 10) break;
                if (processedTxs.has(sig.signature)) continue;

                try {
                    const tx = await this.connection.getTransaction(sig.signature, {
                        commitment: 'confirmed',
                        maxSupportedTransactionVersion: 0
                    });

                    if (!tx || !tx.meta || !tx.meta.logMessages) continue;

                    // Look for payout transactions
                    const isPayout = tx.meta.logMessages.some(log => 
                        log.includes('PayoutWinners') || 
                        log.includes('payout') ||
                        log.includes('Winner') ||
                        log.includes('Transfer')
                    );

                    if (isPayout && tx.meta.postBalances) {
                        // Extract winner addresses from account keys
                        const accountKeys = tx.transaction.message.accountKeys;
                        const preBalances = tx.meta.preBalances || [];
                        const postBalances = tx.meta.postBalances || [];

                        // Find accounts that received SOL (balance increased)
                        const recipientAccounts = [];
                        for (let i = 0; i < accountKeys.length; i++) {
                            const preBalance = preBalances[i] || 0;
                            const postBalance = postBalances[i] || 0;
                            const increase = postBalance - preBalance;

                            // If balance increased significantly (more than just fees)
                            if (increase > 1000000) { // More than 0.001 SOL
                                const account = accountKeys[i];
                                if (account && typeof account === 'object' && account.toString) {
                                    recipientAccounts.push({
                                        address: account.toString(),
                                        amount: increase / 1e9, // Convert to SOL
                                        isSystemProgram: account.toString() === '11111111111111111111111111111111'
                                    });
                                }
                            }
                        }

                        // Filter out system program and sort by amount
                        const realWinners = recipientAccounts
                            .filter(acc => !acc.isSystemProgram)
                            .sort((a, b) => b.amount - a.amount)
                            .slice(0, 9); // Top 9 (1 main + 8 minor)

                        if (realWinners.length > 0) {
                            // Main winner (largest amount)
                            const mainWinner = realWinners[0];
                            winners.push({
                                date: new Date(sig.blockTime * 1000),
                                transaction: sig.signature,
                                type: 'Grand Prize',
                                amount: `${mainWinner.amount.toFixed(4)} SOL`,
                                address: mainWinner.address,
                                isReal: true
                            });

                            // Minor winners
                            realWinners.slice(1).forEach((winner, idx) => {
                                winners.push({
                                    date: new Date(sig.blockTime * 1000),
                                    transaction: sig.signature,
                                    type: 'Minor Winner',
                                    amount: `${winner.amount.toFixed(4)} SOL`,
                                    address: winner.address,
                                    isReal: true
                                });
                            });

                            processedTxs.add(sig.signature);
                        }
                    }
                } catch (e) {
                    console.error('Error processing transaction:', e);
                }
            }

            // Sort by date (newest first) and limit to 10
            winners.sort((a, b) => b.date - a.date);
            this.winners = winners.slice(0, 10);
            
            return this.winners;
        } catch (error) {
            console.error('Error fetching real winners:', error);
            return [];
        }
    }

    formatAddress(address) {
        if (!address) return 'N/A';
        return `${address.slice(0, 6)}...${address.slice(-6)}`;
    }

    formatDate(date) {
        if (!date) return 'N/A';
        return new Date(date).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    async displayWinners() {
        const container = document.getElementById('winners-list');
        
        if (!container) return;

        // Show loading state
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #666;">
                <div style="font-size: 3em; margin-bottom: 20px;">⏳</div>
                <div style="font-size: 1.2em;">Loading real winners from blockchain...</div>
            </div>
        `;

        try {
            // Initialize if needed
            if (!this.connection || !this.lotteryPDA) {
                const initialized = await this.init();
                if (!initialized) {
                    throw new Error('Failed to initialize connection');
                }
            }

            // Fetch with timeout
            const winnersPromise = this.fetchRealWinners();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout')), 10000)
            );
            
            const winners = await Promise.race([winnersPromise, timeoutPromise]);
            
            if (!winners || winners.length === 0) {
                container.innerHTML = `
                    <div style="text-align: center; padding: 40px; color: #666;">
                        <div style="font-size: 3em; margin-bottom: 20px;">🎰</div>
                        <div style="font-size: 1.2em; margin-bottom: 10px;">No winners yet</div>
                        <div style="font-size: 0.9em; color: #999;">Be the first to win! Make an entry and wait for the next draw.</div>
                    </div>
                `;
                return;
            }
        } catch (error) {
            console.error('Error loading winners:', error);
            container.innerHTML = `
                <div style="text-align: center; padding: 40px; color: #666;">
                    <div style="font-size: 3em; margin-bottom: 20px;">🎰</div>
                    <div style="font-size: 1.2em; margin-bottom: 10px;">No winners yet</div>
                    <div style="font-size: 0.9em; color: #999;">Be the first to win! Make an entry and wait for the next draw.</div>
                </div>
            `;
            return;
        }

        const winners = await this.fetchRealWinners();

        container.innerHTML = winners.map((winner, index) => {
            const isGrandPrize = winner.type === 'Grand Prize';
            const cardClass = isGrandPrize ? 'winner-card grand-prize' : 'winner-card minor';
            
            return `
                <div class="${cardClass}">
                    <div class="winner-rank">
                        #${index + 1} ${isGrandPrize ? '🏆 GRAND PRIZE' : '🎯 MINOR WINNER'}
                    </div>
                    <div class="winner-date">${this.formatDate(winner.date)}</div>
                    <div class="winner-amount" style="color: ${isGrandPrize ? '#DC143C' : '#003087'};">
                        ${winner.amount}
                    </div>
                    <div class="winner-address-display">
                        <span style="font-weight: 600;">${this.formatAddress(winner.address)}</span>
                        <button class="copy-btn" onclick="copyWinnerAddress('${winner.address}')" 
                                style="margin-left: 10px; padding: 5px 10px; font-size: 0.8em; background: #003087; color: white; border: none; border-radius: 4px; cursor: pointer;">
                            📋 Copy
                        </button>
                    </div>
                    <div style="margin-top: 10px; font-size: 0.85em;">
                        <a href="https://explorer.solana.com/tx/${winner.transaction}?cluster=devnet" 
                           target="_blank" 
                           style="color: #003087; text-decoration: none; font-weight: 600;">
                            🔗 View Transaction on Explorer →
                        </a>
                    </div>
                    ${winner.isReal ? '<div style="margin-top: 5px; font-size: 0.75em; color: #28a745;">✅ Verified on-chain</div>' : ''}
                </div>
            `;
        }).join('');
    }
}

// Initialize and display
let winnersHistory = null;

async function loadWinnersHistory() {
    if (!winnersHistory) {
        winnersHistory = new WinnersHistory();
    }
    await winnersHistory.displayWinners();
}

// Copy winner address function
function copyWinnerAddress(address) {
    navigator.clipboard.writeText(address).then(() => {
        // Show feedback
        const btn = event.target;
        const originalText = btn.innerHTML;
        btn.innerHTML = '✅ Copied!';
        btn.style.background = '#28a745';
        setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = '#003087';
        }, 2000);
    }).catch(() => {
        // Fallback
        const textArea = document.createElement('textarea');
        textArea.value = address;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        alert('Address copied to clipboard!');
    });
}

// Load on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadWinnersHistory);
} else {
    loadWinnersHistory();
}

// Refresh every 60 seconds
setInterval(loadWinnersHistory, 60000);

// Make copy function global
window.copyWinnerAddress = copyWinnerAddress;
