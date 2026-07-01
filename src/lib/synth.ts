// Native, source-grounded synthesis (the "NotebookLM step", done in-house with Claude).
// Distills the brand's raw source material (documents + transcripts + brain folder) into a tight,
// reusable content brain that grounds all future copy. Falls back to the raw text if unavailable.
export async function synthesizeBrain(raw: string, brandName: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  const trimmed = (raw || "").trim();
  if (!key || !trimmed) return trimmed.slice(0, 12000);
  const system = `You are a brand strategist. Distill the raw source material into a tight, reusable "content brain" that will ground all future social copy for ${brandName || "the brand"}. Use ONLY what's in the sources — never invent facts.`;
  const user =
    `Raw source material (documents, transcripts, notes):\n<sources>\n${trimmed.slice(0, 24000)}\n</sources>\n\n` +
    `Produce a concise structured brief with these sections (bullet points, factual):\n` +
    `- Core message / positioning\n- Key offers / products\n- Proof points, metrics, results\n- Signature phrases / quotable lines (verbatim where strong)\n- Audience & their pains\n- Voice & tone notes\n\nKeep it under ~600 words.`;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 1500, temperature: 0.3, system, messages: [{ role: "user", content: user }] }),
    });
    if (!res.ok) return trimmed.slice(0, 12000);
    const data: any = await res.json();
    const text: string = (data.content || []).map((b: any) => (b.type === "text" ? b.text : "")).join("").trim();
    return text || trimmed.slice(0, 12000);
  } catch {
    return trimmed.slice(0, 12000);
  }
}
