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
      .limit(50),
    db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1),
  ]);

  const subscription = userSubscription[0] ?? null;
  const completedRuns = userGenerations.filter((g) => g.status === "complete").length;

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
        brandProfile: (g.brandProfile as Record<string, unknown> | null) ?? {},
        errorMessage: g.errorMessage ?? null,
      }))}
      stats={{
        completedRuns,
        totalGenerations: userGenerations.length,
        generationsUsed: subscription?.generationsUsed ?? 0,
        generationsLimit: subscription?.generationsLimit ?? 10,
      }}
    />
  );
}
