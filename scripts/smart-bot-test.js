// Smart bot that tracks progress toward 200 SOL threshold
const { Connection, Keypair, clusterApiUrl } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const WALLETS_DIR = path.join(__dirname, '..', 'bots', 'wallets');
const RESULTS_DIR = path.join(__dirname, '..', 'bots', 'results');

// Create results directory if it doesn't exist
if (!fs.existsSync(RESULTS_DIR)) {
    fs.mkdirSync(RESULTS_DIR, { recursive: true });
}

const CALCULATIONS = require('./calculate-revenue-needed.js');

const JACKPOT_THRESHOLD_SOL = 200;
const JACKPOT_TAX_RATE = 0.0245; // 2.45%
const VOLUME_NEEDED = CALCULATIONS.volumeNeededSOL;

class SmartBot {
    constructor(botId, connection, wallet) {
        this.botId = botId;
        this.connection = connection;
        this.wallet = wallet;
        this.totalVolumeSOL = 0;
        this.totalVolumeUSD = 0;
        this.transactions = [];
        this.contributedToJackpot = 0; // SOL contributed
    }

    async executeTransaction(type, amountUSD) {
        const amountSOL = amountUSD / 150; // Convert USD to SOL at $150/SOL
        
        // Calculate jackpot contribution
        const jackpotContribution = amountSOL * JACKPOT_TAX_RATE;
        
        this.totalVolumeSOL += amountSOL;
        this.totalVolumeUSD += amountUSD;
        this.contributedToJackpot += jackpotContribution;
        
        const tx = {
            type,
            amountUSD,
            amountSOL: amountSOL.toFixed(4),
            jackpotContribution: jackpotContribution.toFixed(4),
            timestamp: new Date().toISOString()
        };
        
        this.transactions.push(tx);
        
        // Simulate delay
        await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
        
        return tx;
    }

    async buyTokens(amountUSD) {
        return await this.executeTransaction('buy', amountUSD);
    }

    async sellTokens(amountUSD) {
        return await this.executeTransaction('sell', amountUSD);
    }

    async enterLottery(amountUSD) {
        // Lottery entry doesn't contribute to jackpot (only transfers do)
        // But we'll still track it
        const tx = {
            type: 'lottery_entry',
            amountUSD,
            timestamp: new Date().toISOString()
        };
        this.transactions.push(tx);
        await new Promise(resolve => setTimeout(resolve, 500));
        return tx;
    }

    getProgress() {
        const progressPercent = (this.totalVolumeSOL / VOLUME_NEEDED) * 100;
        const jackpotProgress = (this.contributedToJackpot / JACKPOT_THRESHOLD_SOL) * 100;
        
        return {
            botId: this.botId,
            totalVolumeSOL: this.totalVolumeSOL.toFixed(4),
            totalVolumeUSD: this.totalVolumeUSD.toFixed(2),
            contributedToJackpot: this.contributedToJackpot.toFixed(4),
            progressPercent: progressPercent.toFixed(2),
            jackpotProgress: jackpotProgress.toFixed(2),
            transactions: this.transactions.length,
            remaining: (VOLUME_NEEDED - this.totalVolumeSOL).toFixed(4)
        };
    }
}

