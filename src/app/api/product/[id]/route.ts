import { prisma } from "@/lib/db";

// Serves a product PNG by URL (for canvas compositing + the render service overlay).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const p = await prisma.productImage.findUnique({ where: { id: params.id } });
  if (!p) return new Response("Not found", { status: 404 });
  const buf = Buffer.from(p.data, "base64");
  return new Response(buf, { headers: { "content-type": "image/png", "cache-control": "public, max-age=86400" } });
}
