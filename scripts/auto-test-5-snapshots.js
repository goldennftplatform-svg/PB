// Fully automated: Add entries + run 5 snapshots with smart timing handling
const { Connection, Keypair, PublicKey, Transaction, SystemProgram } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { triggerSnapshotRaw } = require('./trigger-snapshot-raw');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');
const KNOWN_LOTTERY_PDA = 'ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb';

function getEnterLotteryDiscriminator() {
    const hash = crypto.createHash('sha256');
    hash.update('global:enter_lottery_with_usd_value');
    return Buffer.from(hash.digest().slice(0, 8));
}

async function makeEntry(walletKeypair, usdValueCents, connection) {
    const lotteryPDA = new PublicKey(KNOWN_LOTTERY_PDA);
    const [participantPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('participant'), lotteryPDA.toBuffer(), walletKeypair.publicKey.toBuffer()],
        LOTTERY_PROGRAM_ID
    );

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

async function autoTest5Snapshots() {
    console.log('\n🤖 FULLY AUTOMATED: 5 SNAPSHOT TESTS\n');
    console.log('='.repeat(80));
    console.log('This will run completely automatically - no manual intervention needed!');
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

    const lotteryPDA = new PublicKey(KNOWN_LOTTERY_PDA);
    const results = [];
    let lastSnapshotTime = null;

    for (let snapshotTest = 1; snapshotTest <= 5; snapshotTest++) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📸 AUTOMATED TEST ${snapshotTest}/5`);
        console.log('='.repeat(80) + '\n');

        // STEP 1: Add entries (batch create wallets first for speed)
        console.log('📝 Step 1: Creating and funding wallets...\n');
        
        const testWallets = [];
        const entryAmounts = [2000, 2500, 3000, 5000, 10000, 15000, 20000, 25000, 30000, 50000, 2000, 2500, 3000];

        // Create all wallets first
        for (let i = 0; i < 13; i++) {
            testWallets.push(Keypair.generate());
        }

        // Batch fund wallets (parallel where possible)
        console.log('💰 Funding wallets from admin...');
        const fundingPromises = testWallets.map(async (wallet) => {
            try {
                const transferTx = new Transaction().add(
                    SystemProgram.transfer({
                        fromPubkey: adminKeypair.publicKey,
                        toPubkey: wallet.publicKey,
                        lamports: 0.1 * 1e9,
                    })
                );
                
                const { blockhash } = await connection.getLatestBlockhash();
                transferTx.recentBlockhash = blockhash;
                transferTx.feePayer = adminKeypair.publicKey;
                transferTx.sign(adminKeypair);
                
                const sig = await connection.sendRawTransaction(transferTx.serialize());
                await connection.confirmTransaction(sig, 'confirmed');
                return true;
            } catch (e) {
                return false;
            }
        });

        await Promise.all(fundingPromises);
        console.log('✅ Wallets funded\n');

        // Make entries (with small delays to avoid rate limits)
        console.log('🎫 Making entries...\n');
        let entrySuccess = 0;
        for (let i = 0; i < testWallets.length; i++) {
            try {
                const usdValue = entryAmounts[i] || 2000;
                await makeEntry(testWallets[i], usdValue, connection);
                entrySuccess++;
                process.stdout.write(`   ✅ Entry ${i + 1}/${testWallets.length}\r`);
                await new Promise(resolve => setTimeout(resolve, 200)); // Small delay
            } catch (error) {
                // Continue on error
            }
        }
        console.log(`\n✅ Made ${entrySuccess} entries\n`);

        await new Promise(resolve => setTimeout(resolve, 2000));

        // STEP 2: Trigger snapshot with smart retry logic
        console.log('📸 Step 2: Triggering snapshot...\n');
        
        let snapshotSuccess = false;
        let attempts = 0;
        const maxAttempts = 3;

        while (!snapshotSuccess && attempts < maxAttempts) {
            attempts++;
            
            try {
                await triggerSnapshotRaw();
                snapshotSuccess = true;
                
                await new Promise(resolve => setTimeout(resolve, 5000));

                // Check result
                const signatures = await connection.getSignaturesForAddress(lotteryPDA, { limit: 3 });
                if (signatures.length > 0) {
                    const latestSig = signatures[0];
                    try {
                        const tx = await connection.getTransaction(latestSig.signature, {
                            commitment: 'confirmed',
                            maxSupportedTransactionVersion: 0
                        });

                        if (tx && tx.meta && tx.meta.logMessages) {
                            const logs = tx.meta.logMessages.join(' ');
                            const isOdd = logs.includes('ODD') || logs.includes('PAYOUT TIME');
                            const isEven = logs.includes('EVEN') || logs.includes('ROLLOVER');
                            
                            const pepeMatch = logs.match(/Pepe.*?[Bb]all.*?[Cc]ount[:\s]+(\d+)/i);
                            let pepeBallCount = null;
                            if (pepeMatch) {
                                pepeBallCount = parseInt(pepeMatch[1]);
                            }

                            const outcome = isOdd ? 'PAYOUT' : isEven ? 'ROLLOVER' : 'UNKNOWN';
                            
                            results.push({
                                test: snapshotTest,
                                signature: latestSig.signature,
                                pepeBallCount: pepeBallCount || 'unknown',
                                outcome: outcome,
                                isOdd: isOdd,
                                isEven: isEven
                            });

                            console.log(`✅ Snapshot ${snapshotTest} complete!`);
                            console.log(`   Outcome: ${outcome === 'PAYOUT' ? '🎉 PAYOUT TIME!' : outcome === 'ROLLOVER' ? '🚀 ROLLOVER!' : '❓ UNKNOWN'}`);
                            console.log(`   TX: https://explorer.solana.com/tx/${latestSig.signature}?cluster=devnet\n`);
                            
                            lastSnapshotTime = Date.now();
                        }
                    } catch (e) {
                        // Continue
                    }
                }
            } catch (error) {
                console.log(`   ⚠️  Attempt ${attempts}/${maxAttempts} failed: ${error.message}`);
                
                // If timing error, calculate wait time
                if (error.message.includes('DrawTooEarly') || error.message.includes('too early')) {
                    if (lastSnapshotTime) {
                        const timeSinceLastSnapshot = Date.now() - lastSnapshotTime;
                        const waitNeeded = Math.max(0, 120000 - timeSinceLastSnapshot); // 2 min minimum
                        
                        if (waitNeeded > 0) {
                            console.log(`   ⏳ Waiting ${Math.ceil(waitNeeded / 1000)} seconds for timing interval...\n`);
                            await new Promise(resolve => setTimeout(resolve, waitNeeded));
                        }
                    } else {
                        // First snapshot or unknown timing - wait 2 minutes
                        console.log('   ⏳ Waiting 2 minutes for timing interval...\n');
                        await new Promise(resolve => setTimeout(resolve, 120000));
                    }
                } else if (error.message.includes('NotEnoughParticipants')) {
                    console.log('   ⚠️  Not enough participants - this should not happen, but continuing...\n');
                    break; // Skip this test
                } else {
                    // Other error - wait a bit and retry
                    console.log('   ⏳ Waiting 10 seconds before retry...\n');
                    await new Promise(resolve => setTimeout(resolve, 10000));
                }
            }
        }

        if (!snapshotSuccess) {
            console.log(`❌ Snapshot ${snapshotTest} failed after ${maxAttempts} attempts\n`);
        }

        // Smart wait between tests - only if not last test
        if (snapshotTest < 5) {
            if (lastSnapshotTime) {
                const timeSinceLastSnapshot = Date.now() - lastSnapshotTime;
                const waitNeeded = Math.max(0, 120000 - timeSinceLastSnapshot); // 2 min minimum
                
                if (waitNeeded > 0) {
                    console.log(`⏸️  Waiting ${Math.ceil(waitNeeded / 1000)} seconds before next test...\n`);
                    await new Promise(resolve => setTimeout(resolve, waitNeeded));
                } else {
                    console.log('⏸️  Timing interval already passed, continuing...\n');
                }
            } else {
                console.log('⏸️  Waiting 2 minutes before next test...\n');
                await new Promise(resolve => setTimeout(resolve, 120000));
            }
        }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 AUTOMATED TEST COMPLETE - FINAL SUMMARY');
    console.log('='.repeat(80) + '\n');
    
    const payoutCount = results.filter(r => r.isOdd).length;
    const rolloverCount = results.filter(r => r.isEven).length;
    
    console.log(`   ✅ Total snapshots completed: ${results.length}/5`);
    console.log(`   🎉 Payouts (ODD): ${payoutCount}`);
    console.log(`   🚀 Rollovers (EVEN): ${rolloverCount}\n`);

    if (payoutCount > 0) {
        console.log('🎉 SUCCESS! At least one payout was triggered!\n');
        console.log('   Next steps:');
        console.log('   1. Calculate winners from snapshot seed (off-chain)');
        console.log('   2. Call set_winners instruction');
        console.log('   3. Call payout_winners instruction');
        console.log('   4. Frontend will then show all wallet payouts!\n');
    } else if (results.length > 0) {
        console.log('⚠️  Snapshots completed but ODD/EVEN not determined from logs');
        console.log('   Check transaction logs manually\n');
    }

    results.forEach((r) => {
        console.log(`   Test ${r.test}: ${r.outcome} (${r.pepeBallCount} balls) - ${r.signature.substring(0, 16)}...`);
    });

    console.log('\n✅ All done! No manual intervention needed.\n');
}

if (require.main === module) {
    autoTest5Snapshots()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('\n❌ Failed:', error);
            console.error(error.stack);
            process.exit(1);
        });
}

module.exports = { autoTest5Snapshots };
