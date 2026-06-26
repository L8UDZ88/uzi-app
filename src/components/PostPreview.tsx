"use client";
// Renders a draft as a platform-native post card, so the user previews the
// real thing before approving. The image area shows the art-direction brief as
// a placeholder until the image-generation layer renders the actual visual.

type Draft = { headline: string; caption: string; hashtags: string[]; visualBrief: string; cta: string };

export default function PostPreview({ channel, draft, handle }: { channel: string; draft: Draft; handle?: string }) {
  const h = (handle || "@yourbrand").replace(/^@/, "");
  const initial = (h[0] || "U").toUpperCase();
  const textFirst = ["X", "LinkedIn", "Facebook"].includes(channel);
  const vertical = channel === "TikTok" || channel === "YouTube";
  const mediaAspect = channel === "Instagram" ? "aspect-[4/5]" : vertical ? "aspect-[9/16] max-h-[380px] mx-auto" : "aspect-[1.91/1]";

  const Media = (
    <div className={`${mediaAspect} w-full bg-gradient-to-br from-zinc-100 to-zinc-200 flex items-center justify-center p-5`}>
      <div className="text-center">
        <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-2">Visual · to be generated</div>
        <div className="text-sm text-zinc-600 max-w-xs mx-auto leading-snug">{draft.visualBrief}</div>
        {vertical && <div className="text-xs text-zinc-400 mt-3">▶ {channel} video</div>}
      </div>
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
          <div className="text-xs text-zinc-500">{channel === "X" ? `@${h}` : channel}</div>
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
