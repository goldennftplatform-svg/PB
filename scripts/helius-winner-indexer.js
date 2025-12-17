// Helius-based Winner Indexer for Scalable Lottery
// Uses Helius Enhanced API to index participant accounts and calculate winners

const { Connection, PublicKey, Keypair } = require('@solana/web3.js');
const anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');

// Helius API Configuration
// Uses environment variable or fallback to configured key
const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '431ca765-2f35-4b23-8abd-db03796bd85f';
const HELIUS_RPC_URL = HELIUS_API_KEY 
    ? `https://rpc.helius.xyz/?api-key=${HELIUS_API_KEY}`
    : 'https://api.devnet.solana.com';

class HeliusWinnerIndexer {
    constructor(connection, lotteryProgram, lotteryPDA) {
        this.connection = connection;
        this.lotteryProgram = lotteryProgram;
        this.lotteryPDA = lotteryPDA;
    }

    /**
     * Get all participant accounts using Helius Enhanced API
     * Falls back to standard getProgramAccounts if Helius not available
     */
    async getAllParticipants() {
        console.log('🔍 Fetching all participant accounts...\n');

        try {
            // Try Helius Enhanced API first
            if (HELIUS_API_KEY) {
                return await this.getParticipantsHelius();
            } else {
                // Fallback to standard RPC
                return await this.getParticipantsStandard();
            }
        } catch (error) {
            console.error('⚠️  Error fetching participants:', error.message);
            console.log('🔄 Falling back to standard RPC...\n');
            return await this.getParticipantsStandard();
        }
    }

    /**
     * Use Helius Enhanced API to get participant accounts
     */
    async getParticipantsHelius() {
        console.log('🚀 Using Helius Enhanced API...\n');

        // ParticipantAccount discriminator from IDL: [239, 31, 144, 66, 245, 178, 84, 109]
        // Convert to base58 for memcmp filter
        const discriminator = Buffer.from([239, 31, 144, 66, 245, 178, 84, 109]);
        // Use dataSize filter instead of memcmp for better compatibility

        const response = await fetch(HELIUS_RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getProgramAccounts',
                params: [
                    LOTTERY_PROGRAM_ID.toString(),
                    {
                        filters: [
                            {
                                dataSize: 92 // ParticipantAccount size: 8 (discriminator) + 32 + 32 + 4 + 8 + 8
                            }
                        ],
                        encoding: 'base64'
                    }
                ]
            })
        });

        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error.message);
        }

        const participants = [];
        for (const account of data.result || []) {
            try {
                // Use Anchor's account parsing
                const accountData = Buffer.from(account.account.data[0], 'base64');
                const participant = await this.lotteryProgram.account.participantAccount.coder.accounts.decode(
                    'ParticipantAccount',
                    accountData
                );
                
                if (participant && new PublicKey(participant.lottery).equals(this.lotteryPDA)) {
                    participants.push({
                        wallet: new PublicKey(participant.wallet),
                        ticket_count: participant.ticketCount,
                        usd_value: participant.usdValue,
                        entry_time: participant.entryTime,
                        account_pubkey: new PublicKey(account.pubkey)
                    });
                }
            } catch (e) {
                // Skip invalid accounts
                continue;
            }
        }

        console.log(`✅ Found ${participants.length} participant accounts via Helius\n`);
        return participants;
    }

    /**
     * Standard RPC method (fallback)
     */
    async getParticipantsStandard() {
        console.log('📡 Using standard RPC (slower for large datasets)...\n');
        console.log('⚠️  For 20k+ participants, Helius API is strongly recommended!\n');

        // ParticipantAccount size: 8 (discriminator) + 32 (lottery) + 32 (wallet) + 4 (ticket_count) + 8 (usd_value) + 8 (entry_time) = 92 bytes
        const accounts = await this.connection.getProgramAccounts(LOTTERY_PROGRAM_ID, {
            filters: [
                {
                    dataSize: 92 // ParticipantAccount size
                }
            ]
        });

        const participants = [];
        for (const account of accounts) {
            try {
                // Use Anchor's account parsing
                const participant = await this.lotteryProgram.account.participantAccount.coder.accounts.decode(
                    'ParticipantAccount',
                    account.account.data
                );
                
                if (participant && new PublicKey(participant.lottery).equals(this.lotteryPDA)) {
                    participants.push({
                        wallet: new PublicKey(participant.wallet),
                        ticket_count: participant.ticketCount,
                        usd_value: participant.usdValue,
                        entry_time: participant.entryTime,
                        account_pubkey: account.pubkey
                    });
                }
            } catch (e) {
                // Skip invalid accounts
                continue;
            }
        }

        console.log(`✅ Found ${participants.length} participant accounts via standard RPC\n`);
        return participants;
    }

    /**
     * Calculate winners based on snapshot seed
     */
    calculateWinners(participants, snapshotSeed, totalTickets) {
        console.log('🎲 Calculating winners...\n');
        console.log(`   Snapshot Seed: ${snapshotSeed}`);
        console.log(`   Total Tickets: ${totalTickets}`);
        console.log(`   Participants: ${participants.length}\n`);

        if (participants.length < 9) {
            throw new Error('Not enough participants (need at least 9)');
        }

        // Main winner (weighted by tickets)
        const mainTicket = Number(BigInt(snapshotSeed) % BigInt(totalTickets));
        let accumulated = 0;
        let mainWinner = null;

        for (const participant of participants) {
            accumulated += participant.ticket_count;
            if (accumulated > mainTicket) {
                mainWinner = participant.wallet;
                break;
            }
        }

        if (!mainWinner) {
            // Fallback to last participant if calculation fails
            mainWinner = participants[participants.length - 1].wallet;
        }

        // Minor winners (8 winners, excluding main)
        const minorWinners = [];
        let seed = BigInt(snapshotSeed) * BigInt(7);
        const available = participants.filter(p => !p.wallet.equals(mainWinner));

        for (let i = 0; i < 8 && available.length > 0; i++) {
            const idx = Number(seed % BigInt(available.length));
            minorWinners.push(available[idx].wallet);
            available.splice(idx, 1);
            seed = seed * BigInt(13) + BigInt(1);
        }

        console.log('✅ Winners calculated:');
        console.log(`   Main Winner: ${mainWinner.toString()}`);
        console.log(`   Minor Winners: ${minorWinners.length}`);
        minorWinners.forEach((w, i) => {
            console.log(`      ${i + 1}. ${w.toString()}`);
        });
        console.log();

        return { mainWinner, minorWinners };
    }

    /**
     * Get current lottery state
     */
    async getLotteryState() {
        try {
            const lottery = await this.lotteryProgram.account.lottery.fetch(this.lotteryPDA);
            return lottery;
        } catch (error) {
            // Try alternative fetch method
            const accountInfo = await this.connection.getAccountInfo(this.lotteryPDA);
            if (!accountInfo) {
                throw new Error(`Lottery account does not exist: ${this.lotteryPDA.toString()}`);
            }
            const lottery = await this.lotteryProgram.account.lottery.fetch(this.lotteryPDA);
            return lottery;
        }
    }

    /**
     * Main indexing and winner calculation flow
     */
    async indexAndCalculateWinners() {
        console.log('🎰 Helius Winner Indexer\n');
        console.log('='.repeat(70) + '\n');

        // Get lottery state
        const lotteryState = await this.getLotteryState();
        
        console.log('📊 Lottery State:');
        console.log(`   Total Participants: ${lotteryState.totalParticipants}`);
        console.log(`   Total Tickets: ${lotteryState.totalTickets}`);
        console.log(`   Snapshot Seed: ${lotteryState.snapshotSeed || 'Not set'}\n`);

        if (!lotteryState.snapshotSeed || lotteryState.snapshotSeed === 0) {
            console.log('⚠️  No snapshot has been taken yet. Run take_snapshot first.\n');
            return null;
        }

        // Get all participants
        const participants = await this.getAllParticipants();

        if (participants.length === 0) {
            console.log('⚠️  No participants found!\n');
            return null;
        }

        // Calculate winners
        const winners = this.calculateWinners(
            participants,
            Number(lotteryState.snapshotSeed),
            Number(lotteryState.totalTickets)
        );

        return winners;
    }

    /**
     * Set winners on-chain
     */
    async setWinnersOnChain(mainWinner, minorWinners) {
        console.log('📝 Setting winners on-chain...\n');

        const tx = await this.lotteryProgram.methods
            .setWinners(mainWinner, minorWinners)
            .accounts({
                lottery: this.lotteryPDA,
                admin: this.lotteryProgram.provider.wallet.publicKey,
            })
            .rpc();

        console.log('✅ Winners set on-chain!');
        console.log(`   Transaction: ${tx}`);
        console.log(`   Explorer: https://explorer.solana.com/tx/${tx}?cluster=devnet\n`);

        return tx;
    }
}

