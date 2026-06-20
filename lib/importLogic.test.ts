import { describe, it, expect } from "vitest";
import { detectSpecialNeeds } from "./specialNeeds";
import { matchStudent, type MatchableStudent } from "./matchStudent";
import { parseStudents } from "./parseStudents";

describe("detectSpecialNeeds", () => {
  it("flags keyword matches case-insensitively", () => {
    expect(detectSpecialNeeds("Has mild Autism spectrum disorder")).toBe(true);
    expect(detectSpecialNeeds("Instructors with ASD experience preferred")).toBe(true);
    expect(detectSpecialNeeds("High-functioning special needs young adult")).toBe(true);
    expect(detectSpecialNeeds("Has ADHD and needs reinforcement")).toBe(true);
    expect(detectSpecialNeeds("participates in adapted sports")).toBe(true);
  });
  it("does not flag plain goals", () => {
    expect(detectSpecialNeeds("Work on freestyle and back float")).toBe(false);
    expect(detectSpecialNeeds("")).toBe(false);
    expect(detectSpecialNeeds(null)).toBe(false);
  });
  it("does not false-positive on substrings of other words", () => {
    // "asd" inside "basildon" should not match the \basd\b boundary
    expect(detectSpecialNeeds("loves the basildon pool")).toBe(false);
  });
});

describe("matchStudent", () => {
  const students: MatchableStudent[] = [
    { id: "1", first_name: "Julian", last_name: "Di Pietra" },
    { id: "2", first_name: "Matteo", last_name: "Di Pietra" },
    { id: "3", first_name: "Ellie", last_name: "Saba" },
    { id: "4", first_name: "Ellie", last_name: "Sapien" },
    { id: "5", first_name: "Gavin", last_name: "De La Cruz" },
  ];

  it("matches on first + last name exactly", () => {
    const r = matchStudent("Ellie Saba", students);
    expect(r.student?.id).toBe("3");
    expect(r.confidence).toBe("exact");
  });

  it("disambiguates duplicate first names by last name", () => {
    expect(matchStudent("Ellie Sapien", students).student?.id).toBe("4");
    expect(matchStudent("Matteo Di Pietra", students).student?.id).toBe("2");
  });

  it("matches a unique first name even without a last name", () => {
    const r = matchStudent("Gavin", students);
    expect(r.student?.id).toBe("5");
    expect(r.confidence).toBe("first");
  });

  it("handles multi-word last names", () => {
    expect(matchStudent("Gavin De La Cruz", students).student?.id).toBe("5");
  });

  it("returns none for an unknown name", () => {
    const r = matchStudent("Zelda Nobody", students);
    expect(r.student).toBeNull();
    expect(r.confidence).toBe("none");
  });
});

describe("parseStudents", () => {
  const csv = `Last name,First name,Gender,Age,Level,Goals for Lessons
Egertson,Ellis,Male,7,Non-Swimmer,Ellis has mild autism spectrum disorder and loves the pool.
Tsai,David,Male,6,Beginner,Be able to submerge head underwater.
Park,Luna,Female,4,Non-Swimmer,`;

  it("parses rows with correct fields", () => {
    const { students } = parseStudents(csv);
    expect(students).toHaveLength(3);
    expect(students[1]).toMatchObject({
      first_name: "David",
      last_name: "Tsai",
      age: 6,
      level: "Beginner",
    });
  });

  it("auto-detects special needs from goals", () => {
    const { students } = parseStudents(csv);
    expect(students[0].special_needs).toBe(true);
    expect(students[1].special_needs).toBe(false);
  });

  it("handles empty goals and missing age gracefully", () => {
    const { students } = parseStudents(csv);
    expect(students[2].goals).toBe("");
    expect(students[2].special_needs).toBe(false);
  });
});
