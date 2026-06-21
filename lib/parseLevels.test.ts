import { describe, it, expect } from "vitest";
import { parseLevels, resolveGroupLevel } from "./parseLevels";

describe("resolveGroupLevel", () => {
  it("reads numbers and level phrases", () => {
    expect(resolveGroupLevel("3")).toBe(3);
    expect(resolveGroupLevel("Level 5")).toBe(5);
    expect(resolveGroupLevel("L2")).toBe(2);
    expect(resolveGroupLevel("Group 6")).toBe(6);
  });
  it("reads animal names", () => {
    expect(resolveGroupLevel("Red Octopus")).toBe(1);
    expect(resolveGroupLevel("clown fish")).toBe(2);
    expect(resolveGroupLevel("Yellow Stingrays")).toBe(3);
    expect(resolveGroupLevel("Sea Turtles")).toBe(4);
    expect(resolveGroupLevel("Dolphins")).toBe(5);
    expect(resolveGroupLevel("Purple Sharks")).toBe(6);
  });
  it("returns null for unknown / out-of-range", () => {
    expect(resolveGroupLevel("Beginner")).toBeNull();
    expect(resolveGroupLevel("9")).toBeNull();
    expect(resolveGroupLevel("")).toBeNull();
  });
});

describe("parseLevels", () => {
  it("matches name + group columns and warns on bad values", () => {
    const csv =
      "Name,Group\nAva Smith,Dolphins\nBen Lee,3\nCai Wu,Beginner\n";
    const { rows, warnings } = parseLevels(csv);
    expect(rows).toEqual([
      { first_name: "Ava", last_name: "Smith", group_level: 5 },
      { first_name: "Ben", last_name: "Lee", group_level: 3 },
    ]);
    expect(warnings.length).toBe(1);
  });
});
