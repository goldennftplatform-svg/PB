// Test participant entry with new scalable architecture
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');

async function testParticipantEntry() {
    console.log('🧪 Testing Participant Entry (Scalable Architecture)\n');
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

    // Create a test participant wallet
    const testParticipant = Keypair.generate();
    
    // Fund test participant from admin
    console.log('💰 Funding test participant...');
    try {
        const transferSig = await connection.requestAirdrop(testParticipant.publicKey, 2 * 1e9);
        await connection.confirmTransaction(transferSig, 'confirmed');
        console.log(`✅ Test participant funded: ${testParticipant.publicKey.toString()}\n`);
    } catch (e) {
        // If airdrop fails, transfer from admin
        const { Transaction, SystemProgram } = require('@solana/web3.js');
        const transfer = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey: adminKeypair.publicKey,
                toPubkey: testParticipant.publicKey,
                lamports: 2 * 1e9,
            })
        );
        const sig = await connection.sendTransaction(transfer, [adminKeypair]);
        await connection.confirmTransaction(sig, 'confirmed');
        console.log(`✅ Test participant funded via transfer: ${testParticipant.publicKey.toString()}\n`);
    }

    // Test entry
    const usdValue = 2000; // $20.00
    console.log(`🎫 Entering lottery with $${usdValue / 100}...\n`);

    try {
        // Derive participant account PDA
        const [participantPDA] = PublicKey.findProgramAddressSync(
            [
                Buffer.from('participant'),
                lotteryPDA.toBuffer(),
                testParticipant.publicKey.toBuffer()
            ],
            LOTTERY_PROGRAM_ID
        );

        console.log(`📝 Participant Account PDA: ${participantPDA.toString()}\n`);

        // Check if account exists
        const accountInfo = await connection.getAccountInfo(participantPDA);
        const isNew = !accountInfo || accountInfo.lamports === 0;

        if (isNew) {
            // New participant - use enter_lottery_with_usd_value
            console.log('🆕 New participant - creating account...\n');
            const tx = await lotteryProgram.methods
                .enterLotteryWithUsdValue(new anchor.BN(usdValue))
                .accounts({
                    lottery: lotteryPDA,
                    participantAccount: participantPDA,
                    participant: testParticipant.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .signers([testParticipant])
                .rpc();

            console.log('✅ Entry successful!');
            console.log(`   Transaction: ${tx}`);
            console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);
        } else {
            // Existing participant - use update_participant_tickets
            console.log('🔄 Existing participant - updating tickets...\n');
            const ticketCount = 1; // $20 = 1 ticket
            const tx = await lotteryProgram.methods
                .updateParticipantTickets(ticketCount, new anchor.BN(usdValue))
                .accounts({
                    lottery: lotteryPDA,
                    participantAccount: participantPDA,
                    participant: testParticipant.publicKey,
                })
                .signers([testParticipant])
                .rpc();

            console.log('✅ Update successful!');
            console.log(`   Transaction: ${tx}\n`);
        }

        // Check lottery state
        const lottery = await lotteryProgram.account.lottery.fetch(lotteryPDA);
        console.log('📊 Updated Lottery State:');
        console.log(`   Total Participants: ${lottery.totalParticipants}`);
        console.log(`   Total Tickets: ${lottery.totalTickets}\n`);

        // Check participant account
        const participant = await lotteryProgram.account.participantAccount.fetch(participantPDA);
        console.log('📋 Participant Account:');
        console.log(`   Wallet: ${participant.wallet.toString()}`);
        console.log(`   Tickets: ${participant.ticketCount}`);
        console.log(`   USD Value: $${(participant.usdValue / 100).toFixed(2)}\n`);

        console.log('✅ Test complete!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.logs) {
            console.error('Logs:');
            error.logs.forEach(log => console.error('  ', log));
        }
        throw error;
    }
}

if (require.main === module) {
    testParticipantEntry()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Failed:', error);
            process.exit(1);
        });
}

module.exports = { testParticipantEntry };

