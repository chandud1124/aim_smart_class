import { createRoot } from 'react-dom/client'
import { StrictMode } from 'react'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import './index.css'

const container = document.getElementById("root")!;
const root = createRoot(container);

// Performance monitoring in development
if (import.meta.env.DEV) {
  // Monitor React performance
  const reportWebVitals = (metric: any) => {
    console.log('Web Vitals:', metric);
  };

  // Simple performance observer
  if ('performance' in window && 'PerformanceObserver' in window) {
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (entry.entryType === 'largest-contentful-paint') {
            console.log('LCP:', entry.startTime);
          }
        }
      }).observe({ entryTypes: ['largest-contentful-paint'] });
    } catch (e) {
      console.warn('Performance monitoring not supported');
    }
  }
}

root.render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
);
