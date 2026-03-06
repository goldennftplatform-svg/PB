// Add entries first, then run 5 snapshot tests
const { Connection, Keypair, PublicKey, Transaction, SystemProgram } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { triggerSnapshotRaw } = require('./trigger-snapshot-raw');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');
const KNOWN_LOTTERY_PDA = 'ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb';

// Calculate instruction discriminator
function getEnterLotteryDiscriminator() {
    const hash = crypto.createHash('sha256');
    hash.update('global:enter_lottery_with_usd_value');
    return Buffer.from(hash.digest().slice(0, 8));
}

async function makeEntry(walletKeypair, usdValueCents, connection) {
    const lotteryPDA = new PublicKey(KNOWN_LOTTERY_PDA);

    const [participantPDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from('participant'),
            lotteryPDA.toBuffer(),
            walletKeypair.publicKey.toBuffer()
        ],
        LOTTERY_PROGRAM_ID
    );

    // Build instruction
    const discriminator = getEnterLotteryDiscriminator();
    const usdValueBuffer = Buffer.allocUnsafe(8);
    usdValueBuffer.writeBigUInt64LE(BigInt(usdValueCents), 0);
    
    const ixData = Buffer.concat([discriminator, usdValueBuffer]);

    const keys = [
        { pubkey: lotteryPDA, isWritable: true, isSigner: false },
        { pubkey: participantPDA, isWritable: true, isSigner: false },
        { pubkey: walletKeypair.publicKey, isWritable: false, isSigner: true },
        { pubkey: SystemProgram.programId, isWritable: false, isSigner: false },
    ];

    const instruction = {
        programId: LOTTERY_PROGRAM_ID,
        keys,
        data: ixData,
    };

    const tx = new Transaction();
    tx.add(instruction);
    
    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = walletKeypair.publicKey;

    tx.sign(walletKeypair);

    const sig = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
    });

    await connection.confirmTransaction(sig, 'confirmed');
    return sig;
}

