// Lottery Data Fetcher - Fetches real winners and payout data from Solana
// Uses @solana/web3.js to connect and fetch lottery account data

// PROGRAM ID - Verified working in test scripts
// Make these available globally to avoid duplicate declarations
window.LOTTERY_PROGRAM_ID = '8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7';
const LOTTERY_PROGRAM_ID = window.LOTTERY_PROGRAM_ID;
// KNOWN PDA - Verified exists on devnet (from check-lottery-status.js)
const KNOWN_LOTTERY_PDA = 'ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb';
window.NETWORK = 'devnet'; // Testnet/Devnet for pre-live testing
const NETWORK = window.NETWORK;
window.RPC_URL = 'https://api.devnet.solana.com';
const RPC_URL = window.RPC_URL;

// Use Helius for faster RPC (works on devnet)
// Primary Helius API key
window.HELIUS_API_KEY = '431ca765-2f35-4b23-8abd-db03796bd85f';
const HELIUS_API_KEY = window.HELIUS_API_KEY;
window.HELIUS_RPC_URL = `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`;
const HELIUS_RPC_URL = window.HELIUS_RPC_URL;

// Fallback Helius API key (if you get another one, add it here)
// For now, we'll rotate between primary and public RPC
const HELIUS_RPC_URLS = [
    HELIUS_RPC_URL,
    RPC_URL // Public RPC as fallback
];
let currentRPCIndex = 0;

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
            // Rotate RPC to avoid rate limits
            let rpcUrl = HELIUS_RPC_URLS[currentRPCIndex] || RPC_URL;
            console.log(`🔗 Connecting to: ${rpcUrl.includes('helius') ? 'Helius RPC' : 'Public RPC'}`);
            this.connection = new Connection(rpcUrl, 'confirmed');
            
            // Test connection
            const version = await this.connection.getVersion();
            console.log(`✅ Connected to Solana ${NETWORK} (${version['solana-core']})`);
            
            // Store RPC info for fallback
            this.primaryRPC = rpcUrl;
            this.fallbackRPC = rpcUrl.includes('helius') ? RPC_URL : HELIUS_RPC_URL || RPC_URL;
            this.allRPCs = HELIUS_RPC_URLS;
            this.currentRPCIndex = currentRPCIndex;
            
            // Use known PDA directly (bypasses derivation issues in browser)
            // This PDA is verified to exist on devnet
            try {
                const knownPDA = new PublicKey(KNOWN_LOTTERY_PDA);
                console.log('🔑 Using known PDA (bypassing derivation):', knownPDA.toString());
                
                // Verify it's a valid PublicKey
                this.lotteryPDA = knownPDA;
                console.log(`✅ Lottery PDA set directly: ${knownPDA.toString()}`);
                
                // Also try to derive it for verification (but don't fail if it doesn't match)
                try {
                    let seedBuffer;
                    if (typeof Buffer !== 'undefined' && Buffer.from) {
                        seedBuffer = Buffer.from('lottery');
                    } else {
                        seedBuffer = new TextEncoder().encode('lottery');
                    }
                    
                    const programId = new PublicKey(LOTTERY_PROGRAM_ID);
                    const [derivedPDA] = PublicKey.findProgramAddressSync([seedBuffer], programId);
                    const derived = derivedPDA.toString();
                    
                    if (derived === KNOWN_LOTTERY_PDA) {
                        console.log('✅ Derived PDA matches known PDA - verification passed!');
                    } else {
                        console.warn('⚠️  Derived PDA differs from known PDA:');
                        console.warn(`   Derived: ${derived}`);
                        console.warn(`   Known: ${KNOWN_LOTTERY_PDA}`);
                        console.warn('   Using known PDA anyway (it exists on-chain)');
                    }
                } catch (deriveError) {
                    console.warn('⚠️  Could not derive PDA for verification (using known PDA):', deriveError.message);
                }
            } catch (pdaError) {
                console.error('❌ Failed to create PublicKey from known PDA:', pdaError);
                throw new Error(`Failed to initialize lottery PDA: ${pdaError.message || pdaError}`);
            }
            
            // Verify program exists (non-blocking - just log if not found)
            try {
                const programInfo = await this.connection.getAccountInfo(new PublicKey(LOTTERY_PROGRAM_ID));
                if (programInfo) {
                    console.log(`✅ Program verified on-chain`);
                } else {
                    console.warn(`⚠️  Program ${LOTTERY_PROGRAM_ID} not found via RPC`);
                    console.warn(`   This might be an RPC issue - continuing anyway since we know the PDA exists`);
                    console.warn(`   Check: https://explorer.solana.com/address/${LOTTERY_PROGRAM_ID}?cluster=devnet`);
                }
            } catch (programError) {
                console.warn(`⚠️  Error checking program (non-blocking):`, programError.message);
            }
            
            // Verify account exists - THIS is what matters
            let accountInfo = await this.connection.getAccountInfo(this.lotteryPDA);
            
            // If not found and we're using Helius, try public RPC as fallback
            if (!accountInfo && this.primaryRPC.includes('helius')) {
                console.log(`🔄 Account not found via Helius RPC, trying public RPC fallback...`);
                try {
                    const fallbackConnection = new Connection(this.fallbackRPC, 'confirmed');
                    accountInfo = await fallbackConnection.getAccountInfo(this.lotteryPDA);
                    if (accountInfo) {
                        console.log(`✅ Found account via public RPC! Switching to public RPC.`);
                        this.connection = fallbackConnection;
                    }
                } catch (fallbackError) {
                    console.warn(`⚠️  Fallback RPC also failed:`, fallbackError.message);
                }
            }
            
            if (accountInfo) {
                console.log(`✅ Lottery account found (${accountInfo.lamports / 1e9} SOL)`);
                console.log(`   Account data length: ${accountInfo.data.length} bytes`);
                console.log(`   Owner: ${accountInfo.owner.toString()}`);
                return true; // Account exists, we're good!
            } else {
                console.warn(`⚠️  Lottery account not found at PDA: ${this.lotteryPDA.toString()}`);
                console.warn(`   Tried both primary and fallback RPC endpoints`);
                console.warn(`   The lottery is initialized (verified by check-lottery-status.js)`);
                console.warn(`   This might be a temporary RPC issue.`);
            }
            
            return true; // Always return true - let fetchLotteryState handle the error
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
            // Ensure we have connection and PDA
            if (!this.connection || !this.lotteryPDA) {
                console.log('🔄 Re-initializing connection...');
                const initResult = await this.init();
                if (!initResult) {
                    return { error: 'Failed to initialize connection' };
                }
            }

            // Fetch account data for jackpot
            if (!this.lotteryPDA) {
                return { error: 'Lottery PDA not initialized' };
            }
            
            const pdaAddress = this.lotteryPDA.toString();
            
            console.log(`🔍 Checking account at PDA: ${pdaAddress}`);
            console.log(`   Known working PDA: ${KNOWN_LOTTERY_PDA}`);
            console.log(`   Using RPC: ${this.primaryRPC || 'unknown'}`);
            
            if (pdaAddress !== KNOWN_LOTTERY_PDA) {
                console.warn(`⚠️  PDA doesn't match known PDA, but continuing anyway`);
                console.warn(`   Current: ${pdaAddress}`);
                console.warn(`   Known: ${KNOWN_LOTTERY_PDA}`);
            } else {
                console.log(`✅ PDA matches known working PDA!`);
            }
            
            // Try to get account info with retries
            let accountInfo = null;
            let lastError = null;
            
            // First try current connection
            try {
                accountInfo = await this.connection.getAccountInfo(this.lotteryPDA);
            } catch (e) {
                lastError = e;
                console.warn(`⚠️  First attempt failed:`, e.message);
            }
            
            // If not found, try other RPC endpoints
            if (!accountInfo && this.allRPCs && this.allRPCs.length > 1) {
                console.log(`🔄 Account not found, trying other RPC endpoints...`);
                for (let i = 0; i < this.allRPCs.length; i++) {
                    if (this.allRPCs[i] === this.primaryRPC) continue; // Skip the one we already tried
                    try {
                        console.log(`   Trying RPC ${i + 1}/${this.allRPCs.length}...`);
                        const testConnection = new Connection(this.allRPCs[i], 'confirmed');
                        accountInfo = await testConnection.getAccountInfo(this.lotteryPDA);
                        if (accountInfo) {
                            console.log(`✅ Found account via RPC ${i + 1}! Switching to that RPC.`);
                            this.connection = testConnection;
                            this.primaryRPC = this.allRPCs[i];
                            break;
                        }
                    } catch (rpcError) {
                        console.warn(`   RPC ${i + 1} failed:`, rpcError.message);
                        lastError = rpcError;
                        continue;
                    }
                }
            }
            
            // If still not found, try known PDA as fallback
            if (!accountInfo && pdaAddress !== KNOWN_LOTTERY_PDA) {
                console.log(`🔄 Account not found at derived PDA, trying known PDA...`);
                try {
                    const { PublicKey } = window.solanaWeb3 || await import('https://cdn.jsdelivr.net/npm/@solana/web3.js@1.87.6/+esm');
                    const knownPDA = new PublicKey(KNOWN_LOTTERY_PDA);
                    accountInfo = await this.connection.getAccountInfo(knownPDA);
                    if (accountInfo) {
                        console.log(`✅ Found account at known PDA! Using that.`);
                        this.lotteryPDA = knownPDA;
                    }
                } catch (knownPDAError) {
                    console.warn(`⚠️  Known PDA attempt failed:`, knownPDAError.message);
                }
            }
            
            // If STILL not found, but we have a connection, return jackpot as 0 with a warning
            // This allows the page to still render
            if (!accountInfo) {
                console.error(`❌ Lottery account not found at PDA: ${pdaAddress}`);
                console.error(`   Last error:`, lastError?.message || 'Unknown');
                console.error(`   This might be an RPC issue. The account exists (verified by check-lottery-status.js)`);
                
                // Return a state with jackpot=0 instead of an error, so the page still renders
                // The error will be shown but won't block display
                return {
                    jackpot: 0, // Return 0 instead of error
                    winners: { mainWinner: null, minorWinners: [] },
                    lastSnapshot: null,
                    payoutTx: null,
                    payoutTime: null,
                    payouts: null,
                    participantCount: 0,
                    snapshotTx: null,
                    snapshotTime: null,
                    warning: 'Could not fetch account data. This might be a temporary RPC issue. Try refreshing.',
                    pda: pdaAddress,
                    knownPDA: KNOWN_LOTTERY_PDA
                };
            }
            
            console.log(`✅ Account found! Balance: ${accountInfo.lamports / 1e9} SOL, Data: ${accountInfo.data.length} bytes`);

            // Get jackpot from account balance FIRST (so we always have it)
            const jackpot = accountInfo.lamports || 0;
            console.log(`💰 Jackpot from account: ${(jackpot / 1e9).toFixed(4)} SOL`);

            // Fetch real winners from payout transactions (with timeout to avoid hanging)
            console.log('🔍 Fetching winners from transactions...');
            let winnersData = { winners: { mainWinner: null, minorWinners: [] }, payoutTx: null, payoutTime: null, payouts: null };
            try {
                const winnersPromise = this.fetchRealWinnersFromTransactions();
                const winnersTimeout = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Winners fetch timeout after 5s')), 5000)
                );
                winnersData = await Promise.race([winnersPromise, winnersTimeout]);
                console.log('✅ Winners data fetched');
            } catch (error) {
                console.warn('⚠️  Error/timeout fetching winners, using empty data:', error.message);
            }
            
            // Also fetch snapshot/participant data from transactions (with timeout)
            console.log('🔍 Fetching snapshot data...');
            let snapshotData = { lastSnapshot: null, snapshotTx: null, snapshotTime: null, participantCount: 0 };
            try {
                const snapshotPromise = this.fetchSnapshotData();
                const snapshotTimeout = new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Snapshot fetch timeout after 5s')), 5000)
                );
                snapshotData = await Promise.race([snapshotPromise, snapshotTimeout]);
                console.log('✅ Snapshot data fetched');
            } catch (error) {
                console.warn('⚠️  Error/timeout fetching snapshot, using empty data:', error.message);
            }
            
            // ALWAYS return data, even if transaction fetching failed
            const data = {
                jackpot: jackpot, // This is the most important - always have it
                winners: winnersData?.winners || { mainWinner: null, minorWinners: [] },
                lastSnapshot: winnersData?.lastSnapshot || snapshotData?.lastSnapshot || null,
                payoutTx: winnersData?.payoutTx || null,
                payoutTime: winnersData?.payoutTime || null,
                payouts: winnersData?.payouts || null,
                participantCount: snapshotData?.participantCount || 0,
                snapshotTx: snapshotData?.snapshotTx || null,
                snapshotTime: snapshotData?.snapshotTime || null
            };
            
            console.log('✅ Final lottery state:', {
                jackpot: `${(data.jackpot / 1e9).toFixed(4)} SOL`,
                jackpotRaw: data.jackpot,
                hasMainWinner: !!data.winners?.mainWinner,
                minorWinners: data.winners?.minorWinners?.length || 0,
                participantCount: data.participantCount,
                hasSnapshot: !!data.snapshotTx
            });
            
            // Cache and return - ALWAYS return data even if incomplete
            this.cache.lotteryState = data;
            this.cache.timestamp = Date.now();
            
            console.log('📤 Returning data object:', data);
            return data;
        } catch (error) {
            console.error('❌ Error fetching lottery state:', error);
            console.error('   Message:', error.message);
            console.error('   Stack:', error.stack);
            return { error: error.message || 'Unknown error' };
        }
    }

    /**
     * Fetch real winners from payout transactions on-chain
     */
    async fetchRealWinnersFromTransactions() {
        try {
            // Ensure initialization
            if (!this.connection || !this.lotteryPDA) {
                console.log('🔄 Initializing connection for winners fetch...');
                const initResult = await this.init();
                if (!initResult) {
                    console.error('❌ Init returned false in fetchRealWinnersFromTransactions');
                    throw new Error('Failed to initialize connection');
                }
                if (!this.lotteryPDA) {
                    console.error('❌ PDA still null after init in fetchRealWinnersFromTransactions');
                    throw new Error('Lottery PDA not initialized after init()');
                }
            }

            if (!this.lotteryPDA) {
                console.error('❌ PDA is null in fetchRealWinnersFromTransactions');
                throw new Error('Lottery PDA not initialized');
            }

            // Get recent transactions for the lottery PDA (reduced limit to avoid rate limits)
            const signatures = await this.connection.getSignaturesForAddress(
                this.lotteryPDA,
                { limit: 20 } // Reduced from 100 to avoid rate limits
            );
            
            console.log(`📋 Found ${signatures.length} recent transactions`);

            let mainWinner = null;
            const minorWinners = [];
            let payoutTx = null;
            let payoutTime = null;
            let lastSnapshot = null;
            let payouts = null;

            // Look for payout transactions
            let processedCount = 0;
            const maxTransactions = 10; // Limit to first 10 to avoid rate limits
            
            for (const sig of signatures) {
                if (mainWinner) break; // Found the most recent payout, break
                if (processedCount >= maxTransactions) {
                    console.log(`⏸️  Reached transaction limit (${maxTransactions}) to avoid rate limits`);
                    break;
                }
                
                try {
                    // Add small delay to avoid rate limits
                    if (processedCount > 0 && processedCount % 3 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    
                    const tx = await this.connection.getTransaction(sig.signature, {
                        commitment: 'confirmed',
                        maxSupportedTransactionVersion: 0
                    });
                    
                    processedCount++;

                    if (!tx || !tx.meta || !tx.meta.logMessages) continue;

                    // Check if this is a payout transaction - look for multiple indicators
                    const logs = tx.meta.logMessages.join(' ');
                    const isPayout = logs.includes('PayoutWinners') || 
                                    logs.includes('payout_winners') ||
                                    logs.includes('payout') ||
                                    logs.includes('Winner') ||
                                    logs.includes('winner') ||
                                    (logs.includes('Transfer') && logs.includes('SOL'));

                    // Also check if this transaction has multiple large SOL transfers (indicating payouts)
                    const hasLargeTransfers = tx.meta.postBalances && tx.meta.preBalances && 
                        tx.transaction && tx.transaction.message;
                    
                    let largeTransferCount = 0;
                    if (hasLargeTransfers) {
                        const preBalances = tx.meta.preBalances || [];
                        const postBalances = tx.meta.postBalances || [];
                        for (let i = 0; i < Math.min(preBalances.length, postBalances.length); i++) {
                            const increase = postBalances[i] - preBalances[i];
                            if (increase > 10000000) { // More than 0.01 SOL
                                largeTransferCount++;
                            }
                        }
                    }
                    
                    // Consider it a payout if it has payout logs OR multiple large transfers (9+ recipients = winners)
                    const looksLikePayout = isPayout || largeTransferCount >= 3;

                    if (looksLikePayout && tx.meta.postBalances && tx.transaction && tx.transaction.message) {
                        console.log(`💰 Found potential payout transaction: ${sig.signature.substring(0, 16)}...`);
                        console.log(`   Large transfers: ${largeTransferCount}`);
                        console.log(`   Has payout logs: ${isPayout}`);
                        // Extract winner addresses from account keys
                        const accountKeys = (tx.transaction.message.accountKeys || []);
                        const preBalances = tx.meta.preBalances || [];
                        const postBalances = tx.meta.postBalances || [];
                        
                        if (!Array.isArray(accountKeys) || accountKeys.length === 0) continue;

                        // Find accounts that received SOL (balance increased significantly)
                        const recipientAccounts = [];
                        for (let i = 0; i < accountKeys.length && i < postBalances.length; i++) {
                            const preBalance = preBalances[i] || 0;
                            const postBalance = postBalances[i] || 0;
                            const increase = postBalance - preBalance;

                            // If balance increased significantly (more than just fees)
                            // Lower threshold to catch smaller payouts
                            if (increase > 500000) { // More than 0.0005 SOL (lowered from 0.001)
                                const account = accountKeys[i];
                                if (!account) continue; // Skip null accounts
                                
                                let address = null;
                                try {
                                    // Handle different account key formats
                                    if (!account) {
                                        continue; // Skip null accounts
                                    }
                                    
                                    if (typeof account === 'string') {
                                        address = account;
                                    } else if (account && typeof account === 'object') {
                                        // Try toString first (safest)
                                        if (account.toString && typeof account.toString === 'function') {
                                            try {
                                                address = account.toString();
                                            } catch (e) {
                                                // If toString fails, try toBase58
                                                if (account.toBase58 && typeof account.toBase58 === 'function') {
                                                    address = account.toBase58();
                                                }
                                            }
                                        } else if (account.toBase58 && typeof account.toBase58 === 'function') {
                                            address = account.toBase58();
                                        } else if (account.pubkey && account.pubkey.toString) {
                                            address = account.pubkey.toString();
                                        }
                                    }
                                    
                                    // Skip if we couldn't get address or it's system program
                                    if (!address || address === '11111111111111111111111111111111') {
                                        continue;
                                    }
                                    
                                    recipientAccounts.push({
                                        address: address,
                                        amount: increase
                                    });
                                } catch (e) {
                                    console.warn('Error parsing account key:', e);
                                    continue; // Skip this account
                                }
                            }
                        }

                        // Filter out known system accounts and lottery PDA
                        const filteredRecipients = recipientAccounts.filter(acc => {
                            return acc.address !== KNOWN_LOTTERY_PDA &&
                                   acc.address !== '11111111111111111111111111111111' &&
                                   acc.address !== 'So11111111111111111111111111111111111111112'; // Wrapped SOL
                        });

                        // Sort by amount (largest first)
                        filteredRecipients.sort((a, b) => b.amount - a.amount);

                        console.log(`   Found ${filteredRecipients.length} recipient accounts after filtering`);

                        if (filteredRecipients.length > 0) {
                            // Main winner is the one who received the most
                            mainWinner = filteredRecipients[0].address;
                            const mainPayoutAmount = filteredRecipients[0].amount;
                            console.log(`   Main winner: ${mainWinner.substring(0, 16)}... (${(mainPayoutAmount / 1e9).toFixed(4)} SOL)`);
                            
                            // Next 8 are minor winners (or all remaining if less than 8)
                            // Store both address AND payout amount for each minor winner
                            const minors = filteredRecipients.slice(1, 9).map(w => {
                                console.log(`   Minor winner: ${w.address.substring(0, 16)}... (${(w.amount / 1e9).toFixed(4)} SOL)`);
                                return {
                                    address: w.address,
                                    payout: w.amount
                                };
                            });
                            
                            // Extract addresses for minorWinners array (for compatibility)
                            minorWinners.push(...minors.map(m => m.address));

                            payoutTx = sig.signature;
                            payoutTime = sig.blockTime;
                            
                            // Calculate payouts - store individual payouts
                            const mainPayout = mainPayoutAmount;
                            const minorPayout = minors.length > 0 ? minors[0].payout : 0;
                            
                            // Store individual payouts per wallet
                            const individualPayouts = {};
                            individualPayouts[mainWinner] = mainPayout;
                            minors.forEach(m => {
                                individualPayouts[m.address] = m.payout;
                            });
                            
                            payouts = {
                                mainPayout: mainPayout,
                                minorPayout: minorPayout,
                                totalRecipients: filteredRecipients.length,
                                individualPayouts: individualPayouts // NEW: Store per-wallet payouts
                            };

                            console.log(`✅ Payout transaction found! Main: ${(mainPayout / 1e9).toFixed(4)} SOL, Minors: ${minors.length}`);
                            console.log(`   Individual payouts:`, individualPayouts);

                            // Found the most recent payout, break
                            break;
                        } else {
                            console.log(`   No valid recipients found (filtered out system accounts)`);
                        }
                    }
                } catch (e) {
                    if (e.message && (e.message.includes('429') || e.message.includes('Too many requests'))) {
                        console.warn(`⚠️  Rate limited at transaction ${processedCount}, stopping fetch`);
                        break; // Stop if rate limited
                    }
                    console.warn(`⚠️  Error processing transaction ${processedCount}:`, e.message);
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
            console.error('❌ Error fetching real winners:', error);
            console.error('   Stack:', error.stack);
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
            // Ensure initialization
            if (!this.connection || !this.lotteryPDA) {
                console.log('🔄 Initializing connection for snapshot fetch...');
                const initResult = await this.init();
                if (!initResult) {
                    console.error('❌ Init returned false in fetchSnapshotData');
                    throw new Error('Failed to initialize connection');
                }
                if (!this.lotteryPDA) {
                    console.error('❌ PDA still null after init in fetchSnapshotData');
                    throw new Error('Lottery PDA not initialized after init()');
                }
            }
            
            if (!this.lotteryPDA) {
                console.error('❌ PDA is null in fetchSnapshotData');
                throw new Error('Lottery PDA not initialized');
            }

            const signatures = await this.connection.getSignaturesForAddress(
                this.lotteryPDA,
                { limit: 20 } // Reduced from 50 to avoid rate limits
            );
            
            console.log(`📋 Found ${signatures.length} signatures for snapshot data`);

            let lastSnapshot = null;
            let snapshotTx = null;
            let snapshotTime = null;
            let participantCount = 0;

            // Look for snapshot and entry transactions
            let processedCount = 0;
            const maxTransactions = 10; // Limit to avoid rate limits
            
            for (const sig of signatures) {
                if (processedCount >= maxTransactions) {
                    console.log(`⏸️  Reached transaction limit (${maxTransactions}) for snapshot data`);
                    break;
                }
                
                try {
                    // Add small delay to avoid rate limits
                    if (processedCount > 0 && processedCount % 3 === 0) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    
                    const tx = await this.connection.getTransaction(sig.signature, {
                        commitment: 'confirmed',
                        maxSupportedTransactionVersion: 0
                    });
                    
                    processedCount++;

                    if (!tx || !tx.meta || !tx.meta.logMessages) continue;

                    const logs = tx.meta.logMessages.join(' ');

                    // Check for snapshot
                    if (logs.includes('take_snapshot') || logs.includes('TakeSnapshot')) {
                        if (!lastSnapshot || sig.blockTime > lastSnapshot) {
                            lastSnapshot = sig.blockTime;
                            snapshotTx = sig.signature;
                            snapshotTime = sig.blockTime;
                            
                            // Try to determine if it was ODD (payout) or EVEN (rollover)
                            const isOdd = logs.includes('ODD') || logs.includes('PAYOUT TIME');
                            const isEven = logs.includes('EVEN') || logs.includes('ROLLOVER');
                            console.log(`   Snapshot result: ${isOdd ? 'ODD (PAYOUT TIME!)' : isEven ? 'EVEN (ROLLOVER)' : 'Unknown'}`);
                        }
                    }

                    // Count entry transactions
                    if (logs.includes('enter_lottery') || logs.includes('EnterLottery')) {
                        participantCount++;
                    }
                } catch (e) {
                    if (e.message && (e.message.includes('429') || e.message.includes('Too many requests'))) {
                        console.warn(`⚠️  Rate limited at snapshot transaction ${processedCount}, stopping`);
                        break;
                    }
                    console.warn(`⚠️  Error processing snapshot transaction ${processedCount}:`, e.message);
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
            console.error('❌ Error fetching snapshot data:', error);
            console.error('   Stack:', error.stack);
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
                    this.lotteryPDA ? this.lotteryPDA.toString() : null,
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
// Global lottery fetcher instance (will be initialized in DOMContentLoaded)
let lotteryFetcher = null;

/**
 * Update the HTML with real lottery data
 */
async function updateLotteryDisplay() {
    console.log('🔄 updateLotteryDisplay() called');
    
    try {
        const state = await lotteryFetcher.fetchLotteryState();
        console.log('📦 Received state:', state);
        
        // Show warning if present (but still display data)
        if (state.warning) {
            console.warn('⚠️ Lottery data warning:', state.warning);
            const errorEl = document.getElementById('blockchain-error');
            if (errorEl) {
                errorEl.innerHTML = `
                    <div style="padding: 15px; background: rgba(255, 193, 7, 0.1); border: 2px solid #ffc107; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; color: #ffc107;">⚠️ ${state.warning}</p>
                    </div>
                `;
            }
        }
        
        // Only block display if there's a hard error (not just a warning)
        if (state.error) {
            console.warn('⚠️ Lottery data error:', state.error);
            
            // Show helpful error message
            const errorEl = document.getElementById('blockchain-error');
            if (errorEl) {
                let errorHtml = `
                    <div style="padding: 20px; background: rgba(248, 81, 73, 0.1); border: 2px solid #f85149; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #f85149; margin: 0 0 10px 0;">⚠️ ${state.error}</h3>
                        <p style="margin: 0; color: #c9d1d9;">${state.message || state.error}</p>
                `;
                
                // Special handling for "Lottery not initialized" error
                if (state.error === 'Lottery not initialized') {
                    errorHtml += `
                        <div style="margin-top: 15px; padding: 15px; background: rgba(0, 255, 65, 0.1); border: 1px solid var(--accent-green); border-radius: 4px;">
                            <p style="margin: 0 0 10px 0; color: var(--accent-green); font-weight: bold;">📋 How to Initialize:</p>
                            <ol style="margin: 0; padding-left: 20px; color: var(--text-primary);">
                                <li style="margin-bottom: 8px;">Open terminal in the project directory</li>
                                <li style="margin-bottom: 8px;">Run: <code style="background: var(--bg-secondary); padding: 2px 6px; border-radius: 3px;">node scripts/simple-init-lottery.js</code></li>
                                <li style="margin-bottom: 8px;">Or: <code style="background: var(--bg-secondary); padding: 2px 6px; border-radius: 3px;">node scripts/reinit-lottery-50-50.js</code></li>
                                <li>Refresh this page after initialization completes</li>
                            </ol>
                            ${state.pda ? `<p style="margin-top: 10px; font-size: 0.9em; color: var(--text-secondary);">PDA: <code>${state.pda}</code></p>` : ''}
                        </div>
                    `;
                }
                
                errorHtml += `</div>`;
                errorEl.innerHTML = errorHtml;
            }
            
            // Also update winner displays
            const mainWinnerEl = document.getElementById('main-winner-display');
            const minorWinnersEl = document.getElementById('minor-winners-display');
            if (mainWinnerEl) {
                mainWinnerEl.innerHTML = `<div style="color: #f85149; font-size: 1.2em;">${state.error}</div>`;
            }
            if (minorWinnersEl) {
                minorWinnersEl.innerHTML = `<div style="color: #8b949e;">Lottery needs to be initialized first</div>`;
            }
            return;
        }

        // Log what we found for debugging
        console.log('📊 Lottery State:', {
            jackpot: state.jackpot,
            jackpotSOL: state.jackpot ? (state.jackpot / 1e9).toFixed(4) + ' SOL' : '0 SOL',
            hasMainWinner: !!state.winners?.mainWinner,
            minorWinnersCount: state.winners?.minorWinners?.length || 0,
            participantCount: state.participantCount,
            snapshotTx: state.snapshotTx,
            payoutTx: state.payoutTx,
            hasError: !!state.error
        });

        // Always update display, even if no winners
        console.log('🎨 Updating display with data...');
        console.log('   State to display:', JSON.stringify(state, null, 2));
        
        // Force update even if data seems empty
        if (!state.error) {
            updateLotteryDisplayWithData(state);
            console.log('✅ Display updated!');
        } else {
            console.warn('⚠️  Not updating display due to error:', state.error);
        }
    } catch (error) {
        console.error('❌ Error in updateLotteryDisplay:', error);
        console.error('   Stack:', error.stack);
    }
}

/**
 * Update display with data (works with test or real data)
 */
function updateLotteryDisplayWithData(state) {
    console.log('🎨 updateLotteryDisplayWithData() called with:', state);
    console.log('   State keys:', Object.keys(state));
    console.log('   Jackpot value:', state.jackpot);
    console.log('   Jackpot type:', typeof state.jackpot);
    console.log('   Jackpot raw:', state.jackpot);
    
    // Update jackpot (always update, even if 0)
    const jackpotAmountEl = document.getElementById('jackpot-amount');
    if (jackpotAmountEl) {
        // Ensure jackpot is a number
        let jackpotValue = state.jackpot;
        if (typeof jackpotValue === 'string') {
            jackpotValue = parseFloat(jackpotValue);
        }
        if (isNaN(jackpotValue) || jackpotValue === null || jackpotValue === undefined) {
            jackpotValue = 0;
        }
        
        const jackpotSOL = (jackpotValue / 1e9).toFixed(4);
        jackpotAmountEl.textContent = `${jackpotSOL} SOL`;
        console.log(`💰 Updated jackpot: ${jackpotSOL} SOL (from ${jackpotValue} lamports)`);
        
        // Force a visual update
        jackpotAmountEl.style.display = 'block';
        jackpotAmountEl.style.visibility = 'visible';
        jackpotAmountEl.style.opacity = '1';
    } else {
        console.error('❌ jackpot-amount element NOT FOUND in DOM!');
        console.error('   Available elements with "jackpot" in id:', 
            Array.from(document.querySelectorAll('[id*="jackpot"]')).map(el => el.id));
    }

    // Update winners (even if empty)
    console.log('🏆 Updating winners display...');
    console.log('   Winners data:', state.winners);
    if (state.winners) {
        updateWinnersDisplay(state);
    } else {
        console.warn('⚠️  No winners data in state');
    }
    
    // Update snapshot date/link
    const snapshotDateEl = document.querySelector('.draw-date');
    if (!snapshotDateEl) {
        // Try to find any element that might show snapshot info
        console.log('📅 Looking for snapshot display element...');
    } else {
        if (state.lastSnapshot) {
            snapshotDateEl.textContent = 'Snapshot: ' + lotteryFetcher.formatDate(state.lastSnapshot);
            console.log('📅 Updated snapshot date');
        } else if (state.snapshotTx) {
            snapshotDateEl.innerHTML = `Snapshot: <a href="${EXPLORER_BASE}/tx/${state.snapshotTx}${EXPLORER_CLUSTER}" target="_blank" style="color: var(--accent-green);">View TX</a>`;
            console.log('📅 Snapshot transaction link created');
        } else {
            snapshotDateEl.textContent = 'No snapshot yet';
            console.log('📅 No snapshot data');
        }
    }
    
    // Update payout transaction
    if (typeof updatePayoutTransaction === 'function') {
        updatePayoutTransaction(state);
    } else {
        console.warn('⚠️  updatePayoutTransaction function not found');
    }
    
    // Update "What's Next" section
    updateWhatsNext(state);
    
    // Clear any error messages if we got data
    const errorEl = document.getElementById('blockchain-error');
    if (errorEl && !state.error) {
        errorEl.innerHTML = '';
        console.log('✅ Cleared error message');
    }
    
    console.log('✅ Display update complete!');
}

/**
 * Update "What's Next" section with exciting info
 */
function updateWhatsNext(state) {
    const whatsNextEl = document.getElementById('whats-next-content');
    if (!whatsNextEl) return;
    
    const hasWinners = state.winners?.mainWinner;
    const hasSnapshot = state.snapshotTx;
    const participantCount = state.participantCount || 0;
    const jackpotSOL = state.jackpot ? (state.jackpot / 1e9).toFixed(4) : '0.0000';
    
    let content = '';
    
    if (hasWinners && state.payoutTx) {
        // Just had a payout - show next draw info
        content = `
            <div style="text-align: center; padding: 25px; background: var(--bg-card); border-radius: 12px; border: 2px solid var(--accent-green); animation: pulse 2s infinite;">
                <div style="font-size: 2.5em; margin-bottom: 15px;">🎰</div>
                <div style="font-size: 1.3em; color: var(--accent-green); font-weight: bold; margin-bottom: 10px;">Next Draw Coming!</div>
                <div style="font-size: 1em; color: var(--text-primary); margin-bottom: 15px;">Get your entries in now!</div>
                <div style="font-size: 0.9em; color: var(--text-secondary);">Current Jackpot: <span style="color: var(--accent-green); font-weight: bold;">${jackpotSOL} SOL</span></div>
            </div>
            <div style="text-align: center; padding: 25px; background: var(--bg-card); border-radius: 12px; border: 2px solid var(--accent-cyan);">
                <div style="font-size: 2em; margin-bottom: 15px;">📊</div>
                <div style="font-size: 1.2em; color: var(--accent-cyan); font-weight: bold; margin-bottom: 10px;">${participantCount} Participants</div>
                <div style="font-size: 0.9em; color: var(--text-secondary);">Ready for next snapshot</div>
            </div>
            <div style="text-align: center; padding: 25px; background: var(--bg-card); border-radius: 12px; border: 2px solid var(--accent-green);">
                <div style="font-size: 2em; margin-bottom: 15px;">💰</div>
                <div style="font-size: 1.2em; color: var(--accent-green); font-weight: bold; margin-bottom: 10px;">50/50 Rollover</div>
                <div style="font-size: 0.9em; color: var(--text-secondary);">ODD = Payout • EVEN = Rollover</div>
            </div>
        `;
    } else if (hasSnapshot && !state.payoutTx) {
        // Snapshot taken, waiting for payout
        content = `
            <div style="text-align: center; padding: 25px; background: var(--bg-card); border-radius: 12px; border: 2px solid #ffc107; animation: pulse 2s infinite;">
                <div style="font-size: 2.5em; margin-bottom: 15px;">⏳</div>
                <div style="font-size: 1.3em; color: #ffc107; font-weight: bold; margin-bottom: 10px;">Waiting for Payout</div>
                <div style="font-size: 1em; color: var(--text-primary); margin-bottom: 15px;">Snapshot taken with ${participantCount} participants</div>
                <div style="font-size: 0.9em; color: var(--text-secondary);">If ODD, payout will be triggered</div>
            </div>
            <div style="text-align: center; padding: 25px; background: var(--bg-card); border-radius: 12px; border: 2px solid var(--accent-green);">
                <div style="font-size: 2em; margin-bottom: 15px;">🎯</div>
                <div style="font-size: 1.2em; color: var(--accent-green); font-weight: bold; margin-bottom: 10px;">Next Steps</div>
                <div style="font-size: 0.9em; color: var(--text-secondary); text-align: left; margin-top: 10px;">
                    <div style="margin-bottom: 8px;">1. Winners calculated from seed</div>
                    <div style="margin-bottom: 8px;">2. Winners set on-chain</div>
                    <div>3. Payout executed</div>
                </div>
            </div>
        `;
    } else {
        // No snapshot yet - encourage entries
        content = `
            <div style="text-align: center; padding: 25px; background: var(--bg-card); border-radius: 12px; border: 2px solid var(--accent-green); animation: pulse 2s infinite;">
                <div style="font-size: 2.5em; margin-bottom: 15px;">🎲</div>
                <div style="font-size: 1.3em; color: var(--accent-green); font-weight: bold; margin-bottom: 10px;">Get Your Entry In!</div>
                <div style="font-size: 1em; color: var(--text-primary); margin-bottom: 15px;">Hold $20+ worth of PEPEBALL tokens</div>
                <div style="font-size: 0.9em; color: var(--text-secondary);">Current Jackpot: <span style="color: var(--accent-green); font-weight: bold;">${jackpotSOL} SOL</span></div>
            </div>
            <div style="text-align: center; padding: 25px; background: var(--bg-card); border-radius: 12px; border: 2px solid var(--accent-cyan);">
                <div style="font-size: 2em; margin-bottom: 15px;">📈</div>
                <div style="font-size: 1.2em; color: var(--accent-cyan); font-weight: bold; margin-bottom: 10px;">${participantCount} Participants</div>
                <div style="font-size: 0.9em; color: var(--text-secondary);">Need 9+ for snapshot</div>
            </div>
            <div style="text-align: center; padding: 25px; background: var(--bg-card); border-radius: 12px; border: 2px solid var(--accent-green);">
                <div style="font-size: 2em; margin-bottom: 15px;">⏰</div>
                <div style="font-size: 1.2em; color: var(--accent-green); font-weight: bold; margin-bottom: 10px;">Next Draw</div>
                <div style="font-size: 0.9em; color: var(--text-secondary);">When conditions are met</div>
            </div>
        `;
    }
    
    whatsNextEl.innerHTML = content;
}

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
            console.log('📦 Creating LotteryDataFetcher...');
            lotteryFetcher = new LotteryDataFetcher();
            
            console.log('🔗 Initializing connection...');
            const initPromise = lotteryFetcher.init();
            const timeoutPromise = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Initialization timeout after 15 seconds')), 15000)
            );
            
            const initResult = await Promise.race([initPromise, timeoutPromise]);
            console.log('✅ Initialization complete:', initResult);
            
            console.log('📊 Fetching lottery state...');
            const updatePromise = updateLotteryDisplay();
            const updateTimeout = new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Update timeout after 20 seconds')), 20000)
            );
            
            await Promise.race([updatePromise, updateTimeout]);
            console.log('✅ Initial update complete!');
            
            // Update every 30 seconds
            console.log('⏰ Setting up auto-refresh (every 30 seconds)...');
            setInterval(() => {
                console.log('🔄 Auto-refresh triggered');
                updateLotteryDisplay().catch(err => console.error('Auto-refresh error:', err));
            }, 30000);
        } catch (error) {
            console.error('❌ Failed to load real data:', error);
            console.error('   Error message:', error.message);
            console.error('   Error stack:', error.stack);
            
            // Show error message
            const errorEl = document.getElementById('blockchain-error');
            if (errorEl) {
                errorEl.innerHTML = `
                    <div style="padding: 20px; background: rgba(248, 81, 73, 0.1); border: 2px solid #f85149; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #f85149; margin: 0 0 10px 0;">⚠️ Failed to Load Data</h3>
                        <p style="margin: 0; color: #c9d1d9;">${error.message || 'Unknown error'}</p>
                        <p style="margin: 10px 0 0 0; font-size: 0.9em; color: #8b949e;">Check browser console (F12) for detailed logs.</p>
                    </div>
                `;
            }
            
            // Show "no data" instead of fake data
            if (mainWinnerEl) mainWinnerEl.innerHTML = '<div style="color: var(--text-secondary); font-size: 1.2em;">⚠️ Failed to load data - check console</div>';
            if (minorWinnersEl) minorWinnersEl.innerHTML = '<div style="color: var(--text-secondary);">⚠️ Failed to load data - check console</div>';
        }
    };
    
    loadData();
});

    /**
     * Update the HTML with real lottery data
     */
async function updateLotteryDisplay() {
    console.log('🔄 updateLotteryDisplay() called');
    
    try {
        const state = await lotteryFetcher.fetchLotteryState();
        console.log('📦 Received state:', state);
        
        // Show warning if present (but still display data)
        if (state.warning) {
            console.warn('⚠️ Lottery data warning:', state.warning);
            const errorEl = document.getElementById('blockchain-error');
            if (errorEl) {
                errorEl.innerHTML = `
                    <div style="padding: 15px; background: rgba(255, 193, 7, 0.1); border: 2px solid #ffc107; border-radius: 8px; margin: 20px 0;">
                        <p style="margin: 0; color: #ffc107;">⚠️ ${state.warning}</p>
                    </div>
                `;
            }
        }
        
        // Only block display if there's a hard error (not just a warning)
        if (state.error) {
            console.warn('⚠️ Lottery data error:', state.error);
            
            // Show helpful error message
            const errorEl = document.getElementById('blockchain-error');
            if (errorEl) {
                let errorHtml = `
                    <div style="padding: 20px; background: rgba(248, 81, 73, 0.1); border: 2px solid #f85149; border-radius: 8px; margin: 20px 0;">
                        <h3 style="color: #f85149; margin: 0 0 10px 0;">⚠️ ${state.error}</h3>
                        <p style="margin: 0; color: #c9d1d9;">${state.message || state.error}</p>
                `;
                
                // Special handling for "Lottery not initialized" error
                if (state.error === 'Lottery not initialized') {
                    errorHtml += `
                        <div style="margin-top: 15px; padding: 15px; background: rgba(0, 255, 65, 0.1); border: 1px solid var(--accent-green); border-radius: 4px;">
                            <p style="margin: 0 0 10px 0; color: var(--accent-green); font-weight: bold;">📋 How to Initialize:</p>
                            <ol style="margin: 0; padding-left: 20px; color: var(--text-primary);">
                                <li style="margin-bottom: 8px;">Open terminal in the project directory</li>
                                <li style="margin-bottom: 8px;">Run: <code style="background: var(--bg-secondary); padding: 2px 6px; border-radius: 3px;">node scripts/simple-init-lottery.js</code></li>
                                <li style="margin-bottom: 8px;">Or: <code style="background: var(--bg-secondary); padding: 2px 6px; border-radius: 3px;">node scripts/reinit-lottery-50-50.js</code></li>
                                <li>Refresh this page after initialization completes</li>
                            </ol>
                            ${state.pda ? `<p style="margin-top: 10px; font-size: 0.9em; color: var(--text-secondary);">PDA: <code>${state.pda}</code></p>` : ''}
                        </div>
                    `;
                }
                
                errorHtml += `</div>`;
                errorEl.innerHTML = errorHtml;
            }
            
            // Also update winner displays
            const mainWinnerEl = document.getElementById('main-winner-display');
            const minorWinnersEl = document.getElementById('minor-winners-display');
            if (mainWinnerEl) {
                mainWinnerEl.innerHTML = `<div style="color: #f85149; font-size: 1.2em;">${state.error}</div>`;
            }
            if (minorWinnersEl) {
                minorWinnersEl.innerHTML = `<div style="color: #8b949e;">Lottery needs to be initialized first</div>`;
            }
            return;
        }

        // Log what we found for debugging
        console.log('📊 Lottery State:', {
            jackpot: state.jackpot,
            jackpotSOL: state.jackpot ? (state.jackpot / 1e9).toFixed(4) + ' SOL' : '0 SOL',
            hasMainWinner: !!state.winners?.mainWinner,
            minorWinnersCount: state.winners?.minorWinners?.length || 0,
            participantCount: state.participantCount,
            snapshotTx: state.snapshotTx,
            payoutTx: state.payoutTx,
            hasError: !!state.error
        });

        // Always update display, even if no winners
        console.log('🎨 Updating display with data...');
        console.log('   State to display:', JSON.stringify(state, null, 2));
        
        // Force update even if data seems empty
        if (!state.error) {
            updateLotteryDisplayWithData(state);
            console.log('✅ Display updated!');
        } else {
            console.warn('⚠️  Not updating display due to error:', state.error);
        }
    } catch (error) {
        console.error('❌ Error in updateLotteryDisplay:', error);
        console.error('   Stack:', error.stack);
        
        const errorEl = document.getElementById('blockchain-error');
        if (errorEl) {
            errorEl.innerHTML = `
                <div style="padding: 20px; background: rgba(248, 81, 73, 0.1); border: 2px solid #f85149; border-radius: 8px; margin: 20px 0;">
                    <h3 style="color: #f85149; margin: 0 0 10px 0;">⚠️ JavaScript Error</h3>
                    <p style="margin: 0; color: #c9d1d9;">${error.message || 'Unknown error'}</p>
                    <p style="margin: 10px 0 0 0; font-size: 0.9em; color: #8b949e;">Check browser console for full error details.</p>
                </div>
            `;
        }
    }
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
 * Update winners display with copy buttons - EXCITING VERSION!
 */
function updateWinnersDisplay(state) {
    console.log('🏆 updateWinnersDisplay() called');
    const mainWinnerEl = document.getElementById('main-winner-display');
    const minorWinnersEl = document.getElementById('minor-winners-display');
    
    console.log('   Main winner element found:', !!mainWinnerEl);
    console.log('   Minor winners element found:', !!minorWinnersEl);
    console.log('   State.winners:', state.winners);
    console.log('   State.payouts:', state.payouts);
    
    if (!state.winners) {
        console.log('   No winners object, showing "No winners yet"');
        if (mainWinnerEl) {
            mainWinnerEl.innerHTML = '<div style="color: var(--text-secondary); font-size: 1.2em;">No winners yet</div>';
        }
        if (minorWinnersEl) {
            minorWinnersEl.innerHTML = '<div style="color: var(--text-secondary);">No winners yet</div>';
        }
        return;
    }

    // Main winner - BIG, EXCITING, ANIMATED!
    if (mainWinnerEl) {
        if (state.winners?.mainWinner) {
            const mainWinnerAddress = typeof state.winners.mainWinner === 'string' 
                ? state.winners.mainWinner 
                : (state.winners.mainWinner?.toString() || '');
            if (!mainWinnerAddress) {
                mainWinnerEl.innerHTML = '<div style="color: var(--text-secondary); font-size: 1.2em;">Invalid winner address</div>';
                return;
            }
            // Get actual payout amount from transaction data if available
            const mainPayout = state.payouts?.mainPayout || (Number(state.jackpot) * 0.5);
            const mainPayoutSOL = lotteryFetcher.formatSOL(mainPayout);
            
            console.log(`   Main winner payout: ${mainPayoutSOL} SOL (${mainPayout} lamports)`);
            
            // Trigger confetti animation
            setTimeout(() => {
                if (window.createConfetti) {
                    window.createConfetti();
                }
            }, 100);
            
            mainWinnerEl.innerHTML = `
                <div class="winner-celebration" style="animation: pulse 2s infinite; padding: 30px; background: linear-gradient(135deg, rgba(0,255,65,0.1) 0%, rgba(0,255,65,0.05) 100%); border: 3px solid var(--accent-green); border-radius: 16px; box-shadow: 0 0 30px rgba(0,255,65,0.4);">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <div style="font-size: 3em; margin-bottom: 10px;">🎉🏆🎉</div>
                        <div style="font-size: 1.5em; color: var(--accent-green); font-weight: bold; margin-bottom: 15px; text-transform: uppercase; letter-spacing: 2px;">GRAND PRIZE WINNER!</div>
                    </div>
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 20px;">
                        <div style="font-size: 4em; font-weight: bold; color: var(--accent-green); text-shadow: 0 0 20px rgba(0,255,65,0.8); font-family: 'Courier New', monospace;">
                            ${mainPayoutSOL} SOL
                        </div>
                        <div style="font-size: 1.3em; color: var(--text-primary); margin-bottom: 10px;">50% of Jackpot</div>
                        <div style="display: flex; align-items: center; justify-content: center; gap: 15px; flex-wrap: wrap; background: var(--bg-secondary); padding: 20px; border-radius: 12px; border: 2px solid var(--accent-green);">
                            <span style="font-family: 'Courier New', monospace; color: var(--accent-green); font-size: 1.2em; font-weight: bold;">
                                ${lotteryFetcher.formatAddress(mainWinnerAddress)}
                            </span>
                            <button class="copy-btn" onclick="copyAddressToClipboard('${mainWinnerAddress}').then(() => { this.textContent='✅ COPIED!'; this.style.background='#28a745'; setTimeout(() => { this.textContent='📋 Copy'; this.style.background=''; }, 2000); })" style="padding: 10px 20px; font-size: 1em; font-weight: bold; background: var(--accent-green); color: var(--bg-primary); border: 2px solid var(--accent-green); cursor: pointer; border-radius: 8px;">📋 Copy</button>
                            <a href="${EXPLORER_BASE}/address/${mainWinnerAddress}${EXPLORER_CLUSTER}" 
                               target="_blank" style="color: var(--accent-green); text-decoration: none; font-size: 1.1em; font-weight: bold; background: var(--bg-secondary); padding: 10px 20px; border-radius: 8px; border: 2px solid var(--accent-green);">🔗 View Wallet</a>
                        </div>
                        ${state.payoutTx ? `
                            <div style="margin-top: 15px; font-size: 0.9em; color: var(--text-secondary);">
                                <a href="${EXPLORER_BASE}/tx/${state.payoutTx}${EXPLORER_CLUSTER}" target="_blank" style="color: var(--accent-green); text-decoration: none;">📋 View Payout Transaction</a>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        } else if (state.snapshotTx) {
            const isRollover = !state.payoutTx && state.snapshotTx;
            mainWinnerEl.innerHTML = `
                <div style="text-align: center; padding: 30px; background: var(--bg-card); border: 2px solid var(--border-color); border-radius: 16px;">
                    <div style="font-size: 2.5em; margin-bottom: 15px;">📸</div>
                    <div style="font-size: 1.5em; color: var(--accent-green); font-weight: bold; margin-bottom: 15px; text-transform: uppercase;">Snapshot Taken!</div>
                    <div style="font-size: 1.1em; color: var(--text-primary); margin-bottom: 10px;">
                        ${state.participantCount || '?'} Participants
                    </div>
                    ${isRollover ? 
                        '<div style="font-size: 1em; color: var(--accent-cyan); margin-bottom: 15px; padding: 15px; background: rgba(0,255,255,0.1); border-radius: 8px; border: 2px solid var(--accent-cyan);">🚀 ROLLOVER - Jackpot Growing!</div>' :
                        '<div style="font-size: 1em; color: var(--text-secondary); margin-bottom: 15px; padding: 15px; background: rgba(255,193,7,0.1); border-radius: 8px; border: 2px solid #ffc107;">⏳ Waiting for payout...</div>'
                    }
                    <a href="${EXPLORER_BASE}/tx/${state.snapshotTx}${EXPLORER_CLUSTER}" 
                       target="_blank" style="color: var(--accent-green); text-decoration: none; font-size: 1em; font-weight: bold; padding: 10px 20px; background: var(--bg-secondary); border-radius: 8px; border: 2px solid var(--accent-green); display: inline-block; margin-top: 10px;">🔗 View Snapshot TX</a>
                </div>
            `;
        } else {
            mainWinnerEl.innerHTML = '<div style="color: var(--text-secondary); font-size: 1.2em; font-family: monospace; text-align: center; padding: 30px;">Be the first to win! Make an entry and wait for the next draw.</div>';
        }
    }

    // Minor winners - Show ALL with individual payouts
    if (minorWinnersEl) {
        if (state.winners.minorWinners && state.winners.minorWinners.length > 0) {
            const validWinners = state.winners.minorWinners
                .filter(w => w && w !== '11111111111111111111111111111111');
            
            if (validWinners.length > 0) {
                // Get individual payouts if available, otherwise calculate
                const individualPayouts = state.payouts?.individualPayouts || {};
                const defaultMinorPayout = state.payouts?.minorPayout || (Number(state.jackpot) * 0.05); // 5% each
                
                const minorWinnersHTML = validWinners
                    .map((w, idx) => {
                        const address = typeof w === 'string' ? w : (w?.toString() || '');
                        if (!address || address === '11111111111111111111111111111111') return null;
                        
                        // Use individual payout if available, otherwise use default
                        const walletPayout = individualPayouts[address] || defaultMinorPayout;
                        const payoutSOL = lotteryFetcher.formatSOL(walletPayout);
                        
                        return `
                            <div class="minor-winner-card" style="margin: 15px 0; padding: 20px; background: linear-gradient(135deg, rgba(0,255,65,0.1) 0%, rgba(0,255,65,0.05) 100%); border-radius: 12px; border: 2px solid var(--accent-green); display: flex; align-items: center; gap: 15px; flex-wrap: wrap; box-shadow: 0 4px 15px rgba(0,255,65,0.2); transition: transform 0.3s; animation: slideIn 0.5s ease-out ${idx * 0.1}s both;">
                                <div style="font-weight: bold; color: var(--accent-green); font-size: 1.5em; background: var(--bg-secondary); padding: 12px 18px; border-radius: 50%; width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; border: 3px solid var(--accent-green); box-shadow: 0 0 15px rgba(0,255,65,0.4);">#${idx + 1}</div>
                                <div style="flex: 1; min-width: 200px;">
                                    <div style="font-family: 'Courier New', monospace; color: var(--accent-green); font-size: 1.1em; font-weight: bold; margin-bottom: 5px;">
                                        ${lotteryFetcher.formatAddress(address)}
                                    </div>
                                    <div style="font-size: 0.85em; color: var(--text-secondary);">5% of Jackpot</div>
                                </div>
                                <div style="font-size: 1.8em; font-weight: bold; color: var(--accent-green); text-shadow: 0 0 10px rgba(0,255,65,0.5); font-family: 'Courier New', monospace; margin: 0 10px;">
                                    ${payoutSOL} SOL
                                </div>
                                <button class="copy-btn" onclick="copyAddressToClipboard('${address}').then(() => { this.textContent='✅'; this.style.background='#28a745'; setTimeout(() => { this.textContent='📋'; this.style.background=''; }, 2000); })" style="padding: 10px 15px; font-size: 0.9em; font-weight: bold; background: var(--accent-green); color: var(--bg-primary); border: 2px solid var(--accent-green); cursor: pointer; border-radius: 8px;">📋</button>
                                <a href="${EXPLORER_BASE}/address/${address}${EXPLORER_CLUSTER}" 
                                   target="_blank" style="color: var(--accent-green); text-decoration: none; font-weight: bold; background: var(--bg-secondary); padding: 10px 15px; border-radius: 8px; border: 2px solid var(--accent-green);">🔗</a>
                            </div>
                        `;
                    })
                    .filter(w => w !== null)
                    .join('');
                
                minorWinnersEl.innerHTML = `
                    <div style="margin-bottom: 20px; text-align: center;">
                        <div style="font-size: 1.8em; color: var(--accent-green); font-weight: bold; margin-bottom: 10px;">🎯 ${validWinners.length} Minor Winners</div>
                        <div style="font-size: 1em; color: var(--text-secondary);">Each receives 5% of the jackpot (40% total)</div>
                    </div>
                    ${minorWinnersHTML}
                `;
            } else {
                if (state.snapshotTx && !state.payoutTx) {
                    minorWinnersEl.innerHTML = `
                        <div style="text-align: center; padding: 30px; color: var(--text-secondary);">
                            <div style="font-size: 1.3em; margin-bottom: 15px;">⏳ Waiting for payout</div>
                            <div style="font-size: 1em; color: var(--text-primary); margin-bottom: 10px;">
                                Snapshot taken with ${state.participantCount || '?'} participants
                            </div>
                            <div style="font-size: 0.9em; color: var(--accent-cyan); margin-top: 15px; padding: 15px; background: rgba(0,255,255,0.1); border-radius: 8px;">
                                If snapshot was ODD, payout needs to be triggered
                            </div>
                        </div>
                    `;
                } else {
                    minorWinnersEl.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--text-secondary); font-size: 1.1em;">No minor winners yet</div>';
                }
            }
        } else {
            if (state.snapshotTx && !state.payoutTx) {
                minorWinnersEl.innerHTML = `
                    <div style="text-align: center; padding: 30px; color: var(--text-secondary);">
                        <div style="font-size: 1.3em; margin-bottom: 15px;">⏳ Waiting for payout</div>
                        <div style="font-size: 1em; color: var(--text-primary); margin-bottom: 10px;">
                            Snapshot taken with ${state.participantCount || '?'} participants
                        </div>
                        <div style="font-size: 0.9em; color: var(--accent-cyan); margin-top: 15px; padding: 15px; background: rgba(0,255,255,0.1); border-radius: 8px;">
                            If snapshot was ODD, payout needs to be triggered
                        </div>
                    </div>
                `;
            } else {
                minorWinnersEl.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--text-secondary); font-size: 1.1em;">No minor winners yet</div>';
            }
        }
    }
    
    // Add CSS animations if not already added
    if (!document.getElementById('winner-animations')) {
        const style = document.createElement('style');
        style.id = 'winner-animations';
        style.textContent = `
            @keyframes pulse {
                0%, 100% { transform: scale(1); box-shadow: 0 0 30px rgba(0,255,65,0.4); }
                50% { transform: scale(1.02); box-shadow: 0 0 50px rgba(0,255,65,0.6); }
            }
            @keyframes slideIn {
                from { opacity: 0; transform: translateX(-20px); }
                to { opacity: 1; transform: translateX(0); }
            }
            .minor-winner-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 6px 25px rgba(0,255,65,0.4);
            }
        `;
        document.head.appendChild(style);
    }
}

// Make copyAddressToClipboard global
window.copyAddressToClipboard = copyAddressToClipboard;

/**
 * Update payout transaction display
 */
function updatePayoutTransaction(state) {
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
        } else if (state.snapshotTx) {
            // Show snapshot info if no payout yet
            payoutTxSection.style.display = 'block';
            payoutTxDisplay.innerHTML = `
                <div style="text-align: center; color: var(--text-secondary);">
                    <div style="margin-bottom: 8px;">📸 Snapshot taken, waiting for payout</div>
                    <div style="font-size: 0.85em; color: var(--accent-cyan);">
                        <a href="${EXPLORER_BASE}/tx/${state.snapshotTx}${EXPLORER_CLUSTER}" 
                           target="_blank" style="color: var(--accent-cyan); text-decoration: none;">View Snapshot TX</a>
                    </div>
                    <div style="font-size: 0.8em; color: var(--text-secondary); margin-top: 8px;">
                        If snapshot was ODD, trigger payout_winners instruction
                    </div>
                </div>
            `;
        } else {
            payoutTxSection.style.display = 'block';
            payoutTxDisplay.textContent = 'No payout transaction yet';
        }
    }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { LotteryDataFetcher, lotteryFetcher };
}

