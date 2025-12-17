// Schedule payout in 34 minutes
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');
const DELAY_MINUTES = 34;

async function schedulePayout() {
    console.log(`⏰ Scheduling payout in ${DELAY_MINUTES} minutes...\n`);
    
    const delayMs = DELAY_MINUTES * 60 * 1000;
    const targetTime = new Date(Date.now() + delayMs);
    
    console.log(`📅 Payout will trigger at: ${targetTime.toLocaleString()}\n`);
    console.log(`⏳ Waiting ${DELAY_MINUTES} minutes...\n`);
    
    // Wait
    await new Promise(resolve => setTimeout(resolve, delayMs));
    
    console.log(`\n💰 Time's up! Triggering payout...\n`);
    
    // Load admin wallet
    const walletPath = process.env.ANCHOR_WALLET || 
        path.join(process.env.HOME || process.env.USERPROFILE, '.config', 'solana', 'id.json');
    
    const adminKeypair = Keypair.fromSecretKey(
        Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, 'utf8')))
    );

    const connection = new Connection(RPC_URL, 'confirmed');
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
        const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
        lotteryProgram = new anchor.Program(idl, LOTTERY_PROGRAM_ID, provider);
    }

    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );

    // Trigger payout
    try {
        const payoutTx = await lotteryProgram.methods
            .payoutWinners()
            .accounts({
                lottery: lotteryPDA,
                admin: adminKeypair.publicKey,
            })
            .rpc();

        console.log(`✅ Payout executed!`);
        console.log(`   Transaction: ${payoutTx}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${payoutTx}?cluster=${NETWORK}\n`);
    } catch (error) {
        console.error(`❌ Payout failed: ${error.message}`);
        if (error.logs) {
            error.logs.forEach(log => console.error('   ', log));
        }
    }
}

if (require.main === module) {
    schedulePayout()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Failed:', error);
            process.exit(1);
        });
}

module.exports = { schedulePayout };






