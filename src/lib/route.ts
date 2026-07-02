// Autopilot source routing: given a post's format/channel/pillar, decide how its MEDIA is produced —
// so the user never picks a source by hand. Documents→text, Audio→audiogram, Video→splice, else AI.
import { aspectFor } from "./constants";

export type RouteMethod = "text" | "audiogram" | "splice" | "real" | "ai";
export type PostRoute = {
  method: RouteMethod;
  label: string;             // human-readable "auto-source" line
  needs: "video" | "audio" | null; // a connected library this method requires
};

export function routePost(opts: { format?: string; channel?: string; pillarSource?: string }): PostRoute {
  const aspect = aspectFor(opts.channel || "", opts.format || "");
  const fmt = (opts.format || "").toLowerCase();
  if (aspect === "audio") return { method: "audiogram", label: "Audiogram / episode from your Audio library", needs: "audio" };
  if (/long/.test(fmt) || aspect === "wide") return { method: "splice", label: "Spliced from your Video library", needs: "video" };
  if (aspect === "text") return { method: "text", label: "Text post written from your brain", needs: null };
  if (opts.pillarSource === "real") return { method: "real", label: "Your real footage from the connected folder", needs: null };
  return { method: "ai", label: "AI visual (Flux) + your logo", needs: null };
}

// Is the library this route needs actually connected? (inputs.libraries[slot].folderId)
export function routeReady(route: PostRoute, libraries: any): boolean {
  if (!route.needs) return true;
  return !!libraries?.[route.needs]?.folderId;
}
