import { describe, it, expect } from "vitest";
import { parsePreferences } from "./parsePreferences";

describe("parsePreferences", () => {
  it("parses first/last + instructor + notes columns", () => {
    const csv = `First name,Last name,Preferred instructor,Parent notes
Grace,Lovrich,Maya R.,Loved her last year
Johnny,Burgoon,Steven,Please pair with Steven again`;
    const { rows } = parsePreferences(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      first_name: "Grace",
      last_name: "Lovrich",
      preferred_instructor_raw: "Maya R.",
      parent_notes: "Loved her last year",
    });
  });

  it("auto-detects a single full-name column and alternate headers", () => {
    const csv = `Student,Coach,Comments
Ellie Saba,,Shares a slot with her brother
Blythe Guerra-Genc,Katherine Marley,No sweets analogies`;
    const { rows } = parsePreferences(csv);
    expect(rows[0]).toMatchObject({ first_name: "Ellie", last_name: "Saba" });
    expect(rows[1]).toMatchObject({
      first_name: "Blythe",
      last_name: "Guerra-Genc",
      preferred_instructor_raw: "Katherine Marley",
    });
  });

  it("skips rows with neither a preference nor notes", () => {
    const csv = `First name,Last name,Preferences
Nobody,Here,`;
    const { rows, warnings } = parsePreferences(csv);
    expect(rows).toHaveLength(0);
    expect(warnings.length).toBe(1);
  });
});
