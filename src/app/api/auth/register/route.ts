import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { users, subscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { randomUUID } from "crypto";

const registerSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, email, password } = parsed.data;

    // Check if user already exists
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existing) {
      return NextResponse.json(
        { error: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const userId = randomUUID();

    // Create user
    await db.insert(users).values({
      id: userId,
      name,
      email,
      passwordHash,
    });

    // Create free tier subscription
    await db.insert(subscriptions).values({
      id: randomUUID(),
      userId,
      tier: "free",
      status: "active",
      generationsUsed: 0,
      generationsLimit: 3,
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[register] error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
