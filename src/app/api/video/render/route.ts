import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { generateVoiceover, generateElevenVoiceover, elevenEnabled, voiceScript, TTS_VOICES } from "@/lib/tts";
import { searchStock, keywordsFromBrief } from "@/lib/stock";
import { buildTimeline, shotstackRender, renderEnabled } from "@/lib/render";

export const maxDuration = 60;

// Assemble a finished video: voiceover + stock clip (+ optional music) -> Shotstack render.
// Returns a renderId; the client polls /api/video/status for the MP4.
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!renderEnabled()) {
    return NextResponse.json({ error: "Video render isn't enabled yet — add SHOTSTACK_API_KEY in Vercel." }, { status: 400 });
  }
  const { campaignId, text, brief, voice, clipUrl, musicUrl, aspect, title, productId, stillDataUrl, loopSeg } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const origin = new URL(req.url).origin;

  // 1) Voiceover -> host it so the renderer can fetch it by URL.
  const script = voiceScript(text || "");
  let voUrl: string | undefined;
  if (script) {
    const useEleven = elevenEnabled() && voice && !TTS_VOICES.includes(voice);
    const vo = useEleven ? await generateElevenVoiceover(script, voice) : await generateVoiceover(script, voice || "alloy");
    if (vo.audio) {
      const b64 = vo.audio.split(",")[1] || "";
      const asset = await prisma.renderAsset.create({ data: { mime: "audio/mpeg", data: b64 } });
      voUrl = `${origin}/api/asset/${asset.id}`;
    }
  }

  // 2) Background. PRIMARY: the on-brand still (product baked in) animated with a zoom.
  //    FALLBACK: a stock clip + the product overlaid.
  let stillUrl: string | undefined;
  let clip: string | undefined;
  let productUrl: string | undefined;
  if (stillDataUrl && String(stillDataUrl).startsWith("data:")) {
    const b64 = String(stillDataUrl).split(",")[1] || "";
    const asset = await prisma.renderAsset.create({ data: { mime: "image/png", data: b64 } });
    stillUrl = `${origin}/api/asset/${asset.id}`;
  } else {
    clip = clipUrl as string | undefined;
    if (!clip) {
      const q = keywordsFromBrief(brief || text || "") || c.region || "city";
      const clips = await searchStock(q, aspect === "wide" ? "landscape" : "portrait");
      clip = clips[0]?.download;
    }
    if (!clip) return NextResponse.json({ error: "Generate the image first (it becomes the video), or add PEXELS_API_KEY for stock." }, { status: 400 });
    productUrl = productId ? `${origin}/api/product/${productId}` : undefined;
  }

  // 3) Voiceover length estimate (speech ≈ 14 chars/sec), clamped. Video runs ~1s longer
  //    than the voiceover so the VO is never cut off.
  const voLen = Math.max(6, Math.min(40, Math.round((script.length || 120) / 14)));
  const length = voLen + 1;
  const vertical = aspect !== "wide";

  const timeline = buildTimeline({
    stillUrl, clipUrl: clip, clipLoopSeg: clip && loopSeg ? Number(loopSeg) : undefined,
    voUrl, musicUrl: musicUrl || undefined, productUrl,
    length, width: vertical ? 1080 : 1920, height: vertical ? 1920 : 1080, title: title || undefined,
  });
  const r = await shotstackRender(timeline);
  if (!r.id) return NextResponse.json({ error: r.error || "Render failed to start." }, { status: 502 });
  return NextResponse.json({ renderId: r.id });
}
