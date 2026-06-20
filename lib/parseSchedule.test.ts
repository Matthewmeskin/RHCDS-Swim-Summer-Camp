import { describe, it, expect } from "vitest";
import {
  parseSchedule,
  normalizeTimeLabel,
  parseHeaderDate,
  splitStudentNames,
} from "./parseSchedule";

// A 3-instructor sample mirroring the Google Sheets export grid format.
const SAMPLE = `Quinn Kearns,,,,,,
Time,Jun-22,Jun-23,Jun-24,Jun-25,Jun-26
4:30 - 5:00,Charlotte Aguilar & Juliette Aguilar,Charlotte Aguilar & Juliette Aguilar,Charlotte Aguilar & Juliette Aguilar,Charlotte Aguilar & Juliette Aguilar,Charlotte Aguilar & Juliette Aguilar
5:00 - 5:30,,,,,
5:30 - 6:00,Delbert Hessick,,Delbert Hessick,,
,,,,,,
Aileen Ko,,,,,,
Time,Jun-22,Jun-23,Jun-24,Jun-25,Jun-26
4:30 - 5:00,X,,X,,X
5:00 - 5:30,X,,X,,X
5:30 - 6:00,X,,X,,X
,,,,,,
Megan Zelhart,,,,,,
Time,Jun-22,Jun-23,Jun-24,Jun-25,Jun-26
4:30 - 5:00,Ellie Saba & Colin Saba,,Ellie Saba and Colin Saba,Ellie Saba & Colin Saba,
5:00 - 5:30,,,,,
5:30 - 6:00,,,,,
`;

describe("normalizeTimeLabel", () => {
  it("handles dash-separated ranges", () => {
    expect(normalizeTimeLabel("4:30 - 5:00")).toBe("4:30");
    expect(normalizeTimeLabel("5:00-5:30")).toBe("5:00");
    expect(normalizeTimeLabel("5:30 – 6:00")).toBe("5:30");
  });
  it("handles a bare start time", () => {
    expect(normalizeTimeLabel("4:30")).toBe("4:30");
  });
  it("rejects non-slots", () => {
    expect(normalizeTimeLabel("Time")).toBeNull();
    expect(normalizeTimeLabel("7:00 - 7:30")).toBeNull();
  });
});

describe("parseHeaderDate", () => {
  it("parses Mon-DD tokens", () => {
    expect(parseHeaderDate("Jun-22", 2025)).toBe("2025-06-22");
    expect(parseHeaderDate("Jun 23", 2025)).toBe("2025-06-23");
    expect(parseHeaderDate("July 4", 2025)).toBe("2025-07-04");
  });
  it("parses numeric tokens", () => {
    expect(parseHeaderDate("6/22", 2025)).toBe("2025-06-22");
  });
  it("returns null on junk", () => {
    expect(parseHeaderDate("", 2025)).toBeNull();
    expect(parseHeaderDate("Student", 2025)).toBeNull();
  });
});

describe("splitStudentNames", () => {
  it("splits sibling pairs on & and and", () => {
    expect(splitStudentNames("Charlotte Aguilar & Juliette Aguilar")).toEqual([
      "Charlotte Aguilar",
      "Juliette Aguilar",
    ]);
    expect(splitStudentNames("Ellie Saba and Colin Saba")).toEqual([
      "Ellie Saba",
      "Colin Saba",
    ]);
  });
  it("leaves single names intact", () => {
    expect(splitStudentNames("Delbert Hessick")).toEqual(["Delbert Hessick"]);
  });
  it("does not split names containing 'and' as a substring", () => {
    expect(splitStudentNames("Landon Greenway")).toEqual(["Landon Greenway"]);
  });
});

describe("parseSchedule (3-instructor sample)", () => {
  const result = parseSchedule(SAMPLE, 2025);

  it("detects all three instructors in order", () => {
    expect(result.instructors).toEqual([
      "Quinn Kearns",
      "Aileen Ko",
      "Megan Zelhart",
    ]);
  });

  it("produces no warnings on clean input", () => {
    expect(result.warnings).toEqual([]);
  });

  it("expands sibling pairs into one lesson row per student", () => {
    const mondayKearns = result.lessons.filter(
      (l) =>
        l.instructorName === "Quinn Kearns" &&
        l.lessonDate === "2025-06-22" &&
        l.startTime === "16:30:00"
    );
    expect(mondayKearns).toHaveLength(1);
    expect(mondayKearns[0].studentNames).toEqual([
      "Charlotte Aguilar",
      "Juliette Aguilar",
    ]);
  });

  it("assigns correct start/end times per slot", () => {
    const hessick = result.lessons.find(
      (l) => l.cellRaw === "Delbert Hessick" && l.lessonDate === "2025-06-22"
    );
    expect(hessick).toBeDefined();
    expect(hessick!.startTime).toBe("17:30:00");
    expect(hessick!.endTime).toBe("18:00:00");
  });

  it("records X cells as unavailability, not lessons", () => {
    const koLessons = result.lessons.filter(
      (l) => l.instructorName === "Aileen Ko"
    );
    expect(koLessons).toHaveLength(0);

    const koOff = result.unavailable.filter(
      (u) => u.instructorName === "Aileen Ko"
    );
    // 3 days off (Jun 22, 24, 26) x 3 slots each = 9
    expect(koOff).toHaveLength(9);
    expect(koOff.every((u) => ["2025-06-22", "2025-06-24", "2025-06-26"].includes(u.lessonDate))).toBe(
      true
    );
  });

  it("ignores blank cells (no lesson, no unavailability)", () => {
    const kearnsFriday530 = result.lessons.filter(
      (l) =>
        l.instructorName === "Quinn Kearns" &&
        l.lessonDate === "2025-06-26" &&
        l.startTime === "17:30:00"
    );
    expect(kearnsFriday530).toHaveLength(0);
  });

  it("handles both & and 'and' sibling joiners in the same block", () => {
    const zelhart = result.lessons.filter(
      (l) => l.instructorName === "Megan Zelhart"
    );
    // Jun 22, 24, 25 each have the Saba pair = 3 lessons
    expect(zelhart).toHaveLength(3);
    for (const l of zelhart) {
      expect(l.studentNames).toEqual(["Ellie Saba", "Colin Saba"]);
    }
  });
});

describe("parseSchedule warnings", () => {
  it("warns on unparseable date headers", () => {
    const csv = `Bob Smith,,,,,,
Time,Notadate,Jun-23,,,
4:30 - 5:00,Kid One,Kid Two,,,
`;
    const result = parseSchedule(csv, 2025);
    expect(result.warnings.some((w) => w.type === "unparseable_date")).toBe(true);
    // The unparseable column is skipped, the valid one still parses.
    expect(result.lessons).toHaveLength(1);
    expect(result.lessons[0].lessonDate).toBe("2025-06-23");
  });

  it("warns on unrecognized time row labels", () => {
    const csv = `Bob Smith,,,,,,
Time,Jun-22,,,,
6:30 - 7:00,Late Kid,,,,
`;
    const result = parseSchedule(csv, 2025);
    expect(result.warnings.some((w) => w.type === "unknown_time")).toBe(true);
    expect(result.lessons).toHaveLength(0);
  });
});
