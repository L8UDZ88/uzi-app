import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { listVoices } from "@/lib/tts";

// Voices for the picker — ElevenLabs (if connected) + OpenAI.
export async function GET() {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ voices: await listVoices() });
}
