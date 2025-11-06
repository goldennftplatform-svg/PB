// Bot that buys and sells tokens to test contract
const { Connection, Keypair, PublicKey, clusterApiUrl } = require('@solana/web3.js');
const { getAssociatedTokenAddress, createAssociatedTokenAccountInstruction } = require('@solana/spl-token');
const Anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

// Program IDs (devnet)
const PROGRAM_IDS = {
    token: new PublicKey('61gft4rst67cSLvNZ7G8wxGxiUmpVmEQWbPW5cXR2rPW'),
    lottery: new PublicKey('Ayf1yysvTa1KPVC3ZDwMJ5nScGcsxJnfXSRpP8BvCBWX'),
    lpManager: new PublicKey('CnjYgWGNN4FfMhNF3fuDKbFAwQkMWjoT2kEdetbTRyUc')
};

const WALLETS_DIR = path.join(__dirname, '..', 'bots', 'wallets');

class BotTrader {
    constructor(botId, connection, wallet) {
        this.botId = botId;
        this.connection = connection;
        this.wallet = wallet;
        this.transactions = [];
        this.errors = [];
    }

    async buyTokens(amountUSD = 20) {
        try {
            console.log(`[Bot ${this.botId}] 💰 Buying tokens worth $${amountUSD}...`);
            
            // Mock buy - in real implementation, this would:
            // 1. Swap SOL for PEPE tokens via DEX
            // 2. Transfer tokens (triggering tax)
            // 3. Verify tax deduction
            
            // For now, simulate the transaction
            await this.simulateTransaction('buy', { amountUSD });
            
            this.transactions.push({
                type: 'buy',
                amountUSD,
                timestamp: new Date().toISOString()
            });
            
            console.log(`[Bot ${this.botId}] ✅ Buy transaction simulated`);
            return true;
        } catch (error) {
            console.error(`[Bot ${this.botId}] ❌ Buy failed:`, error.message);
            this.errors.push({ type: 'buy', error: error.message });
            return false;
        }
    }

    async sellTokens(amountUSD = 10) {
        try {
            console.log(`[Bot ${this.botId}] 💸 Selling tokens worth $${amountUSD}...`);
            
            // Mock sell - in real implementation:
            // 1. Transfer tokens (triggering tax)
            // 2. Swap tokens for SOL
            // 3. Verify tax deduction
            
            await this.simulateTransaction('sell', { amountUSD });
            
            this.transactions.push({
                type: 'sell',
                amountUSD,
                timestamp: new Date().toISOString()
            });
            
            console.log(`[Bot ${this.botId}] ✅ Sell transaction simulated`);
            return true;
        } catch (error) {
            console.error(`[Bot ${this.botId}] ❌ Sell failed:`, error.message);
            this.errors.push({ type: 'sell', error: error.message });
            return false;
        }
    }

    async enterLottery(usdValue = 20) {
        try {
            console.log(`[Bot ${this.botId}] 🎰 Entering lottery with $${usdValue}...`);
            
            // This would call: lottery.enterLotteryWithUsdValue()
            // For now, simulate
            await this.simulateTransaction('lottery_entry', { usdValue });
            
            this.transactions.push({
                type: 'lottery_entry',
                usdValue,
                timestamp: new Date().toISOString()
            });
            
            console.log(`[Bot ${this.botId}] ✅ Lottery entry simulated`);
            return true;
        } catch (error) {
            console.error(`[Bot ${this.botId}] ❌ Lottery entry failed:`, error.message);
            this.errors.push({ type: 'lottery_entry', error: error.message });
            return false;
        }
    }

    async simulateTransaction(type, params) {
        // Simulate network delay
        const delay = Math.random() * 1000 + 500; // 500-1500ms
        await new Promise(resolve => setTimeout(resolve, delay));
        
        // Simulate occasional failures (5% chance)
        if (Math.random() < 0.05) {
            throw new Error(`Simulated ${type} failure`);
        }
    }

    getStats() {
        return {
            botId: this.botId,
            transactions: this.transactions.length,
            errors: this.errors.length,
            transactionHistory: this.transactions,
            errorHistory: this.errors
        };
    }
}

// Run bot trader
async function runBotTrader(botId = 1) {
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    
    // Load bot wallet
    const walletFile = path.join(WALLETS_DIR, `bot${botId}.json`);
    const secretKey = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
    const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
    
    console.log(`🤖 Starting Bot ${botId} Trader...`);
    console.log(`   Address: ${keypair.publicKey.toString()}\n`);
    
    const bot = new BotTrader(botId, connection, keypair);
    
    // Run trading sequence
    const actions = [
        () => bot.buyTokens(20),   // Buy $20
        () => bot.enterLottery(20), // Enter lottery
        () => bot.buyTokens(50),    // Buy more
        () => bot.sellTokens(10),   // Sell some
        () => bot.enterLottery(100), // Enter with $100
    ];
    
    for (const action of actions) {
        await action();
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2s between actions
    }
    
    console.log(`\n📊 Bot ${botId} Stats:`, bot.getStats());
    
    return bot.getStats();
}

// If run directly
if (require.main === module) {
    const botId = parseInt(process.argv[2]) || 1;
    runBotTrader(botId).catch(console.error);
}

module.exports = { BotTrader, runBotTrader };



