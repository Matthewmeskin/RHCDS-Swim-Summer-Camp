/**
 * The camp's 6 swim groups (from the Instructor Training guide). Emoji + color
 * are fixed here so the UI is consistent; the teaching content for each level
 * lives in the `swim_levels` table and is editable in the admin Level Guide.
 */
export interface SwimGroup {
  level: number;
  name: string;
  emoji: string;
  color: string; // hex, for pills/badges
}

export const SWIM_GROUPS: SwimGroup[] = [
  { level: 1, name: "Red Octopus", emoji: "🐙", color: "#E4572E" },
  { level: 2, name: "Orange Clownfish", emoji: "🐠", color: "#F2994A" },
  { level: 3, name: "Yellow Stingrays", emoji: "🐟", color: "#E0A800" },
  { level: 4, name: "Green Sea Turtles", emoji: "🐢", color: "#407A5B" },
  { level: 5, name: "Blue Dolphins", emoji: "🐬", color: "#648EAA" },
  { level: 6, name: "Purple Sharks", emoji: "🦈", color: "#7E5B9C" },
];

export function groupByLevel(level: number | null | undefined): SwimGroup | null {
  if (level == null) return null;
  return SWIM_GROUPS.find((g) => g.level === level) ?? null;
}

/** "🐬 Blue Dolphins" or "" when unassigned. */
export function groupLabel(level: number | null | undefined): string {
  const g = groupByLevel(level);
  return g ? `${g.emoji} ${g.name}` : "";
}
