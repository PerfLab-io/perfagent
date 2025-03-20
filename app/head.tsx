export default function Head() {
  return (
    <>
      {/* Additional meta tags that can't be included in the metadata object */}
      <meta property="og:image:alt" content="PerfAgent logo" />
      <meta property="og:logo" content="/images/logo.svg" />
      <meta name="application-name" content="PerfAgent" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content="PerfAgent" />
      <meta name="format-detection" content="telephone=no" />
      <meta name="mobile-web-app-capable" content="yes" />
      <meta name="msapplication-TileColor" content="#1a2b34" />
      <meta name="msapplication-tap-highlight" content="no" />
      <meta name="theme-color" content="#4ade80" />

      {/* Schema.org markup for Google */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "PerfAgent",
            applicationCategory: "WebApplication",
            operatingSystem: "Web",
            offers: {
              "@type": "Offer",
              price: "0",
              priceCurrency: "USD",
            },
            description:
              "AI-powered web performance analysis and Core Web Vitals optimization assistant.",
            creator: {
              "@type": "Organization",
              name: "PerfLab",
              logo: "/images/logo.svg",
              url: "https://agent.perflab.io",
            },
          }),
        }}
      />
    </>
  );
}
