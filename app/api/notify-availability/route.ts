import { NextResponse } from "next/server";

/**
 * Sends an email to the aquatics office when an instructor updates their
 * availability. Uses Resend (https://resend.com) via its REST API.
 *
 * Env (set on Vercel):
 *   RESEND_API_KEY   — required to actually send; without it this no-ops.
 *   NOTIFY_TO        — recipient (defaults to swim@rhcds.com)
 *   NOTIFY_FROM      — verified sender (defaults to Resend's test sender)
 *   NEXT_PUBLIC_SITE_URL — used to build the link (optional)
 */
export async function POST(req: Request) {
  let body: { instructor?: string; slug?: string; week?: number; offCount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    // Not configured yet — succeed quietly so the instructor's save isn't affected.
    return NextResponse.json({ ok: true, skipped: "no RESEND_API_KEY" });
  }

  const to = process.env.NOTIFY_TO || "swim@rhcds.com";
  const from = process.env.NOTIFY_FROM || "Swim Portal <onboarding@resend.dev>";
  const instructor = body.instructor || "An instructor";
  const week = body.week ?? "—";
  const offCount = body.offCount ?? 0;

  const base =
    process.env.NEXT_PUBLIC_SITE_URL ||
    `https://${req.headers.get("host") ?? ""}`;
  const link = body.slug ? `${base}/instructor/${body.slug}?week=${week}` : base;

  const subject = `Availability updated: ${instructor} — Week ${week}`;
  const html = `
    <div style="font-family:system-ui,sans-serif;color:#2C2C2C">
      <h2 style="color:#407A5B;margin:0 0 8px">Availability updated</h2>
      <p><strong>${instructor}</strong> updated their availability for
      <strong>Week ${week}</strong> (${offCount} slot${offCount === 1 ? "" : "s"} marked off).</p>
      <p><a href="${link}" style="color:#407A5B">View their schedule →</a></p>
      <p style="color:#888;font-size:12px">Country Day Camp Swim Portal</p>
    </div>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ ok: false, error: text }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
