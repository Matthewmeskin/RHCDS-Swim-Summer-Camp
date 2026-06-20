import { NextResponse } from "next/server";

/**
 * Forwards availability events to an n8n webhook, which fans them out to
 * Slack + Gmail. Two event types:
 *   - { type: "request", instructor, slug, week, offCount, email, phone, note }
 *       → notify the office that an instructor requested a change.
 *   - { type: "decision", instructor, slug, week, status, email, decisionNote }
 *       → alert the instructor that their request was approved/denied.
 *
 * Env (Vercel):
 *   N8N_AVAILABILITY_WEBHOOK — the n8n Webhook URL. Without it, this no-ops.
 *   NEXT_PUBLIC_SITE_URL     — used to build links (optional).
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "bad json" }, { status: 400 });
  }

  const webhook = process.env.N8N_AVAILABILITY_WEBHOOK;
  if (!webhook) {
    // Not wired up yet — succeed quietly so the user action isn't affected.
    return NextResponse.json({ ok: true, skipped: "no N8N_AVAILABILITY_WEBHOOK" });
  }

  const base =
    process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get("host") ?? ""}`;
  const slug = typeof body.slug === "string" ? body.slug : "";
  const week = body.week ?? "";
  const payload = {
    ...body,
    instructorLink: slug ? `${base}/instructor/${slug}?week=${week}` : base,
    adminLink: `${base}/admin/requests`,
    sentAt: new Date().toISOString(),
  };

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: await res.text() }, { status: 502 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: (e as Error).message }, { status: 502 });
  }
}
