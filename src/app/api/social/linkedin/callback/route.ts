import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { linkedinExchange, linkedinIdentity, decodeState } from "@/lib/social";

export async function GET(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.redirect(new URL("/login", req.url));
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const { campaignId } = decodeState(searchParams.get("state") || "");
  const back = `/campaign/${campaignId || ""}`;
  if (!code) return NextResponse.redirect(new URL(`${back}?social=error`, req.url));

  const tok = await linkedinExchange(code);
  if (!tok.access_token) return NextResponse.redirect(new URL(`${back}?social=error`, req.url));
  const id = await linkedinIdentity(tok.access_token);
  const expiresAt = tok.expires_in ? new Date(Date.now() + tok.expires_in * 1000) : null;

  await prisma.socialConnection.upsert({
    where: { userId_platform: { userId: uid, platform: "linkedin" } },
    update: { accessToken: tok.access_token, externalId: id.urn, displayName: id.name, expiresAt },
    create: { userId: uid, platform: "linkedin", accessToken: tok.access_token, externalId: id.urn, displayName: id.name, expiresAt },
  });
  return NextResponse.redirect(new URL(`${back}?social=linkedin`, req.url));
}
