import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orb | Know Any Company. From a URL.",
  description: "Drop a URL. Get a full company intelligence report in under 60 seconds — visual identity, voice, archetype, and how GPT, Claude, and Gemini describe them.",
  metadataBase: new URL("https://www.contentproduction.ai"),
  openGraph: {
    title: "Orb | Know Any Company. From a URL.",
    description: "Drop a URL. Get a full company intelligence report in under 60 seconds — visual identity, voice, archetype, and how GPT, Claude, and Gemini describe them.",
    url: "https://www.contentproduction.ai",
    siteName: "Orb",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Orb — Know Any Company. From a URL.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Orb | Know Any Company. From a URL.",
    description: "Drop a URL. Get a full company intelligence report in under 60 seconds.",
    images: ["/og-image.png"],
  },
  robots: { index: true, follow: true },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Orb",
  url: "https://www.contentproduction.ai",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  description:
    "On-demand company intelligence. Drop any URL and get a full intelligence report — visual identity, voice, archetype, product positioning, and how GPT, Claude, and Gemini describe the company.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free preview with paid tiers available.",
  },
  creator: {
    "@type": "Organization",
    name: "Orb by cp/ai",
    url: "https://www.contentproduction.ai",
  },
  featureList: [
    "Company intelligence from any URL",
    "Visual identity extraction — colors, fonts, shape language",
    "Brand archetype classification",
    "AI perception from GPT, Claude, and Gemini",
    "Competitor comparison with USP generation",
    "Product and positioning intelligence",
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