async function runSmartBots() {
    console.log('🤖 Smart Bot Testing - Target: 200 SOL Jackpot Threshold\n');
    console.log(`📊 Target Volume: ${VOLUME_NEEDED.toFixed(2)} SOL`);
    console.log(`   (~$${CALCULATIONS.volumeNeededUSD.toFixed(0)} USD)\n`);
    
    const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
    const bots = [];
    const botPromises = [];
    
    // Load and create bots
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
            
            const bot = new SmartBot(i, connection, keypair);
            bots.push(bot);
        } catch (error) {
            console.error(`❌ Failed to load Bot ${i}:`, error.message);
        }
    }
    
    if (bots.length === 0) {
        console.log('❌ No bot wallets found! Run create-bot-wallets.js first.');
        return;
    }
    
    console.log(`✅ Loaded ${bots.length} bots\n`);
    console.log('🚀 Starting transactions...\n');
    
    // Run bots in parallel
    bots.forEach((bot, index) => {
        const botTask = async () => {
            // Each bot does different volume
            const patterns = [
                // High volume bots (1, 5, 9)
                async () => {
                    await bot.buyTokens(100);
                    await bot.buyTokens(200);
                    await bot.sellTokens(50);
                    await bot.buyTokens(300);
                    await bot.enterLottery(100);
                    await bot.buyTokens(500);
                },
                // Medium volume (2, 6, 10)
                async () => {
                    await bot.buyTokens(50);
                    await bot.buyTokens(100);
                    await bot.enterLottery(100);
                    await bot.buyTokens(200);
                    await bot.sellTokens(25);
                },
                // Standard (3, 7)
                async () => {
                    await bot.buyTokens(20);
                    await bot.enterLottery(20);
                    await bot.buyTokens(50);
                    await bot.enterLottery(100);
                },
                // Small frequent (4, 8)
                async () => {
                    await bot.buyTokens(20);
                    await bot.buyTokens(20);
                    await bot.buyTokens(20);
                    await bot.sellTokens(10);
                    await bot.enterLottery(20);
                }
            ];
            
            const pattern = patterns[index % patterns.length];
            
            try {
                await pattern();
            } catch (error) {
                console.error(`Bot ${bot.botId} error:`, error.message);
            }
        };
        
        botPromises.push(botTask());
    });
    
    // Wait for all bots
    await Promise.all(botPromises);
    
    // Calculate totals
    const totalVolume = bots.reduce((sum, bot) => sum + bot.totalVolumeSOL, 0);
    const totalJackpot = bots.reduce((sum, bot) => sum + bot.contributedToJackpot, 0);
    const totalUSD = bots.reduce((sum, bot) => sum + bot.totalVolumeUSD, 0);
    const totalTransactions = bots.reduce((sum, bot) => sum + bot.transactions.length, 0);
    
    // Display results
    console.log('\n📊 FINAL RESULTS');
    console.log('='.repeat(60));
    console.log(`Total Volume: ${totalVolume.toFixed(4)} SOL`);
    console.log(`Total Volume: $${totalUSD.toFixed(2)} USD`);
    console.log(`Jackpot Contribution: ${totalJackpot.toFixed(4)} SOL`);
    console.log(`Total Transactions: ${totalTransactions}`);
    console.log('\nProgress Toward 200 SOL Threshold:');
    console.log(`  Current: ${totalJackpot.toFixed(4)} SOL / ${JACKPOT_THRESHOLD_SOL} SOL`);
    console.log(`  Progress: ${((totalJackpot / JACKPOT_THRESHOLD_SOL) * 100).toFixed(2)}%`);
    console.log(`  Remaining: ${(JACKPOT_THRESHOLD_SOL - totalJackpot).toFixed(4)} SOL`);
    console.log(`  Volume Needed: ${VOLUME_NEEDED.toFixed(4)} SOL`);
    console.log(`  Volume Done: ${totalVolume.toFixed(4)} SOL`);
    console.log(`  Volume Remaining: ${(VOLUME_NEEDED - totalVolume).toFixed(4)} SOL`);
    
    if (totalJackpot >= JACKPOT_THRESHOLD_SOL) {
        console.log('\n🎉 THRESHOLD REACHED! Fast Mode (48h) would activate!');
    } else {
        const remaining = JACKPOT_THRESHOLD_SOL - totalJackpot;
        const remainingVolume = remaining / JACKPOT_TAX_RATE;
        console.log(`\n📈 To reach threshold:`);
        console.log(`   Need ${remainingVolume.toFixed(4)} more SOL in volume`);
        console.log(`   That's ~${Math.ceil(remainingVolume * 150 / 20)} more $20 transactions`);
        console.log(`   Or ~${Math.ceil(remainingVolume * 150 / 100)} more $100 transactions`);
    }
    
    // Save detailed results
    const results = {
        timestamp: new Date().toISOString(),
        target: JACKPOT_THRESHOLD_SOL,
        totalVolumeSOL: totalVolume,
        totalVolumeUSD: totalUSD,
        totalJackpotContribution: totalJackpot,
        totalTransactions,
        progressPercent: (totalJackpot / JACKPOT_THRESHOLD_SOL) * 100,
        remaining: JACKPOT_THRESHOLD_SOL - totalJackpot,
        botResults: bots.map(bot => bot.getProgress())
    };
    
    fs.writeFileSync(
        path.join(RESULTS_DIR, 'revenue-analysis.json'),
        JSON.stringify(results, null, 2)
    );
    
    console.log('\n💾 Results saved to bots/results/revenue-analysis.json');
    
    return results;
}

// Export
module.exports = { SmartBot, runSmartBots };

// Run if called directly
if (require.main === module) {
    runSmartBots().catch(console.error);
}

