import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { generateAvatarVideo, avatarEnabled } from "@/lib/avatar";

export const maxDuration = 60;

// Make a talking-avatar video: a presenter photo (kind "avatar") lip-synced to a (trimmed) audio URL.
export async function POST(req: Request) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!avatarEnabled()) return NextResponse.json({ error: "Avatar isn't enabled — add FAL_KEY." }, { status: 400 });

  const { campaignId, audioUrl, avatarImageId } = await req.json();
  if (!campaignId || !audioUrl) return NextResponse.json({ error: "Missing audio" }, { status: 400 });
  const c = await prisma.brand.findUnique({ where: { id: campaignId } });
  if (!c || c.userId !== uid) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const av = avatarImageId
    ? await prisma.productImage.findUnique({ where: { id: avatarImageId } })
    : await prisma.productImage.findFirst({ where: { brandId: campaignId, kind: "avatar" } });
  if (!av || av.brandId !== campaignId) {
    return NextResponse.json({ error: "Upload a presenter photo (Connect Your Brain → Presenter photo) to enable avatar videos." }, { status: 400 });
  }

  const imageUrl = `data:image/png;base64,${av.data}`;
  const r = await generateAvatarVideo(imageUrl, String(audioUrl));
  if (!r.video) return NextResponse.json({ error: r.error || "Avatar generation failed." }, { status: 502 });
  return NextResponse.json({ videoUrl: r.video });
}
