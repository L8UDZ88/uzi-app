import { prisma } from "@/lib/db";

// Serves a generated asset (e.g. voiceover mp3) by URL so the render service can fetch it.
// Public on purpose (opaque cuid id); contains no sensitive data.
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const a = await prisma.renderAsset.findUnique({ where: { id: params.id } });
  if (!a) return new Response("Not found", { status: 404 });
  const buf = Buffer.from(a.data, "base64");
  return new Response(buf, {
    headers: { "content-type": a.mime, "cache-control": "public, max-age=86400" },
  });
}
