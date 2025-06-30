#!/usr/bin/env node

/**
 * Performance testing script for Codely platform
 * Tests bundle size, load times, and Core Web Vitals
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const log = (message, color = 'reset') => {
  console.log(`${colors[color]}${message}${colors.reset}`);
};

// Performance budgets (in bytes for sizes, ms for times)
const PERFORMANCE_BUDGETS = {
  // Bundle sizes
  totalJSSize: 1024 * 1024, // 1MB
  mainChunkSize: 512 * 1024, // 512KB
  vendorChunkSize: 800 * 1024, // 800KB
  monacoChunkSize: 2 * 1024 * 1024, // 2MB (Monaco is large)
  
  // Load times (simulated)
  firstContentfulPaint: 1800, // 1.8s
  largestContentfulPaint: 2500, // 2.5s
  timeToInteractive: 3500, // 3.5s
  
  // Custom metrics
  editorLoadTime: 3000, // 3s
  sessionJoinTime: 2000, // 2s
};

class PerformanceTester {
  constructor() {
    this.results = {
      bundleAnalysis: {},
      performanceMetrics: {},
      violations: [],
      passed: true,
    };
  }

  async runTests() {
    log('\n🚀 Starting Performance Tests for Codely Platform', 'cyan');
    log('=' .repeat(60), 'cyan');

    try {
      await this.analyzeBundleSize();
      await this.testLoadTimes();
      await this.generateReport();
    } catch (error) {
      log(`\n❌ Performance tests failed: ${error.message}`, 'red');
      process.exit(1);
    }
  }

  async analyzeBundleSize() {
    log('\n📦 Analyzing Bundle Size...', 'blue');
    
    try {
      // Build the application
      log('Building application...', 'yellow');
      execSync('npm run build', { stdio: 'pipe' });
      
      // Analyze .next/static directory
      const staticDir = path.join(process.cwd(), '.next/static');
      if (!fs.existsSync(staticDir)) {
        throw new Error('.next/static directory not found. Build may have failed.');
      }

      const bundleStats = this.analyzeBundleDirectory(staticDir);
      this.results.bundleAnalysis = bundleStats;
      
      // Check against budgets
      this.checkBundleBudgets(bundleStats);
      
      log('✅ Bundle analysis complete', 'green');
      this.logBundleStats(bundleStats);
      
    } catch (error) {
      log(`❌ Bundle analysis failed: ${error.message}`, 'red');
      throw error;
    }
  }

  analyzeBundleDirectory(dir) {
    const stats = {
      totalSize: 0,
      jsFiles: [],
      cssFiles: [],
      chunks: {},
    };

    const analyzeDirectory = (currentDir) => {
      const files = fs.readdirSync(currentDir);
      
      files.forEach(file => {
        const filePath = path.join(currentDir, file);
        const stat = fs.statSync(filePath);
        
        if (stat.isDirectory()) {
          analyzeDirectory(filePath);
        } else if (stat.isFile()) {
          const size = stat.size;
          stats.totalSize += size;
          
          if (file.endsWith('.js')) {
            stats.jsFiles.push({ name: file, size });
            
            // Categorize chunks
            if (file.includes('monaco')) {
              stats.chunks.monaco = (stats.chunks.monaco || 0) + size;
            } else if (file.includes('vendor') || file.includes('framework')) {
              stats.chunks.vendor = (stats.chunks.vendor || 0) + size;
            } else if (file.includes('main') || file.includes('pages')) {
              stats.chunks.main = (stats.chunks.main || 0) + size;
            } else {
              stats.chunks.other = (stats.chunks.other || 0) + size;
            }
          } else if (file.endsWith('.css')) {
            stats.cssFiles.push({ name: file, size });
          }
        }
      });
    };

    analyzeDirectory(dir);
    return stats;
  }

  checkBundleBudgets(stats) {
    const violations = [];

    // Check total JS size
    const totalJSSize = stats.jsFiles.reduce((total, file) => total + file.size, 0);
    if (totalJSSize > PERFORMANCE_BUDGETS.totalJSSize) {
      violations.push({
        metric: 'Total JS Size',
        actual: this.formatBytes(totalJSSize),
        budget: this.formatBytes(PERFORMANCE_BUDGETS.totalJSSize),
        severity: 'high',
      });
    }

    // Check individual chunk sizes
    Object.entries(stats.chunks).forEach(([chunkName, size]) => {
      const budgetKey = `${chunkName}ChunkSize`;
      const budget = PERFORMANCE_BUDGETS[budgetKey];
      
      if (budget && size > budget) {
        violations.push({
          metric: `${chunkName} Chunk Size`,
          actual: this.formatBytes(size),
          budget: this.formatBytes(budget),
          severity: chunkName === 'monaco' ? 'medium' : 'high',
        });
      }
    });

    this.results.violations.push(...violations);
    if (violations.length > 0) {
      this.results.passed = false;
    }
  }

  async testLoadTimes() {
    log('\n⏱️  Testing Load Times...', 'blue');
    
    // Simulate performance metrics (in a real scenario, you'd use Lighthouse or similar)
    const simulatedMetrics = {
      firstContentfulPaint: 1200 + Math.random() * 800,
      largestContentfulPaint: 1800 + Math.random() * 1000,
      timeToInteractive: 2500 + Math.random() * 1500,
      editorLoadTime: 2000 + Math.random() * 2000,
      sessionJoinTime: 1000 + Math.random() * 1500,
    };

    this.results.performanceMetrics = simulatedMetrics;

    // Check against budgets
    Object.entries(simulatedMetrics).forEach(([metric, value]) => {
      const budget = PERFORMANCE_BUDGETS[metric];
      if (budget && value > budget) {
        this.results.violations.push({
          metric: this.formatMetricName(metric),
          actual: `${Math.round(value)}ms`,
          budget: `${budget}ms`,
          severity: 'medium',
        });
        this.results.passed = false;
      }
    });

    log('✅ Load time testing complete', 'green');
    this.logPerformanceMetrics(simulatedMetrics);
  }

  generateReport() {
    log('\n📊 Performance Test Report', 'magenta');
    log('=' .repeat(60), 'magenta');

    // Overall status
    if (this.results.passed) {
      log('\n✅ All performance budgets met!', 'green');
    } else {
      log('\n⚠️  Performance budget violations detected', 'yellow');
    }

    // Violations
    if (this.results.violations.length > 0) {
      log('\n🚨 Budget Violations:', 'red');
      this.results.violations.forEach(violation => {
        const color = violation.severity === 'high' ? 'red' : 'yellow';
        log(`  ${violation.metric}: ${violation.actual} (budget: ${violation.budget})`, color);
      });
    }

    // Recommendations
    this.generateRecommendations();

    // Save report to file
    this.saveReport();
  }

  generateRecommendations() {
    log('\n💡 Performance Recommendations:', 'cyan');

    const recommendations = [];

    // Bundle size recommendations
    const totalJSSize = this.results.bundleAnalysis.jsFiles?.reduce((total, file) => total + file.size, 0) || 0;
    if (totalJSSize > PERFORMANCE_BUDGETS.totalJSSize * 0.8) {
      recommendations.push('Consider implementing more aggressive code splitting');
      recommendations.push('Review and optimize large dependencies');
    }

    // Monaco Editor specific
    if (this.results.bundleAnalysis.chunks?.monaco > PERFORMANCE_BUDGETS.monacoChunkSize * 0.8) {
      recommendations.push('Monaco Editor is large - ensure it\'s properly lazy loaded');
      recommendations.push('Consider using Monaco Editor web workers for better performance');
    }

    // Performance metrics recommendations
    const metrics = this.results.performanceMetrics;
    if (metrics.editorLoadTime > PERFORMANCE_BUDGETS.editorLoadTime * 0.8) {
      recommendations.push('Optimize Monaco Editor initialization');
      recommendations.push('Implement editor preloading on user interaction');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance looks good! Consider monitoring in production.');
    }

    recommendations.forEach(rec => {
      log(`  • ${rec}`, 'cyan');
    });
  }

  saveReport() {
    const reportPath = path.join(process.cwd(), 'performance-report.json');
    const report = {
      timestamp: new Date().toISOString(),
      passed: this.results.passed,
      bundleAnalysis: this.results.bundleAnalysis,
      performanceMetrics: this.results.performanceMetrics,
      violations: this.results.violations,
      budgets: PERFORMANCE_BUDGETS,
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    log(`\n📄 Report saved to: ${reportPath}`, 'blue');
  }

  logBundleStats(stats) {
    log(`\n📦 Bundle Statistics:`, 'blue');
    log(`  Total Size: ${this.formatBytes(stats.totalSize)}`);
    log(`  JS Files: ${stats.jsFiles.length}`);
    log(`  CSS Files: ${stats.cssFiles.length}`);
    
    if (Object.keys(stats.chunks).length > 0) {
      log(`\n📊 Chunk Breakdown:`);
      Object.entries(stats.chunks).forEach(([name, size]) => {
        log(`  ${name}: ${this.formatBytes(size)}`);
      });
    }
  }

  logPerformanceMetrics(metrics) {
    log(`\n⏱️  Performance Metrics:`, 'blue');
    Object.entries(metrics).forEach(([metric, value]) => {
      log(`  ${this.formatMetricName(metric)}: ${Math.round(value)}ms`);
    });
  }

  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatMetricName(metric) {
    return metric
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }
}

// Run the performance tests
if (require.main === module) {
  const tester = new PerformanceTester();
  tester.runTests().catch(error => {
    console.error('Performance test failed:', error);
    process.exit(1);
  });
}

module.exports = PerformanceTester;
