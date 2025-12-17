// Test scalable lottery with existing test wallets
const { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');
const WALLETS_DIR = path.join(__dirname, '..', 'test-wallets');

async function testScalableWithExistingWallets() {
    console.log('🧪 Testing Scalable Lottery with Existing Wallets\n');
    console.log('='.repeat(70) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');

    // Load admin wallet
    const walletPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
    );

    // Setup Anchor
    const provider = new anchor.AnchorProvider(
        connection,
        new anchor.Wallet(adminKeypair),
        { commitment: 'confirmed' }
    );
    anchor.setProvider(provider);

    // Load program
    let lotteryProgram;
    try {
        lotteryProgram = anchor.workspace.Lottery;
    } catch (e) {
        const idlPath = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
        if (!fs.existsSync(idlPath)) {
            console.error('❌ IDL not found! Run: anchor build');
            process.exit(1);
        }
        const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
        lotteryProgram = new anchor.Program(idl, LOTTERY_PROGRAM_ID, provider);
    }

    // Derive lottery PDA
    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );

    console.log(`✅ Admin: ${adminKeypair.publicKey.toString()}`);
    console.log(`✅ Lottery PDA: ${lotteryPDA.toString()}\n`);

    // Load existing test wallets
    const walletsInfoPath = path.join(WALLETS_DIR, 'wallets-info.json');
    if (!fs.existsSync(walletsInfoPath)) {
        console.error('❌ Test wallets not found!');
        process.exit(1);
    }

    const walletsInfo = JSON.parse(fs.readFileSync(walletsInfoPath, 'utf8'));
    console.log(`📊 Found ${walletsInfo.length} test wallets\n`);

    // Use first 5 wallets for testing
    const testWallets = walletsInfo.slice(0, 5);
    
    // Fund wallets if needed (from admin)
    console.log('💰 Checking and funding wallets...\n');
    for (const walletInfo of testWallets) {
        const walletData = JSON.parse(fs.readFileSync(walletInfo.path, 'utf8'));
        const walletKeypair = Keypair.fromSecretKey(Uint8Array.from(walletData.secretKey));
        const balance = await connection.getBalance(walletKeypair.publicKey);
        
        if (balance < 0.1 * LAMPORTS_PER_SOL) {
            console.log(`   Funding ${walletInfo.publicKey.substring(0, 8)}...`);
            try {
                const tx = await connection.sendTransaction(
                    new anchor.web3.Transaction().add(
                        SystemProgram.transfer({
                            fromPubkey: adminKeypair.publicKey,
                            toPubkey: walletKeypair.publicKey,
                            lamports: 0.5 * LAMPORTS_PER_SOL,
                        })
                    ),
                    [adminKeypair]
                );
                await connection.confirmTransaction(tx, 'confirmed');
                console.log(`      ✅ Funded\n`);
            } catch (error) {
                console.error(`      ❌ Failed: ${error.message}\n`);
            }
        } else {
            console.log(`   ✅ ${walletInfo.publicKey.substring(0, 8)}... has ${(balance / LAMPORTS_PER_SOL).toFixed(4)} SOL\n`);
        }
    }

    // Test entries
    console.log('🎫 Testing lottery entries...\n');
    
    for (let i = 0; i < testWallets.length; i++) {
        const walletInfo = testWallets[i];
        const walletData = JSON.parse(fs.readFileSync(walletInfo.path, 'utf8'));
        const walletKeypair = Keypair.fromSecretKey(Uint8Array.from(walletData.secretKey));
        const usdValue = 2000 + (i * 1000); // $20, $30, $40, $50, $60
        
        try {
            // Derive participant account PDA
            const [participantPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('participant'),
                    lotteryPDA.toBuffer(),
                    walletKeypair.publicKey.toBuffer()
                ],
                LOTTERY_PROGRAM_ID
            );

            // Check if account exists
            const accountInfo = await connection.getAccountInfo(participantPDA);
            const isNew = !accountInfo || accountInfo.lamports === 0;

            if (isNew) {
                // New participant
                console.log(`   Wallet ${i + 1}: Entering with $${usdValue / 100} (new)`);
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

                console.log(`      ✅ Transaction: ${tx.substring(0, 20)}...\n`);
            } else {
                // Existing participant
                console.log(`   Wallet ${i + 1}: Adding $${usdValue / 100} more (update)`);
                const ticketCount = usdValue >= 2000 && usdValue < 10000 ? 1 : 
                                   usdValue >= 10000 && usdValue < 50000 ? 4 : 10;
                
                const tx = await lotteryProgram.methods
                    .updateParticipantTickets(ticketCount, new anchor.BN(usdValue))
                    .accounts({
                        lottery: lotteryPDA,
                        participantAccount: participantPDA,
                        participant: walletKeypair.publicKey,
                    })
                    .signers([walletKeypair])
                    .rpc();

                console.log(`      ✅ Transaction: ${tx.substring(0, 20)}...\n`);
            }
        } catch (error) {
            console.error(`   ❌ Wallet ${i + 1} failed: ${error.message}\n`);
        }
    }

    // Check lottery state
    console.log('📊 Checking lottery state...\n');
    try {
        const lottery = await lotteryProgram.account.lottery.fetch(lotteryPDA);
        console.log(`   Total Participants: ${lottery.totalParticipants}`);
        console.log(`   Total Tickets: ${lottery.totalTickets}`);
        console.log(`   Status: ${lottery.isActive ? '✅ Active' : '❌ Inactive'}\n`);
    } catch (error) {
        console.error(`   ❌ Failed to fetch lottery: ${error.message}\n`);
    }

    console.log('✅ Test complete!\n');
}

if (require.main === module) {
    testScalableWithExistingWallets()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Failed:', error);
            process.exit(1);
        });
}

module.exports = { testScalableWithExistingWallets };

