import { describe, it, expect } from "vitest";
import { detectRequestedInstructor } from "./builder";
import type { Instructor } from "./types";

const instructors: Instructor[] = [
  ["Maya Rosales", "maya-rosales"],
  ["Katherine Marley", "katherine-marley"],
  ["Drew Zane", "drew-zane"],
  ["Drew Friscancho", "drew-friscancho"],
  ["Ellie Pizer", "ellie-pizer"],
  ["Grace MacInnis", "grace-macinnis"],
].map(([name, slug]) => ({
  id: slug,
  name,
  slug,
  email: null,
  role: "instructor" as const,
}));

describe("detectRequestedInstructor", () => {
  it("matches a unique first name (Maya R.)", () => {
    const r = detectRequestedInstructor(
      "Continue swim lessons with Ava or Maya R. if they are available",
      instructors
    );
    expect(r?.name).toBe("Maya Rosales");
  });

  it("matches a full name", () => {
    const r = detectRequestedInstructor(
      "Would love to be paired with Katherine Marley again",
      instructors
    );
    expect(r?.name).toBe("Katherine Marley");
  });

  it("returns null for a non-instructor name", () => {
    expect(
      detectRequestedInstructor("Last year Johnny's coach was Steven", instructors)
    ).toBeNull();
    expect(
      detectRequestedInstructor("Worked with Josh Scaglione last year", instructors)
    ).toBeNull();
  });

  it("does not guess on an ambiguous first name (two Drews)", () => {
    expect(detectRequestedInstructor("hoping for Drew again", instructors)).toBeNull();
  });

  it("returns null when no instructor is mentioned", () => {
    expect(detectRequestedInstructor("Just wants to be water safe", instructors)).toBeNull();
    expect(detectRequestedInstructor("", instructors)).toBeNull();
  });
});
