/**
 * GET /api/generations?id=<generationId>
 *
 * Returns the current status and images for a single generation.
 * Used as a polling fallback when the SSE stream drops mid-run.
 */
import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { db } from "@/db";
import { generations } from "@/db/schema";
import { eq } from "drizzle-orm";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  const userId = (session?.user as { id?: string } | undefined)?.id;
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return new Response(JSON.stringify({ error: "id is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const [generation] = await db
    .select()
    .from(generations)
    .where(eq(generations.id, id))
    .limit(1);

  if (!generation) {
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (generation.userId !== userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(
    JSON.stringify({
      id: generation.id,
      status: generation.status,
      brandUrl: generation.brandUrl,
      brandProfile: generation.brandProfile,
      images: generation.images ?? [],
      errorMessage: generation.errorMessage ?? null,
      createdAt: generation.createdAt.toISOString(),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
