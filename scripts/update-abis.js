const fs = require('fs');
const path = require('path');

/**
 * Script to copy contract ABIs from artifacts to utils/abis
 * This ensures the frontend always has the latest ABIs
 */
async function updateABIs() {
    console.log('🔄 Updating contract ABIs...');
    
    const artifactsDir = path.join(__dirname, '..', 'artifacts', 'contracts');
    const abisDir = path.join(__dirname, '..', 'utils', 'abis');
    
    // Ensure abis directory exists
    if (!fs.existsSync(abisDir)) {
        fs.mkdirSync(abisDir, { recursive: true });
    }
    
    // Get all contract directories
    const contractDirs = fs.readdirSync(artifactsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);
    
    console.log('📁 Found contract directories:', contractDirs);
    
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const contractDir of contractDirs) {
        const contractPath = path.join(artifactsDir, contractDir);
        const jsonFile = path.join(contractPath, `${contractDir.split('.')[0]}.json`);
        
        if (fs.existsSync(jsonFile)) {
            try {
                const artifact = JSON.parse(fs.readFileSync(jsonFile, 'utf8'));
                const contractName = artifact.contractName;
                const abi = artifact.abi;
                
                if (abi && Array.isArray(abi)) {
                    // Create the ABI file
                    const abiFile = path.join(abisDir, `${contractName}.json`);
                    const abiContent = {
                        contractName: contractName,
                        abi: abi
                    };
                    
                    fs.writeFileSync(abiFile, JSON.stringify(abiContent, null, 2));
                    console.log(`✅ Updated ABI for ${contractName}`);
                    updatedCount++;
                } else {
                    console.log(`⚠️  No ABI found for ${contractName}`);
                }
            } catch (error) {
                console.error(`❌ Error processing ${contractDir}:`, error.message);
                errorCount++;
            }
        } else {
            console.log(`⚠️  No JSON file found for ${contractDir}`);
        }
    }
    
    console.log('\n📊 ABI Update Summary:');
    console.log(`✅ Successfully updated: ${updatedCount} ABIs`);
    console.log(`❌ Errors: ${errorCount}`);
    
    // List all ABIs in utils/abis
    const abiFiles = fs.readdirSync(abisDir)
        .filter(file => file.endsWith('.json'))
        .map(file => file.replace('.json', ''));
    
    console.log('\n📋 Available ABIs in utils/abis:');
    abiFiles.forEach(file => console.log(`  - ${file}`));
    
    console.log('\n🎉 ABI update complete!');
}

// Run the script
updateABIs()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error('❌ Script failed:', error);
        process.exit(1);
    }); 