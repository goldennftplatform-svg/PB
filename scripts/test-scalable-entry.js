// Test scalable lottery entry with participant accounts
const { Connection, Keypair, PublicKey } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');

async function testScalableEntry() {
    console.log('🧪 Testing Scalable Lottery Entry\n');
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

    // Create test participant wallets
    console.log('👥 Creating 5 test participant wallets...\n');
    const participants = [];
    for (let i = 0; i < 5; i++) {
        const keypair = Keypair.generate();
        participants.push({
            keypair,
            publicKey: keypair.publicKey.toString()
        });
        console.log(`   Participant ${i + 1}: ${keypair.publicKey.toString()}`);
    }
    console.log();

    // Fund participants
    console.log('💰 Funding participants...\n');
    for (const participant of participants) {
        try {
            const signature = await connection.requestAirdrop(
                participant.keypair.publicKey,
                2 * 1e9 // 2 SOL
            );
            await connection.confirmTransaction(signature, 'confirmed');
            console.log(`   ✅ Funded ${participant.publicKey.substring(0, 8)}...`);
        } catch (error) {
            console.error(`   ❌ Failed to fund ${participant.publicKey}: ${error.message}`);
        }
    }
    console.log();

    // Wait a moment for airdrops to settle
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Test entries
    console.log('🎫 Testing lottery entries...\n');
    
    for (let i = 0; i < participants.length; i++) {
        const participant = participants[i];
        const usdValue = 2000 + (i * 1000); // $20, $30, $40, $50, $60
        
        try {
            // Derive participant account PDA
            const [participantPDA] = PublicKey.findProgramAddressSync(
                [
                    Buffer.from('participant'),
                    lotteryPDA.toBuffer(),
                    participant.keypair.publicKey.toBuffer()
                ],
                LOTTERY_PROGRAM_ID
            );

            // Check if account exists
            const accountInfo = await connection.getAccountInfo(participantPDA);
            const isNew = !accountInfo || accountInfo.lamports === 0;

            if (isNew) {
                // New participant - use enter_lottery_with_usd_value
                console.log(`   Participant ${i + 1}: Entering with $${usdValue / 100} (new)`);
                const tx = await lotteryProgram.methods
                    .enterLotteryWithUsdValue(new anchor.BN(usdValue))
                    .accounts({
                        lottery: lotteryPDA,
                        participantAccount: participantPDA,
                        participant: participant.keypair.publicKey,
                        systemProgram: anchor.web3.SystemProgram.programId,
                    })
                    .signers([participant.keypair])
                    .rpc();

                console.log(`      ✅ Transaction: ${tx.substring(0, 20)}...\n`);
            } else {
                // Existing participant - use update_participant_tickets
                console.log(`   Participant ${i + 1}: Adding $${usdValue / 100} more (update)`);
                const ticketCount = usdValue >= 2000 && usdValue < 10000 ? 1 : 
                                   usdValue >= 10000 && usdValue < 50000 ? 4 : 10;
                
                const tx = await lotteryProgram.methods
                    .updateParticipantTickets(ticketCount, new anchor.BN(usdValue))
                    .accounts({
                        lottery: lotteryPDA,
                        participantAccount: participantPDA,
                        participant: participant.keypair.publicKey,
                    })
                    .signers([participant.keypair])
                    .rpc();

                console.log(`      ✅ Transaction: ${tx.substring(0, 20)}...\n`);
            }
        } catch (error) {
            console.error(`   ❌ Participant ${i + 1} failed: ${error.message}\n`);
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
    testScalableEntry()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Failed:', error);
            process.exit(1);
        });
}

module.exports = { testScalableEntry };

