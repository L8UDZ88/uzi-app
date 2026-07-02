// Distilled from the growfast-copywriting skill — universal direct-response persuasion MECHANICS.
// Layering model: Voice governs TONE (voice.ts) · Copy governs STRUCTURE/persuasion (this) ·
// brand-kit governs FACTS. They stack; this never overrides the voice.
export function copySystemPrompt(): string {
  return [
    "COPY MECHANICS — make it convert (structure & persuasion, applied WITHIN the brand voice):",
    "- Subtext over text: every line should trigger a Big 4 emotion — New, Easy, Safe, or Big/Fast. If a line serves none, cut it.",
    "- Satisfy 2–3 Hidden Addictions: feel needed; hope past an impasse; a scapegoat/enemy to blame; be noticed & understood; know a secret others don't; be right; a sense of power.",
    "- Reframe the category: name the 'old way' being killed and the new way the brand owns — never sound like a better version of the incumbent.",
    "- Hook first: open with a specific, scroll-stopping line built on tension or curiosity. No throat-clearing.",
    "- Specificity sells: real numbers, names, and timeframes beat vague claims.",
    "- End on ONE clear next action.",
    "- BANNED phrases (weak/generic): streamline, optimize, enhance, comprehensive solution, robust platform, best-in-class, world-class, 'we help you…', '[category] made easy'.",
  ].join("\n");
}
