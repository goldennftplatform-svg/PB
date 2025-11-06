// Snapshot Service - Calculate USD values for lottery snapshots
// Integrates with price service and Helius API

class SnapshotService {
    constructor(priceService, connection, programId) {
        this.priceService = priceService;
        this.connection = connection;
        this.programId = programId;
        this.lotteryPDA = null;
    }

    /**
     * Derive lottery PDA
     */
    async deriveLotteryPDA() {
        if (this.lotteryPDA) return this.lotteryPDA;
        
        const anchor = window.anchor;
        if (!anchor) {
            throw new Error('Anchor not loaded');
        }
        
        const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
            [Buffer.from('lottery')],
            new anchor.web3.PublicKey(this.programId)
        );
        
        this.lotteryPDA = pda;
        return pda;
    }

    /**
     * Calculate USD value for a participant's token holdings
     */
    async calculateParticipantUSDValue(walletAddress, tokenMint) {
        try {
            // Get token balance and USD value
            const balanceData = await this.priceService.getTokenBalanceWithUSD(walletAddress, tokenMint);
            
            if (!balanceData) {
                return 0;
            }
            
            return balanceData.usdValue;
        } catch (error) {
            console.error('Error calculating USD value:', error);
            return 0;
        }
    }

    /**
     * Get all participants and calculate their USD values
     */
    async getParticipantsWithUSDValues() {
        try {
            // Fetch lottery account
            const lotteryPDA = await this.deriveLotteryPDA();
            
            // TODO: Fetch actual lottery account data
            // For now, return structure
            const participants = []; // Would come from lottery.participants
            
            // Calculate USD values for each participant
            const participantsWithUSD = await Promise.all(
                participants.map(async (participant) => {
                    const usdValue = await this.calculateParticipantUSDValue(
                        participant.wallet.toString(),
                        this.priceService.tokenMint
                    );
                    
                    return {
                        ...participant,
                        usdValue,
                        usdValueCents: Math.floor(usdValue * 100) // Convert to cents for contract
                    };
                })
            );
            
            return participantsWithUSD;
        } catch (error) {
            console.error('Error getting participants:', error);
            return [];
        }
    }

    /**
     * Prepare snapshot data for contract
     * Includes USD values for all participants
     */
    async prepareSnapshotData() {
        const participants = await this.getParticipantsWithUSDValues();
        
        // Filter participants with minimum $20 USD value
        const qualifiedParticipants = participants.filter(p => p.usdValue >= 20.0);
        
        return {
            participants: qualifiedParticipants,
            totalParticipants: qualifiedParticipants.length,
            totalUSDValue: qualifiedParticipants.reduce((sum, p) => sum + p.usdValue, 0),
            timestamp: Date.now()
        };
    }

    /**
     * Update participant USD values in lottery contract
     * This would be called when taking a snapshot
     */
    async updateParticipantUSDValues() {
        try {
            const snapshotData = await this.prepareSnapshotData();
            
            // TODO: Call contract instruction to update USD values
            // This would be a new instruction or part of take_snapshot
            
            console.log('📊 Snapshot data prepared:', {
                participants: snapshotData.totalParticipants,
                totalUSD: snapshotData.totalUSDValue
            });
            
            return snapshotData;
        } catch (error) {
            console.error('Error updating participant USD values:', error);
            throw error;
        }
    }
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SnapshotService;
} else {
    window.SnapshotService = SnapshotService;
}

