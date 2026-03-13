import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { generations, subscriptions } from "@/db/schema";
import { eq, desc } from "drizzle-orm";
import DashboardClient from "./DashboardClient";

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id as string;

  const [userGenerations, userSubscription] = await Promise.all([
    db
      .select()
      .from(generations)
      .where(eq(generations.userId, userId))
      .orderBy(desc(generations.createdAt))
      .limit(20),
    db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1),
  ]);

  const subscription = userSubscription[0] ?? null;

  const totalGenerations = userGenerations.length;
  const completedRuns = userGenerations.filter((g) => g.status === "complete").length;
  const totalImages = userGenerations.reduce((acc, g) => {
    const imgs = g.images as Array<unknown> | null;
    return acc + (imgs ? imgs.length : 0);
  }, 0);

  const generationsUsed = subscription?.generationsUsed ?? 0;
  const generationsLimit = subscription?.generationsLimit ?? 3;

  const user = {
    name: session.user.name || session.user.email || "User",
    email: session.user.email || "",
    initials: (session.user.name || session.user.email || "U")
      .split(" ")
      .map((w: string) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 2),
  };

  return (
    <DashboardClient
      user={user}
      generations={userGenerations.map((g) => ({
        id: g.id,
        brandUrl: g.brandUrl,
        status: g.status,
        createdAt: g.createdAt.toISOString(),
        images: (g.images as Array<{
          schemaId: string;
          schemaName: string;
          size: string;
          url: string;
        }> | null) ?? [],
        brandProfile: (g.brandProfile as Record<string, unknown> | null) ?? {},
        errorMessage: g.errorMessage ?? null,
      }))}
      stats={{
        totalImages,
        completedRuns,
        totalGenerations,
        generationsUsed,
        generationsLimit,
      }}
    />
  );
}
