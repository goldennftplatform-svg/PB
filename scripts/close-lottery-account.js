// Close lottery account for upgrade
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');

async function closeLotteryAccount() {
    console.log('🔒 Closing Lottery Account for Upgrade\n');
    console.log('='.repeat(70) + '\n');

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

    // Setup Anchor
    const provider = new anchor.AnchorProvider(
        connection,
        new anchor.Wallet(adminKeypair),
        { commitment: 'confirmed' }
    );
    anchor.setProvider(provider);

    // Use workspace (avoids IDL account size issues)
    let lotteryProgram;
    try {
        lotteryProgram = anchor.workspace.Lottery;
        if (!lotteryProgram) {
            throw new Error('Workspace not available');
        }
    } catch (e) {
        // Fallback: Load IDL manually but add account size info
        const IDL_PATH = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
        if (!fs.existsSync(IDL_PATH)) {
            console.error('❌ IDL not found! Run: anchor build');
            process.exit(1);
        }
        const IDL = JSON.parse(fs.readFileSync(IDL_PATH, 'utf8'));
        
        // Fix: Add account size info if missing
        if (IDL.accounts && IDL.accounts.length > 0) {
            const lotteryAccount = IDL.accounts.find(acc => acc.name === 'Lottery');
            if (lotteryAccount && !lotteryAccount.size) {
                // Approximate size: base + 1000 participants * participant size
                // Base: ~200 bytes, Participant: ~48 bytes each
                lotteryAccount.size = 8 + 200 + (1000 * 48); // 8 byte discriminator + data
            }
        }
        
        lotteryProgram = new anchor.Program(IDL, LOTTERY_PROGRAM_ID, provider);
    }

    // Derive lottery PDA
    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );

    console.log(`✅ Admin: ${adminKeypair.publicKey.toString()}`);
    console.log(`✅ Lottery PDA: ${lotteryPDA.toString()}\n`);

    try {
        // Check if account exists
        const accountInfo = await connection.getAccountInfo(lotteryPDA);
        if (!accountInfo) {
            console.log('✅ Lottery account does not exist (already closed or never initialized)');
            return;
        }

        console.log('📊 Current account size:', accountInfo.data.length, 'bytes\n');

        // Close the account
        console.log('🔒 Closing lottery account...\n');
        const tx = await lotteryProgram.methods
            .closeLottery()
            .accounts({
                lottery: lotteryPDA,
                admin: adminKeypair.publicKey,
            })
            .rpc();

        console.log('✅ Lottery account closed!');
        console.log(`   Transaction: ${tx}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);

    } catch (error) {
        if (error.message.includes('AccountNotInitialized') || error.message.includes('does not exist')) {
            console.log('✅ Lottery account does not exist (already closed)');
        } else {
            console.error('❌ Error closing account:', error.message);
            throw error;
        }
    }
}

if (require.main === module) {
    closeLotteryAccount()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Failed:', error);
            process.exit(1);
        });
}

module.exports = { closeLotteryAccount };

