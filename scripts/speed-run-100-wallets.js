// Speed Run: 100 Wallets, Auto-Entries, Trigger Snapshot
// Uses your 125 SOL to fund 100 wallets and make entries

const { Connection, Keypair, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const HELIUS_API_KEY = '431ca765-2f35-4b23-8abd-db03796bd85f';
const HELIUS_RPC_URL = `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`;
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');
const NUM_WALLETS = 100;
const SOL_PER_WALLET = 0.3; // 0.3 SOL per wallet (30 SOL total for funding, leaves room for fees)
const USD_VALUE_CENTS = 2000; // $20 per entry

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

async function runSpeedRun() {
    console.log('\n' + '='.repeat(70));
    console.log('  🚀 SPEED RUN: 100 Wallets → Entries → Snapshot');
    console.log('='.repeat(70) + '\n');

    let connection = new Connection(HELIUS_RPC_URL || RPC_URL, 'confirmed');

    // Load admin wallet - supports custom path via environment variable
    let adminKeyPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    // Also check for common wallet locations
    if (!fs.existsSync(adminKeyPath)) {
        const altPaths = [
            path.join(process.env.USERPROFILE, 'Desktop', 'wallet.json'),
            path.join(process.env.USERPROFILE, 'Downloads', 'wallet.json'),
            path.join(__dirname, '..', 'wallet.json'),
        ];
        
        for (const altPath of altPaths) {
            if (fs.existsSync(altPath)) {
                adminKeyPath = altPath;
                console.log(`📂 Found wallet at: ${adminKeyPath}\n`);
                break;
            }
        }
    }
    
    if (!fs.existsSync(adminKeyPath)) {
        console.error('❌ Admin wallet not found!');
        console.error(`   Checked: ${adminKeyPath}`);
        console.error('\n💡 To use a different wallet:');
        console.error('   Set environment variable: $env:ANCHOR_WALLET="C:\\path\\to\\wallet.json"');
        console.error('   Or place wallet.json in project root\n');
        process.exit(1);
    }

    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(adminKeyPath, 'utf8')))
    );

    console.log(`✅ Admin: ${adminKeypair.publicKey.toString()}\n`);

    // Check admin balance - try multiple RPC endpoints
    let adminBalance = await connection.getBalance(adminKeypair.publicKey);
    console.log(`💰 Admin Balance (Helius): ${(adminBalance / 1e9).toFixed(4)} SOL`);
    
    // Also check public RPC in case Helius is cached
    if (adminBalance < 1 * LAMPORTS_PER_SOL) {
        console.log(`   Checking public RPC...`);
        const publicConn = new Connection(RPC_URL, 'confirmed');
        const publicBalance = await publicConn.getBalance(adminKeypair.publicKey);
        console.log(`💰 Admin Balance (Public): ${(publicBalance / 1e9).toFixed(4)} SOL`);
        if (publicBalance > adminBalance) {
            adminBalance = publicBalance;
            connection = publicConn; // Use public RPC if it has more balance
        }
    }
    
    const requiredSOL = (NUM_WALLETS * SOL_PER_WALLET) + 5; // +5 for fees
    
    // Check balance and provide instructions
    if (adminBalance < requiredSOL * LAMPORTS_PER_SOL) {
        console.log(`\n⚠️  INSUFFICIENT BALANCE!\n`);
        console.log(`   Current: ${(adminBalance / 1e9).toFixed(4)} SOL`);
        console.log(`   Required: ${requiredSOL} SOL (for ${NUM_WALLETS} wallets)\n`);
        console.log(`💡 TO FIX:\n`);
        console.log(`   1. Transfer SOL to your wallet:`);
        console.log(`      ${adminKeypair.publicKey.toString()}\n`);
        console.log(`   2. Or run with fewer wallets:`);
        console.log(`      Change NUM_WALLETS in the script\n`);
        console.log(`   3. Check balance:`);
        console.log(`      node scripts/check-balance.js\n`);
        process.exit(1);
    }
    console.log(`✅ Sufficient balance for ${NUM_WALLETS} wallets\n`);

    // Create or load wallets
    const WALLETS_DIR = path.join(__dirname, '..', 'speed-run-wallets');
    if (!fs.existsSync(WALLETS_DIR)) {
        fs.mkdirSync(WALLETS_DIR, { recursive: true });
    }

    const walletsPath = path.join(WALLETS_DIR, 'wallets.json');
    let wallets = [];

    if (fs.existsSync(walletsPath) && JSON.parse(fs.readFileSync(walletsPath, 'utf8')).length >= NUM_WALLETS) {
        console.log(`📂 Loading existing wallets...`);
        const walletsData = JSON.parse(fs.readFileSync(walletsPath, 'utf8'));
        wallets = walletsData.slice(0, NUM_WALLETS).map(w => ({
            keypair: Keypair.fromSecretKey(Uint8Array.from(w.secretKey)),
            address: w.publicKey
        }));
        console.log(`✅ Loaded ${wallets.length} wallets\n`);
    } else {
        console.log(`🔨 Creating ${NUM_WALLETS} wallets...`);
        for (let i = 0; i < NUM_WALLETS; i++) {
            const keypair = Keypair.generate();
            wallets.push({
                keypair,
                address: keypair.publicKey.toString()
            });
        }
        
        const walletsData = wallets.map(w => ({
            publicKey: w.address,
            secretKey: Array.from(w.keypair.secretKey)
        }));
        
        fs.writeFileSync(walletsPath, JSON.stringify(walletsData, null, 2));
        console.log(`✅ Created ${wallets.length} wallets\n`);
    }

    // Fund wallets
    console.log(`💸 Funding ${wallets.length} wallets with ${SOL_PER_WALLET} SOL each...`);
    console.log(`   Total funding: ${(NUM_WALLETS * SOL_PER_WALLET).toFixed(2)} SOL\n`);
    
    const transferAmount = SOL_PER_WALLET * LAMPORTS_PER_SOL;
    let fundedCount = 0;
    
    for (let i = 0; i < wallets.length; i++) {
        try {
            const balance = await connection.getBalance(wallets[i].keypair.publicKey);
            if (balance < 0.1 * LAMPORTS_PER_SOL) {
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
                fundedCount++;
            } else {
                fundedCount++; // Already funded
            }
            
            if ((i + 1) % 20 === 0) {
                console.log(`   ✅ Funded ${i + 1}/${wallets.length}...`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 150));
        } catch (error) {
            console.error(`\n❌ Failed to fund wallet ${i + 1}:`, error.message);
        }
    }
    console.log(`✅ All wallets funded! (${fundedCount}/${NUM_WALLETS})\n`);

    // Make entries
    console.log(`🎫 Making entries for ${wallets.length} participants ($${USD_VALUE_CENTS / 100} each)...\n`);
    
    const entrySignatures = [];
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < wallets.length; i++) {
        try {
            const sig = await makeEntry(wallets[i].keypair, USD_VALUE_CENTS, connection);
            entrySignatures.push({
                wallet: wallets[i].address,
                signature: sig,
                explorer: `https://explorer.solana.com/tx/${sig}?cluster=devnet`
            });
            successCount++;
            
            if ((i + 1) % 10 === 0) {
                console.log(`   ✅ ${i + 1}/${wallets.length} entries completed...`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
        } catch (error) {
            failCount++;
            if (failCount <= 5) {
                console.error(`\n❌ Entry ${i + 1} failed:`, error.message);
            }
        }
    }
    
    console.log(`\n✅ Entries Complete!`);
    console.log(`   Success: ${successCount}/${NUM_WALLETS}`);
    console.log(`   Failed: ${failCount}\n`);

    // Wait for entries to settle
    console.log('⏳ Waiting for entries to settle (10 seconds)...\n');
    await new Promise(resolve => setTimeout(resolve, 10000));

    // Trigger snapshot
    console.log('📸 Triggering Snapshot...\n');
    try {
        const snapshotTx = await triggerSnapshot(adminKeypair, connection);
        
        console.log('✅ Snapshot triggered!');
        console.log(`   Transaction: ${snapshotTx}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${snapshotTx}?cluster=devnet\n`);
        
        await connection.confirmTransaction(snapshotTx, 'confirmed');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        console.log('='.repeat(70));
        console.log('  🎉 SPEED RUN COMPLETE!');
        console.log('='.repeat(70) + '\n');
        
        console.log('📋 SUMMARY:');
        console.log(`   Wallets Created: ${wallets.length}`);
        console.log(`   Entries Made: ${successCount}`);
        console.log(`   Entry Value: $${USD_VALUE_CENTS / 100} each`);
        console.log(`   Total Value: $${(successCount * USD_VALUE_CENTS / 100).toFixed(2)}`);
        console.log(`   SOL Used: ${(NUM_WALLETS * SOL_PER_WALLET).toFixed(2)} SOL\n`);
        
        console.log('🔗 View Snapshot Transaction:');
        console.log(`   https://explorer.solana.com/tx/${snapshotTx}?cluster=devnet\n`);
        
        console.log('🌐 Your website should now show real data!');
        console.log('   Refresh: https://pb-n7kx.vercel.app/\n');
        
        // Save entry signatures to file
        const signaturesPath = path.join(WALLETS_DIR, 'entry-signatures.json');
        fs.writeFileSync(signaturesPath, JSON.stringify(entrySignatures, null, 2));
        console.log(`💾 Entry signatures saved to: ${signaturesPath}\n`);
        
    } catch (error) {
        console.error('\n❌ Snapshot failed:', error.message);
        if (error.logs) {
            error.logs.forEach(log => console.error('   ', log));
        }
        throw error;
    }
}

if (require.main === module) {
    runSpeedRun()
        .then(() => {
            console.log('✅ Speed run complete! Check your website now!\n');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Speed run failed:', error);
            process.exit(1);
        });
}

module.exports = { runSpeedRun };
