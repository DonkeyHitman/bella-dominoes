import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  try {
    const players = await prisma.player.findMany({
      orderBy: { credits: "desc" },
    });
    return NextResponse.json(players);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch players" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = body.email?.trim() || `user_${Date.now()}@bella.com`;
    const name = body.name?.trim() || "John";

    const player = await prisma.player.upsert({
      where: { email },
      update: { name },
      create: {
        email,
        name,
        avatarUrl: `https://api.dicebear.com/9.x/adventurer/svg?seed=${encodeURIComponent(name)}`,
      },
    });

    return NextResponse.json(player);
  } catch (error) {
    return NextResponse.json({ error: "Failed to register player" }, { status: 500 });
  }
}
