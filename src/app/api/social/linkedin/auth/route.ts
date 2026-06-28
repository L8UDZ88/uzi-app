import { NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { linkedinConfigured, linkedinAuthUrl, encodeState } from "@/lib/social";

export async function GET(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.redirect(new URL("/login", req.url));
  const { searchParams } = new URL(req.url);
  const campaignId = searchParams.get("campaignId") || "";
  if (!linkedinConfigured()) {
    return NextResponse.redirect(new URL(`/campaign/${campaignId}?social=unconfigured`, req.url));
  }
  return NextResponse.redirect(linkedinAuthUrl(encodeState({ campaignId, uid })));
}
