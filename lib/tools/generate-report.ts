import { registerTool } from "../mock-ai-sdk";
import { getAnimationUrlForTopic } from "../utils/gif-generator";

// Mock report content based on topics
const reportContent = {
  "web-performance-overview": {
    title: "Web Performance Overview",
    sections: [
      {
        title: "Introduction to Web Performance",
        content: `# Web Performance and Core Web Vitals

![Web Performance Visualization](${getAnimationUrlForTopic("web-performance-overview")})

Web performance is a critical aspect of modern web development that directly impacts user experience, conversion rates, and SEO rankings. Core Web Vitals are Google's initiative to provide unified guidance for quality signals that are essential to delivering a great user experience on the web.

## Key Metrics

- **Loading Performance**: Measured by LCP (Largest Contentful Paint)
- **Interactivity**: Measured by FID (First Input Delay)
- **Visual Stability**: Measured by CLS (Cumulative Layout Shift)
- **Additional Metrics**: TTFB, FCP, TTI, and TBT

Web Vitals combine real-world user experience metrics with clear thresholds, making it easier to understand and optimize website performance.`,
      },
      {
        title: "Getting Started with Web Performance",
        content: `## Measuring Web Performance

![Getting Started with Web Performance](${getAnimationUrlForTopic("web-performance-overview")})

Getting started with web performance optimization:

1. Use Lighthouse for lab testing
2. Implement Real User Monitoring (RUM)
3. Monitor Core Web Vitals in Search Console
4. Set up Performance Budgets

## Basic Performance Optimization

Here's a simple performance checklist:

\`\`\`javascript
// Image optimization
const img = new Image();
img.loading = "lazy"; // Use lazy loading
img.srcset = "image-400.jpg 400w, image-800.jpg 800w"; // Responsive images

// Resource hints
<link rel="preconnect" href="https://example.com">
<link rel="preload" as="style" href="critical.css">
\`\`\`

These optimizations form the foundation of a fast-loading website.`,
      },
      {
        title: "Core Web Vitals Deep Dive",
        content: `## Core Web Vitals

![Core Web Vitals](${getAnimationUrlForTopic("web-performance-overview")})

### Largest Contentful Paint (LCP)

LCP measures loading performance. To provide a good user experience, sites should strive for LCP within 2.5 seconds.

### First Input Delay (FID)

FID measures interactivity. A good FID score is under 100 milliseconds.

### Cumulative Layout Shift (CLS)

CLS measures visual stability. A good CLS score is less than 0.1.`,
      },
      {
        title: "Performance Resources",
        content: `## Performance Resources

![Web Performance Resources](${getAnimationUrlForTopic("web-performance-overview")})

To improve your web performance:

- [web.dev](https://web.dev/): Official Google resource for web performance
- [PageSpeed Insights](https://pagespeed.web.dev/): Performance analysis tool
- [Core Web Vitals Report](https://support.google.com/webmasters/answer/9205520): Monitor real-world performance
- [WebPageTest](https://www.webpagetest.org/): Detailed performance testing

## Next Steps

Ready to optimize further? Focus on:
- JavaScript optimization
- Critical rendering path
- Resource prioritization
- Performance monitoring`,
      },
    ],
  },
  "performance-optimization": {
    title: "Performance Optimization Techniques",
    sections: [
      {
        title: "Understanding Performance Optimization",
        content: `# Web Performance Optimization

![Performance Optimization](${getAnimationUrlForTopic("performance-optimization")})

Performance optimization is crucial for delivering fast, responsive web experiences. It encompasses various techniques from code optimization to resource delivery strategies.

## Key Areas

- **Resource Loading**: Optimize how assets are loaded and delivered
- **Runtime Performance**: Improve JavaScript execution and rendering
- **Network Optimization**: Reduce latency and payload size
- **Caching Strategies**: Implement effective caching mechanisms`,
      },
      {
        title: "Advanced Optimization Techniques",
        content: `## Advanced Techniques

![Advanced Optimization](${getAnimationUrlForTopic("performance-optimization")})

### Code Splitting and Lazy Loading

\`\`\`javascript
// Dynamic imports for route-based code splitting
const Dashboard = React.lazy(() => import('./Dashboard'));

// Lazy loading components
function MyComponent() {
  return (
    <Suspense fallback={<Loading />}>
      <Dashboard />
    </Suspense>
  );
}
\`\`\`

### Resource Hints and Preloading

\`\`\`html
<!-- Preconnect to critical origins -->
<link rel="preconnect" href="https://api.example.com">

<!-- Preload critical resources -->
<link rel="preload" href="critical.js" as="script">
<link rel="preload" href="hero.jpg" as="image">
\`\`\``,
      },
    ],
  },
  "error-monitoring": {
    title: "Performance Error Monitoring",
    sections: [
      {
        title: "Performance Monitoring Setup",
        content: `## Performance Monitoring

![Performance Monitoring](${getAnimationUrlForTopic("error-monitoring")})

### Real User Monitoring (RUM)

\`\`\`javascript
// Performance monitoring setup
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    // Report performance metrics
    console.log(entry.name, entry.startTime, entry.duration);
  }
});

observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
\`\`\`

### Error Tracking

\`\`\`javascript
// Track performance errors
window.addEventListener('error', (event) => {
  // Report error with performance context
  console.error('Performance error:', {
    message: event.message,
    filename: event.filename,
    performance: performance.now()
  });
});
\`\`\``,
      },
    ],
  },
};

// Update the generateReportTool to support streaming
export const generateReportTool = registerTool({
  name: "generateReport",
  description: "Generates a comprehensive report on a Go programming topic",
  execute: async (params: { query: string }) => {
    // Ensure params is an object and query is a string
    const safeParams = params || {};
    const query =
      typeof safeParams.query === "string"
        ? safeParams.query.toLowerCase()
        : "";

    console.log("Generate report query:", query);

    // Determine which report to generate based on the query
    let reportType = "web-performance-overview";

    if (query.includes("performance optimization")) {
      reportType = "performance-optimization";
    } else if (query.includes("error monitoring")) {
      reportType = "error-monitoring";
    }

    // Return the complete report data
    return {
      type: "report",
      reportType,
      reportData: reportContent[reportType as keyof typeof reportContent],
    };
  },
  // Add streaming support
  stream: async function* (
    params: { query: string; toolCallId?: string },
    dataStream?: any,
  ) {
    // Ensure params is an object and query is a string
    const safeParams = params || {};
    const query =
      typeof safeParams.query === "string"
        ? safeParams.query.toLowerCase()
        : "";

    // Generate a unique toolCallId if not provided
    const toolCallId =
      params.toolCallId ||
      `report-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Determine which report to generate based on the query
    let reportType = "web-performance-overview";

    if (query.includes("performance optimization")) {
      reportType = "performance-optimization";
    } else if (query.includes("error monitoring")) {
      reportType = "error-monitoring";
    }

    // Get the report content
    const report = reportContent[reportType as keyof typeof reportContent];

    // First yield just the title to show something immediately
    yield {
      type: "report",
      reportType,
      reportData: {
        title: report.title,
        sections: [],
      },
      toolCallId,
    };

    // Then stream each section with a delay
    let currentSections = [];
    for (let i = 0; i < report.sections.length; i++) {
      // Add a delay to simulate streaming
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 + Math.random() * 1000),
      );

      // Add this section to our current sections
      currentSections = [...currentSections, report.sections[i]];

      // Yield the report with sections up to this point
      yield {
        type: "report",
        reportType,
        reportData: {
          title: report.title,
          sections: currentSections,
        },
        toolCallId,
      };
    }
  },
});
