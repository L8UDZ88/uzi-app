"use client";
// Renders a draft as a platform-native post card, shaped by channel AND format
// (Feed / Story / Reel / Carousel / Thread / etc.), so the user previews the real
// placement before approving. The image area shows the art-direction brief as a
// placeholder until the image-generation layer renders the actual visual.

import type { Aspect } from "@/lib/constants";

type Draft = { headline: string; caption: string; hashtags: string[]; visualBrief: string; cta: string };

export default function PostPreview({
  channel, format, aspect, draft, handle, imageUrl, productUrl,
}: { channel: string; format?: string; aspect?: Aspect; draft: Draft; handle?: string; imageUrl?: string; productUrl?: string }) {
  const h = (handle || "@yourbrand").replace(/^@/, "");
  const initial = (h[0] || "U").toUpperCase();
  const asp: Aspect = aspect || "feed";
  const vertical = asp === "vertical";
  const isCarousel = asp === "carousel";
  const isAudio = asp === "audio";
  const textFirst = asp === "text";

  const frame =
    asp === "feed" ? "aspect-[4/5]" :
    vertical ? "aspect-[9/16] max-h-[400px] mx-auto" :
    asp === "wide" ? "aspect-video" :
    "aspect-[4/5]"; // carousel

  // Vertical formats (Story / Reel / Short / TikTok) — full-bleed media with overlaid caption.
  if (vertical) {
    return (
      <div className="bg-white text-zinc-900 rounded-2xl overflow-hidden border border-zinc-200 shadow-sm">
        <div className={`relative ${frame} w-full bg-gradient-to-br from-zinc-800 to-zinc-950 text-white`}>
          {imageUrl && <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />}
          <div className="absolute top-0 inset-x-0 flex items-center gap-2 p-3 z-10">
            <div className="w-8 h-8 rounded-full bg-white/90 text-zinc-900 flex items-center justify-center text-xs font-bold">{initial}</div>
            <div className="text-sm font-semibold drop-shadow">{h}</div>
            <div className="ml-auto text-[10px] uppercase tracking-wide bg-white/15 rounded-full px-2 py-0.5">{format || "Story"}</div>
          </div>
          {!imageUrl && (
            <div className="absolute inset-0 flex items-center justify-center p-6 text-center">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-white/60 mb-2">Visual · to be generated</div>
                <div className="text-sm text-white/90 leading-snug max-w-[15rem] mx-auto">{draft.visualBrief}</div>
              </div>
            </div>
          )}
          <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/70 to-transparent z-[2]">
            <div className="text-sm font-medium leading-snug line-clamp-3">{draft.caption}</div>
            <div className="mt-2 inline-block text-xs font-semibold bg-white text-zinc-900 rounded-full px-3 py-1">{draft.cta}</div>
          </div>
        </div>
      </div>
    );
  }

  // Audio (podcast) — waveform card.
  if (isAudio) {
    return (
      <div className="bg-white text-zinc-900 rounded-2xl overflow-hidden border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-2 p-3">
          <div className="w-9 h-9 rounded-full bg-zinc-900 text-white flex items-center justify-center text-sm font-bold">{initial}</div>
          <div className="leading-tight flex-1 min-w-0"><div className="font-semibold text-sm truncate">{h}</div><div className="text-xs text-zinc-500">{channel} · {format || "Episode"}</div></div>
        </div>
        <div className="px-3 pb-3 text-sm text-zinc-900">{draft.caption}</div>
        <div className="bg-zinc-100 px-3 py-4 flex items-center gap-1.5">
          <div className="w-9 h-9 rounded-full bg-zinc-900 text-white flex items-center justify-center">▶</div>
          {Array.from({ length: 28 }).map((_, i) => (
            <div key={i} className="w-1 rounded-full bg-zinc-400" style={{ height: `${8 + Math.abs(Math.sin(i * 1.3)) * 26}px` }} />
          ))}
        </div>
      </div>
    );
  }

  const Media = (
    <div className={`relative ${frame} w-full bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center p-5 overflow-hidden`}>
      {imageUrl ? (
        <img src={imageUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <div className="text-center">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-2">Visual · to be generated</div>
          <div className="text-sm text-zinc-600 max-w-xs mx-auto leading-snug">{draft.visualBrief}</div>
        </div>
      )}
      {isCarousel && (
        <>
          <div className="absolute top-2 right-3 text-xs bg-black/60 text-white rounded-full px-2 py-0.5">1/5</div>
          <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1.5">
            {Array.from({ length: 5 }).map((_, i) => <span key={i} className={`w-1.5 h-1.5 rounded-full ${i === 0 ? "bg-zinc-800" : "bg-zinc-400"}`} />)}
          </div>
          <div className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 text-xl">›</div>
        </>
      )}
    </div>
  );

  const Caption = (
    <div className="p-3">
      {channel === "Instagram" && <div className="flex gap-3 text-zinc-800 text-lg mb-2">♡ <span>◯</span> <span>↗</span></div>}
      <div className="text-sm whitespace-pre-wrap text-zinc-900">
        <span className="font-semibold">{h} </span>{draft.caption}
      </div>
      {draft.hashtags.length > 0 && <div className="text-sky-600 text-sm mt-1.5">{draft.hashtags.join(" ")}</div>}
    </div>
  );

  return (
    <div className="bg-white text-zinc-900 rounded-2xl overflow-hidden border border-zinc-200 shadow-sm">
      <div className="flex items-center gap-2 p-3">
        <div className="w-9 h-9 rounded-full bg-zinc-900 text-white flex items-center justify-center text-sm font-bold">{initial}</div>
        <div className="leading-tight flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{h}</div>
          <div className="text-xs text-zinc-500">{channel === "X" ? `@${h}` : channel}{format ? ` · ${format}` : ""}</div>
        </div>
        <div className="text-zinc-400">•••</div>
      </div>
      {textFirst ? (
        <>
          <div className="px-3 pb-3 text-sm whitespace-pre-wrap text-zinc-900">{draft.caption}{draft.hashtags.length > 0 && <span className="text-sky-600"> {draft.hashtags.join(" ")}</span>}</div>
          {Media}
        </>
      ) : (
        <>
          {Media}
          {Caption}
        </>
      )}
    </div>
  );
}