async function main() {
    const connection = new Connection(HELIUS_RPC_URL, 'confirmed');

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

    // Load program - try workspace first, fallback to IDL
    let lotteryProgram;
    try {
        lotteryProgram = anchor.workspace.Lottery;
    } catch (e) {
        // Fallback: Load IDL manually
        const idlPath = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
        if (!fs.existsSync(idlPath)) {
            console.error('❌ IDL not found! Run: anchor build');
            process.exit(1);
        }
        const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
        lotteryProgram = new anchor.Program(idl, LOTTERY_PROGRAM_ID, provider);
    }
    
    if (!lotteryProgram) {
        console.error('❌ Lottery program not found! Run: anchor build');
        process.exit(1);
    }

    // Derive lottery PDA
    const [lotteryPDA] = PublicKey.findProgramAddressSync(
        [Buffer.from('lottery')],
        LOTTERY_PROGRAM_ID
    );

    console.log(`✅ Admin: ${adminKeypair.publicKey.toString()}`);
    console.log(`✅ Lottery PDA: ${lotteryPDA.toString()}`);
    console.log(`✅ Using Helius API\n`);

    const indexer = new HeliusWinnerIndexer(connection, lotteryProgram, lotteryPDA);

    try {
        // Index and calculate winners
        const winners = await indexer.indexAndCalculateWinners();

        if (!winners) {
            console.log('❌ Could not calculate winners\n');
            process.exit(1);
        }

        // Set winners on-chain
        const tx = await indexer.setWinnersOnChain(
            winners.mainWinner,
            winners.minorWinners
        );

        console.log('✅ Winner indexing complete!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.logs) {
            error.logs.forEach(log => console.error('   ', log));
        }
        process.exit(1);
    }
}

if (require.main === module) {
    main()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Failed:', error);
            process.exit(1);
        });
}

module.exports = { HeliusWinnerIndexer };

