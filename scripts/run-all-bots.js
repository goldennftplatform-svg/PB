// Run all 10 bots simultaneously to stress test contracts
const { Connection, clusterApiUrl } = require('@solana/web3.js');
const { BotTrader } = require('./bot-trader');
const fs = require('fs');
const path = require('path');

const WALLETS_DIR = path.join(__dirname, '..', 'bots', 'wallets');
const RESULTS_DIR = path.join(__dirname, '..', 'bots', 'results');

// Create results directory
if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');

async function runBot(botId, connection) {
    const { Keypair } = require('@solana/web3.js');
    
    try {
        // Load bot wallet
        const walletFile = path.join(WALLETS_DIR, `bot${botId}.json`);
        const secretKey = JSON.parse(fs.readFileSync(walletFile, 'utf8'));
        const keypair = Keypair.fromSecretKey(Uint8Array.from(secretKey));
        
        const bot = new BotTrader(botId, connection, keypair);
        
        // Random trading pattern for each bot
        const patterns = [
            // Pattern 1: Aggressive trader
            [
                () => bot.buyTokens(100),
                () => bot.sellTokens(50),
                () => bot.buyTokens(200),
                () => bot.enterLottery(100),
            ],
            // Pattern 2: Lottery focused
            [
                () => bot.buyTokens(20),
                () => bot.enterLottery(20),
                () => bot.enterLottery(100),
                () => bot.enterLottery(500),
            ],
            // Pattern 3: Buy and hold
            [
                () => bot.buyTokens(50),
                () => bot.buyTokens(100),
                () => bot.enterLottery(50),
            ],
            // Pattern 4: Frequent trader
            [
                () => bot.buyTokens(25),
                () => bot.sellTokens(10),
                () => bot.buyTokens(30),
                () => bot.sellTokens(15),
                () => bot.enterLottery(25),
            ],
        ];
        
        const pattern = patterns[botId % patterns.length];
        
        console.log(`\n🤖 Bot ${botId} starting pattern ${(botId % patterns.length) + 1}...`);
        
        for (const action of pattern) {
            await action();
            // Random delay between 1-3 seconds
            const delay = Math.random() * 2000 + 1000;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        const stats = bot.getStats();
        
        // Save bot results
        fs.writeFileSync(
            path.join(RESULTS_DIR, `bot${botId}-results.json`),
            JSON.stringify(stats, null, 2)
        );
        
        return stats;
        
    } catch (error) {
        console.error(`❌ Bot ${botId} error:`, error.message);
        return {
            botId,
            error: error.message,
            transactions: [],
            errors: [{ type: 'fatal', error: error.message }]
        };
    }
}

async function runAllBots() {
    console.log('🚀 Starting all 10 bots for stress testing...\n');
    console.log('📊 This will simulate buy/sell/lottery interactions\n');
    
    const startTime = Date.now();
    const botPromises = [];
    
    // Run all 10 bots in parallel
    for (let i = 1; i <= 10; i++) {
        botPromises.push(runBot(i, connection));
    }
    
    // Wait for all bots to complete
    const results = await Promise.all(botPromises);
    
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;
    
    // Aggregate results
    const summary = {
        timestamp: new Date().toISOString(),
        duration: `${duration.toFixed(2)}s`,
        totalBots: 10,
        successfulBots: results.filter(r => !r.error).length,
        failedBots: results.filter(r => r.error).length,
        totalTransactions: results.reduce((sum, r) => sum + (r.transactions || 0), 0),
        totalErrors: results.reduce((sum, r) => sum + (r.errors || 0), 0),
        botResults: results
    };
    
    // Save summary
    fs.writeFileSync(
        path.join(RESULTS_DIR, 'stress-test-summary.json'),
        JSON.stringify(summary, null, 2)
    );
    
    console.log('\n📊 STRESS TEST SUMMARY');
    console.log('=' .repeat(50));
    console.log(`Duration: ${summary.duration}`);
    console.log(`Successful Bots: ${summary.successfulBots}/10`);
    console.log(`Total Transactions: ${summary.totalTransactions}`);
    console.log(`Total Errors: ${summary.totalErrors}`);
    console.log('\n📁 Results saved to:', RESULTS_DIR);
    console.log('   - Individual bot results: bot1-results.json ... bot10-results.json');
    console.log('   - Summary: stress-test-summary.json');
    
    // Display bot performance
    console.log('\n🤖 Bot Performance:');
    results.forEach(result => {
        if (result.error) {
            console.log(`   Bot ${result.botId}: ❌ ${result.error}`);
        } else {
            console.log(`   Bot ${result.botId}: ✅ ${result.transactions} transactions, ${result.errors} errors`);
        }
    });
}

// Run if called directly
if (require.main === module) {
    runAllBots().catch(console.error);
}

module.exports = { runAllBots };



