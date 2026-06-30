import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { generateMusic, musicEnabled } from "@/lib/music";

export const maxDuration = 60;

// Generate an instrumental score derived from the brand's mood. Returns a hosted audio URL.
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!musicEnabled()) return NextResponse.json({ error: "Music isn't enabled — add FAL_KEY in Vercel.", notEnabled: true }, { status: 400 });
  const { campaignId, mood } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const voice = c.voice || "warm, confident, modern";
  const region = c.region ? `, evoking ${c.region}` : "";
  const prompt = `Instrumental background score for a premium social ad${region}. Mood: ${mood || voice}. Clean, modern, loopable, leaves room for a voiceover on top. High-quality production, no vocals.`;
  const negative = "vocals, singing, lyrics, spoken word, low quality";
  const r = await generateMusic(prompt, negative);
  if (!r.audioUrl) return NextResponse.json({ error: r.error || "Couldn't generate music — try again." }, { status: 502 });
  return NextResponse.json({ audioUrl: r.audioUrl });
}
