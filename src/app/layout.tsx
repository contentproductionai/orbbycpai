import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Orb — On-brand content at the speed of thought",
  description: "Orb extracts your brand identity and generates on-brand social media content across every platform in seconds.",
  metadataBase: new URL("https://www.contentproduction.ai"),
  openGraph: {
    title: "Orb — On-brand content at the speed of thought",
    description: "AI-powered social content that looks like your design team made it.",
    url: "https://www.contentproduction.ai",
    siteName: "Orb",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Orb — On-brand content at the speed of thought",
    description: "AI-powered social content that looks like your design team made it.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased">{children}</body>
    </html>
  );
}
