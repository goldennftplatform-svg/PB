// Comprehensive Lottery State Diagnostic
// Checks if lottery is initialized, has participants, and can trigger snapshots

const { Connection, PublicKey } = require('@solana/web3.js');
const Anchor = require('@coral-xyz/anchor');
const fs = require('fs');
const path = require('path');

const NETWORK = 'devnet';
const RPC_URL = 'https://api.devnet.solana.com';
const LOTTERY_PROGRAM_ID = new PublicKey('8xdCoGh7WrHrmpxMzqaXLfqJxYxU4mksQ3CBmztn13E7');
const KNOWN_LOTTERY_PDA = 'ERyc67uwzGAxAGVUQvoDg74nGmxNssPjVT7eD6yN6FKb';

async function diagnoseLotteryState() {
    console.log('\n' + '='.repeat(80));
    console.log('  🔍 COMPREHENSIVE LOTTERY STATE DIAGNOSTIC');
    console.log('='.repeat(80) + '\n');

    const connection = new Connection(RPC_URL, 'confirmed');

    // Step 1: Check program exists
    console.log('1️⃣ CHECKING PROGRAM...\n');
    const programInfo = await connection.getAccountInfo(LOTTERY_PROGRAM_ID);
    if (!programInfo) {
        console.error('❌ Program NOT FOUND on devnet!');
        console.error(`   Program ID: ${LOTTERY_PROGRAM_ID.toString()}`);
        process.exit(1);
    }
    console.log('✅ Program exists on devnet');
    console.log(`   Owner: ${programInfo.owner.toString()}`);
    console.log(`   Data length: ${programInfo.data.length} bytes\n`);

    // Step 2: Check lottery account
    console.log('2️⃣ CHECKING LOTTERY ACCOUNT...\n');
    const lotteryPDA = new PublicKey(KNOWN_LOTTERY_PDA);
    const accountInfo = await connection.getAccountInfo(lotteryPDA);
    
    if (!accountInfo) {
        console.error('❌ Lottery account NOT FOUND!');
        console.error('   The lottery needs to be initialized.');
        console.error('\n📋 To initialize, run:');
        console.error('   node scripts/simple-init-lottery.js');
        console.error('   OR');
        console.error('   node scripts/reinit-lottery-50-50.js\n');
        process.exit(1);
    }

    console.log('✅ Lottery account exists!');
    console.log(`   PDA: ${lotteryPDA.toString()}`);
    console.log(`   Balance: ${(accountInfo.lamports / 1e9).toFixed(4)} SOL`);
    console.log(`   Data length: ${accountInfo.data.length} bytes`);
    console.log(`   Owner: ${accountInfo.owner.toString()}\n`);

    // Step 3: Try to parse lottery state using Anchor
    console.log('3️⃣ PARSING LOTTERY STATE...\n');
    let lottery = null;
    let parsedSuccessfully = false;

    try {
        // Try to load IDL
        const IDL_PATH = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');
        if (fs.existsSync(IDL_PATH)) {
            const IDL = JSON.parse(fs.readFileSync(IDL_PATH, 'utf8'));
            const program = new Anchor.Program(IDL, LOTTERY_PROGRAM_ID, {
                connection: connection
            });
            
            lottery = await program.account.lottery.fetch(lotteryPDA);
            parsedSuccessfully = true;
            
            console.log('✅ Successfully parsed lottery state using Anchor IDL\n');
            console.log('📊 LOTTERY STATE:');
            console.log(`   Is Active: ${lottery.isActive}`);
            console.log(`   Total Participants: ${lottery.totalParticipants}`);
            console.log(`   Total Tickets: ${lottery.totalTickets}`);
            console.log(`   Jackpot Amount: ${(lottery.jackpotAmount / 1e9).toFixed(4)} SOL`);
            console.log(`   Carry-over Amount: ${((lottery.carryOverAmount || 0) / 1e9).toFixed(4)} SOL`);
            console.log(`   Fees Collected: ${(lottery.feesCollected / 1e9).toFixed(4)} SOL`);
            console.log(`   Is Fast Mode: ${lottery.isFastMode || false}`);
            console.log(`   Base Snapshot Interval: ${(lottery.baseSnapshotInterval / 3600).toFixed(0)} hours`);
            console.log(`   Fast Snapshot Interval: ${(lottery.fastSnapshotInterval / 3600).toFixed(0)} hours`);
            console.log(`   Fast Mode Threshold: ${(lottery.fastModeThreshold / 1e9).toFixed(4)} SOL`);
            console.log(`   Last Snapshot: ${new Date(lottery.lastSnapshot * 1000).toLocaleString()}`);
            console.log(`   Total Snapshots: ${lottery.totalSnapshots || 0}`);
            console.log(`   Rollover Count: ${lottery.rolloverCount || 0}`);
            console.log(`   Pepe Ball Count: ${lottery.pepeBallCount || 0}\n`);
        } else {
            console.warn('⚠️  IDL not found, attempting manual parsing...\n');
        }
    } catch (error) {
        console.warn('⚠️  Could not parse with Anchor IDL:', error.message);
        console.warn('   Attempting manual parsing...\n');
    }

    // Step 4: Manual parsing if Anchor failed
    if (!parsedSuccessfully) {
        console.log('📊 MANUAL PARSING (approximate offsets):\n');
        const data = accountInfo.data;
        
        // These offsets are approximate - actual struct layout may vary
        // But we can at least check if data exists
        console.log(`   Account data size: ${data.length} bytes`);
        console.log(`   Expected size: ~423 bytes (with rollover fields)\n`);
        
        // Try to read some basic fields (these offsets are guesses based on struct)
        // is_active is likely near the start (bool = 1 byte)
        // total_participants is likely u32 = 4 bytes
        // jackpot_amount is likely u64 = 8 bytes
        
        if (data.length >= 100) {
            console.log('   ⚠️  Manual parsing is unreliable without exact struct layout');
            console.log('   💡 Recommendation: Run `anchor build` to generate IDL\n');
        }
    }

    // Step 5: Check trigger conditions
    console.log('4️⃣ CHECKING SNAPSHOT TRIGGER CONDITIONS...\n');
    
    if (parsedSuccessfully && lottery) {
        const currentTime = Math.floor(Date.now() / 1000);
        const timeSinceLastSnapshot = currentTime - lottery.lastSnapshot.toNumber();
        const snapshotInterval = lottery.isFastMode 
            ? lottery.fastSnapshotInterval.toNumber()
            : lottery.baseSnapshotInterval.toNumber();
        const timeUntilNextSnapshot = snapshotInterval - timeSinceLastSnapshot;
        
        console.log('📋 REQUIREMENTS FOR SNAPSHOT:');
        console.log(`   ✅ Is Active: ${lottery.isActive ? 'YES ✅' : 'NO ❌'}`);
        console.log(`   ${lottery.totalParticipants >= 9 ? '✅' : '❌'} Participants: ${lottery.totalParticipants} / 9 required`);
        console.log(`   ${lottery.totalTickets > 0 ? '✅' : '❌'} Tickets: ${lottery.totalTickets} (must be > 0)`);
        console.log(`   ${timeSinceLastSnapshot >= snapshotInterval ? '✅' : '❌'} Time elapsed: ${(timeSinceLastSnapshot / 3600).toFixed(2)}h / ${(snapshotInterval / 3600).toFixed(0)}h required\n`);
        
        if (!lottery.isActive) {
            console.log('❌ BLOCKER: Lottery is not active!');
            console.log('   Run: node scripts/configure-test-timing.js (or similar) to activate\n');
        }
        
        if (lottery.totalParticipants < 9) {
            console.log('❌ BLOCKER: Not enough participants!');
            console.log(`   Current: ${lottery.totalParticipants}`);
            console.log(`   Required: 9`);
            console.log('   💡 Run entry scripts to add participants:\n');
            console.log('      node scripts/make-entries-with-test-wallets.js');
            console.log('      node scripts/speed-run-100-wallets.js\n');
        }
        
        if (lottery.totalTickets === 0) {
            console.log('❌ BLOCKER: No tickets!');
            console.log('   Participants must have entered the lottery\n');
        }
        
        if (timeSinceLastSnapshot < snapshotInterval) {
            const hoursRemaining = timeUntilNextSnapshot / 3600;
            console.log(`⏳ WAITING: ${hoursRemaining.toFixed(2)} hours until next snapshot can be taken`);
            console.log(`   Last snapshot: ${new Date(lottery.lastSnapshot * 1000).toLocaleString()}`);
            console.log(`   Next snapshot: ${new Date((lottery.lastSnapshot + snapshotInterval) * 1000).toLocaleString()}\n`);
        }
        
        if (lottery.isActive && lottery.totalParticipants >= 9 && lottery.totalTickets > 0 && timeSinceLastSnapshot >= snapshotInterval) {
            console.log('✅ ALL CONDITIONS MET! Snapshot can be triggered!\n');
            console.log('🚀 To trigger snapshot, run:');
            console.log('   node scripts/trigger-snapshot.js\n');
        }
    } else {
        console.log('⚠️  Cannot check conditions without parsed lottery state');
        console.log('   Run `anchor build` to generate IDL, then re-run this script\n');
    }

    // Step 6: Check recent transactions
    console.log('5️⃣ CHECKING RECENT TRANSACTIONS...\n');
    const signatures = await connection.getSignaturesForAddress(lotteryPDA, { limit: 20 });
    console.log(`✅ Found ${signatures.length} recent transactions\n`);
    
    if (signatures.length > 0) {
        let entryCount = 0;
        let snapshotCount = 0;
        let payoutCount = 0;
        
        console.log('   Analyzing transaction types...\n');
        
        for (let i = 0; i < Math.min(10, signatures.length); i++) {
            const sig = signatures[i];
            try {
                const tx = await connection.getTransaction(sig.signature, {
                    commitment: 'confirmed',
                    maxSupportedTransactionVersion: 0
                });
                
                if (tx && tx.meta && tx.meta.logMessages) {
                    const logs = tx.meta.logMessages.join(' ');
                    if (logs.includes('enter_lottery') || logs.includes('EnterLottery')) {
                        entryCount++;
                    }
                    if (logs.includes('take_snapshot') || logs.includes('TakeSnapshot')) {
                        snapshotCount++;
                    }
                    if (logs.includes('payout_winners') || logs.includes('PayoutWinners')) {
                        payoutCount++;
                    }
                }
            } catch (e) {
                // Skip failed transaction fetches
            }
        }
        
        console.log(`   📝 Entry transactions: ${entryCount}`);
        console.log(`   📸 Snapshot transactions: ${snapshotCount}`);
        console.log(`   💰 Payout transactions: ${payoutCount}\n`);
        
        if (entryCount === 0) {
            console.log('⚠️  WARNING: No entry transactions found in recent history!');
            console.log('   This suggests participants may not have entered yet.\n');
        }
    }

    // Step 7: Summary
    console.log('6️⃣ SUMMARY...\n');
    console.log('='.repeat(80) + '\n');
    
    if (parsedSuccessfully && lottery) {
        const canTrigger = lottery.isActive && 
                          lottery.totalParticipants >= 9 && 
                          lottery.totalTickets > 0;
        
        if (canTrigger) {
            console.log('✅ LOTTERY IS READY!');
            console.log(`   Jackpot: ${(lottery.jackpotAmount / 1e9).toFixed(4)} SOL`);
            console.log(`   Participants: ${lottery.totalParticipants}`);
            console.log(`   Tickets: ${lottery.totalTickets}\n`);
        } else {
            console.log('⚠️  LOTTERY NEEDS SETUP:');
            if (!lottery.isActive) console.log('   - Activate lottery');
            if (lottery.totalParticipants < 9) console.log(`   - Add ${9 - lottery.totalParticipants} more participants`);
            if (lottery.totalTickets === 0) console.log('   - Ensure participants have entered\n');
        }
    } else {
        console.log('⚠️  Could not fully parse lottery state');
        console.log('   Run `anchor build` to generate IDL\n');
    }
    
    console.log('💡 NEXT STEPS:');
    console.log('   1. If lottery not active: Run activation script');
    console.log('   2. If not enough participants: Run entry scripts');
    console.log('   3. If conditions met: Run trigger-snapshot.js');
    console.log('   4. Check frontend: Hard refresh (Ctrl+Shift+R)\n');
}

diagnoseLotteryState().catch(error => {
    console.error('\n❌ Error:', error);
    console.error(error.stack);
    process.exit(1);
});
