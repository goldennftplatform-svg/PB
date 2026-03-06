// Force an ODD snapshot and complete the full payout flow automatically
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

async function checkSnapshotResult(connection, signature) {
    try {
        const tx = await connection.getTransaction(signature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
        });

        if (!tx || !tx.meta || !tx.meta.logMessages) return null;

        const logs = tx.meta.logMessages.join(' ');
        const isOdd = logs.includes('ODD') || logs.includes('PAYOUT TIME');
        const isEven = logs.includes('EVEN') || logs.includes('ROLLOVER');
        
        const pepeMatch = logs.match(/Pepe.*?[Bb]all.*?[Cc]ount[:\s]+(\d+)/i);
        let pepeBallCount = null;
        if (pepeMatch) {
            pepeBallCount = parseInt(pepeMatch[1]);
        }

        return {
            isOdd: isOdd || (pepeBallCount !== null && pepeBallCount % 2 === 1),
            isEven: isEven || (pepeBallCount !== null && pepeBallCount % 2 === 0),
            pepeBallCount: pepeBallCount,
            signature: signature
        };
    } catch (e) {
        return null;
    }
}

async function forceOddSnapshotAndPayout() {
    console.log('\n🎯 FORCE ODD SNAPSHOT & COMPLETE PAYOUT FLOW\n');
    console.log('='.repeat(80));
    console.log('This will:');
    console.log('  1. Add entries');
    console.log('  2. Keep running snapshots until we get ODD (payout)');
    console.log('  3. Calculate winners');
    console.log('  4. Set winners on-chain');
    console.log('  5. Execute payout');
    console.log('  6. Frontend will then show all payouts!');
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
    let lastSnapshotTime = null;
    let snapshotAttempts = 0;
    const maxAttempts = 10; // Try up to 10 times

    // STEP 1: Add entries
    console.log('📝 STEP 1: Adding entries...\n');
    
    const testWallets = [];
    const entryAmounts = [2000, 2500, 3000, 5000, 10000, 15000, 20000, 25000, 30000, 50000, 2000, 2500, 3000];

    // Create and fund wallets
    for (let i = 0; i < 13; i++) {
        testWallets.push(Keypair.generate());
        
        try {
            const transferTx = new Transaction().add(
                SystemProgram.transfer({
                    fromPubkey: adminKeypair.publicKey,
                    toPubkey: testWallets[i].publicKey,
                    lamports: 0.1 * 1e9,
                })
            );
            
            const { blockhash } = await connection.getLatestBlockhash();
            transferTx.recentBlockhash = blockhash;
            transferTx.feePayer = adminKeypair.publicKey;
            transferTx.sign(adminKeypair);
            
            await connection.sendRawTransaction(transferTx.serialize());
            await connection.confirmTransaction(transferTx.sign(adminKeypair).serialize(), 'confirmed');
        } catch (e) {
            // Continue
        }
    }

    await new Promise(resolve => setTimeout(resolve, 2000));

    // Make entries
    let entrySuccess = 0;
    for (let i = 0; i < testWallets.length; i++) {
        try {
            const usdValue = entryAmounts[i] || 2000;
            await makeEntry(testWallets[i], usdValue, connection);
            entrySuccess++;
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
            // Continue
        }
    }

    console.log(`✅ Made ${entrySuccess} entries\n`);

    // STEP 2: Keep running snapshots until ODD
    console.log('📸 STEP 2: Running snapshots until we get ODD (payout)...\n');
    
    let oddSnapshotFound = false;
    let oddSnapshotResult = null;

    while (!oddSnapshotFound && snapshotAttempts < maxAttempts) {
        snapshotAttempts++;
        console.log(`\n${'='.repeat(80)}`);
        console.log(`📸 Snapshot Attempt ${snapshotAttempts}/${maxAttempts}`);
        console.log('='.repeat(80) + '\n');

        try {
            await triggerSnapshotRaw();
            
            await new Promise(resolve => setTimeout(resolve, 5000));

            // Check result
            const signatures = await connection.getSignaturesForAddress(lotteryPDA, { limit: 3 });
            if (signatures.length > 0) {
                const latestSig = signatures[0];
                const result = await checkSnapshotResult(connection, latestSig.signature);
                
                if (result) {
                    console.log(`✅ Snapshot ${snapshotAttempts} complete!`);
                    console.log(`   Transaction: ${latestSig.signature.substring(0, 20)}...`);
                    if (result.pepeBallCount) {
                        console.log(`   🎲 Pepe Ball Count: ${result.pepeBallCount}`);
                    }
                    
                    if (result.isOdd) {
                        console.log(`   🎉 ODD - PAYOUT TIME!\n`);
                        oddSnapshotFound = true;
                        oddSnapshotResult = result;
                        oddSnapshotResult.signature = latestSig.signature;
                        break;
                    } else if (result.isEven) {
                        console.log(`   🚀 EVEN - ROLLOVER (continuing...)\n`);
                    } else {
                        console.log(`   ❓ UNKNOWN (continuing...)\n`);
                    }
                    
                    lastSnapshotTime = Date.now();
                }
            }
        } catch (error) {
            console.log(`   ⚠️  Attempt ${snapshotAttempts} failed: ${error.message}`);
            
            if (error.message.includes('DrawTooEarly') || error.message.includes('too early')) {
                if (lastSnapshotTime) {
                    const timeSinceLastSnapshot = Date.now() - lastSnapshotTime;
                    const waitNeeded = Math.max(0, 120000 - timeSinceLastSnapshot);
                    
                    if (waitNeeded > 0) {
                        console.log(`   ⏳ Waiting ${Math.ceil(waitNeeded / 1000)} seconds...\n`);
                        await new Promise(resolve => setTimeout(resolve, waitNeeded));
                    }
                } else {
                    console.log('   ⏳ Waiting 2 minutes...\n');
                    await new Promise(resolve => setTimeout(resolve, 120000));
                }
            } else if (error.message.includes('NotEnoughParticipants')) {
                console.log('   ⚠️  Not enough participants - adding more entries...\n');
                // Add more entries
                for (let i = 0; i < 5; i++) {
                    try {
                        const wallet = Keypair.generate();
                        // Fund and make entry
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
                        await connection.sendRawTransaction(transferTx.serialize());
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        await makeEntry(wallet, 2000, connection);
                    } catch (e) {
                        // Continue
                    }
                }
            } else {
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }

        // Wait before next attempt (if not ODD)
        if (!oddSnapshotFound && snapshotAttempts < maxAttempts) {
            if (lastSnapshotTime) {
                const timeSinceLastSnapshot = Date.now() - lastSnapshotTime;
                const waitNeeded = Math.max(0, 120000 - timeSinceLastSnapshot);
                
                if (waitNeeded > 0) {
                    console.log(`⏸️  Waiting ${Math.ceil(waitNeeded / 1000)} seconds before next attempt...\n`);
                    await new Promise(resolve => setTimeout(resolve, waitNeeded));
                }
            } else {
                console.log('⏸️  Waiting 2 minutes before next attempt...\n');
                await new Promise(resolve => setTimeout(resolve, 120000));
            }
        }
    }

    if (!oddSnapshotFound) {
        console.error('\n❌ Could not get ODD snapshot after 10 attempts');
        console.error('   This is very unlikely (50% chance each time)');
        console.error('   Try running again or check the lottery state\n');
        process.exit(1);
    }

    // STEP 3: Calculate winners using helius indexer
    console.log('\n' + '='.repeat(80));
    console.log('🏆 STEP 3: Calculating Winners');
    console.log('='.repeat(80) + '\n');

    try {
        // Try to use helius-winner-indexer if available
        const { HeliusWinnerIndexer } = require('./helius-winner-indexer');
        const anchor = require('@coral-xyz/anchor');
        
        const provider = new anchor.AnchorProvider(
            connection,
            new anchor.Wallet(adminKeypair),
            { commitment: 'confirmed' }
        );
        anchor.setProvider(provider);
        
        const lotteryProgram = anchor.workspace.Lottery;
        
        if (lotteryProgram) {
            const indexer = new HeliusWinnerIndexer(connection, lotteryProgram, lotteryPDA);
            const winners = await indexer.indexAndCalculateWinners();
            
            if (winners) {
                console.log('✅ Winners calculated!\n');
                console.log(`   Main Winner: ${winners.mainWinner.toString()}`);
                console.log(`   Minor Winners: ${winners.minorWinners.length}\n`);

                // STEP 4: Set winners on-chain
                console.log('📝 STEP 4: Setting Winners On-Chain...\n');
                
                const setWinnersTx = await indexer.setWinnersOnChain(
                    winners.mainWinner,
                    winners.minorWinners
                );
                
                console.log(`✅ Winners set on-chain!`);
                console.log(`   Transaction: ${setWinnersTx}\n`);

                // STEP 5: Execute payout
                console.log('💰 STEP 5: Executing Payout...\n');
                
                const payoutTx = await lotteryProgram.methods
                    .payoutWinners()
                    .accounts({
                        lottery: lotteryPDA,
                        admin: adminKeypair.publicKey,
                    })
                    .rpc();

                console.log(`✅ Payout executed!`);
                console.log(`   Transaction: ${payoutTx}`);
                console.log(`   Explorer: https://explorer.solana.com/tx/${payoutTx}?cluster=devnet\n`);

                console.log('='.repeat(80));
                console.log('🎉 SUCCESS! PAYOUT COMPLETE!');
                console.log('='.repeat(80) + '\n');
                console.log('✅ The frontend should now show:');
                console.log('   - Main winner with 50% payout');
                console.log('   - 8 minor winners with 5% each');
                console.log('   - All transaction links');
                console.log('\n🌐 Check your Vercel site - it should show all payouts now!\n');
                
                return;
            }
        }
    } catch (error) {
        console.error('⚠️  Could not use helius-winner-indexer:', error.message);
        console.error('   This requires anchor build and IDL');
        console.error('   But the ODD snapshot was found!');
        console.error(`   Snapshot TX: ${oddSnapshotResult.signature}\n`);
        console.error('   Manual steps:');
        console.error('   1. Run: node scripts/helius-winner-indexer.js');
        console.error('   2. Run: node scripts/secure-payout-tool.js\n');
    }
}

if (require.main === module) {
    forceOddSnapshotAndPayout()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('\n❌ Failed:', error);
            console.error(error.stack);
            process.exit(1);
        });
}

module.exports = { forceOddSnapshotAndPayout };
