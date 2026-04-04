/**
 * POST /api/brand/create-manual
 *
 * Accepts a multipart form with brand tokens and optional asset uploads.
 * Creates a brand profile in the DB without scraping.
 *
 * Required fields: brandName, primaryColor, textColor
 * Optional fields: accentColor, secondaryColor, fontName, logo, productImage,
 *                  stats (JSON array), voice (JSON array), instagramHandle
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { brands } from "@/db/schema";
import { randomUUID } from "crypto";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    // Auth check
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await req.formData();

    // Required fields
    const brandName = (formData.get("brandName") as string)?.trim();
    const primaryColor = (formData.get("primaryColor") as string)?.trim();
    const textColor = (formData.get("textColor") as string)?.trim();

    if (!brandName || !primaryColor || !textColor) {
      return NextResponse.json(
        { error: "brandName, primaryColor, and textColor are required" },
        { status: 400 }
      );
    }

    // Optional fields
    const accentColor = (formData.get("accentColor") as string)?.trim() || null;
    const secondaryColor = (formData.get("secondaryColor") as string)?.trim() || null;
    const fontName = (formData.get("fontName") as string)?.trim() || null;
    const instagramHandle = (formData.get("instagramHandle") as string)?.trim() || null;

    let stats: string[] = [];
    try {
      const statsRaw = formData.get("stats") as string;
      if (statsRaw) stats = JSON.parse(statsRaw);
    } catch { /* ignore */ }

    let voice: string[] = [];
    try {
      const voiceRaw = formData.get("voice") as string;
      if (voiceRaw) voice = JSON.parse(voiceRaw);
    } catch { /* ignore */ }

    // Handle file uploads — convert to base64 data URIs for storage
    let logoDataUri: string | null = null;
    let productImageDataUri: string | null = null;

    const logoFile = formData.get("logo") as File | null;
    if (logoFile && logoFile.size > 0) {
      const bytes = await logoFile.arrayBuffer();
      const b64 = Buffer.from(bytes).toString("base64");
      logoDataUri = `data:${logoFile.type};base64,${b64}`;
    }

    const productFile = formData.get("productImage") as File | null;
    if (productFile && productFile.size > 0) {
      const bytes = await productFile.arrayBuffer();
      const b64 = Buffer.from(bytes).toString("base64");
      productImageDataUri = `data:${productFile.type};base64,${b64}`;
    }

    // Derive a domain key for the brand — use brand name slug for manual profiles
    const domainKey = `manual:${brandName.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${randomUUID().slice(0, 8)}`;

    // Build the brand profile JSON — same shape as the automated pipeline
    const brandProfile = {
      brandName,
      source: "manual",
      colors: {
        primary: primaryColor,
        text: textColor,
        accent: accentColor,
        secondary: secondaryColor,
        background: primaryColor, // use primary as background for layout routing
      },
      fonts: {
        heading: fontName || "Inter",
        body: fontName || "Inter",
      },
      assets: {
        logo: logoDataUri,
        productImage: productImageDataUri,
      },
      stats: stats.filter(Boolean),
      voice: voice,
      social: {
        instagram: instagramHandle,
      },
      extractedAt: new Date().toISOString(),
    };

    // Upsert into brands table
    const [brand] = await db
      .insert(brands)
      .values({
        domain: domainKey,
        brandUrl: `manual:${brandName}`,
        brandProfile,
        scrapedAt: new Date(),
      })
      .returning({ id: brands.id });

    return NextResponse.json({
      success: true,
      brandId: brand.id,
      brandName,
    });

  } catch (err) {
    console.error("[create-manual] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
