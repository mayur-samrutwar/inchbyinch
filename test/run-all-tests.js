const { exec } = require('child_process');
const fs = require('fs');

console.log("🧪 Running Comprehensive inchbyinch Tests...\n");

const testFiles = [
  'test/ComprehensiveTests.test.js',
  'test/LOPIntegrationTests.test.js',
  'test/Factory.test.js',
  'test/OracleAdapter.test.js',
  'test/OrderManager.test.js',
  'test/Simple.test.js'
];

const testResults = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: []
};

async function runTest(file) {
  return new Promise((resolve) => {
    console.log(`\n📋 Running: ${file}`);
    
    const child = exec(`npx hardhat test ${file}`, (error, stdout, stderr) => {
      if (error) {
        console.log(`❌ Failed: ${file}`);
        console.log(`Error: ${error.message}`);
        testResults.failed++;
        testResults.errors.push({
          file,
          error: error.message,
          stderr
        });
      } else {
        console.log(`✅ Passed: ${file}`);
        testResults.passed++;
      }
      
      testResults.total++;
      resolve();
    });

    child.stdout.on('data', (data) => {
      // Only show output for failed tests or verbose mode
      if (process.argv.includes('--verbose')) {
        console.log(data.toString());
      }
    });

    child.stderr.on('data', (data) => {
      console.log(`Error in ${file}: ${data.toString()}`);
    });
  });
}

async function runAllTests() {
  console.log("🚀 Starting test suite...\n");
  
  for (const file of testFiles) {
    if (fs.existsSync(file)) {
      await runTest(file);
    } else {
      console.log(`⚠️  Skipping: ${file} (not found)`);
    }
  }

  // Generate test report
  console.log("\n" + "=".repeat(60));
  console.log("📊 TEST SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total Tests: ${testResults.total}`);
  console.log(`✅ Passed: ${testResults.passed}`);
  console.log(`❌ Failed: ${testResults.failed}`);
  console.log(`📈 Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);

  if (testResults.errors.length > 0) {
    console.log("\n❌ FAILED TESTS:");
    testResults.errors.forEach((error, index) => {
      console.log(`\n${index + 1}. ${error.file}`);
      console.log(`   Error: ${error.error}`);
    });
  }

  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total: testResults.total,
      passed: testResults.passed,
      failed: testResults.failed,
      successRate: (testResults.passed / testResults.total) * 100
    },
    errors: testResults.errors,
    testFiles
  };

  fs.writeFileSync('test-report.json', JSON.stringify(report, null, 2));
  console.log("\n💾 Detailed report saved to: test-report.json");

  // Exit with appropriate code
  if (testResults.failed > 0) {
    console.log("\n❌ Some tests failed!");
    process.exit(1);
  } else {
    console.log("\n🎉 All tests passed!");
    process.exit(0);
  }
}

// Handle command line arguments
if (process.argv.includes('--help')) {
  console.log(`
🧪 inchbyinch Test Runner

Usage:
  node test/run-all-tests.js [options]

Options:
  --verbose     Show detailed output for all tests
  --help        Show this help message

Test Files:
${testFiles.map(f => `  - ${f}`).join('\n')}

Examples:
  node test/run-all-tests.js
  node test/run-all-tests.js --verbose
`);
  process.exit(0);
}

runAllTests().catch(console.error); 