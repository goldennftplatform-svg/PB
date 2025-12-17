// Calculate how much buy/sell volume is needed to hit 200 SOL threshold
// Based on: 2.45% of transaction volume goes to jackpot pool

const JACKPOT_THRESHOLD_SOL = 200;
const JACKPOT_TAX_RATE = 0.0245; // 2.45% of each transaction

console.log('💰 PEPEBALL Revenue Calculator');
console.log('================================\n');

console.log('📊 Current Tax Structure:');
console.log(`   Total Tax: 2.5% per transaction`);
console.log(`   Creator Fund: 0.05% (to Matt Furie)`);
console.log(`   Jackpot Pool: 2.45% (${JACKPOT_TAX_RATE * 100}%)\n`);

console.log(`🎯 Target: ${JACKPOT_THRESHOLD_SOL} SOL in jackpot pool`);
console.log(`   This triggers Fast Mode (48-hour snapshots)\n`);

// Calculate volume needed
const volumeNeededSOL = JACKPOT_THRESHOLD_SOL / JACKPOT_TAX_RATE;
const volumeNeededUSD = volumeNeededSOL * 150; // Assuming ~$150/SOL

console.log('💵 Volume Needed:');
console.log(`   ${volumeNeededSOL.toFixed(2)} SOL in transaction volume`);
console.log(`   ~$${volumeNeededUSD.toFixed(2)} USD (at $150/SOL)`);
console.log(`   ~$${(volumeNeededUSD / 1000).toFixed(2)}k USD\n`);

console.log('📈 Breakdown by Transaction Type:');
console.log(`   If all $20 entries:`);
console.log(`     ${Math.ceil(volumeNeededUSD / 20)} transactions needed`);
console.log(`     ${(Math.ceil(volumeNeededUSD / 20) * 20 / 1000).toFixed(2)}k total volume\n`);

console.log(`   If all $100 entries:`);
console.log(`     ${Math.ceil(volumeNeededUSD / 100)} transactions needed`);
console.log(`     ${(Math.ceil(volumeNeededUSD / 100) * 100 / 1000).toFixed(2)}k total volume\n`);

console.log(`   If all $500 entries:`);
console.log(`     ${Math.ceil(volumeNeededUSD / 500)} transactions needed`);
console.log(`     ${(Math.ceil(volumeNeededUSD / 500) * 500 / 1000).toFixed(2)}k total volume\n`);

// Calculate with 10 bots
console.log('🤖 With 10 Bots:');
const transactionsPerBot = Math.ceil(volumeNeededUSD / 20 / 10);
console.log(`   Each bot needs ~${transactionsPerBot} transactions (at $20 each)`);
console.log(`   Or ${Math.ceil(transactionsPerBot / 5)} transactions (at $100 each)\n`);

// Progressive calculation
console.log('📊 Progressive Milestones:');
const milestones = [50, 100, 150, 200];
milestones.forEach(milestone => {
    const volume = milestone / JACKPOT_TAX_RATE;
    const usd = volume * 150;
    console.log(`   ${milestone} SOL = ${volume.toFixed(2)} SOL volume = ~$${usd.toFixed(0)}`);
});

console.log('\n💡 Summary:');
console.log(`   Need ${volumeNeededSOL.toFixed(2)} SOL in buy/sell volume`);
console.log(`   That's ${volumeNeededSOL * 1e9} lamports`);
console.log(`   Or ~$${volumeNeededUSD.toFixed(0)} USD at current prices\n`);

// Export for bot testing
module.exports = {
    JACKPOT_THRESHOLD_SOL,
    JACKPOT_TAX_RATE,
    volumeNeededSOL,
    volumeNeededUSD,
    transactionsNeeded20: Math.ceil(volumeNeededUSD / 20),
    transactionsNeeded100: Math.ceil(volumeNeededUSD / 100),
    transactionsNeeded500: Math.ceil(volumeNeededUSD / 500)
};


















