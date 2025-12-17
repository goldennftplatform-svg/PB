// Auto-Entry Monitor - Automatically enters Pump.fun buyers into lottery
// Monitors token transfers and auto-enters buyers who meet $20 minimum

const { Connection, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = clusterApiUrl(NETWORK);

// Program IDs
const TOKEN_PROGRAM_ID = new PublicKey('HArmxo4FBfy7RiT3iS7erxvC23L1AreU9AskyXc3iuhR');
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');

// Minimum USD value for entry
const MIN_ENTRY_USD = 20.00; // $20 minimum

class AutoEntryMonitor {
    constructor() {
        this.connection = new Connection(RPC_URL, 'confirmed');
        this.processedSignatures = new Set();
        this.priceService = null; // Will be initialized
    }

    async start() {
        console.log('🎰 Auto-Entry Monitor Started\n');
        console.log('Monitoring token transfers for auto-entry...\n');
        console.log(`Token Program: ${TOKEN_PROGRAM_ID.toString()}`);
        console.log(`Lottery Program: ${LOTTERY_PROGRAM_ID.toString()}\n`);

        // Monitor for new token transfers
        this.monitorTransfers();
    }

    async monitorTransfers() {
        try {
            // Get recent transactions for token program
            const signatures = await this.connection.getSignaturesForAddress(
                TOKEN_PROGRAM_ID,
                { limit: 10 }
            );

            for (const sigInfo of signatures) {
                if (this.processedSignatures.has(sigInfo.signature)) {
                    continue;
                }

                try {
                    const tx = await this.connection.getTransaction(sigInfo.signature, {
                        maxSupportedTransactionVersion: 0
                    });

                    if (tx && tx.meta && tx.meta.logMessages) {
                        // Check if this is a token transfer
                        const isTransfer = tx.meta.logMessages.some(log => 
                            log.includes('Transfer') || log.includes('transfer_with_tax')
                        );

                        if (isTransfer) {
                            await this.processTransfer(tx);
                        }
                    }

                    this.processedSignatures.add(sigInfo.signature);
                } catch (error) {
                    console.error(`Error processing transaction ${sigInfo.signature}:`, error.message);
                }
            }

            // Check again in 10 seconds
            setTimeout(() => this.monitorTransfers(), 10000);
        } catch (error) {
            console.error('Monitor error:', error);
            setTimeout(() => this.monitorTransfers(), 30000);
        }
    }

    async processTransfer(tx) {
        try {
            // Extract recipient from transaction
            // This is simplified - actual implementation would parse accounts properly
            const accounts = tx.transaction.message.accountKeys;
            
            // Find token account changes
            const preBalances = tx.meta.preTokenBalances || [];
            const postBalances = tx.meta.postTokenBalances || [];

            for (const postBalance of postBalances) {
                const accountIndex = postBalance.accountIndex;
                const owner = postBalance.owner;
                const uiAmount = postBalance.uiTokenAmount.uiAmount;

                if (uiAmount > 0) {
                    // New tokens received
                    const recipient = new PublicKey(owner);
                    
                    // Calculate USD value
                    const usdValue = await this.calculateUSDValue(uiAmount);
                    
                    if (usdValue >= MIN_ENTRY_USD) {
                        console.log(`\n🎰 Auto-Entry Triggered!`);
                        console.log(`   Recipient: ${recipient.toString()}`);
                        console.log(`   Amount: ${uiAmount.toLocaleString()} tokens`);
                        console.log(`   USD Value: $${usdValue.toFixed(2)}`);
                        console.log(`   Minimum Required: $${MIN_ENTRY_USD.toFixed(2)}`);
                        console.log(`   ✅ Qualifies for lottery entry!\n`);

                        // Auto-enter into lottery
                        await this.autoEnterLottery(recipient, usdValue);
                    } else {
                        console.log(`\n⚠️  Transfer below minimum:`);
                        console.log(`   Recipient: ${recipient.toString()}`);
                        console.log(`   Amount: ${uiAmount.toLocaleString()} tokens`);
                        console.log(`   USD Value: $${usdValue.toFixed(2)}`);
                        console.log(`   Minimum Required: $${MIN_ENTRY_USD.toFixed(2)}`);
                        console.log(`   ❌ Does not qualify (need $${(MIN_ENTRY_USD - usdValue).toFixed(2)} more)\n`);
                    }
                }
            }
        } catch (error) {
            console.error('Error processing transfer:', error);
        }
    }

    async calculateUSDValue(tokenAmount) {
        try {
            // Get real-time token price from Jupiter
            const tokenMint = TOKEN_PROGRAM_ID.toString();
            const response = await fetch(`https://price.jup.ag/v4/price?ids=${tokenMint}`);
            const data = await response.json();
            
            let tokenPrice = 0.000020; // Default fallback
            
            if (data.data && data.data[tokenMint]) {
                tokenPrice = parseFloat(data.data[tokenMint].price || 0);
            }
            
            // Calculate USD value: tokenAmount * price
            // tokenAmount is already in human-readable format (not raw)
            const usdValue = tokenAmount * tokenPrice;
            
            console.log(`   Price: $${tokenPrice.toFixed(6)} per token`);
            console.log(`   Tokens: ${tokenAmount.toLocaleString()}`);
            console.log(`   USD Value: $${usdValue.toFixed(2)}`);
            
            return usdValue;
        } catch (error) {
            console.error('Error calculating USD value:', error);
            // Fallback calculation
            const defaultPrice = 0.000020;
            return tokenAmount * defaultPrice;
        }
    }

    async autoEnterLottery(participant, usdValue) {
        try {
            // Load Anchor program
            const walletPath = process.env.ANCHOR_WALLET || 
                path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
            
            if (!fs.existsSync(walletPath)) {
                console.error('❌ Wallet not found for auto-entry');
                return;
            }

            const walletKeypair = anchor.web3.Keypair.fromSecretKey(
                Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
            );

            const provider = new anchor.AnchorProvider(
                this.connection,
                new anchor.Wallet(walletKeypair),
                { commitment: 'confirmed' }
            );

            anchor.setProvider(provider);

            // Load lottery program
            const lotteryProgram = anchor.workspace.Lottery;
            if (!lotteryProgram) {
                console.error('❌ Lottery program not found');
                return;
            }

            // Derive lottery PDA
            const [lotteryPDA] = anchor.web3.PublicKey.findProgramAddressSync(
                [Buffer.from('lottery')],
                LOTTERY_PROGRAM_ID
            );

            // Enter lottery with USD value
            const usdValueCents = Math.floor(usdValue * 100); // Convert to cents

            const tx = await lotteryProgram.methods
                .enterLotteryWithUsdValue(new anchor.BN(usdValueCents))
                .accounts({
                    lottery: lotteryPDA,
                    participant: participant,
                })
                .rpc();

            console.log(`✅ Auto-entered into lottery!`);
            console.log(`   Transaction: ${tx}`);
            console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=${NETWORK}\n`);
        } catch (error) {
            console.error('❌ Auto-entry failed:', error.message);
            // Don't throw - continue monitoring
        }
    }
}

// Run monitor
if (require.main === module) {
    const monitor = new AutoEntryMonitor();
    monitor.start().catch(console.error);
}

module.exports = { AutoEntryMonitor };

