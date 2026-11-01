import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { name, email, avatarUrl } = await req.json();

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required." }, { status: 400 });
    }

    // Check if this email has already been registered
    const existingPlayer = await prisma.player.findFirst({
      where: { email: email.toLowerCase().trim() },
    });

    if (existingPlayer) {
      return NextResponse.json(
        { 
          error: "You have already registered with this email address!", 
          playerId: existingPlayer.id 
        }, 
        { status: 400 }
      );
    }

    // Create the new player if email is unique
    const newPlayer = await prisma.player.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        avatarUrl: avatarUrl || `https://api.dicebear.com/9.x/adventurer/svg?seed=${name}`,
        credits: 100, // Starting credits if applicable
        gamesPlayed: 0,
        gamesWon: 0,
      },
    });

    return NextResponse.json(newPlayer, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to register player." }, { status: 500 });
  }
}