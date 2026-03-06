// Manually update IDL with new fields (workaround for build issues)
// This adds rollover_count and pepe_ball_count to the Lottery type

const fs = require('fs');
const path = require('path');

const IDL_PATH = path.join(__dirname, '..', 'target', 'idl', 'lottery.json');

function manualIDLUpdate() {
    console.log('🔧 Manual IDL Update\n');
    console.log('='.repeat(70) + '\n');

    // Check if IDL exists
    if (!fs.existsSync(IDL_PATH)) {
        console.log('❌ IDL file not found!');
        console.log(`   Expected at: ${IDL_PATH}\n`);
        console.log('💡 Options:');
        console.log('   1. Try building in WSL (even with version warning)');
        console.log('   2. Copy IDL from a previous successful build');
        console.log('   3. Create a minimal IDL manually\n');
        return false;
    }

    console.log(`📄 Reading IDL from: ${IDL_PATH}\n`);

    try {
        const idl = JSON.parse(fs.readFileSync(IDL_PATH, 'utf8'));

        // Find Lottery type
        if (!idl.types) {
            console.log('❌ IDL has no types array\n');
            return false;
        }

        const lotteryType = idl.types.find(t => t.name === 'Lottery');
        if (!lotteryType) {
            console.log('❌ Lottery type not found in IDL\n');
            return false;
        }

        console.log('✅ Found Lottery type\n');

        // Check if fields already exist
        const hasRollover = lotteryType.type.fields?.some(f => f.name === 'rollover_count');
        const hasPepeBall = lotteryType.type.fields?.some(f => f.name === 'pepe_ball_count');

        if (hasRollover && hasPepeBall) {
            console.log('✅ IDL already has rollover_count and pepe_ball_count!\n');
            return true;
        }

        // Add missing fields
        if (!lotteryType.type.fields) {
            lotteryType.type.fields = [];
        }

        if (!hasRollover) {
            lotteryType.type.fields.push({
                name: 'rollover_count',
                type: 'u8'
            });
            console.log('   ✅ Added rollover_count');
        }

        if (!hasPepeBall) {
            lotteryType.type.fields.push({
                name: 'pepe_ball_count',
                type: 'u8'
            });
            console.log('   ✅ Added pepe_ball_count');
        }

        // Save updated IDL
        fs.writeFileSync(IDL_PATH, JSON.stringify(idl, null, 2));
        console.log(`\n✅ IDL updated and saved!\n`);

        return true;
    } catch (error) {
        console.error('❌ Error updating IDL:', error.message);
        return false;
    }
}

if (require.main === module) {
    const success = manualIDLUpdate();
    if (success) {
        console.log('🎉 IDL is ready! You can now use it in scripts.\n');
        process.exit(0);
    } else {
        console.log('⚠️  IDL update failed\n');
        process.exit(1);
    }
}

module.exports = { manualIDLUpdate };







