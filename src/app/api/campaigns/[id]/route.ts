import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";

async function owned(uid: string, id: string) {
  const c = await prisma.brand.findUnique({ where: { id } });
  return c && c.userId === uid ? c : null;
}

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const campaign = await owned(uid, params.id);
  if (!campaign) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ campaign });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await owned(uid, params.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await req.json();
  const campaign = await prisma.brand.update({
    where: { id: params.id },
    data: {
      campaignType: b.campaignType, name: b.name, handle: b.handle, tagline: b.tagline,
      region: b.region, voice: b.voice, pillars: b.pillars, channels: b.channels,
      inputs: b.inputs, cadence: b.cadence, omni: b.omni, onboarded: b.onboarded,
    },
  });
  return NextResponse.json({ campaign });
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const uid = await getUserId();
  if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await owned(uid, params.id))) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.brand.delete({ where: { id: params.id } }); // cascades schedule + assets
  return NextResponse.json({ ok: true });
}
