import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orb | On-Brand Social Content in 60 Seconds",
  description: "Orb extracts your brand identity and generates on-brand social media content across every platform in seconds.",
  metadataBase: new URL("https://www.contentproduction.ai"),
  openGraph: {
    title: "Orb | On-Brand Social Content in 60 Seconds",
    description: "Paste a URL. Get 40 on-brand social posts — colors, fonts, and voice matched to your brand.",
    url: "https://www.contentproduction.ai",
    siteName: "Orb",
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Orb — On-Brand Social Content in 60 Seconds",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Orb | On-Brand Social Content in 60 Seconds",
    description: "Paste a URL. Get 40 on-brand social posts — colors, fonts, and voice matched to your brand.",
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
    "AI-powered social media content generator that extracts brand identity from any URL and generates on-brand posts for every platform in seconds.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "Free preview with paid download tiers available.",
  },
  creator: {
    "@type": "Organization",
    name: "Orb by cp/ai",
    url: "https://www.contentproduction.ai",
  },
  featureList: [
    "Brand identity extraction from any URL",
    "AI-generated social media posts",
    "On-brand colors, fonts, and voice",
    "Facebook, Instagram, LinkedIn, and Twitter/X support",
    "40 posts generated per brand",
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
