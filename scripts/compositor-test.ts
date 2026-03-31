/**
 * Compositor Quality Gate Test
 * Extracts brand profile via existing pipeline, then runs compositor pipeline.
 * Run with: npx tsx scripts/compositor-test.ts
 */
import { config } from "dotenv";
import path from "path";
import fs from "fs";

config({ path: path.join(__dirname, "../.env.local") });
config({ path: path.join(__dirname, "../.env") });

process.env.FAL_KEY = "313719a4-2aa8-4db3-beef-f84eda92b039:298781dd2908e2f875616514fab10e73";
process.env.PEXELS_API_KEY = "4XmBUTy7ZHI94MH7EkjGqvowTGpg85hk1ZLwAaZhdOa0AZape8tgVTpQ";

import { runFullPipeline } from "../src/lib/pipeline/runPipeline";
import { runCompositorPipeline } from "../src/lib/pipeline/runCompositor";

const BRANDS = [
  { name: "selfpublishing", url: "https://www.selfpublishing.com", topic: "How to write and publish your first book" },
  { name: "howler-brothers", url: "https://howlerbros.com", topic: "Adventure-ready gear for the outdoors" },
  { name: "vanta", url: "https://www.vanta.com", topic: "Automated security compliance" },
  { name: "linear", url: "https://www.linear.app", topic: "Ship software faster with Linear" },
  { name: "notion", url: "https://www.notion.so", topic: "The connected workspace for your team" },
];

const OUTPUT_DIR = path.join(__dirname, "../compositor-test-output");
fs.mkdirSync(OUTPUT_DIR, { recursive: true });

interface TestResult {
  brand: string;
  success: boolean;
  imagePaths?: string[];
  critiqueScores?: number[];
  error?: string;
}

async function runBrand(brand: typeof BRANDS[0]): Promise<TestResult> {
  const workDir = path.join(OUTPUT_DIR, brand.name);
  fs.mkdirSync(workDir, { recursive: true });

  console.log(`\n${"=".repeat(55)}`);
  console.log(`BRAND: ${brand.name.toUpperCase()} — ${brand.url}`);
  console.log("=".repeat(55));

  const emit: import("../src/lib/pipeline/types").EmitFn = (event) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const e = event as any;
    if (e.type === "status") {
      process.stdout.write(`  [${e.step}/${e.total}] ${e.message}\n`);
    } else if (e.type === "image") {
      process.stdout.write(`  [image] ${e.size}: score=${e.critiqueScore ?? "N/A"}\n`);
    } else if (e.type === "schema") {
      process.stdout.write(`  [schema] ${e.schemaName}\n`);
    }
  };

  try {
    // Step 1: Extract brand profile using existing pipeline
    console.log("  Extracting brand profile...");
    const { brandProfile } = await runFullPipeline(brand.url, workDir, emit);
    console.log(`  ✓ Brand profile extracted: ${brandProfile.meta.brandName}`);

    // Step 2: Run compositor pipeline with the extracted brand profile
    console.log("  Running compositor pipeline...");
    const compositorResults = await runCompositorPipeline(
      brandProfile,
      path.join(workDir, "compositor"),
      emit,
      ["portrait"],
      brand.topic
    );

    const imagePaths = compositorResults.map((r) => r.imagePath);
    const critiqueScores = compositorResults.map((r) => r.critiqueScore);

    console.log(`  ✓ Compositor complete: ${imagePaths.length} images`);
    for (let i = 0; i < imagePaths.length; i++) {
      console.log(`    ${path.basename(imagePaths[i])}: score=${critiqueScores[i]}`);
      if (compositorResults[i].critiqueIssues.length > 0) {
        console.log(`    Issues: ${compositorResults[i].critiqueIssues.join("; ")}`);
      }
    }

    return { brand: brand.name, success: true, imagePaths, critiqueScores };
  } catch (err) {
    const message = (err as Error).message;
    console.error(`  ✗ FAILED: ${message}`);
    return { brand: brand.name, success: false, error: message };
  }
}

async function main() {
  console.log("Compositor Quality Gate Test");
  console.log(`Output: ${OUTPUT_DIR}`);
  console.log(`Brands: ${BRANDS.map((b) => b.name).join(", ")}\n`);

  const results: TestResult[] = [];

  for (const brand of BRANDS) {
    const result = await runBrand(brand);
    results.push(result);
  }

  console.log(`\n${"=".repeat(55)}`);
  console.log("QUALITY GATE RESULTS");
  console.log("=".repeat(55));
  for (const r of results) {
    const passed = r.success && (r.critiqueScores ?? []).every((s) => s >= 8);
    const status = passed ? "✓ PASS" : "✗ FAIL";
    const scores = r.critiqueScores ? ` (scores: ${r.critiqueScores.join(", ")})` : "";
    console.log(`${status}  ${r.brand}${scores}${r.error ? ` — ${r.error}` : ""}`);
  }

  const resultsPath = path.join(OUTPUT_DIR, "results.json");
  fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
  console.log(`\nResults saved to ${resultsPath}`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
