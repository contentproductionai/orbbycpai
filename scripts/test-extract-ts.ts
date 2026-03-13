/**
 * TypeScript test runner for brand extraction pipeline.
 * Calls the real extractDom + classifyVisual modules — identical to production.
 *
 * Usage: npx tsx scripts/test-extract-ts.ts <url>
 */

import * as path from "path";
import * as fs from "fs";
import { extractDom } from "../src/lib/pipeline/extractDom";
import { classifyVisual } from "../src/lib/pipeline/classifyVisual";

const url = process.argv[2];
if (!url) {
  console.error("Usage: npx tsx scripts/test-extract-ts.ts <url>");
  process.exit(1);
}

async function main() {
  const fullUrl = url!.startsWith("http") ? url! : `https://www.${url}`;
  const workDir = path.join(process.cwd(), ".test-extract");
  fs.mkdirSync(workDir, { recursive: true });

  // Dummy emit function — just logs to console
  const emit = (event: object) => console.log("[emit]", JSON.stringify(event));

  console.log(`\n[test] Extracting: ${fullUrl}\n`);

  // ── Step 1: DOM Discovery ──────────────────────────────────────────────────────────────────────────────────
  console.log("=".repeat(60));
  console.log("STEP 1 — DOM DISCOVERY (extractDom.ts)");
  console.log("=".repeat(60));

  let raw: Record<string, unknown>;
  try {
    raw = await extractDom(fullUrl, workDir, emit) as Record<string, unknown>;
  } catch (e) {
    console.error("[test] extractDom failed:", (e as Error).message);
    process.exit(1);
  }

  const scoredPalette = (raw.scoredPalette as Array<{ hex: string; score: number; sources: string[]; totalArea?: number }>) ?? [];
  const discoveredFonts = (raw.discoveredFonts as Array<{ family: string; seenOn: string[]; score?: number }>) ?? [];
  const fontElementMap = (raw.fontElementMap as Record<string, string | null>) ?? {};

  console.log("\nscoredPalette:");
  console.log(JSON.stringify(scoredPalette, null, 2));

  console.log("\ndiscoveredFonts (ranked):");
  console.log(JSON.stringify(discoveredFonts, null, 2));

  console.log("\nfontElementMap (per-element DOM assignments):");
  console.log(JSON.stringify(fontElementMap, null, 2));

  // ── Step 2: Claude Vision Classification ──────────────────────────────────────────────────────────────────────────────────
  console.log("\n" + "=".repeat(60));
  console.log("STEP 2 — CLAUDE VISION CLASSIFICATION (classifyVisual.ts)");
  console.log("=".repeat(60));

  const viewportScreenshotPath = (raw.viewportScreenshotPath as string) ?? "";

  let classification;
  try {
    classification = await classifyVisual(
      viewportScreenshotPath,
      scoredPalette,
      discoveredFonts,
      fontElementMap
    );
  } catch (e) {
    console.error("[test] classifyVisual failed:", (e as Error).message);
    process.exit(1);
  }

  console.log("\nClassified colors:");
  classification.colors.forEach((c: { hex: string; role: string; score: number }) =>
    console.log(`  ${c.hex}  role=${c.role}  score=${c.score}`)
  );

  console.log("\nClassified fonts:");
  classification.fonts.forEach((f: { family: string; role: string; seenOn: string[] }) =>
    console.log(`  ${f.family}  role=${f.role}  seenOn=[${f.seenOn.join(",")}]`)
  );

  console.log("\n" + "=".repeat(60));
  console.log("FINAL OUTPUT");
  console.log("=".repeat(60));
  console.log(`brandPrimary:   ${classification.brandPrimary ?? "null"}`);
  console.log(`brandSecondary: ${classification.brandSecondary ?? "null"}`);
  console.log(`accentColor:    ${classification.accentColor ?? "null"}`);
  console.log(`headingFont:    ${classification.headingFont ?? "null"}`);
  console.log(`bodyFont:       ${classification.bodyFont ?? "null"}`);
  console.log(`uiFont:         ${classification.uiFont ?? "null"}`);
}

main().catch(e => { console.error(e); process.exit(1); });
