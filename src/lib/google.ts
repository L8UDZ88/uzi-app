// Google Drive integration — OAuth + read-only Drive access via direct REST (no SDK).
// Grounds Uzi's captions in the brand's real content. Falls back gracefully if not configured.

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const DRIVE = "https://www.googleapis.com/drive/v3";
const USERINFO = "https://www.googleapis.com/oauth2/v2/userinfo";
// drive.readonly so we can list + read; openid/email so we can show which account is linked.
const SCOPE = "openid email https://www.googleapis.com/auth/drive.readonly";

export function googleConfigured(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_REDIRECT_URI);
}
const redirectUri = () => process.env.GOOGLE_REDIRECT_URI || "";

export function authUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",     // get a refresh token
    prompt: "consent",          // force refresh_token even on re-auth
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${p.toString()}`;
}

type TokenResp = { access_token?: string; refresh_token?: string; expires_in?: number; error?: string };

export async function exchangeCode(code: string): Promise<TokenResp> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    redirect_uri: redirectUri(),
    grant_type: "authorization_code",
  });
  const r = await fetch(TOKEN_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  return (await r.json()) as TokenResp;
}

export async function refreshAccessToken(refreshToken: string): Promise<string | null> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID || "",
    client_secret: process.env.GOOGLE_CLIENT_SECRET || "",
    grant_type: "refresh_token",
  });
  const r = await fetch(TOKEN_URL, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  if (!r.ok) return null;
  const j = (await r.json()) as TokenResp;
  return j.access_token || null;
}

export async function getEmail(accessToken: string): Promise<string | null> {
  try {
    const r = await fetch(USERINFO, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!r.ok) return null;
    const j = (await r.json()) as { email?: string };
    return j.email || null;
  } catch { return null; }
}

export type DriveFolder = { id: string; name: string };
export type DriveFile = { id: string; name: string; mimeType: string };

const driveGet = async (accessToken: string, path: string) =>
  fetch(`${DRIVE}${path}`, { headers: { authorization: `Bearer ${accessToken}` } });

// List folders: root-level by default, or matching a search term.
export async function listFolders(accessToken: string, query?: string): Promise<DriveFolder[]> {
  let q = "mimeType='application/vnd.google-apps.folder' and trashed=false";
  if (query && query.trim()) {
    const safe = query.replace(/'/g, "\\'");
    q += ` and name contains '${safe}'`;
  } else {
    q += " and 'root' in parents";
  }
  const url = `/files?q=${encodeURIComponent(q)}&fields=files(id,name)&pageSize=50&orderBy=name`;
  const r = await driveGet(accessToken, url);
  if (!r.ok) return [];
  const j = (await r.json()) as { files?: DriveFolder[] };
  return j.files || [];
}

export async function listFiles(accessToken: string, folderId: string): Promise<DriveFile[]> {
  const q = `'${folderId.replace(/'/g, "\\'")}' in parents and trashed=false`;
  const url = `/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType)&pageSize=200&orderBy=modifiedTime desc`;
  const r = await driveGet(accessToken, url);
  if (!r.ok) return [];
  const j = (await r.json()) as { files?: DriveFile[] };
  return j.files || [];
}

// List the real PHOTOS and VIDEOS in a folder (for the "Real Photos & Footage" pillars).
export type DriveMedia = { id: string; name: string; mimeType: string; kind: "image" | "video" | "audio"; thumbnailLink?: string };
export async function listMedia(accessToken: string, folderId: string): Promise<DriveMedia[]> {
  const q = `'${folderId.replace(/'/g, "\\'")}' in parents and trashed=false and (mimeType contains 'image/' or mimeType contains 'video/')`;
  const url = `/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType,thumbnailLink)&pageSize=200&orderBy=modifiedTime desc`;
  const r = await driveGet(accessToken, url);
  if (!r.ok) return [];
  const j = (await r.json()) as { files?: any[] };
  return (j.files || []).map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, kind: (f.mimeType || "").startsWith("video/") ? "video" : "image", thumbnailLink: f.thumbnailLink }));
}

// List the audio files in a folder (for the Audio library / audiograms).
export async function listAudio(accessToken: string, folderId: string): Promise<DriveMedia[]> {
  const q = `'${folderId.replace(/'/g, "\\'")}' in parents and trashed=false and mimeType contains 'audio/'`;
  const url = `/files?q=${encodeURIComponent(q)}&fields=files(id,name,mimeType)&pageSize=200&orderBy=modifiedTime desc`;
  const r = await driveGet(accessToken, url);
  if (!r.ok) return [];
  const j = (await r.json()) as { files?: any[] };
  return (j.files || []).map((f) => ({ id: f.id, name: f.name, mimeType: f.mimeType, kind: "audio" as const }));
}

// Stream a Drive file's bytes (image/video) — used to host the real media for preview + render.
export async function fetchDriveFile(accessToken: string, fileId: string): Promise<Response> {
  return driveGet(accessToken, `/files/${fileId.replace(/[^a-zA-Z0-9_-]/g, "")}?alt=media`);
}

// Pull readable text from a file (Google Docs export, plain text, markdown). Other types skipped.
export async function readDriveFileText(accessToken: string, f: DriveFile): Promise<string> {
  return readText(accessToken, f);
}
async function readText(accessToken: string, f: DriveFile): Promise<string> {
  try {
    if (f.mimeType === "application/vnd.google-apps.document") {
      const r = await driveGet(accessToken, `/files/${f.id}/export?mimeType=text/plain`);
      return r.ok ? await r.text() : "";
    }
    if (f.mimeType.startsWith("text/") || f.mimeType === "application/json") {
      const r = await driveGet(accessToken, `/files/${f.id}?alt=media`);
      return r.ok ? await r.text() : "";
    }
    return "";
  } catch { return ""; }
}

// Ingest a folder into one grounding string (capped), plus a quick inventory.
export async function ingestFolder(
  accessToken: string,
  folderId: string,
  maxChars = 9000
): Promise<{ sourceText: string; fileCount: number; textFiles: number }> {
  const files = await listFiles(accessToken, folderId);
  let out = "";
  let textFiles = 0;
  for (const f of files) {
    if (out.length >= maxChars) break;
    const t = (await readText(accessToken, f)).trim();
    if (t) {
      textFiles++;
      out += `\n\n### ${f.name}\n${t.slice(0, 2500)}`;
    }
  }
  return { sourceText: out.slice(0, maxChars).trim(), fileCount: files.length, textFiles };
}

export function encodeState(obj: Record<string, string>): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}
export function decodeState(s: string): Record<string, string> {
  try { return JSON.parse(Buffer.from(s, "base64url").toString()); } catch { return {}; }
}
