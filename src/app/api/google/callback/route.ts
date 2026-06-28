import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { exchangeCode, getEmail, decodeState } from "@/lib/google";

// Google redirects here after consent. Exchange the code, store the refresh token on the user.
export async function GET(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.redirect(new URL("/login", req.url));
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const err = searchParams.get("error");
  const { campaignId } = decodeState(searchParams.get("state") || "");
  const back = `/campaign/${campaignId || ""}/setup`;

  if (err || !code) return NextResponse.redirect(new URL(`${back}?drive=error`, req.url));

  const tok = await exchangeCode(code);
  if (!tok.access_token) return NextResponse.redirect(new URL(`${back}?drive=error`, req.url));

  const email = await getEmail(tok.access_token);
  const data: { googleEmail?: string; googleRefreshToken?: string } = {};
  if (email) data.googleEmail = email;
  // refresh_token only comes back on first consent; keep the existing one if absent.
  if (tok.refresh_token) data.googleRefreshToken = tok.refresh_token;
  if (Object.keys(data).length) await prisma.user.update({ where: { id: uid }, data });

  return NextResponse.redirect(new URL(`${back}?drive=connected`, req.url));
}
