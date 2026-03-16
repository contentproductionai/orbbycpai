/**
 * End-to-end test: runs the real extractDom + classifyVisual pipeline
 * and prints the classified brand output.
 *
 * Usage: node scripts/test-extract.mjs <url>
 *
 * This script delegates to a TypeScript runner so it uses the exact same
 * code that production uses — no inline duplication.
 */
import { execSync } from "child_process";
import * as path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.argv[2];
if (!url) { console.error("Usage: node scripts/test-extract.mjs <url>"); process.exit(1); }

// Run the TypeScript test runner via tsx
try {
  execSync(
    `npx tsx ${path.join(__dirname, "test-extract-ts.ts")} "${url}"`,
    { stdio: "inherit", cwd: path.join(__dirname, "..") }
  );
} catch (e) {
  process.exit(1);
}
