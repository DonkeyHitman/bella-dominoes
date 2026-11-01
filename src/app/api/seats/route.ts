import { NextResponse } from "next/server";

// In-memory store for active table seats shared across all connected devices
let globalSeats = [
  { id: "player-a", name: "PLAYER A", email: "", avatar: "" },
  { id: "player-b", name: "PLAYER B", email: "", avatar: "" },
  { id: "player-c", name: "PLAYER C", email: "", avatar: "" },
  { id: "player-d", name: "PLAYER D", email: "", avatar: "" },
];

export async function GET() {
  return NextResponse.json({ seats: globalSeats });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { seatName, email, avatar } = body;

    if (!seatName || !email) {
      return NextResponse.json({ error: "Missing seatName or email" }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Update global seats state:
    globalSeats = globalSeats.map((s) => {
      // If this seat is being claimed, assign email and avatar
      if (s.name === seatName) {
        return { ...s, email: cleanEmail, avatar: avatar || s.avatar };
      }
      // If this user already held a different seat, clear it so they don't double-book
      if (s.email === cleanEmail) {
        return { ...s, email: "", avatar: "" };
      }
      return s;
    });

    return NextResponse.json({ success: true, seats: globalSeats });
  } catch (error) {
    return NextResponse.json({ error: "Invalid request payload" }, { status: 400 });
  }
}