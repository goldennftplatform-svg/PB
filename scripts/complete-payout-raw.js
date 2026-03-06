// Complete payout flow using raw transactions (no IDL needed)
// This will: 1) Find ODD snapshot, 2) Calculate winners, 3) Set winners, 4) Payout
const { Connection, Keypair, PublicKey, Transaction, SystemProgram } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { triggerSnapshotRaw } = require('./trigger-snapshot-raw');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');
const KNOWN_LOTTERY_PDA = 'ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb';

// Instruction discriminators (first 8 bytes of sha256)
function getDiscriminator(name) {
    const hash = crypto.createHash('sha256');
    hash.update(name);
    return Buffer.from(hash.digest().slice(0, 8));
}

const SET_WINNERS_DISCRIMINATOR = getDiscriminator('global:set_winners');
const PAYOUT_WINNERS_DISCRIMINATOR = getDiscriminator('global:payout_winners');

function getEnterLotteryDiscriminator() {
    return getDiscriminator('global:enter_lottery_with_usd_value');
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

async function getAllParticipants(connection) {
    console.log('🔍 Fetching all participant accounts...\n');
    
    // Use getProgramAccounts to find all participant accounts
    const participantAccounts = await connection.getProgramAccounts(LOTTERY_PROGRAM_ID, {
        filters: [
            {
                dataSize: 92 // ParticipantAccount size
            }
        ]
    });

    const participants = [];
    for (const account of participantAccounts) {
        try {
            const data = account.account.data;
            // Parse participant account manually
            // Structure: discriminator (8) + lottery (32) + wallet (32) + ticket_count (4) + usd_value (8) + reserved (8)
            if (data.length >= 92) {
                const lotteryPubkey = new PublicKey(data.slice(8, 40));
                const walletPubkey = new PublicKey(data.slice(40, 72));
                
                if (lotteryPubkey.toString() === KNOWN_LOTTERY_PDA) {
                    const ticketCount = data.readUInt32LE(72);
                    const usdValue = data.readBigUInt64LE(76);
                    
                    participants.push({
                        wallet: walletPubkey,
                        ticketCount: ticketCount,
                        usdValue: Number(usdValue)
                    });
                }
            }
        } catch (e) {
            // Skip invalid accounts
        }
    }

    console.log(`✅ Found ${participants.length} participants\n`);
    return participants;
}

async function calculateWinners(participants, snapshotSeed) {
    console.log('🎲 Calculating winners from snapshot seed...\n');
    console.log(`   Snapshot Seed: ${snapshotSeed}`);
    console.log(`   Total Participants: ${participants.length}\n`);

    // Calculate total tickets
    const totalTickets = participants.reduce((sum, p) => sum + p.ticketCount, 0);
    console.log(`   Total Tickets: ${totalTickets}\n`);

    // Use seed to deterministically select winners
    let seed = BigInt(snapshotSeed);
    
    // Select main winner (weighted by tickets)
    let randomValue = Number(seed % BigInt(totalTickets));
    let cumulativeTickets = 0;
    let mainWinner = null;
    
    for (const participant of participants) {
        cumulativeTickets += participant.ticketCount;
        if (randomValue < cumulativeTickets) {
            mainWinner = participant.wallet;
            break;
        }
    }

    if (!mainWinner) {
        mainWinner = participants[0].wallet; // Fallback
    }

    console.log(`   🏆 Main Winner: ${mainWinner.toString()}\n`);

    // Select 8 minor winners (excluding main winner)
    const minorWinners = [];
    const remainingParticipants = participants.filter(p => !p.wallet.equals(mainWinner));
    
    // Shuffle using seed
    for (let i = 0; i < Math.min(8, remainingParticipants.length); i++) {
        seed = (seed * 1103515245n + 12345n) % (2n ** 32n); // LCG
        const index = Number(seed % BigInt(remainingParticipants.length));
        minorWinners.push(remainingParticipants[index].wallet);
        remainingParticipants.splice(index, 1); // Remove to avoid duplicates
    }

    console.log(`   🎯 Minor Winners: ${minorWinners.length}\n`);
    minorWinners.forEach((w, i) => {
        console.log(`      ${i + 1}. ${w.toString()}`);
    });

    return { mainWinner, minorWinners };
}

async function setWinnersRaw(adminKeypair, mainWinner, minorWinners, connection) {
    console.log('📝 Setting winners on-chain (raw transaction)...\n');

    const lotteryPDA = new PublicKey(KNOWN_LOTTERY_PDA);
    
    // Build instruction data: discriminator + main_winner (32) + minor_winners (4 + 32*8)
    const mainWinnerBuffer = mainWinner.toBuffer();
    const minorCountBuffer = Buffer.allocUnsafe(4);
    minorCountBuffer.writeUInt32LE(minorWinners.length, 0);
    
    const minorWinnersBuffer = Buffer.concat(
        minorWinners.map(w => w.toBuffer())
    );
    
    const ixData = Buffer.concat([
        SET_WINNERS_DISCRIMINATOR,
        mainWinnerBuffer,
        minorCountBuffer,
        minorWinnersBuffer
    ]);

    const keys = [
        { pubkey: lotteryPDA, isWritable: true, isSigner: false },
        { pubkey: adminKeypair.publicKey, isWritable: false, isSigner: true },
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
    tx.feePayer = adminKeypair.publicKey;
    tx.sign(adminKeypair);

    const sig = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
    });

    await connection.confirmTransaction(sig, 'confirmed');
    console.log(`✅ Winners set! TX: ${sig}\n`);
    return sig;
}

