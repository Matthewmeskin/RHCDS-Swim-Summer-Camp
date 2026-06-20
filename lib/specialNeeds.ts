/**
 * Auto-detects whether a goals note flags a special-needs student.
 * Case-insensitive match on a small keyword list per the spec.
 */
const KEYWORDS = ["autism", "asd", "special needs", "adhd", "adapted"];

export function detectSpecialNeeds(goals: string | null | undefined): boolean {
  if (!goals) return false;
  const text = goals.toLowerCase();
  return KEYWORDS.some((kw) => {
    // Use word-ish boundaries for short acronyms to avoid false positives
    // (e.g. "asd" inside another word).
    if (kw === "asd" || kw === "adhd") {
      return new RegExp(`\\b${kw}\\b`, "i").test(goals);
    }
    return text.includes(kw);
  });
}
