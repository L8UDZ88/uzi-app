import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import Dashboard from "@/components/Dashboard";

export default async function CampaignPage({ params }: { params: { id: string } }) {
  const uid = await getUserId();
  if (!uid) redirect("/login");
  const campaign = await prisma.brand.findUnique({
    where: { id: params.id },
    include: { schedule: { orderBy: { date: "asc" } } },
  });
  if (!campaign || campaign.userId !== uid) redirect("/dashboard");
  if (!campaign.onboarded) redirect(`/campaign/${campaign.id}/setup`);
  const slots = campaign.schedule.map((s) => ({
    id: s.id,
    date: s.date.toISOString().slice(0, 10),
    day: s.date.toLocaleDateString(undefined, { weekday: "short" }),
    pillar: s.pillar, channel: s.channel, format: (s as any).format || "",
    glyph: ({ LinkedIn: "in", X: "𝕏", YouTube: "▶", Instagram: "◎", Facebook: "f", TikTok: "♪", Podcast: "🎙" } as any)[s.channel] || "·",
    status: s.status,
    city: (s as any).city || null,
    externalUrl: (s as any).externalUrl || null,
  }));
  return <Dashboard campaign={campaign} campaignId={campaign.id} slots={slots} />;
}
