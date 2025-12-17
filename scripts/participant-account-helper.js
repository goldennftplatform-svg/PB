// Helper to derive participant account PDAs and query them
// Useful for testing and debugging the scalable architecture

const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');

/**
 * Derive participant account PDA
 */
function deriveParticipantAccount(lotteryPDA, participantWallet) {
    const [participantPDA] = PublicKey.findProgramAddressSync(
        [
            Buffer.from('participant'),
            lotteryPDA.toBuffer(),
            participantWallet.toBuffer()
        ],
        LOTTERY_PROGRAM_ID
    );
    return participantPDA;
}

/**
 * Get participant account data
 */
async function getParticipantAccount(connection, lotteryProgram, lotteryPDA, participantWallet) {
    const participantPDA = deriveParticipantAccount(lotteryPDA, participantWallet);
    
    try {
        const account = await lotteryProgram.account.participantAccount.fetch(participantPDA);
        return {
            exists: true,
            lottery: account.lottery.toString(),
            wallet: account.wallet.toString(),
            ticket_count: account.ticketCount,
            usd_value: account.usdValue,
            entry_time: account.entryTime
        };
    } catch (error) {
        return { exists: false };
    }
}

/**
 * List all participant accounts for a lottery
 * Note: This requires knowing participant wallets or using an indexer
 */
async function listParticipants(connection, lotteryProgram, lotteryPDA, participantWallets) {
    console.log('📋 Listing Participant Accounts\n');
    console.log('='.repeat(70) + '\n');

    const participants = [];

    for (const walletStr of participantWallets) {
        const wallet = new PublicKey(walletStr);
        const data = await getParticipantAccount(connection, lotteryProgram, lotteryPDA, wallet);
        
        if (data.exists) {
            participants.push(data);
            console.log(`✅ ${wallet.toString()}`);
            console.log(`   Tickets: ${data.ticket_count}`);
            console.log(`   USD Value: $${(data.usd_value / 100).toFixed(2)}`);
            console.log();
        }
    }

    return participants;
}

if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.log('Usage: node participant-account-helper.js <participant_wallet1> [participant_wallet2] ...');
        console.log('Example: node participant-account-helper.js <wallet1> <wallet2>');
        process.exit(1);
    }

    (async () => {
        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
        
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

        const lotteryProgram = anchor.workspace.Lottery;
        const [lotteryPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('lottery')],
            LOTTERY_PROGRAM_ID
        );

        await listParticipants(connection, lotteryProgram, lotteryPDA, args);
    })();
}

module.exports = { deriveParticipantAccount, getParticipantAccount };

