// Fund bot wallets with devnet SOL using Solana CLI
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BOTS_DIR = path.join(__dirname, '..', 'bots');
const WALLETS_DIR = path.join(BOTS_DIR, 'wallets');
const REGISTRY_FILE = path.join(BOTS_DIR, 'registry.json');

async function fundBots() {
    console.log('💰 Funding bot wallets with devnet SOL...\n');
    console.log('⚠️  Using Solana CLI - ensure you are on devnet!\n');
    
    const registry = JSON.parse(fs.readFileSync(REGISTRY_FILE, 'utf8'));
    const SOL_PER_BOT = 2; // 2 SOL per bot
    const confirmedBots = [];
    const failedBots = [];
    
    // Ensure we're on devnet
    try {
        execSync('solana config set --url devnet', { stdio: 'pipe' });
    } catch (error) {
        console.error('⚠️  Could not set devnet (continuing anyway)');
    }
    
    for (const bot of registry.bots) {
        try {
            const walletFile = path.join(__dirname, '..', bot.walletFile);
            
            if (!fs.existsSync(walletFile)) {
                throw new Error('Wallet file not found');
            }
            
            console.log(`Funding Bot ${bot.id} (${bot.publicKey.slice(0, 8)}...)`);
            
            // Request airdrop using Solana CLI
            try {
                execSync(`solana airdrop ${SOL_PER_BOT} "${walletFile}" --url devnet`, {
                    stdio: 'pipe'
                });
                
                // Check balance
                const balanceOutput = execSync(`solana balance "${walletFile}" --url devnet`, {
                    stdio: 'pipe',
                    encoding: 'utf8'
                });
                
                const balanceMatch = balanceOutput.match(/([\d.]+)\s+SOL/);
                const solBalance = balanceMatch ? parseFloat(balanceMatch[1]) : 0;
                
                console.log(`  ✅ Funded: ${solBalance} SOL`);
                confirmedBots.push({ ...bot, balance: solBalance });
                
                // Small delay to avoid rate limits
                await new Promise(resolve => setTimeout(resolve, 2000));
                
            } catch (airdropError) {
                // Try again after delay
                console.log(`  ⏳ Rate limited, waiting...`);
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                try {
                    execSync(`solana airdrop ${SOL_PER_BOT} "${walletFile}" --url devnet`, {
                        stdio: 'pipe'
                    });
                    console.log(`  ✅ Funded on retry`);
                    confirmedBots.push({ ...bot, balance: SOL_PER_BOT });
                } catch (retryError) {
                    throw retryError;
                }
            }
            
        } catch (error) {
            console.error(`  ❌ Failed to fund Bot ${bot.id}:`, error.message);
            failedBots.push(bot);
        }
    }
    
    console.log(`\n✅ Funding complete!`);
    console.log(`   Successful: ${confirmedBots.length}`);
    console.log(`   Failed: ${failedBots.length}`);
    
    if (confirmedBots.length > 0) {
        console.log(`\n💰 Total SOL distributed: ${confirmedBots.length * SOL_PER_BOT} SOL`);
        console.log(`\n📋 Bot balances:`);
        confirmedBots.forEach(bot => {
            console.log(`   Bot ${bot.id}: ${bot.balance.toFixed(4)} SOL`);
        });
    }
    
    // Save funding status
    const fundingStatus = {
        timestamp: new Date().toISOString(),
        successful: confirmedBots,
        failed: failedBots,
        totalFunded: confirmedBots.length * SOL_PER_BOT
    };
    
    fs.writeFileSync(
        path.join(BOTS_DIR, 'funding-status.json'),
        JSON.stringify(fundingStatus, null, 2)
    );
}

fundBots().catch(console.error);

