import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { addSharedVoice } from "@/lib/tts";

// Add a chosen shared-library voice to the ElevenLabs account so it can be used for voiceovers.
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { ownerId, voiceId, name } = await req.json();
  const r = await addSharedVoice(ownerId, voiceId, name);
  if (!r.id) return NextResponse.json({ error: r.error || "Couldn't add the voice." }, { status: 502 });
  return NextResponse.json({ id: r.id });
}