async function payoutWinnersRaw(adminKeypair, connection) {
    console.log('💰 Executing payout (raw transaction)...\n');

    const lotteryPDA = new PublicKey(KNOWN_LOTTERY_PDA);
    
    // Build instruction data: just discriminator (no args)
    const ixData = PAYOUT_WINNERS_DISCRIMINATOR;

    const keys = [
        { pubkey: lotteryPDA, isWritable: true, isSigner: false },
        { pubkey: adminKeypair.publicKey, isWritable: false, isSigner: true },
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
    tx.feePayer = adminKeypair.publicKey;
    tx.sign(adminKeypair);

    const sig = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
    });

    await connection.confirmTransaction(sig, 'confirmed');
    console.log(`✅ Payout executed! TX: ${sig}\n`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet\n`);
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
        
        // Extract snapshot seed from logs
        const seedMatch = logs.match(/Snapshot Seed[:\s]+(\d+)/i);
        let snapshotSeed = null;
        if (seedMatch) {
            snapshotSeed = BigInt(seedMatch[1]);
        }

        const pepeMatch = logs.match(/Pepe.*?[Bb]all.*?[Cc]ount[:\s]+(\d+)/i);
        let pepeBallCount = null;
        if (pepeMatch) {
            pepeBallCount = parseInt(pepeMatch[1]);
        }

        return {
            isOdd: isOdd || (pepeBallCount !== null && pepeBallCount % 2 === 1),
            isEven: isEven || (pepeBallCount !== null && pepeBallCount % 2 === 0),
            pepeBallCount: pepeBallCount,
            snapshotSeed: snapshotSeed,
            signature: signature
        };
    } catch (e) {
        return null;
    }
}

async function completePayoutRaw() {
    console.log('\n🎯 COMPLETE PAYOUT FLOW (RAW TRANSACTIONS)\n');
    console.log('='.repeat(80));
    console.log('This will complete the FULL payout flow:');
    console.log('  1. Add entries');
    console.log('  2. Get ODD snapshot');
    console.log('  3. Calculate winners');
    console.log('  4. Set winners on-chain');
    console.log('  5. Execute payout');
    console.log('  6. Frontend will show all winners!');
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
    const maxAttempts = 10;

    // STEP 1: Add entries
    console.log('📝 STEP 1: Adding entries...\n');
    
    const testWallets = [];
    const entryAmounts = [2000, 2500, 3000, 5000, 10000, 15000, 20000, 25000, 30000, 50000, 2000, 2500, 3000];

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

    // STEP 2: Get ODD snapshot
    console.log('📸 STEP 2: Getting ODD snapshot...\n');
    
    let oddSnapshotResult = null;

    while (!oddSnapshotResult && snapshotAttempts < maxAttempts) {
        snapshotAttempts++;
        console.log(`📸 Attempt ${snapshotAttempts}/${maxAttempts}\n`);

        try {
            await triggerSnapshotRaw();
            await new Promise(resolve => setTimeout(resolve, 5000));

            const signatures = await connection.getSignaturesForAddress(lotteryPDA, { limit: 3 });
            if (signatures.length > 0) {
                const latestSig = signatures[0];
                const result = await checkSnapshotResult(connection, latestSig.signature);
                
                if (result && result.isOdd && result.snapshotSeed) {
                    console.log(`🎉 ODD snapshot found!\n`);
                    oddSnapshotResult = result;
                    oddSnapshotResult.signature = latestSig.signature;
                    break;
                } else if (result && result.isEven) {
                    console.log(`🚀 EVEN - Rollover (continuing...)\n`);
                }
                
                lastSnapshotTime = Date.now();
            }
        } catch (error) {
            if (error.message.includes('DrawTooEarly')) {
                const waitNeeded = lastSnapshotTime ? Math.max(0, 120000 - (Date.now() - lastSnapshotTime)) : 120000;
                if (waitNeeded > 0) {
                    console.log(`⏳ Waiting ${Math.ceil(waitNeeded / 1000)} seconds...\n`);
                    await new Promise(resolve => setTimeout(resolve, waitNeeded));
                }
            } else {
                await new Promise(resolve => setTimeout(resolve, 10000));
            }
        }

        if (!oddSnapshotResult && snapshotAttempts < maxAttempts) {
            const waitNeeded = lastSnapshotTime ? Math.max(0, 120000 - (Date.now() - lastSnapshotTime)) : 120000;
            if (waitNeeded > 0) {
                await new Promise(resolve => setTimeout(resolve, waitNeeded));
            }
        }
    }

    if (!oddSnapshotResult || !oddSnapshotResult.snapshotSeed) {
        console.error('❌ Could not get ODD snapshot with seed\n');
        process.exit(1);
    }

    // STEP 3: Calculate winners
    console.log('\n🏆 STEP 3: Calculating Winners\n');
    console.log('='.repeat(80) + '\n');
    
    const participants = await getAllParticipants(connection);
    if (participants.length === 0) {
        console.error('❌ No participants found!\n');
        process.exit(1);
    }

    const winners = await calculateWinners(participants, oddSnapshotResult.snapshotSeed);

    // STEP 4: Set winners
    console.log('\n📝 STEP 4: Setting Winners On-Chain\n');
    console.log('='.repeat(80) + '\n');
    
    await setWinnersRaw(adminKeypair, winners.mainWinner, winners.minorWinners, connection);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // STEP 5: Execute payout
    console.log('\n💰 STEP 5: Executing Payout\n');
    console.log('='.repeat(80) + '\n');
    
    const payoutTx = await payoutWinnersRaw(adminKeypair, connection);

    console.log('='.repeat(80));
    console.log('🎉 SUCCESS! PAYOUT COMPLETE!');
    console.log('='.repeat(80) + '\n');
    console.log('✅ The frontend should now show:');
    console.log(`   🏆 Main Winner: ${winners.mainWinner.toString()}`);
    console.log(`   🎯 ${winners.minorWinners.length} Minor Winners`);
    console.log(`   💰 Payout TX: ${payoutTx}`);
    console.log('\n🌐 Refresh your Vercel site - it should show all winners now!\n');
}

if (require.main === module) {
    completePayoutRaw()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('\n❌ Failed:', error);
            console.error(error.stack);
            process.exit(1);
        });
}

module.exports = { completePayoutRaw };
