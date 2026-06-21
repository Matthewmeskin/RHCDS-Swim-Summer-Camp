import { describe, it, expect } from "vitest";
import { autoAssignWeek, computePrior } from "./autoSchedule";
import { BUILDER_SLOTS, cellKey } from "./builder";
import type { Instructor, Student } from "./types";

function instr(id: string): Instructor {
  return { id, name: id, slug: id, email: null, role: "instructor" };
}
function stud(id: string, first: string, last: string, extra: Partial<Student> = {}): Student {
  return {
    id, first_name: first, last_name: last, gender: null, age: null, level: null,
    goals: null, special_needs: false, parent_notes: null, staff_notes: null,
    preferred_instructor_id: null, group_level: null, active: true, ...extra,
  };
}

const D1 = "2026-06-22";
const base = {
  days: [D1],
  offCells: new Set<string>(),
  requestedByStudent: {} as Record<string, { instructorId: string }>,
  priorByStudent: {} as Record<string, string>,
};

describe("autoAssignWeek", () => {
  it("places kids into distinct cells respecting the ratio cap", () => {
    const { assignments, report } = autoAssignWeek({
      ...base,
      instructors: [instr("i1")],
      students: [stud("s1", "A", "One"), stud("s2", "B", "Two")],
      assignments: {},
      config: { lessonsPerKid: 1, maxPerSlot: 1, mode: "rebuild" },
    });
    expect(report.placed).toBe(2);
    expect(report.unplaced).toHaveLength(0);
    const cells = Object.values(assignments).filter((v) => v.length);
    expect(cells).toHaveLength(2); // maxPerSlot=1 -> two separate cells
  });

  it("honors a parent-requested instructor", () => {
    const { assignments } = autoAssignWeek({
      ...base,
      instructors: [instr("i1"), instr("i2")],
      students: [stud("s1", "A", "One")],
      assignments: {},
      requestedByStudent: { s1: { instructorId: "i2" } },
      config: { lessonsPerKid: 1, maxPerSlot: 2, mode: "rebuild" },
    });
    const placedKey = Object.keys(assignments).find((k) => assignments[k].includes("s1"))!;
    expect(placedKey.startsWith("i2__")).toBe(true);
  });

  it("never uses an Off slot", () => {
    // i1 is off for every slot on D1 -> kid can't be placed with i1.
    const off = new Set(BUILDER_SLOTS.map((s) => cellKey("i1", D1, s.start)));
    const { assignments } = autoAssignWeek({
      ...base,
      offCells: off,
      instructors: [instr("i1"), instr("i2")],
      students: [stud("s1", "A", "One")],
      assignments: {},
      config: { lessonsPerKid: 1, maxPerSlot: 2, mode: "rebuild" },
    });
    const placedKey = Object.keys(assignments).find((k) => assignments[k].includes("s1"))!;
    expect(placedKey.startsWith("i2__")).toBe(true);
  });

  it("keeps siblings with the same instructor", () => {
    const { assignments } = autoAssignWeek({
      ...base,
      instructors: [instr("i1"), instr("i2")],
      students: [stud("s1", "Ellie", "Saba"), stud("s2", "Colin", "Saba")],
      assignments: {},
      config: { lessonsPerKid: 1, maxPerSlot: 2, mode: "rebuild" },
    });
    const k1 = Object.keys(assignments).find((k) => assignments[k].includes("s1"))!;
    const k2 = Object.keys(assignments).find((k) => assignments[k].includes("s2"))!;
    expect(k1.split("__")[0]).toBe(k2.split("__")[0]); // same instructor
  });
});

describe("computePrior", () => {
  it("takes the most recent prior week's instructor", () => {
    const dateToWeek = { "2026-06-22": 1, "2026-06-29": 2 };
    const assignments = {
      [cellKey("i1", "2026-06-22", "16:30:00")]: ["s1"],
      [cellKey("i2", "2026-06-29", "16:30:00")]: ["s1"],
    };
    expect(computePrior(assignments, dateToWeek, 3)).toEqual({ s1: "i2" });
    expect(computePrior(assignments, dateToWeek, 2)).toEqual({ s1: "i1" });
  });
});
