// Volume Testing Script - Target: 10 Million USD
// This script simulates trading volume to test revenue calculations
const { Connection, Keypair, clusterApiUrl } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const WALLETS_DIR = path.join(__dirname, '..', 'bots', 'wallets');
const RESULTS_DIR = path.join(__dirname, '..', 'bots', 'results');

// Create results directory if it doesn't exist
if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

// Configuration
const TARGET_VOLUME_USD = 10_000_000; // 10 million USD
const SOL_PRICE_USD = 150; // SOL price assumption
const JACKPOT_TAX_RATE = 0.0245; // 2.45% goes to jackpot
const TARGET_VOLUME_SOL = TARGET_VOLUME_USD / SOL_PRICE_USD;

class VolumeBot {
    constructor(botId, connection, wallet) {
        this.botId = botId;
        this.connection = connection;
        this.wallet = wallet;
        this.totalVolumeSOL = 0;
        this.totalVolumeUSD = 0;
        this.transactions = [];
        this.contributedToJackpot = 0;
        this.startTime = Date.now();
    }

    async executeTransaction(type, amountUSD) {
        const amountSOL = amountUSD / SOL_PRICE_USD;
        const jackpotContribution = amountSOL * JACKPOT_TAX_RATE;
        
        this.totalVolumeSOL += amountSOL;
        this.totalVolumeUSD += amountUSD;
        this.contributedToJackpot += jackpotContribution;
        
        const tx = {
            type,
            amountUSD,
            amountSOL: parseFloat(amountSOL.toFixed(6)),
            jackpotContribution: parseFloat(jackpotContribution.toFixed(6)),
            timestamp: new Date().toISOString()
        };
        
        this.transactions.push(tx);
        
        // Simulate network delay (realistic transaction time)
        await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
        
        return tx;
    }

    async buyTokens(amountUSD) {
        return await this.executeTransaction('buy', amountUSD);
    }

    async sellTokens(amountUSD) {
        return await this.executeTransaction('sell', amountUSD);
    }

    getProgress() {
        const progressPercent = (this.totalVolumeUSD / TARGET_VOLUME_USD) * 100;
        const elapsed = (Date.now() - this.startTime) / 1000;
        const rate = this.totalVolumeUSD / elapsed; // USD per second
        const remainingUSD = TARGET_VOLUME_USD - this.totalVolumeUSD;
        const estimatedTimeRemaining = remainingUSD / rate; // seconds
        
        return {
            botId: this.botId,
            totalVolumeSOL: parseFloat(this.totalVolumeSOL.toFixed(4)),
            totalVolumeUSD: parseFloat(this.totalVolumeUSD.toFixed(2)),
            contributedToJackpot: parseFloat(this.contributedToJackpot.toFixed(4)),
            progressPercent: parseFloat(progressPercent.toFixed(2)),
            transactions: this.transactions.length,
            remainingUSD: parseFloat(remainingUSD.toFixed(2)),
            rate: parseFloat(rate.toFixed(2)),
            estimatedTimeRemaining: estimatedTimeRemaining > 0 ? estimatedTimeRemaining : 0
        };
    }
}

// Transaction patterns for different bot behaviors
const TRANSACTION_PATTERNS = {
    // High volume traders - mix of large and medium
    aggressive: [
        { type: 'buy', amount: 5000 },
        { type: 'buy', amount: 10000 },
        { type: 'sell', amount: 2000 },
        { type: 'buy', amount: 15000 },
        { type: 'sell', amount: 5000 },
        { type: 'buy', amount: 20000 },
    ],
    // Medium volume - steady trading
    steady: [
        { type: 'buy', amount: 1000 },
        { type: 'buy', amount: 2000 },
        { type: 'sell', amount: 500 },
        { type: 'buy', amount: 3000 },
        { type: 'sell', amount: 1000 },
        { type: 'buy', amount: 5000 },
    ],
    // Smaller frequent trades
    frequent: [
        { type: 'buy', amount: 500 },
        { type: 'buy', amount: 1000 },
        { type: 'sell', amount: 200 },
        { type: 'buy', amount: 1500 },
        { type: 'sell', amount: 300 },
        { type: 'buy', amount: 2000 },
    ]
};

