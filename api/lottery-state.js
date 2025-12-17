// Backend API endpoint for lottery state
// This would be deployed as a serverless function (Vercel, Netlify, etc.)
// For now, this is a reference implementation

const { Connection, PublicKey } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');
const NETWORK = 'devnet';
const RPC_URL = process.env.HELIUS_RPC_URL || 'https://api.devnet.solana.com';

/**
 * Fetch lottery state from Solana
 * Returns JSON with winners, jackpot, payout transaction, etc.
 */
async function getLotteryState() {
    try {
        const connection = new Connection(RPC_URL, 'confirmed');
        
        // Derive lottery PDA
        const [lotteryPDA] = PublicKey.findProgramAddressSync(
            [Buffer.from('lottery')],
            LOTTERY_PROGRAM_ID
        );

        // Load program
        const idlPath = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
        if (!fs.existsSync(idlPath)) {
            throw new Error('IDL not found');
        }

        const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
        
        // Create provider (read-only, no wallet needed)
        const provider = new anchor.AnchorProvider(
            connection,
            { publicKey: PublicKey.default },
            { commitment: 'confirmed' }
        );

        const program = new anchor.Program(idl, LOTTERY_PROGRAM_ID, provider);

        // Fetch lottery account
        const lottery = await program.account.lottery.fetch(lotteryPDA);

        // Get payout transaction from recent transactions
        const payoutTx = await getPayoutTransaction(connection, lotteryPDA);

        // Format response
        return {
            jackpot: lottery.jackpotAmount.toString(),
            carryOver: (lottery.carryOverAmount || 0).toString(),
            lastSnapshot: lottery.lastSnapshot.toString(),
            totalSnapshots: lottery.totalSnapshots.toString(),
            totalParticipants: lottery.totalParticipants.toString(),
            totalTickets: lottery.totalTickets.toString(),
            isActive: lottery.isActive,
            winners: {
                mainWinner: lottery.winners.mainWinner?.toString() || null,
                minorWinners: (lottery.winners.minorWinners || [])
                    .map(w => w?.toString())
                    .filter(w => w && w !== '11111111111111111111111111111111')
            },
            payouts: {
                mainPayout: Math.floor(Number(lottery.jackpotAmount) * 0.68),
                minorPayout: Math.floor(Number(lottery.jackpotAmount) * 0.03),
                carryOver: Number(lottery.carryOverAmount || 0)
            },
            payoutTx: payoutTx,
            payoutTime: payoutTx ? await getTransactionTime(connection, payoutTx) : null
        };
    } catch (error) {
        console.error('Error fetching lottery state:', error);
        return {
            error: error.message
        };
    }
}

/**
 * Get the most recent payout transaction
 */
async function getPayoutTransaction(connection, lotteryPDA) {
    try {
        // Get recent transactions for the lottery account
        const signatures = await connection.getSignaturesForAddress(lotteryPDA, { limit: 50 });
        
        for (const sig of signatures) {
            const tx = await connection.getTransaction(sig.signature, {
                maxSupportedTransactionVersion: 0
            });
            
            if (tx && tx.meta && tx.transaction) {
                // Check if this is a payout transaction
                const instructions = tx.transaction.message.instructions;
                for (const ix of instructions) {
                    // Check if instruction is payout_winners
                    // This is simplified - would need proper instruction parsing
                    if (tx.meta.logMessages && tx.meta.logMessages.some(log => 
                        log.includes('payout') || log.includes('winner')
                    )) {
                        return sig.signature;
                    }
                }
            }
        }
        
        return null;
    } catch (error) {
        console.error('Error getting payout transaction:', error);
        return null;
    }
}

/**
 * Get transaction timestamp
 */
async function getTransactionTime(connection, signature) {
    try {
        const tx = await connection.getTransaction(signature, {
            maxSupportedTransactionVersion: 0
        });
        return tx?.blockTime || null;
    } catch (error) {
        return null;
    }
}

// Export for use as API endpoint
if (typeof module !== 'undefined') {
    module.exports = { getLotteryState };
}

// For serverless function (Vercel, Netlify, etc.)
if (typeof exports !== 'undefined') {
    exports.handler = async (event, context) => {
        const state = await getLotteryState();
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify(state)
        };
    };
}