async function addEntriesThenTest() {
    console.log('\n🎰 ADD ENTRIES THEN RUN 5 SNAPSHOT TESTS\n');
    console.log('='.repeat(80) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');

    // Load admin wallet
    const walletPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    if (!fs.existsSync(walletPath)) {
        console.error('❌ Admin wallet not found!');
        process.exit(1);
    }

    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
    );

    console.log('📋 CONFIGURATION:');
    console.log(`   Admin: ${adminKeypair.publicKey.toString()}`);
    console.log(`   Balance: ${(await connection.getBalance(adminKeypair.publicKey) / 1e9).toFixed(4)} SOL\n`);

    // STEP 1: Create 15 test wallets and add entries
    console.log('📝 STEP 1: Creating entries (need 9+ participants)\n');
    console.log('='.repeat(80) + '\n');

    const testWallets = [];
    const entryAmounts = [2000, 2500, 3000, 5000, 10000, 15000, 20000, 25000, 30000, 50000, 2000, 2500, 3000, 5000, 10000];

    // Create test wallets and fund from admin
    console.log('💰 Creating and funding test wallets from admin...\n');
    for (let i = 0; i < 15; i++) {
        const wallet = Keypair.generate();
        testWallets.push(wallet);
        
        // Fund from admin wallet instead of airdrop
        try {
            const transferTx = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: adminKeypair.publicKey,
                    toPubkey: wallet.publicKey,
                    lamports: 0.1 * 1e9, // 0.1 SOL per wallet
                })
            );
            
            const { blockhash } = await connection.getLatestBlockhash();
            transferTx.recentBlockhash = blockhash;
            transferTx.feePayer = adminKeypair.publicKey;
            transferTx.sign(adminKeypair);
            
            const sig = await connection.sendRawTransaction(transferTx.serialize());
            await connection.confirmTransaction(sig, 'confirmed');
            console.log(`   ✅ Wallet ${i + 1} created and funded (0.1 SOL)`);
            
            await new Promise(resolve => setTimeout(resolve, 200)); // Small delay
        } catch (e) {
            console.log(`   ⚠️  Wallet ${i + 1} funding failed: ${e.message}`);
        }
    }
    
    console.log('\n⏳ Waiting 2 seconds for funding to settle...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n🎫 Making entries...\n');

    let successCount = 0;
    for (let i = 0; i < testWallets.length; i++) {
        try {
            const usdValue = entryAmounts[i] || 2000;
            console.log(`   Entry ${i + 1}/${testWallets.length}: $${(usdValue / 100).toFixed(2)}...`);
            
            const sig = await makeEntry(testWallets[i], usdValue, connection);
            console.log(`   ✅ Success! TX: ${sig.substring(0, 16)}...`);
            successCount++;
            
            await new Promise(resolve => setTimeout(resolve, 500)); // Rate limit
        } catch (error) {
            console.log(`   ⚠️  Failed: ${error.message}`);
        }
    }

    console.log(`\n✅ Made ${successCount} entries\n`);

    if (successCount < 9) {
        console.error('❌ Not enough entries! Need at least 9 participants');
        process.exit(1);
    }

    // Wait a bit for entries to settle
    console.log('⏳ Waiting 3 seconds for entries to settle...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // STEP 2: Run 5 snapshot tests
    console.log('\n📸 STEP 2: Running 5 Snapshot Tests\n');
    console.log('='.repeat(80) + '\n');

    const lotteryPDA = new PublicKey(KNOWN_LOTTERY_PDA);
    const results = [];
    let payoutCount = 0;
    let rolloverCount = 0;

    for (let i = 1; i <= 5; i++) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📸 TEST ${i}/5`);
        console.log('='.repeat(80) + '\n');

        try {
            // Trigger snapshot
            console.log('🚀 Triggering snapshot...\n');
            await triggerSnapshotRaw();

            // Wait for confirmation
            console.log('⏳ Waiting for transaction confirmation...\n');
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Check the snapshot transaction
            const signatures = await connection.getSignaturesForAddress(lotteryPDA, { limit: 5 });
            
            if (signatures.length > 0) {
                const latestSig = signatures[0];
                try {
                    const tx = await connection.getTransaction(latestSig.signature, {
                        commitment: 'confirmed',
                        maxSupportedTransactionVersion: 0
                    });

                    if (tx && tx.meta && tx.meta.logMessages) {
                        const logs = tx.meta.logMessages.join(' ');
                        
                        let isOdd = false;
                        let isEven = false;
                        let pepeBallCount = null;
                        
                        // Check logs for ODD/EVEN indicators
                        if (logs.includes('ODD') || logs.includes('PAYOUT TIME')) {
                            isOdd = true;
                        } else if (logs.includes('EVEN') || logs.includes('ROLLOVER')) {
                            isEven = true;
                        }
                        
                        // Try to extract Pepe ball count from logs
                        const pepeMatch = logs.match(/Pepe Ball Count[:\s]+(\d+)/i);
                        if (pepeMatch) {
                            pepeBallCount = parseInt(pepeMatch[1]);
                            isOdd = pepeBallCount % 2 === 1;
                            isEven = pepeBallCount % 2 === 0;
                        }

                        const outcome = isOdd ? 'PAYOUT' : isEven ? 'ROLLOVER' : 'UNKNOWN';
                        
                        if (isOdd) payoutCount++;
                        if (isEven) rolloverCount++;

                        const result = {
                            test: i,
                            timestamp: new Date().toISOString(),
                            signature: latestSig.signature,
                            pepeBallCount: pepeBallCount || 'unknown',
                            outcome: outcome,
                            isOdd: isOdd,
                            isEven: isEven
                        };

                        results.push(result);

                        console.log(`✅ Test ${i} complete!`);
                        console.log(`   Transaction: ${latestSig.signature.substring(0, 20)}...`);
                        if (pepeBallCount) {
                            console.log(`   🎲 Pepe Ball Count: ${pepeBallCount}`);
                        }
                        console.log(`   📊 Outcome: ${outcome === 'PAYOUT' ? '🎉 PAYOUT TIME!' : outcome === 'ROLLOVER' ? '🚀 ROLLOVER!' : '❓ UNKNOWN'}`);
                        console.log(`   Explorer: https://explorer.solana.com/tx/${latestSig.signature}?cluster=devnet\n`);

                        if (isOdd) {
                            console.log('   💡 This was ODD - Winners should be selected and payout triggered!\n');
                        } else if (isEven) {
                            console.log('   💡 This was EVEN - Rollover! Jackpot grows, no payout yet.\n');
                        }
                    }
                } catch (txError) {
                    console.warn(`   ⚠️  Could not parse transaction: ${txError.message}\n`);
                }
            }

            // Wait between tests - need to wait for timing interval
            // For testing, wait 2 minutes (120 seconds) to allow next snapshot
            if (i < 5) {
                console.log('⏸️  Waiting 2 minutes for timing interval before next test...\n');
                console.log('   (This allows the snapshot interval to pass)\n');
                await new Promise(resolve => setTimeout(resolve, 120000)); // 2 minutes
            }
        } catch (error) {
            console.error(`❌ Test ${i} failed: ${error.message}\n`);
            if (error.logs) {
                console.error('   Transaction logs:');
                error.logs.forEach(log => console.error('      ', log));
            }
        }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(80) + '\n');
    
    console.log(`   Entries made: ${successCount}`);
    console.log(`   Total snapshot tests: ${results.length}`);
    console.log(`   🎉 Payouts (ODD): ${payoutCount}`);
    console.log(`   🚀 Rollovers (EVEN): ${rolloverCount}\n`);

    if (payoutCount > 0) {
        console.log('✅ SUCCESS! At least one payout was triggered!\n');
        console.log('   Next steps:');
        console.log('   1. Calculate winners from snapshot seed (off-chain)');
        console.log('   2. Call set_winners instruction');
        console.log('   3. Call payout_winners instruction');
        console.log('   4. Frontend will then show all wallet payouts!\n');
    } else {
        console.log('⚠️  No payouts triggered (all were rollovers)');
        console.log('   This is normal - 50/50 means ~50% chance of payout\n');
    }

    // Save results
    const resultsPath = path.join(__dirname, '..', 'test-results', 'entries-and-snapshots.json');
    const resultsDir = path.dirname(resultsPath);
    
    if (!fs.existsSync(resultsDir)) {
        fs.mkdirSync(resultsDir, { recursive: true });
    }

    fs.writeFileSync(resultsPath, JSON.stringify({ entries: successCount, snapshots: results }, null, 2));
    console.log(`📁 Results saved to: ${resultsPath}\n`);
}

if (require.main === module) {
    addEntriesThenTest()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('\n❌ Failed:', error);
            console.error(error.stack);
            process.exit(1);
        });
}

module.exports = { addEntriesThenTest };
