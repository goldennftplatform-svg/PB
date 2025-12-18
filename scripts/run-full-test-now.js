// Full test run: Make entries using Anchor workspace (bypasses IDL file requirement)
const anchor = require('@coral-xyz/anchor');
const { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');

async function runFullTest() {
    console.log('🎰 FULL TEST RUN: Entries → Snapshot → Winners → Payout\n');
    console.log('='.repeat(70) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');

    // Load admin wallet
    const walletPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
    );

    const provider = new anchor.AnchorProvider(
        connection,
        new anchor.Wallet(adminKeypair),
        { commitment: 'confirmed' }
    );
    anchor.setProvider(provider);

    // Try to load program from workspace
    let lotteryProgram;
    try {
        lotteryProgram = anchor.workspace.Lottery;
        console.log('✅ Loaded program from Anchor workspace\n');
    } catch (e) {
        console.log('⚠️  Cannot load from workspace, trying IDL file...\n');
        const idlPath = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
        if (fs.existsSync(idlPath)) {
            const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
            lotteryProgram = new anchor.Program(idl, LOTTERY_PROGRAM_ID, provider);
            console.log('✅ Loaded program from IDL file\n');
        } else {
            console.error('❌ Cannot proceed: IDL not found and workspace not available');
            console.error('   Please run: anchor build (in WSL)\n');
            process.exit(1);
        }
    }

    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );

    console.log(`✅ Admin: ${adminKeypair.publicKey.toString()}`);
    console.log(`✅ Lottery PDA: ${lotteryPDA.toString()}\n`);

    // Load test wallets
    const WALLETS_DIR = path.join(__dirname, '..', 'test-wallets');
    const walletsInfoPath = path.join(WALLETS_DIR, 'wallets-info.json');
    
    if (!fs.existsSync(walletsInfoPath)) {
        console.error('❌ Test wallets not found!');
        process.exit(1);
    }

    const walletsInfo = JSON.parse(fs.readFileSync(walletsInfoPath, 'utf8'));
    console.log(`📊 Found ${walletsInfo.length} test wallets\n`);

    // STEP 1: Make entries (need at least 9 participants)
    console.log('🎫 STEP 1: Making Lottery Entries\n');
    const entryAmounts = [2000, 2500, 3000, 5000, 10000, 15000, 20000, 25000, 30000, 50000];
    let successCount = 0;

    for (let i = 0; i < Math.min(10, walletsInfo.length); i++) {
        const walletInfo = walletsInfo[i];
        const walletKeypair = Keypair.fromSecretKey(
            Uint8Array.from(JSON.parse(fs.readFileSync(walletInfo.path, 'utf8')).secretKey)
        );

        try {
            const [participantPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('participant'),
                    lotteryPDA.toBuffer(),
                    walletKeypair.publicKey.toBuffer()
                ],
                LOTTERY_PROGRAM_ID
            );

            const usdValue = entryAmounts[i];
            console.log(`   Entry ${i + 1}/10: $${(usdValue / 100).toFixed(2)}...`);

            const tx = await lotteryProgram.methods
                .enterLotteryWithUsdValue(new anchor.BN(usdValue))
                .accounts({
                    lottery: lotteryPDA,
                    participantAccount: participantPDA,
                    participant: walletKeypair.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .signers([walletKeypair])
                .rpc();

            console.log(`   ✅ Success! TX: ${tx.slice(0, 16)}...`);
            successCount++;
            await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
            console.log(`   ⚠️  Failed: ${error.message}`);
        }
    }

    console.log(`\n✅ Made ${successCount} entries\n`);

    if (successCount < 9) {
        console.log('⚠️  Need at least 9 participants for snapshot');
        console.log(`   Currently have: ${successCount}\n`);
        return;
    }

    // STEP 2: Trigger snapshot
    console.log('📸 STEP 2: Triggering Snapshot (50/50 Rollover)\n');
    try {
        const tx = await lotteryProgram.methods
            .takeSnapshot()
            .accounts({
                lottery: lotteryPDA,
                admin: adminKeypair.publicKey,
            })
            .rpc();

        console.log(`✅ Snapshot triggered! TX: ${tx}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);

        // Wait for confirmation
        await connection.confirmTransaction(tx, 'confirmed');
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Check result
        const lottery = await lotteryProgram.account.lottery.fetch(lotteryPDA);
        const pepeBallCount = lottery.pepeBallCount;
        const isOdd = pepeBallCount % 2 === 1;

        console.log(`🎲 Pepe Ball Count: ${pepeBallCount}`);
        console.log(`   Result: ${isOdd ? '✅ ODD → PAYOUT MODE' : '🔄 EVEN → ROLLOVER'}\n`);

        if (isOdd) {
            // STEP 3: Find winners
            console.log('🔍 STEP 3: Finding Winners\n');
            const { execSync } = require('child_process');
            try {
                execSync('node scripts/helius-winner-indexer.js', { 
                    stdio: 'inherit',
                    cwd: path.join(__dirname, '..')
                });
            } catch (e) {
                console.log('   ⚠️  Winner indexing may have issues\n');
            }

            // STEP 4: Execute payout
            console.log('💰 STEP 4: Executing Payout\n');
            try {
                execSync('node scripts/secure-payout-tool.js', { 
                    stdio: 'inherit',
                    cwd: path.join(__dirname, '..')
                });
            } catch (e) {
                console.log('   ⚠️  Payout may have issues\n');
            }
        } else {
            console.log('🔄 Rollover mode - jackpot grows, timer extended\n');
        }

        console.log('✅ Full test complete!\n');

    } catch (error) {
        console.error('❌ Snapshot failed:', error.message);
        if (error.logs) {
            error.logs.forEach(log => console.error('   ', log));
        }
    }
}

if (require.main === module) {
    runFullTest()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('\n❌ Failed:', error);
            process.exit(1);
        });
}

module.exports = { runFullTest };

