/**
 * Performance monitoring and optimization utilities
 */

// Performance metrics interface
export interface PerformanceMetrics {
  // Core Web Vitals
  fcp?: number; // First Contentful Paint
  lcp?: number; // Largest Contentful Paint
  fid?: number; // First Input Delay
  cls?: number; // Cumulative Layout Shift
  ttfb?: number; // Time to First Byte
  
  // Custom metrics
  editorLoadTime?: number;
  sessionJoinTime?: number;
  codeExecutionTime?: number;
  
  // Bundle metrics
  bundleSize?: number;
  chunkLoadTime?: number;
  
  // User experience metrics
  interactionToNextPaint?: number;
  timeToInteractive?: number;
}

// Performance observer for Core Web Vitals
class PerformanceMonitor {
  private metrics: PerformanceMetrics = {};
  private observers: PerformanceObserver[] = [];

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeObservers();
    }
  }

  private initializeObservers() {
    // Largest Contentful Paint (LCP)
    if ('PerformanceObserver' in window) {
      try {
        const lcpObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const lastEntry = entries[entries.length - 1] as any;
          this.metrics.lcp = lastEntry.startTime;
          this.reportMetric('lcp', lastEntry.startTime);
        });
        lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
        this.observers.push(lcpObserver);
      } catch (error) {
        console.warn('LCP observer not supported:', error);
      }

      // First Input Delay (FID)
      try {
        const fidObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            this.metrics.fid = entry.processingStart - entry.startTime;
            this.reportMetric('fid', this.metrics.fid);
          });
        });
        fidObserver.observe({ entryTypes: ['first-input'] });
        this.observers.push(fidObserver);
      } catch (error) {
        console.warn('FID observer not supported:', error);
      }

      // Cumulative Layout Shift (CLS)
      try {
        let clsValue = 0;
        const clsObserver = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          entries.forEach((entry: any) => {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          });
          this.metrics.cls = clsValue;
          this.reportMetric('cls', clsValue);
        });
        clsObserver.observe({ entryTypes: ['layout-shift'] });
        this.observers.push(clsObserver);
      } catch (error) {
        console.warn('CLS observer not supported:', error);
      }

      // Navigation timing for TTFB and FCP
      this.measureNavigationTiming();
    }
  }

  private measureNavigationTiming() {
    if ('performance' in window && 'getEntriesByType' in performance) {
      const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
      if (navigationEntries.length > 0) {
        const navigation = navigationEntries[0];
        
        // Time to First Byte
        this.metrics.ttfb = navigation.responseStart - navigation.requestStart;
        this.reportMetric('ttfb', this.metrics.ttfb);
      }

      // First Contentful Paint
      const paintEntries = performance.getEntriesByType('paint');
      const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint');
      if (fcpEntry) {
        this.metrics.fcp = fcpEntry.startTime;
        this.reportMetric('fcp', fcpEntry.startTime);
      }
    }
  }

  // Measure custom performance metrics
  public measureEditorLoadTime(startTime: number) {
    const loadTime = performance.now() - startTime;
    this.metrics.editorLoadTime = loadTime;
    this.reportMetric('editorLoadTime', loadTime);
    return loadTime;
  }

  public measureSessionJoinTime(startTime: number) {
    const joinTime = performance.now() - startTime;
    this.metrics.sessionJoinTime = joinTime;
    this.reportMetric('sessionJoinTime', joinTime);
    return joinTime;
  }

  public measureCodeExecutionTime(startTime: number) {
    const executionTime = performance.now() - startTime;
    this.metrics.codeExecutionTime = executionTime;
    this.reportMetric('codeExecutionTime', executionTime);
    return executionTime;
  }

  // Report metric to analytics service
  private reportMetric(name: string, value: number) {
    if (process.env.NODE_ENV === 'production') {
      // In production, send to analytics service
      console.log(`Performance metric: ${name} = ${value}ms`);
      
      // Example: Send to analytics service
      // analytics.track('performance_metric', { name, value });
    } else {
      // In development, log to console
      console.log(`🚀 Performance: ${name} = ${value.toFixed(2)}ms`);
    }
  }

  // Get all metrics
  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  // Clean up observers
  public disconnect() {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// Singleton instance
let performanceMonitor: PerformanceMonitor | null = null;

export const getPerformanceMonitor = (): PerformanceMonitor => {
  if (!performanceMonitor) {
    performanceMonitor = new PerformanceMonitor();
  }
  return performanceMonitor;
};

// Utility functions for performance measurement
export const measureAsync = async <T>(
  fn: () => Promise<T>,
  metricName: string
): Promise<T> => {
  const startTime = performance.now();
  try {
    const result = await fn();
    const duration = performance.now() - startTime;
    getPerformanceMonitor().reportMetric(metricName, duration);
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    getPerformanceMonitor().reportMetric(`${metricName}_error`, duration);
    throw error;
  }
};

export const measureSync = <T>(
  fn: () => T,
  metricName: string
): T => {
  const startTime = performance.now();
  try {
    const result = fn();
    const duration = performance.now() - startTime;
    getPerformanceMonitor().reportMetric(metricName, duration);
    return result;
  } catch (error) {
    const duration = performance.now() - startTime;
    getPerformanceMonitor().reportMetric(`${metricName}_error`, duration);
    throw error;
  }
};

// React hook for performance monitoring
export const usePerformanceMonitor = () => {
  const monitor = getPerformanceMonitor();
  
  React.useEffect(() => {
    return () => {
      // Clean up on unmount
      monitor.disconnect();
    };
  }, [monitor]);

  return {
    measureEditorLoadTime: monitor.measureEditorLoadTime.bind(monitor),
    measureSessionJoinTime: monitor.measureSessionJoinTime.bind(monitor),
    measureCodeExecutionTime: monitor.measureCodeExecutionTime.bind(monitor),
    getMetrics: monitor.getMetrics.bind(monitor),
  };
};

// Bundle size analyzer
export const analyzeBundleSize = () => {
  if (typeof window !== 'undefined' && 'performance' in window) {
    const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    
    const jsResources = resources.filter(resource => 
      resource.name.includes('.js') && resource.name.includes('_next/static')
    );
    
    const totalSize = jsResources.reduce((total, resource) => {
      return total + (resource.transferSize || 0);
    }, 0);
    
    console.log('📦 Bundle Analysis:');
    console.log(`Total JS bundle size: ${(totalSize / 1024).toFixed(2)} KB`);
    
    jsResources.forEach(resource => {
      const size = (resource.transferSize || 0) / 1024;
      const loadTime = resource.loadEnd - resource.loadStart;
      console.log(`  ${resource.name.split('/').pop()}: ${size.toFixed(2)} KB (${loadTime.toFixed(2)}ms)`);
    });
    
    return {
      totalSize,
      resources: jsResources.map(resource => ({
        name: resource.name,
        size: resource.transferSize || 0,
        loadTime: resource.loadEnd - resource.loadStart,
      })),
    };
  }
  
  return null;
};

// Performance budget checker
export const checkPerformanceBudget = (metrics: PerformanceMetrics) => {
  const budgets = {
    fcp: 1800, // 1.8s
    lcp: 2500, // 2.5s
    fid: 100,  // 100ms
    cls: 0.1,  // 0.1
    ttfb: 600, // 600ms
    editorLoadTime: 3000, // 3s
    sessionJoinTime: 2000, // 2s
    codeExecutionTime: 5000, // 5s
  };

  const violations: string[] = [];

  Object.entries(budgets).forEach(([metric, budget]) => {
    const value = metrics[metric as keyof PerformanceMetrics];
    if (value && value > budget) {
      violations.push(`${metric}: ${value.toFixed(2)}ms (budget: ${budget}ms)`);
    }
  });

  if (violations.length > 0) {
    console.warn('⚠️ Performance budget violations:', violations);
  } else {
    console.log('✅ All performance budgets met');
  }

  return violations;
};

export default PerformanceMonitor;
