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
  const { campaignId, text, brief, voice, clipUrl, clipSeconds, musicUrl, musicSeconds, aspect, productId, stillDataUrl, loopSeg, voDataUrl, voSeconds, noVo } = await req.json();
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const origin = new URL(req.url).origin;

  // 1) Voiceover. PREFERRED: the already-generated VO is passed in (so we know its real length).
  //    Otherwise (legacy) generate from text — unless the user chose "No voiceover".
  const script = voiceScript(text || "");
  let voUrl: string | undefined;
  if (voDataUrl && String(voDataUrl).startsWith("data:")) {
    const b64 = String(voDataUrl).split(",")[1] || "";
    const asset = await prisma.renderAsset.create({ data: { mime: "audio/mpeg", data: b64 } });
    voUrl = `${origin}/api/asset/${asset.id}`;
  } else if (!noVo && script) {
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

  // 3) Length comes from the REAL audio now that it's decided up front. Prefer the measured
  //    voiceover duration; if there's no VO, fall back to the music length (capped) or a floor.
  //    Video runs ~1s longer than the voiceover so the VO is never cut off.
  const vSec = Number(voSeconds) || 0;
  const mSec = Number(musicSeconds) || 0;
  const estimate = (!voUrl || (!vSec && !noVo)) && script ? Math.max(6, Math.min(40, Math.round(script.length / 14))) : 0;
  const voLen = vSec > 0 ? Math.ceil(vSec) : (voUrl ? estimate : 0);
  const length = Math.max(10, voLen > 0 ? voLen + 1 : 0, voLen === 0 && mSec > 0 ? Math.min(20, Math.ceil(mSec)) : 0);
  const vertical = aspect !== "wide";

  const timeline = buildTimeline({
    stillUrl, clipUrl: clip, clipSeconds: Number(clipSeconds) || undefined, clipLoopSeg: clip && loopSeg ? Number(loopSeg) : undefined,
    voUrl, musicUrl: musicUrl || undefined, musicLoopSeg: mSec > 0 ? mSec : 30, productUrl,
    length, width: vertical ? 1080 : 1920, height: vertical ? 1920 : 1080,
  });
  const r = await shotstackRender(timeline);
  if (!r.id) return NextResponse.json({ error: r.error || "Render failed to start." }, { status: 502 });
  return NextResponse.json({ renderId: r.id });
}
