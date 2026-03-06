// Complete test: Add entries, then run 5 snapshots
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

async function completeTest() {
    console.log('\n🎰 COMPLETE TEST: ENTRIES + 5 SNAPSHOTS\n');
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

    for (let snapshotTest = 1; snapshotTest <= 5; snapshotTest++) {
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📸 SNAPSHOT TEST ${snapshotTest}/5`);
        console.log('='.repeat(80) + '\n');

        // STEP 1: Add entries for this test
        console.log('📝 Step 1: Adding entries (need 9+ participants)\n');
        
        const testWallets = [];
        const entryAmounts = [2000, 2500, 3000, 5000, 10000, 15000, 20000, 25000, 30000, 50000, 2000, 2500, 3000];

        // Create and fund wallets
        for (let i = 0; i < 13; i++) {
            const wallet = Keypair.generate();
            testWallets.push(wallet);
            
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
            } catch (e) {
                // Continue even if funding fails
            }
        }

        await new Promise(resolve => setTimeout(resolve, 2000));

        // Make entries
        let entrySuccess = 0;
        for (let i = 0; i < testWallets.length; i++) {
            try {
                const usdValue = entryAmounts[i] || 2000;
                const sig = await makeEntry(testWallets[i], usdValue, connection);
                entrySuccess++;
                await new Promise(resolve => setTimeout(resolve, 300));
            } catch (error) {
                // Continue on error
            }
        }

        console.log(`✅ Made ${entrySuccess} entries\n`);

        if (entrySuccess < 9) {
            console.log('⚠️  Not enough entries, but continuing anyway...\n');
        }

        await new Promise(resolve => setTimeout(resolve, 3000));

        // STEP 2: Trigger snapshot
        console.log('📸 Step 2: Triggering snapshot...\n');
        
        try {
            await triggerSnapshotRaw();
            
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
                    }
                } catch (e) {
                    // Continue
                }
            }
        } catch (error) {
            console.error(`❌ Snapshot ${snapshotTest} failed: ${error.message}\n`);
            
            // If timing error, wait longer
            if (error.message.includes('DrawTooEarly') || error.message.includes('too early')) {
                console.log('⏳ Timing error - waiting 3 minutes...\n');
                await new Promise(resolve => setTimeout(resolve, 180000));
            }
        }

        // Wait between tests (except after last)
        if (snapshotTest < 5) {
            console.log('⏸️  Waiting 2 minutes before next test...\n');
            await new Promise(resolve => setTimeout(resolve, 120000));
        }
    }

    // Summary
    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL SUMMARY');
    console.log('='.repeat(80) + '\n');
    
    const payoutCount = results.filter(r => r.isOdd).length;
    const rolloverCount = results.filter(r => r.isEven).length;
    
    console.log(`   Total snapshots: ${results.length}/5`);
    console.log(`   🎉 Payouts (ODD): ${payoutCount}`);
    console.log(`   🚀 Rollovers (EVEN): ${rolloverCount}\n`);

    if (payoutCount > 0) {
        console.log('✅ SUCCESS! At least one payout was triggered!\n');
    }

    results.forEach((r, i) => {
        console.log(`   Test ${r.test}: ${r.outcome} (${r.pepeBallCount} balls)`);
    });
}

if (require.main === module) {
    completeTest()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('\n❌ Failed:', error);
            process.exit(1);
        });
}

module.exports = { completeTest };
