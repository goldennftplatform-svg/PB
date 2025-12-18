// Fetch and display last 10 winners
const { Connection, PublicKey } = require('@solana/web3.js');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');

class WinnersDataFetcher {
    constructor() {
        this.connection = new Connection(RPC_URL, 'confirmed');
        this.lotteryPDA = PublicKey.findProgramAddressSync(
            [Buffer.from('lottery')],
            LOTTERY_PROGRAM_ID
        )[0];
    }

    async fetchLast10Winners() {
        try {
            // Fetch lottery account
            const accountInfo = await this.connection.getAccountInfo(this.lotteryPDA);
            if (!accountInfo) {
                return [];
            }

            // Parse winners from account data
            // This is simplified - would need full IDL for proper parsing
            const winners = [];

            // Try to get winners from recent transactions
            const signatures = await this.connection.getSignaturesForAddress(
                this.lotteryPDA,
                { limit: 50 }
            );

            for (const sig of signatures.slice(0, 10)) {
                try {
                    const tx = await this.connection.getTransaction(sig.signature, {
                        commitment: 'confirmed',
                        maxSupportedTransactionVersion: 0
                    });

                    if (tx && tx.meta && tx.meta.logMessages) {
                        // Look for winner addresses in logs
                        const winnerLogs = tx.meta.logMessages.filter(log => 
                            log.includes('Winner') || log.includes('winner')
                        );

                        if (winnerLogs.length > 0) {
                            winners.push({
                                date: new Date(sig.blockTime * 1000).toLocaleDateString(),
                                transaction: sig.signature,
                                type: 'Grand Prize'
                            });
                        }
                    }
                } catch (e) {
                    // Skip failed transactions
                }
            }

            return winners.slice(0, 10);
        } catch (error) {
            console.error('Error fetching winners:', error);
            return [];
        }
    }

    formatAddress(address) {
        if (!address) return 'N/A';
        return `${address.slice(0, 4)}...${address.slice(-4)}`;
    }
}

// Browser version
if (typeof window !== 'undefined') {
    window.WinnersDataFetcher = WinnersDataFetcher;
}

// Node.js version
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WinnersDataFetcher };
}

