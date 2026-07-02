// The Story Arc — the sequencing spine. Reduced Hero Frame, phased into 4 S's (Start/Struggle/
// Success/Service). PHYSICAL = 6-beat arc (1/2/2/1). DIGITAL = 12-beat arc (3 per S).
// Each beat maps to a pillar (which produces the post) + the Hero Frame inputs that feed its copy.
// The campaign advances ONE beat per posting slot, cycles the arc, and escalates each loop.

export type Phase = "Start" | "Struggle" | "Success" | "Service";
export type Beat = {
  id: string;
  name: string;
  phase: Phase;
  job: string;        // the narrative job of this beat (drives the copy angle)
  keys: string[];     // Hero Frame input ids that feed this beat
  pillar: string;     // the pillar (by name) that produces this beat
  alts?: string[];    // alternate pillars rotated in on later loops (variety)
};

// PHYSICAL — 6 beats, phased 1 / 2 / 2 / 1.
export const ARC_PHYSICAL: Beat[] = [
  { id: "ordinary", name: "Ordinary World", phase: "Start", job: "Establish the hero (the customer) and the world/dream they live in.", keys: ["hero", "dream"], pillar: "Ambient film" },
  { id: "tension", name: "The Tension", phase: "Struggle", job: "The dream blocked — the everyday/old way the product elevates; the cost of staying stuck.", keys: ["obstacle", "cost", "enemy"], pillar: "Store → lifestyle bridge" },
  { id: "hinge", name: "The Hinge", phase: "Struggle", job: "The product as the one thing that changes everything.", keys: ["mechanism"], pillar: "AI Showcase" },
  { id: "system", name: "The System", phase: "Success", job: "Not luck — it's real and it works; proof it exists.", keys: ["system", "causality", "conditions"], pillar: "Real Photos & Footage" },
  { id: "momentum", name: "The Momentum", phase: "Success", job: "People finding it and buying it — it's spreading; the scoreboard.", keys: ["multiplier", "scoreboard", "inputs"], pillar: "Spotted at", alts: ["Transaction", "Now in [city]"] },
  { id: "call", name: "The Call", phase: "Service", job: "Choose now — where to get it.", keys: ["call"], pillar: "Locator", alts: ["Now in [city]"] },
];

// DIGITAL — 12 beats, 3 per S.
export const ARC_DIGITAL: Beat[] = [
  { id: "hero", name: "Address the Hero", phase: "Start", job: "Speak to the customer and the future/dream they want.", keys: ["hero", "dream"], pillar: "The Customer's World" },
  { id: "tension", name: "The Tension", phase: "Start", job: "Name the pain / the broken old way in their world.", keys: ["obstacle", "enemy"], pillar: "The Obstacle" },
  { id: "cost", name: "The Cost", phase: "Start", job: "What staying stuck actually costs them, in specifics.", keys: ["cost"], pillar: "The Obstacle", alts: ["Proof of Crossing"] },
  { id: "hinge", name: "The Hinge", phase: "Struggle", job: "The contrarian insight / the one thing that changes everything.", keys: ["mechanism"], pillar: "The Turning Point" },
  { id: "optimality", name: "Picture Optimality", phase: "Struggle", job: "What the after-state looks like when success is inevitable.", keys: ["conditions", "dream"], pillar: "The Dream", alts: ["The New World"] },
  { id: "required", name: "What's Required", phase: "Struggle", job: "The structures/inputs that make the outcome predictable.", keys: ["conditions", "inputs"], pillar: "The System", alts: ["The Call"] },
  { id: "causality", name: "The Causality", phase: "Success", job: "The cause→effect formula that drives the outcome.", keys: ["causality"], pillar: "The System", alts: ["The Turning Point"] },
  { id: "system", name: "System not Luck", phase: "Success", job: "Show it actually working — deploy the machine, not motivation.", keys: ["system"], pillar: "The System" },
  { id: "multiplier", name: "The Multiplier", phase: "Success", job: "Customer wins and metrics — the system multiplies.", keys: ["multiplier", "scoreboard"], pillar: "Proof of Crossing" },
  { id: "leverage", name: "The Leverage", phase: "Service", job: "Inputs → output → transformation; the leverage made tangible.", keys: ["inputs", "multiplier"], pillar: "The System", alts: ["Proof of Crossing"] },
  { id: "scoreboard", name: "The Scoreboard", phase: "Service", job: "The game/metrics they can measure and win, repeatedly.", keys: ["scoreboard"], pillar: "Proof of Crossing", alts: ["The Call"] },
  { id: "call", name: "The Call", phase: "Service", job: "How to begin — the specific choice, friction removed.", keys: ["call"], pillar: "The Call" },
];

export function arcFor(campaignType?: string): Beat[] {
  return campaignType === "physical" ? ARC_PHYSICAL : ARC_DIGITAL;
}

// The pillar that carries a beat on a given loop — rotates through [pillar, ...alts] for variety.
export function pillarForBeat(beat: Beat, loop: number): string {
  const options = [beat.pillar, ...(beat.alts || [])];
  return options[loop % options.length];
}
