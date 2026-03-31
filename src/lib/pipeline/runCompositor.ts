import * as fs from "fs";
import * as path from "path";
import puppeteer, { type Browser } from "puppeteer";
import {
  generateCreativeBrief,
  sourceHeroImage,
  segmentHeroImage,
  generateComposition,
  critiqueComposition,
} from "./compositorGenerate";
import { renderComposition } from "./compositorRenderer";
import { resolveLogo } from "./runPipeline";
import { execSync } from "child_process";
import type { BrandProfile } from "./classifyBrand";
import type { EmitFn } from "./types";
import type { CreativeBrief } from "./compositorGenerate";

const MAX_RETRY_ATTEMPTS = 3;
const QUALITY_THRESHOLD = 8;

function getChromiumPath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  for (const bin of ["chromium", "chromium-browser", "google-chrome", "google-chrome-stable"]) {
    try {
      const p = execSync(`which ${bin}`, { encoding: "utf8" }).trim();
      if (p) return p;
    } catch {}
  }
  return undefined;
}

export interface CompositorResult {
  imagePath: string;
  composition: object;
  critiqueScore: number;
  critiqueIssues: string[];
  brief: CreativeBrief;
  attempts: number;
}

const SIZE_DIMENSIONS: Record<string, { width: number; height: number }> = {
  portrait: { width: 1080, height: 1350 },
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
  landscape: { width: 1200, height: 628 },
};

export async function runCompositorPipeline(
  brandProfile: BrandProfile,
  workDir: string,
  emit: EmitFn,
  sizes: string[] = ["portrait", "square"],
  postTopic?: string
): Promise<CompositorResult[]> {
  fs.mkdirSync(workDir, { recursive: true });
  const results: CompositorResult[] = [];

  const topic = postTopic ?? "Brand awareness / hero content";
  const primarySize = SIZE_DIMENSIONS[sizes[0]] ?? SIZE_DIMENSIONS.portrait;

  // ── Step 0: Generate Creative Brief ──────────────────────────────────────
  emit({ type: "status", step: 1, total: 6, message: "Writing creative brief..." });
  const brief = await generateCreativeBrief(brandProfile, topic);
  console.log(`[compositor] Creative brief generated:`);
  console.log(`  Audience: ${brief.audience}`);
  console.log(`  Emotional goal: ${brief.emotionalGoal}`);
  console.log(`  Headline: "${brief.headline}"`);
  console.log(`  Visual direction: ${brief.visualDirection}`);
  console.log(`  Pexels query: "${brief.pexelsQuery}"`);
  console.log(`  Color theme: ${brief.colorTheme}`);
  console.log(`  Layout style: ${brief.layoutStyle}`);

  // Save brief to disk for debugging
  fs.writeFileSync(path.join(workDir, "creative_brief.json"), JSON.stringify(brief, null, 2));

  // ── Step 1: Source hero image (Pexels-first, Flux fallback) ──────────────
  emit({ type: "status", step: 2, total: 6, message: "Sourcing hero image..." });
  const heroPath = await sourceHeroImage(brief, brandProfile, primarySize.width, primarySize.height, workDir);

  // ── Step 2: Segment into background + subject ─────────────────────────────
  emit({ type: "status", step: 3, total: 6, message: "Segmenting image..." });
  const segmented = await segmentHeroImage(heroPath, workDir);

  // ── Step 3: Resolve logo ──────────────────────────────────────────────────
  const logoDataUri = await resolveLogo(brandProfile);

  const imageMap: Record<string, string> = {
    background: segmented.backgroundPath,
    subject: segmented.subjectPath,
    logo: logoDataUri ?? "",
  };

  // ── Step 4: Launch browser ────────────────────────────────────────────────
  const browser: Browser = await puppeteer.launch({
    headless: true,
    executablePath: getChromiumPath(),
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--font-render-hinting=none",
      "--disable-web-security",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
  });

  try {
    for (const size of sizes) {
      const dims = SIZE_DIMENSIONS[size] ?? SIZE_DIMENSIONS.portrait;

      emit({ type: "status", step: 4, total: 6, message: `Art Director composing ${size}...` });

      let finalScore = 0;
      let finalIssues: string[] = [];
      let finalComposition = null;
      let finalOutputPath = "";
      let attempt = 0;
      let critiqueIssues: string[] = [];

      // ── QA Retry Loop: up to MAX_RETRY_ATTEMPTS ───────────────────────────
      while (attempt < MAX_RETRY_ATTEMPTS) {
        attempt++;
        console.log(`[compositor] ${size} attempt ${attempt}/${MAX_RETRY_ATTEMPTS}...`);

        // Generate composition (passes critique issues on retry)
        const composition = await generateComposition(
          brandProfile,
          segmented,
          logoDataUri,
          dims.width,
          dims.height,
          brief,
          attempt > 1 ? critiqueIssues : undefined
        );

        // Extract font families for Google Fonts
        const fontFamilies = composition.layers
          .filter((l) => l.type === "text")
          .map((l) => (l as { fontFamily: string }).fontFamily)
          .filter(Boolean);

        // Render
        const outputPath = path.join(workDir, `compositor_${size}_attempt${attempt}.png`);
        await renderComposition(composition, imageMap, fontFamilies, outputPath, browser);

        emit({ type: "status", step: 5, total: 6, message: `Critiquing ${size} (attempt ${attempt})...` });

        // Critique
        const critique = await critiqueComposition(outputPath, composition, brandProfile, brief);

        console.log(`[compositor] ${size} attempt ${attempt}: score=${critique.score}/10, passed=${critique.passed}`);
        if (critique.issues.length > 0) {
          console.log(`  Issues: ${critique.issues.join("; ")}`);
        }

        finalScore = critique.score;
        finalIssues = critique.issues;
        finalComposition = composition;
        finalOutputPath = outputPath;

        if (critique.passed) {
          console.log(`[compositor] ${size} PASSED quality gate at attempt ${attempt} (score=${critique.score})`);
          break;
        }

        // Prepare critique issues for next attempt
        critiqueIssues = critique.issues;

        if (attempt < MAX_RETRY_ATTEMPTS) {
          console.log(`[compositor] ${size} score ${critique.score} < ${QUALITY_THRESHOLD} — retrying with critique feedback...`);
        } else {
          console.log(`[compositor] ${size} exhausted ${MAX_RETRY_ATTEMPTS} attempts. Best score: ${finalScore}`);
        }
      }

      // Copy the final attempt to the canonical output path
      const canonicalPath = path.join(workDir, `compositor_${size}.png`);
      fs.copyFileSync(finalOutputPath, canonicalPath);

      emit({
        type: "image",
        schemaId: `compositor_${size}`,
        size,
        filePath: canonicalPath,
        critiqueScore: finalScore,
        critiqueIssues: finalIssues,
      });

      results.push({
        imagePath: canonicalPath,
        composition: finalComposition!,
        critiqueScore: finalScore,
        critiqueIssues: finalIssues,
        brief,
        attempts: attempt,
      });

      console.log(`[compositor] ${size}: final score=${finalScore}, attempts=${attempt}`);
    }
  } finally {
    await browser.close();
  }

  return results;
}
