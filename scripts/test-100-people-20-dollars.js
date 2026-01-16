// Test Script: 100 People Buy $20 Worth and Trigger Lottery
// Simulates real scenario with 100 participants

const { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');
const USD_VALUE_CENTS = 2000; // $20.00 in cents
const NUM_PARTICIPANTS = 100;

// Calculate instruction discriminator
function getEnterLotteryDiscriminator() {
    const hash = crypto.createHash('sha256');
    hash.update('global:enter_lottery_with_usd_value');
    return Buffer.from(hash.digest().slice(0, 8));
}

async function makeEntry(walletKeypair, usdValueCents, connection) {
    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );

    const [participantPDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from('participant'),
            lotteryPDA.toBuffer(),
            walletKeypair.publicKey.toBuffer()
        ],
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

    try {
        const sig = await connection.sendRawTransaction(tx.serialize(), {
            skipPreflight: false,
            preflightCommitment: 'confirmed',
        });

        await connection.confirmTransaction(sig, 'confirmed');
        return sig;
    } catch (error) {
        throw error;
    }
}

async function triggerSnapshot(adminKeypair, connection) {
    const Anchor = require('@coral-xyz/anchor');
    
    const IDL_PATH = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
    if (!fs.existsSync(IDL_PATH)) {
        throw new Error('IDL not found. Run: anchor build');
    }
    const IDL = JSON.parse(fs.readFileSync(IDL_PATH, 'utf8'));

    const wallet = new Anchor.Wallet(adminKeypair);
    const provider = new Anchor.AnchorProvider(
        connection,
        wallet,
        { commitment: 'confirmed', skipPreflight: false }
    );
    Anchor.setProvider(provider);

    const program = new Anchor.Program(IDL, LOTTERY_PROGRAM_ID, provider);
    
    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );

    console.log('\n📸 Triggering Snapshot...\n');
    
    const tx = await program.methods
        .takeSnapshot()
        .accounts({
            lottery: lotteryPDA,
            admin: adminKeypair.publicKey,
        })
        .rpc();

    console.log('✅ Snapshot triggered!');
    console.log(`   Transaction: ${tx}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);

    // Wait for confirmation
    await connection.confirmTransaction(tx, 'confirmed');
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Fetch updated state
    const lottery = await program.account.lottery.fetch(lotteryPDA);
    
    console.log('📊 SNAPSHOT RESULTS:');
    console.log(`   Pepe Ball Count: ${lottery.pepeBallCount}`);
    console.log(`   Is Odd: ${lottery.pepeBallCount % 2 === 1 ? 'YES - PAYOUT!' : 'NO - ROLLOVER'}`);
    console.log(`   Total Participants: ${lottery.totalParticipants.toString()}`);
    console.log(`   Total Snapshots: ${lottery.totalSnapshots.toString()}`);
    
    if (lottery.winners.mainWinner) {
        console.log(`   Main Winner: ${lottery.winners.mainWinner.toString()}`);
    }
    if (lottery.winners.minorWinners && lottery.winners.minorWinners.length > 0) {
        console.log(`   Minor Winners: ${lottery.winners.minorWinners.length}`);
    }
    
    return { lottery, tx };
}

async function runTest() {
    console.log('\n' + '='.repeat(70));
    console.log('  🎰 TEST: 100 People Buy $20 Worth & Trigger Lottery');
    console.log('='.repeat(70) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');

    // Load admin wallet
    const adminKeyPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    if (!fs.existsSync(adminKeyPath)) {
        console.error('❌ Admin wallet not found!');
        process.exit(1);
    }

    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(adminKeyPath, 'utf8')))
    );

    console.log(`✅ Admin: ${adminKeypair.publicKey.toString()}\n`);

    // Check admin balance
    const adminBalance = await connection.getBalance(adminKeypair.publicKey);
    console.log(`💰 Admin Balance: ${(adminBalance / 1e9).toFixed(4)} SOL`);
    
    if (adminBalance < 10 * LAMPORTS_PER_SOL) {
        console.log('⚠️  Low balance! Requesting airdrop...');
        const airdropSig = await connection.requestAirdrop(adminKeypair.publicKey, 10 * LAMPORTS_PER_SOL);
        await connection.confirmTransaction(airdropSig, 'confirmed');
        console.log('✅ Airdrop received!\n');
    }

    // Load or create test wallets
    const WALLETS_DIR = path.join(__dirname, '..', 'test-wallets');
    if (!fs.existsSync(WALLETS_DIR)) {
        fs.mkdirSync(WALLETS_DIR, { recursive: true });
    }

    const walletsPath = path.join(WALLETS_DIR, 'wallets-info.json');
    let wallets = [];

    if (fs.existsSync(walletsPath) && JSON.parse(fs.readFileSync(walletsPath, 'utf8')).length >= NUM_PARTICIPANTS) {
        console.log(`📂 Loading existing test wallets...`);
        const walletsInfo = JSON.parse(fs.readFileSync(walletsPath, 'utf8'));
        wallets = walletsInfo.slice(0, NUM_PARTICIPANTS).map(w => ({
            keypair: Keypair.fromSecretKey(Uint8Array.from(w.secretKey)),
            address: w.publicKey
        }));
        console.log(`✅ Loaded ${wallets.length} wallets\n`);
    } else {
        console.log(`🔨 Creating ${NUM_PARTICIPANTS} test wallets...`);
        for (let i = 0; i < NUM_PARTICIPANTS; i++) {
            const keypair = Keypair.generate();
            wallets.push({
                keypair,
                address: keypair.publicKey.toString()
            });
        }
        
        const walletsInfo = wallets.map(w => ({
            publicKey: w.address,
            secretKey: Array.from(w.keypair.secretKey)
        }));
        
        fs.writeFileSync(walletsPath, JSON.stringify(walletsInfo, null, 2));
        console.log(`✅ Created ${wallets.length} wallets\n`);
    }

    // Fund wallets by transferring from admin (avoids rate limits)
    console.log(`💸 Funding ${wallets.length} wallets with 0.1 SOL each...`);
    console.log(`   (Transferring from admin wallet to avoid rate limits)\n`);
    
    const transferAmount = 0.1 * LAMPORTS_PER_SOL;
    
    for (let i = 0; i < wallets.length; i++) {
        try {
            const balance = await connection.getBalance(wallets[i].keypair.publicKey);
            if (balance < 0.05 * LAMPORTS_PER_SOL) {
                const tx = new Transaction().add(
                    SystemProgram.transfer({
                        fromPubkey: adminKeypair.publicKey,
                        toPubkey: wallets[i].keypair.publicKey,
                        lamports: transferAmount,
                    })
                );
                
                const { blockhash } = await connection.getLatestBlockhash();
                tx.recentBlockhash = blockhash;
                tx.feePayer = adminKeypair.publicKey;
                tx.sign(adminKeypair);
                
                const sig = await connection.sendRawTransaction(tx.serialize(), {
                    skipPreflight: false,
                });
                await connection.confirmTransaction(sig, 'confirmed');
            }
            
            if ((i + 1) % 20 === 0) {
                console.log(`   ✅ Funded ${i + 1}/${wallets.length}...`);
            }
            
            // Small delay
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            console.error(`\n❌ Failed to fund wallet ${i + 1}:`, error.message);
        }
    }
    console.log(`✅ All wallets funded!\n`);

    // Make entries
    console.log(`🎫 Making entries for ${wallets.length} participants ($${USD_VALUE_CENTS / 100} each)...\n`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < wallets.length; i++) {
        try {
            const sig = await makeEntry(wallets[i].keypair, USD_VALUE_CENTS, connection);
            successCount++;
            
            if ((i + 1) % 10 === 0) {
                console.log(`   ✅ ${i + 1}/${wallets.length} entries completed...`);
            }
            
            // Small delay to avoid rate limiting
            await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
            failCount++;
            console.error(`\n❌ Entry ${i + 1} failed:`, error.message);
        }
    }
    
    console.log(`\n✅ Entries Complete!`);
    console.log(`   Success: ${successCount}`);
    console.log(`   Failed: ${failCount}\n`);

    // Wait a moment for all entries to settle
    console.log('⏳ Waiting for entries to settle...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Trigger snapshot
    try {
        const { lottery, tx } = await triggerSnapshot(adminKeypair, connection);
        
        console.log('\n' + '='.repeat(70));
        console.log('  🎉 TEST COMPLETE!');
        console.log('='.repeat(70) + '\n');
        
        console.log('📋 SUMMARY:');
        console.log(`   Participants: ${successCount}`);
        console.log(`   Entry Value: $${USD_VALUE_CENTS / 100} each`);
        console.log(`   Total Value: $${(successCount * USD_VALUE_CENTS / 100).toFixed(2)}`);
        console.log(`   Pepe Balls: ${lottery.pepeBallCount}`);
        console.log(`   Result: ${lottery.pepeBallCount % 2 === 1 ? 'PAYOUT 🎉' : 'ROLLOVER 🚀'}\n`);
        
        console.log('🔗 View Transaction:');
        console.log(`   https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);
        
    } catch (error) {
        console.error('\n❌ Snapshot failed:', error.message);
        if (error.logs) {
            error.logs.forEach(log => console.error('   ', log));
        }
        throw error;
    }
}

if (require.main === module) {
    runTest()
        .then(() => {
            console.log('✅ All done!\n');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Test failed:', error);
            process.exit(1);
        });
}

module.exports = { runTest };