async function runVolumeTest() {
    console.log('🚀 10 Million USD Volume Test\n');
    console.log('='.repeat(60));
    console.log(`📊 Target Volume: $${TARGET_VOLUME_USD.toLocaleString()} USD`);
    console.log(`   Equivalent: ${TARGET_VOLUME_SOL.toFixed(2)} SOL (at $${SOL_PRICE_USD}/SOL)`);
    console.log(`   Expected Jackpot Contribution: ${(TARGET_VOLUME_SOL * JACKPOT_TAX_RATE).toFixed(2)} SOL\n`);
    
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    const bots = [];
    
    // Load all available wallets
    console.log('📂 Loading wallets...\n');
    for (let i = 1; i <= 10; i++) {
        try {
            const walletFile = path.join(WALLETS_DIR, `bot${i}.json`);
            if (!fs.existsSync(walletFile)) {
                console.log(`⚠️  Bot ${i} wallet not found, skipping...`);
                continue;
            }
            
            const keypair = Keypair.fromSecretKey(
                Uint8Array.from(JSON.parse(fs.readFileSync(walletFile, 'utf8')))
            );
            
            const bot = new VolumeBot(i, connection, keypair);
            bots.push(bot);
            console.log(`✅ Loaded Bot ${i}: ${keypair.publicKey.toString().slice(0, 8)}...`);
        } catch (error) {
            console.error(`❌ Failed to load Bot ${i}:`, error.message);
        }
    }
    
    if (bots.length === 0) {
        console.log('❌ No bot wallets found!');
        return;
    }
    
    const targetPerBot = TARGET_VOLUME_USD / bots.length;
    console.log(`\n📈 Target per bot: $${targetPerBot.toLocaleString()} USD`);
    console.log(`   (~${(targetPerBot / SOL_PRICE_USD).toFixed(2)} SOL per bot)\n`);
    console.log('🚀 Starting volume test...\n');
    console.log('='.repeat(60));
    
    const startTime = Date.now();
    let lastUpdate = Date.now();
    const updateInterval = 5000; // Update every 5 seconds
    
    // Run bots in parallel
    const botPromises = bots.map((bot, index) => {
        return (async () => {
            const patternType = index < 3 ? 'aggressive' : index < 7 ? 'steady' : 'frequent';
            const pattern = TRANSACTION_PATTERNS[patternType];
            
            // Calculate how many pattern iterations needed
            const patternVolume = pattern.reduce((sum, tx) => sum + tx.amount, 0);
            const iterationsNeeded = Math.ceil(targetPerBot / patternVolume);
            
            // Run pattern repeatedly until target reached
            let currentVolume = 0;
            let iteration = 0;
            
            while (currentVolume < targetPerBot && iteration < iterationsNeeded * 2) {
                for (const tx of pattern) {
                    if (currentVolume >= targetPerBot) break;
                    
                    try {
                        if (tx.type === 'buy') {
                            await bot.buyTokens(tx.amount);
                        } else if (tx.type === 'sell') {
                            await bot.sellTokens(tx.amount);
                        }
                        currentVolume += tx.amount;
                    } catch (error) {
                        console.error(`[Bot ${bot.botId}] Error:`, error.message);
                    }
                }
                iteration++;
                
                // Small delay between pattern iterations
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        })();
    });
    
    // Progress monitor
    const progressMonitor = setInterval(() => {
        const totalVolumeUSD = bots.reduce((sum, bot) => sum + bot.totalVolumeUSD, 0);
        const totalVolumeSOL = bots.reduce((sum, bot) => sum + bot.totalVolumeSOL, 0);
        const totalJackpot = bots.reduce((sum, bot) => sum + bot.contributedToJackpot, 0);
        const totalTransactions = bots.reduce((sum, bot) => sum + bot.transactions.length, 0);
        const elapsed = (Date.now() - startTime) / 1000;
        const progress = (totalVolumeUSD / TARGET_VOLUME_USD) * 100;
        
        // Calculate rate
        const rateUSD = totalVolumeUSD / elapsed;
        const remainingUSD = TARGET_VOLUME_USD - totalVolumeUSD;
        const estimatedTime = remainingUSD / rateUSD;
        
        // Clear previous output (simple approach)
        process.stdout.write('\r\x1b[K'); // Clear line
        process.stdout.write(
            `📊 Progress: ${progress.toFixed(2)}% | ` +
            `Volume: $${totalVolumeUSD.toLocaleString()} / $${TARGET_VOLUME_USD.toLocaleString()} | ` +
            `Txs: ${totalTransactions} | ` +
            `Rate: $${rateUSD.toFixed(0)}/s | ` +
            `ETA: ${estimatedTime > 0 ? formatTime(estimatedTime) : 'calculating...'}`
        );
    }, 1000);
    
    // Wait for all bots to complete
    await Promise.all(botPromises);
    
    clearInterval(progressMonitor);
    console.log('\n\n'); // New lines after progress
    
    // Calculate final totals
    const totalVolumeSOL = bots.reduce((sum, bot) => sum + bot.totalVolumeSOL, 0);
    const totalVolumeUSD = bots.reduce((sum, bot) => sum + bot.totalVolumeUSD, 0);
    const totalJackpot = bots.reduce((sum, bot) => sum + bot.contributedToJackpot, 0);
    const totalTransactions = bots.reduce((sum, bot) => sum + bot.transactions.length, 0);
    const elapsed = (Date.now() - startTime) / 1000;
    
    // Display final results
    console.log('📊 FINAL RESULTS');
    console.log('='.repeat(60));
    console.log(`Total Volume: $${totalVolumeUSD.toLocaleString()} USD`);
    console.log(`Total Volume: ${totalVolumeSOL.toFixed(4)} SOL`);
    console.log(`Jackpot Contribution: ${totalJackpot.toFixed(4)} SOL`);
    console.log(`Total Transactions: ${totalTransactions}`);
    console.log(`Duration: ${formatTime(elapsed)}`);
    console.log(`Average Rate: $${(totalVolumeUSD / elapsed).toFixed(2)}/second`);
    console.log(`\nProgress: ${((totalVolumeUSD / TARGET_VOLUME_USD) * 100).toFixed(2)}%`);
    console.log(`\nExpected Jackpot from 10M: ${(TARGET_VOLUME_SOL * JACKPOT_TAX_RATE).toFixed(4)} SOL`);
    console.log(`Actual Jackpot Contribution: ${totalJackpot.toFixed(4)} SOL`);
    console.log(`Difference: ${Math.abs((TARGET_VOLUME_SOL * JACKPOT_TAX_RATE) - totalJackpot).toFixed(4)} SOL`);
    
    // Per-bot breakdown
    console.log('\n🤖 Bot Performance:');
    console.log('-'.repeat(60));
    bots.forEach(bot => {
        const progress = bot.getProgress();
        console.log(`Bot ${progress.botId}: $${progress.totalVolumeUSD.toLocaleString()} (${progress.progressPercent}%) | ${progress.transactions} txs`);
    });
    
    // Save detailed results
    const results = {
        timestamp: new Date().toISOString(),
        target: {
            volumeUSD: TARGET_VOLUME_USD,
            volumeSOL: TARGET_VOLUME_SOL,
            expectedJackpot: TARGET_VOLUME_SOL * JACKPOT_TAX_RATE
        },
        actual: {
            volumeUSD: totalVolumeUSD,
            volumeSOL: totalVolumeSOL,
            jackpotContribution: totalJackpot,
            transactions: totalTransactions,
            duration: elapsed,
            rate: totalVolumeUSD / elapsed
        },
        progress: {
            percent: (totalVolumeUSD / TARGET_VOLUME_USD) * 100,
            remainingUSD: TARGET_VOLUME_USD - totalVolumeUSD,
            remainingSOL: TARGET_VOLUME_SOL - totalVolumeSOL
        },
        botResults: bots.map(bot => bot.getProgress())
    };
    
    const resultsFile = path.join(RESULTS_DIR, '10m-volume-test.json');
    fs.writeFileSync(resultsFile, JSON.stringify(results, null, 2));
    
    console.log(`\n💾 Results saved to: ${resultsFile}`);
    
    // Summary file for quick reference
    const summary = {
        test: '10M USD Volume Test',
        date: new Date().toISOString(),
        target: `$${TARGET_VOLUME_USD.toLocaleString()} USD`,
        actual: `$${totalVolumeUSD.toLocaleString()} USD`,
        progress: `${((totalVolumeUSD / TARGET_VOLUME_USD) * 100).toFixed(2)}%`,
        jackpotContribution: `${totalJackpot.toFixed(4)} SOL`,
        transactions: totalTransactions,
        duration: formatTime(elapsed)
    };
    
    const summaryFile = path.join(RESULTS_DIR, '10m-volume-summary.txt');
    fs.writeFileSync(summaryFile, 
        `10M USD Volume Test Summary\n` +
        `============================\n\n` +
        `Date: ${summary.date}\n` +
        `Target: ${summary.target}\n` +
        `Actual: ${summary.actual}\n` +
        `Progress: ${summary.progress}\n` +
        `Jackpot Contribution: ${summary.jackpotContribution} SOL\n` +
        `Transactions: ${summary.transactions}\n` +
        `Duration: ${summary.duration}\n`
    );
    
    console.log(`📄 Summary saved to: ${summaryFile}\n`);
    
    return results;
}

function formatTime(seconds) {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
}

// Run if called directly
if (require.main === module) {
    runVolumeTest().catch(error => {
        console.error('❌ Test failed:', error);
        process.exit(1);
    });
}

module.exports = { VolumeBot, runVolumeTest, TARGET_VOLUME_USD, TARGET_VOLUME_SOL };

