#!/usr/bin/env node

/**
 * Enhanced Test Runner for IoT Smart Classroom Backend
 * Provides comprehensive testing with multiple modes and reporting
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class TestRunner {
    constructor() {
        this.testDir = path.join(__dirname, 'tests');
        this.coverageDir = path.join(__dirname, 'coverage');
        this.reportsDir = path.join(__dirname, 'test-reports');
    }

    /**
     * Run all tests
     */
    async runAllTests(options = {}) {
        console.log('🚀 Running all backend tests...\n');

        const jestArgs = ['--verbose'];

        if (options.coverage) {
            jestArgs.push('--coverage');
        }

        if (options.watch) {
            jestArgs.push('--watch');
        }

        if (options.ci) {
            jestArgs.push('--watchAll=false', '--passWithNoTests');
        }

        return this.executeJest(jestArgs);
    }

    /**
     * Run specific test suite
     */
    async runTestSuite(suiteName, options = {}) {
        console.log(`🧪 Running ${suiteName} test suite...\n`);

        const testFile = path.join(this.testDir, `${suiteName}.test.js`);
        if (!fs.existsSync(testFile)) {
            console.error(`❌ Test file not found: ${testFile}`);
            return false;
        }

        const jestArgs = [testFile, '--verbose'];

        if (options.coverage) {
            jestArgs.push('--coverage');
        }

        return this.executeJest(jestArgs);
    }

    /**
     * Run integration tests
     */
    async runIntegrationTests(options = {}) {
        console.log('🔗 Running integration tests...\n');

        const jestArgs = [
            '--testPathPattern=integration',
            '--verbose'
        ];

        if (options.coverage) {
            jestArgs.push('--coverage');
        }

        return this.executeJest(jestArgs);
    }

    /**
     * Run unit tests
     */
    async runUnitTests(options = {}) {
        console.log('⚡ Running unit tests...\n');

        const jestArgs = [
            '--testPathPattern=(?<!integration)',
            '--verbose'
        ];

        if (options.coverage) {
            jestArgs.push('--coverage');
        }

        return this.executeJest(jestArgs);
    }

    /**
     * Generate test report
     */
    generateReport() {
        console.log('📊 Generating test report...\n');

        if (!fs.existsSync(this.coverageDir)) {
            console.log('❌ No coverage data found. Run tests with --coverage first.');
            return false;
        }

        const coverageSummary = path.join(this.coverageDir, 'coverage-summary.json');

        if (fs.existsSync(coverageSummary)) {
            const coverage = JSON.parse(fs.readFileSync(coverageSummary, 'utf8'));
            this.displayCoverageReport(coverage);
            return true;
        } else {
            console.log('❌ Coverage summary not found.');
            return false;
        }
    }

    /**
     * Display coverage report
     */
    displayCoverageReport(coverage) {
        console.log('📈 Code Coverage Report');
        console.log('======================\n');

        const { total } = coverage;

        console.log(`📁 Statements: ${total.statements.pct}% (${total.statements.covered}/${total.statements.total})`);
        console.log(`🔀 Branches:   ${total.branches.pct}% (${total.branches.covered}/${total.branches.total})`);
        console.log(`⚡ Functions:  ${total.functions.pct}% (${total.functions.covered}/${total.functions.total})`);
        console.log(`📊 Lines:      ${total.lines.pct}% (${total.lines.covered}/${total.lines.total})`);

        console.log('\n🎯 Coverage Thresholds:');
        console.log('  - Statements: 80%');
        console.log('  - Branches: 70%');
        console.log('  - Functions: 75%');
        console.log('  - Lines: 80%');

        // Check if thresholds are met
        const thresholds = {
            statements: 80,
            branches: 70,
            functions: 75,
            lines: 80
        };

        let allPassed = true;
        Object.keys(thresholds).forEach(metric => {
            const actual = total[metric].pct;
            const required = thresholds[metric];
            const status = actual >= required ? '✅' : '❌';
            console.log(`  ${status} ${metric}: ${actual}% (required: ${required}%)`);

            if (actual < required) {
                allPassed = false;
            }
        });

        console.log(`\n${allPassed ? '🎉 All thresholds met!' : '⚠️  Some thresholds not met'}`);
    }

    /**
     * Execute Jest with given arguments
     */
    executeJest(args) {
        return new Promise((resolve) => {
            const jest = spawn('npx', ['jest', ...args], {
                stdio: 'inherit',
                cwd: __dirname
            });

            jest.on('close', (code) => {
                resolve(code === 0);
            });

            jest.on('error', (error) => {
                console.error('❌ Error running tests:', error.message);
                resolve(false);
            });
        });
    }

    /**
     * Setup test environment
     */
    async setupTestEnvironment() {
        console.log('🔧 Setting up test environment...\n');

        // Ensure test database URI is set
        if (!process.env.MONGODB_URI || !process.env.MONGODB_URI.includes('test')) {
            console.log('⚠️  Using test database. Set MONGODB_URI to a test database.');
        }

        // Create reports directory if it doesn't exist
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
            console.log('✅ Created test reports directory');
        }

        console.log('✅ Test environment ready\n');
        return true;
    }

    /**
     * Clean test artifacts
     */
    cleanTestArtifacts() {
        console.log('🧹 Cleaning test artifacts...\n');

        const artifacts = [
            this.coverageDir,
            this.reportsDir,
            path.join(__dirname, '.nyc_output')
        ];

        artifacts.forEach(dir => {
            if (fs.existsSync(dir)) {
                fs.rmSync(dir, { recursive: true, force: true });
                console.log(`✅ Cleaned: ${path.basename(dir)}`);
            }
        });

        console.log('✅ Test artifacts cleaned\n');
    }

    /**
     * Show help
     */
    showHelp() {
        console.log('🚀 IoT Smart Classroom Test Runner');
        console.log('===================================\n');

        console.log('USAGE:');
        console.log('  node test-runner.js [command] [options]\n');

        console.log('COMMANDS:');
        console.log('  all          Run all tests');
        console.log('  auth         Run authentication tests');
        console.log('  device       Run device tests');
        console.log('  permission   Run permission tests');
        console.log('  integration  Run integration tests');
        console.log('  unit         Run unit tests');
        console.log('  report       Generate coverage report');
        console.log('  setup        Setup test environment');
        console.log('  clean        Clean test artifacts');
        console.log('  help         Show this help\n');

        console.log('OPTIONS:');
        console.log('  --coverage   Generate coverage report');
        console.log('  --watch      Run tests in watch mode');
        console.log('  --ci         Run in CI mode (no watch)');
        console.log('  --verbose    Verbose output\n');

        console.log('EXAMPLES:');
        console.log('  node test-runner.js all --coverage');
        console.log('  node test-runner.js auth --watch');
        console.log('  node test-runner.js report');
        console.log('  node test-runner.js setup\n');
    }

    /**
     * Main execution method
     */
    async run() {
        const args = process.argv.slice(2);
        const command = args[0] || 'help';
        const options = this.parseOptions(args.slice(1));

        switch (command) {
            case 'all':
                await this.setupTestEnvironment();
                const allResult = await this.runAllTests(options);
                if (options.coverage) {
                    this.generateReport();
                }
                return allResult;

            case 'auth':
                await this.setupTestEnvironment();
                return await this.runTestSuite('auth', options);

            case 'device':
                await this.setupTestEnvironment();
                return await this.runTestSuite('device', options);

            case 'permission':
                await this.setupTestEnvironment();
                return await this.runTestSuite('permission', options);

            case 'integration':
                await this.setupTestEnvironment();
                return await this.runIntegrationTests(options);

            case 'unit':
                await this.setupTestEnvironment();
                return await this.runUnitTests(options);

            case 'report':
                return this.generateReport();

            case 'setup':
                return await this.setupTestEnvironment();

            case 'clean':
                return this.cleanTestArtifacts();

            case 'help':
            default:
                this.showHelp();
                return true;
        }
    }

    /**
     * Parse command line options
     */
    parseOptions(args) {
        const options = {};

        args.forEach(arg => {
            switch (arg) {
                case '--coverage':
                    options.coverage = true;
                    break;
                case '--watch':
                    options.watch = true;
                    break;
                case '--ci':
                    options.ci = true;
                    break;
                case '--verbose':
                    options.verbose = true;
                    break;
            }
        });

        return options;
    }
}

// Run the test runner
if (require.main === module) {
    const runner = new TestRunner();
    runner.run().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(error => {
        console.error('❌ Test runner error:', error);
        process.exit(1);
    });
}

module.exports = TestRunner;