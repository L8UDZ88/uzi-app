// Social account OAuth — LinkedIn (OIDC). Direct REST, no SDK. Other platforms added behind
// the same shape as their API apps get approved.

export function linkedinConfigured(): boolean {
  return !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET && process.env.LINKEDIN_REDIRECT_URI);
}

const LI_AUTH = "https://www.linkedin.com/oauth/v2/authorization";
const LI_TOKEN = "https://www.linkedin.com/oauth/v2/accessToken";
const LI_USERINFO = "https://api.linkedin.com/v2/userinfo";
// openid+profile = identity; w_member_social = create posts.
const LI_SCOPE = "openid profile w_member_social";

export function linkedinAuthUrl(state: string): string {
  const p = new URLSearchParams({
    response_type: "code",
    client_id: process.env.LINKEDIN_CLIENT_ID || "",
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI || "",
    scope: LI_SCOPE,
    state,
  });
  return `${LI_AUTH}?${p.toString()}`;
}

export async function linkedinExchange(code: string): Promise<{ access_token?: string; expires_in?: number }> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: process.env.LINKEDIN_CLIENT_ID || "",
    client_secret: process.env.LINKEDIN_CLIENT_SECRET || "",
    redirect_uri: process.env.LINKEDIN_REDIRECT_URI || "",
  });
  const r = await fetch(LI_TOKEN, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body });
  return r.ok ? await r.json() : {};
}

export async function linkedinIdentity(accessToken: string): Promise<{ urn: string | null; name: string | null }> {
  try {
    const r = await fetch(LI_USERINFO, { headers: { authorization: `Bearer ${accessToken}` } });
    if (!r.ok) return { urn: null, name: null };
    const j = (await r.json()) as { sub?: string; name?: string };
    return { urn: j.sub ? `urn:li:person:${j.sub}` : null, name: j.name || null };
  } catch {
    return { urn: null, name: null };
  }
}

export function encodeState(obj: Record<string, string>): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}
export function decodeState(s: string): Record<string, string> {
  try { return JSON.parse(Buffer.from(s, "base64url").toString()); } catch { return {}; }
}
