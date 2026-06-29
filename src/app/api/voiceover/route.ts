import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { generateVoiceover, generateElevenVoiceover, ttsEnabled, elevenEnabled, voiceScript, TTS_VOICES } from "@/lib/tts";

// Generate a voiceover from a post's copy for preview/playback.
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ttsEnabled()) {
    return NextResponse.json({ error: "Voiceover isn't enabled yet — add OPENAI_API_KEY in Vercel." }, { status: 400 });
  }
  const { campaignId, text, voice } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const script = voiceScript(text || "");
  const useEleven = elevenEnabled() && voice && !TTS_VOICES.includes(voice);
  const result = useEleven ? await generateElevenVoiceover(script, voice) : await generateVoiceover(script, voice || "alloy");
  if (!result.audio) return NextResponse.json({ error: result.error || "Couldn't generate voiceover — try again." }, { status: 502 });
  return NextResponse.json({ audio: result.audio });
}
