import { describe, it, expect } from "vitest";
import { parseEnrollment } from "./parseEnrollment";

describe("parseEnrollment", () => {
  it("parses name, week, and lessons", () => {
    const csv = `First name,Last name,Week,Lessons
David,Tsai,1,3
Lincoln,Lynch,Week 2,2`;
    const { rows } = parseEnrollment(csv);
    expect(rows[0]).toEqual({ first_name: "David", last_name: "Tsai", week: 1, lessons: 3 });
    expect(rows[1]).toEqual({ first_name: "Lincoln", last_name: "Lynch", week: 2, lessons: 2 });
  });

  it("defaults lessons to 1 and week to null (all weeks)", () => {
    const csv = `Student,Sessions
Ellie Saba,`;
    const { rows } = parseEnrollment(csv);
    expect(rows[0]).toEqual({ first_name: "Ellie", last_name: "Saba", week: null, lessons: 1 });
  });

  it("warns on an unrecognized week", () => {
    const csv = `Name,Week,Days
Colin Han,Week 12,2`;
    const { rows, warnings } = parseEnrollment(csv);
    expect(rows[0].week).toBeNull();
    expect(rows[0].lessons).toBe(2);
    expect(warnings.length).toBe(1);
  });
});
