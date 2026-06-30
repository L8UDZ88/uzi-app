import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { listSharedItalian } from "@/lib/tts";

// Native Italian voices from the ElevenLabs shared library (with preview samples to audition).
export async function GET() {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ voices: await listSharedItalian() });
}
