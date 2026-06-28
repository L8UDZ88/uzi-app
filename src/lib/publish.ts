// Publishing engine — turns an approved post into a live post via a per-platform adapter.
// Adapters share one interface, so new platforms slot in without touching the scheduler.
// LinkedIn is implemented today; the rest return a clear "pending platform approval" result
// until their API app is registered/approved (the long pole, per platform).

export type PublishPost = { caption: string; mediaUrl?: string | null; channel: string; format?: string };
export type PublishConn = { platform: string; accessToken: string; externalId?: string | null };
export type PublishResult = { ok: boolean; url?: string; error?: string; pending?: boolean };

// Platforms with a working publisher right now. Others are scaffolded behind the same interface.
export const PUBLISHERS_READY = ["linkedin"];

// Map a Uzi channel name ("LinkedIn", "Instagram", "X"…) to a platform key.
export function platformKey(channel: string): string {
  const c = (channel || "").toLowerCase();
  if (c.includes("linkedin")) return "linkedin";
  if (c === "x" || c.includes("twitter")) return "x";
  if (c.includes("instagram")) return "instagram";
  if (c.includes("facebook")) return "facebook";
  if (c.includes("youtube")) return "youtube";
  if (c.includes("tiktok")) return "tiktok";
  if (c.includes("podcast")) return "podcast";
  return c;
}

export async function publish(conn: PublishConn, post: PublishPost): Promise<PublishResult> {
  switch (conn.platform) {
    case "linkedin":
      return publishLinkedIn(conn, post);
    default:
      return { ok: false, pending: true, error: `${conn.platform} auto-publishing is pending that platform's API approval. Post is ready to publish manually.` };
  }
}

// LinkedIn UGC text post (member share). Image posting is a later enhancement (multi-step upload).
async function publishLinkedIn(conn: PublishConn, post: PublishPost): Promise<PublishResult> {
  const author = conn.externalId;
  if (!author) return { ok: false, error: "LinkedIn identity missing — reconnect the account." };
  const body = {
    author,
    lifecycleState: "PUBLISHED",
    specificContent: {
      "com.linkedin.ugc.ShareContent": {
        shareCommentary: { text: post.caption.slice(0, 2900) },
        shareMediaCategory: "NONE",
      },
    },
    visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
  };
  try {
    const r = await fetch("https://api.linkedin.com/v2/ugcPosts", {
      method: "POST",
      headers: {
        authorization: `Bearer ${conn.accessToken}`,
        "content-type": "application/json",
        "X-Restli-Protocol-Version": "2.0.0",
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const t = await r.text();
      return { ok: false, error: `LinkedIn ${r.status}: ${t.slice(0, 240)}` };
    }
    const id = r.headers.get("x-restli-id") || r.headers.get("x-linkedin-id") || "";
    return { ok: true, url: id ? `https://www.linkedin.com/feed/update/${id}` : undefined };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
}
