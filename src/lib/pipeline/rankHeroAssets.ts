import { Anthropic } from "@anthropic-ai/sdk";
import fs from "fs";

export interface RankedAsset {
  index: number;
  src: string;
  localPath: string;
  alt: string;
  width: number;
  height: number;
  inHero: boolean;
  productVisibilityScore: number;
  backgroundCleanlinessScore: number;
  heroUsabilityScore: number;
  totalScore: number;
  heroReason: string;
}

const RANKING_SYSTEM = `You are an expert Art Director selecting the best hero product image for a social media post.
You will be given a set of candidate images downloaded from a brand's website.
Your job is to score each image on three criteria:
1. Product Visibility (0-3): Is the product clearly visible, large, and the main subject? (3 = perfect product shot, 0 = no product or tiny)
2. Background Cleanliness (0-3): Is the background clean, solid color, or transparent? (3 = pure white/transparent/solid, 0 = messy lifestyle scene)
3. Hero Usability (0-4): How well would this work as the main visual anchor in a social post? (4 = perfect hero asset, 0 = unusable icon/banner)

Rules:
- Icons, logos, and UI screenshots should score 0 on Hero Usability.
- Wide banners with text on them should score 0 on Hero Usability.
- Clean product shots on solid backgrounds should score highest.
- Lifestyle photos where the product is clearly visible can score moderately well, but clean product shots are preferred.

Output ONLY valid JSON in this format:
{
  "rankings": [
    {
      "index": number (the index provided in the prompt),
      "productVisibilityScore": number,
      "backgroundCleanlinessScore": number,
      "heroUsabilityScore": number,
      "heroReason": "string (brief reason for this score)"
    }
  ]
}`;

export async function rankHeroAssets(
  downloadedAssets: Array<{
    src: string;
    localPath: string;
    localUrl: string;
    alt: string;
    width: number;
    height: number;
    ext: string;
    isGif: boolean;
    inHero: boolean;
  }>
): Promise<{ rankedAssets: RankedAsset[]; heroAssetIndex: number }> {
  if (!downloadedAssets || downloadedAssets.length === 0) {
    return { rankedAssets: [], heroAssetIndex: 0 };
  }

  // Filter candidates: must be reasonably sized, not gifs, and we only take the top 10 to fit in one API call
  const candidates = downloadedAssets
    .map((asset, index) => ({ ...asset, originalIndex: index }))
    .filter((a) => !a.isGif && a.width >= 300 && a.height >= 300 && fs.existsSync(a.localPath))
    .sort((a, b) => {
      // Prioritize inHero, then size
      if (a.inHero && !b.inHero) return -1;
      if (!a.inHero && b.inHero) return 1;
      return (b.width * b.height) - (a.width * a.height);
    })
    .slice(0, 10);

  if (candidates.length === 0) {
    return { rankedAssets: [], heroAssetIndex: 0 };
  }

  try {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    
    const content: any[] = [
      {
        type: "text",
        text: "Please score these candidate images. The index of each image is provided before it."
      }
    ];

    for (const candidate of candidates) {
      const imgBuf = fs.readFileSync(candidate.localPath);
      const imgBase64 = imgBuf.toString("base64");
      const mediaType = candidate.ext === ".png" ? "image/png" : candidate.ext === ".webp" ? "image/webp" : "image/jpeg";
      
      content.push({
        type: "text",
        text: `Image Index: ${candidate.originalIndex}`
      });
      content.push({
        type: "image",
        source: {
          type: "base64",
          media_type: mediaType,
          data: imgBase64
        }
      });
    }

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      system: RANKING_SYSTEM,
      messages: [{ role: "user", content }],
    });

    const responseText = (response.content[0] as { text: string }).text;
    const cleaned = responseText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
    const parsed = JSON.parse(cleaned) as {
      rankings: Array<{
        index: number;
        productVisibilityScore: number;
        backgroundCleanlinessScore: number;
        heroUsabilityScore: number;
        heroReason: string;
      }>;
    };

    const rankedAssets: RankedAsset[] = parsed.rankings.map(r => {
      const asset = downloadedAssets[r.index];
      return {
        index: r.index,
        src: asset.src,
        localPath: asset.localPath,
        alt: asset.alt,
        width: asset.width,
        height: asset.height,
        inHero: asset.inHero,
        productVisibilityScore: r.productVisibilityScore,
        backgroundCleanlinessScore: r.backgroundCleanlinessScore,
        heroUsabilityScore: r.heroUsabilityScore,
        totalScore: r.productVisibilityScore + r.backgroundCleanlinessScore + r.heroUsabilityScore,
        heroReason: r.heroReason
      };
    }).sort((a, b) => b.totalScore - a.totalScore);

    const heroAssetIndex = rankedAssets.length > 0 ? rankedAssets[0].index : 0;

    console.log(`[rankHeroAssets] Ranked ${candidates.length} assets. Top pick index: ${heroAssetIndex} (Score: ${rankedAssets[0]?.totalScore})`);
    
    return { rankedAssets, heroAssetIndex };

  } catch (e) {
    console.warn("[rankHeroAssets] Failed to rank assets, falling back to default:", (e as Error).message);
    return { rankedAssets: [], heroAssetIndex: candidates.length > 0 ? candidates[0].originalIndex : 0 };
  }
}
