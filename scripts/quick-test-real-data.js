// Quick Test: Create Real Transactions on Devnet
// Creates 10 entries, triggers snapshot, generates real winner data

const { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');
const USD_VALUE_CENTS = 2000; // $20.00 in cents
const NUM_PARTICIPANTS = 10; // Quick test with 10 people

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
    // Use raw snapshot trigger (no IDL needed)
    const { triggerSnapshotRaw } = require('./trigger-snapshot-raw');
    
    console.log('\n📸 Triggering Snapshot (Raw Transaction)...\n');
    
    // The raw script handles everything, but we need to get the result
    // Let's call it and then fetch the lottery state manually
    const tx = await triggerSnapshotRawInternal(adminKeypair, connection);
    
    console.log('✅ Snapshot triggered!');
    console.log(`   Transaction: ${tx}`);
    console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);

    await connection.confirmTransaction(tx, 'confirmed');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Try to fetch lottery state using raw account data
    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );
    
    const lotteryAccount = await connection.getAccountInfo(lotteryPDA);
    if (lotteryAccount) {
        console.log('📊 SNAPSHOT COMPLETE!');
        console.log(`   Lottery PDA: ${lotteryPDA.toString()}`);
        console.log(`   Explorer: https://explorer.solana.com/address/${lotteryPDA.toString()}?cluster=devnet\n`);
        console.log('   Check the transaction logs above for Pepe ball count and winners!\n');
    }
    
    return { tx };
}

async function triggerSnapshotRawInternal(adminKeypair, connection) {
    const TAKE_SNAPSHOT_DISCRIMINATOR = Buffer.from([
        183, 210, 251, 68, 140, 132, 191, 140,
    ]);

    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );

    const ixData = TAKE_SNAPSHOT_DISCRIMINATOR;

    const keys = [
        {
            pubkey: lotteryPDA,
            isWritable: true,
            isSigner: false,
        },
        {
            pubkey: adminKeypair.publicKey,
            isWritable: false,
            isSigner: true,
        },
    ];

    const instruction = {
        programId: LOTTERY_PROGRAM_ID,
        keys,
        data: ixData,
    };

    const tx = new Transaction().add(instruction);

    const sig = await connection.sendTransaction(tx, [adminKeypair], {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
    });

    return sig;
}

async function runTest() {
    console.log('\n' + '='.repeat(70));
    console.log('  🎰 QUICK TEST: Generate Real Test Data');
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
    
    if (adminBalance < 5 * LAMPORTS_PER_SOL) {
        console.log('⚠️  Low balance! Requesting airdrop...');
        const airdropSig = await connection.requestAirdrop(adminKeypair.publicKey, 5 * LAMPORTS_PER_SOL);
        await connection.confirmTransaction(airdropSig, 'confirmed');
        console.log('✅ Airdrop received!\n');
    }

    // Create test wallets
    console.log(`🔨 Creating ${NUM_PARTICIPANTS} test wallets...`);
    const wallets = [];
    for (let i = 0; i < NUM_PARTICIPANTS; i++) {
        const keypair = Keypair.generate();
        wallets.push({
            keypair,
            address: keypair.publicKey.toString()
        });
    }
    console.log(`✅ Created ${wallets.length} wallets\n`);

    // Fund wallets
    console.log(`💸 Funding ${wallets.length} wallets with 0.1 SOL each...\n`);
    
    const transferAmount = 0.1 * LAMPORTS_PER_SOL;
    
    for (let i = 0; i < wallets.length; i++) {
        try {
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
            
            if ((i + 1) % 5 === 0) {
                console.log(`   ✅ Funded ${i + 1}/${wallets.length}...`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
            console.error(`\n❌ Failed to fund wallet ${i + 1}:`, error.message);
        }
    }
    console.log(`✅ All wallets funded!\n`);

    // Make entries
    console.log(`🎫 Making entries for ${wallets.length} participants ($${USD_VALUE_CENTS / 100} each)...\n`);
    
    const entrySignatures = [];
    let successCount = 0;
    
    for (let i = 0; i < wallets.length; i++) {
        try {
            const sig = await makeEntry(wallets[i].keypair, USD_VALUE_CENTS, connection);
            entrySignatures.push({
                wallet: wallets[i].address,
                signature: sig,
                explorer: `https://explorer.solana.com/tx/${sig}?cluster=devnet`
            });
            successCount++;
            
            console.log(`   ✅ Entry ${i + 1}/${wallets.length}: ${wallets[i].address.substring(0, 8)}...`);
            console.log(`      TX: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
            
            await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
            console.error(`\n❌ Entry ${i + 1} failed:`, error.message);
        }
    }
    
    console.log(`\n✅ Entries Complete!`);
    console.log(`   Success: ${successCount}/${NUM_PARTICIPANTS}\n`);

    // Wait for entries to settle
    console.log('⏳ Waiting for entries to settle...\n');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Trigger snapshot
    try {
        const { tx } = await triggerSnapshot(adminKeypair, connection);
        
        console.log('\n' + '='.repeat(70));
        console.log('  🎉 TEST COMPLETE!');
        console.log('='.repeat(70) + '\n');
        
        console.log('📋 SUMMARY:');
        console.log(`   Participants: ${successCount}`);
        console.log(`   Entry Value: $${USD_VALUE_CENTS / 100} each`);
        console.log(`   Total Value: $${(successCount * USD_VALUE_CENTS / 100).toFixed(2)}\n`);
        
        console.log('🔗 View Snapshot Transaction:');
        console.log(`   https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);
        
        console.log('📊 Check transaction logs for:');
        console.log('   - Pepe Ball Count (ODD = payout, EVEN = rollover)');
        console.log('   - Winner addresses\n');
        
        console.log('🌐 Your website should now show this data!');
        console.log('   Refresh: https://pb-n7kx.vercel.app/\n');
        
        console.log('💡 All entry transactions:');
        entrySignatures.forEach((entry, idx) => {
            console.log(`   ${idx + 1}. ${entry.wallet.substring(0, 12)}... - ${entry.explorer}`);
        });
        console.log('');
        
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
            console.log('✅ All done! Check your website now!\n');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Test failed:', error);
            process.exit(1);
        });
}

module.exports = { runTest };
