import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { authUrl, googleConfigured, encodeState } from "@/lib/google";

// Kick off Google OAuth. Redirects the user to Google's consent screen.
export async function GET(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.redirect(new URL("/login", req.url));
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId") || "";
  const back = `/campaign/${campaignId}/setup`;
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL(`${back}?drive=unconfigured`, req.url));
  }
  const state = encodeState({ campaignId, uid });
  return NextResponse.redirect(authUrl(state));
}
