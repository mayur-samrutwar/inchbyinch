const { exec } = require('child_process');
const path = require('path');

console.log('🧪 Running inchbyinch Test Suite...\n');

const testFiles = [
    'Core.test.js',
    'LOP.test.js', 
    'Strategy.test.js',
    'Factory.test.js',
    'OrderManager.test.js',
    'OracleAdapter.test.js'
];

const runTest = (testFile) => {
    return new Promise((resolve, reject) => {
        console.log(`\n📋 Running ${testFile}...`);
        
        const testPath = path.join(__dirname, testFile);
        const command = `npx hardhat test ${testPath}`;
        
        exec(command, { cwd: process.cwd() }, (error, stdout, stderr) => {
            if (error) {
                console.log(`❌ ${testFile} failed:`);
                console.log(stdout);
                console.log(stderr);
                resolve({ file: testFile, success: false, output: stdout + stderr });
            } else {
                console.log(`✅ ${testFile} passed:`);
                console.log(stdout);
                resolve({ file: testFile, success: true, output: stdout });
            }
        });
    });
};

const runAllTests = async () => {
    console.log('🚀 Starting comprehensive test suite...\n');
    
    const results = [];
    
    for (const testFile of testFiles) {
        const result = await runTest(testFile);
        results.push(result);
    }
    
    console.log('\n📊 Test Results Summary:');
    console.log('========================');
    
    let passed = 0;
    let failed = 0;
    
    results.forEach(result => {
        if (result.success) {
            console.log(`✅ ${result.file} - PASSED`);
            passed++;
        } else {
            console.log(`❌ ${result.file} - FAILED`);
            failed++;
        }
    });
    
    console.log('\n📈 Summary:');
    console.log(`Total Tests: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    
    if (failed > 0) {
        console.log('\n❌ Some tests failed. Check the output above for details.');
        process.exit(1);
    } else {
        console.log('\n🎉 All tests passed!');
    }
};

runAllTests().catch(console.error); 