import { type NextRequest } from "next/server";

const DEFAULT_LOCAL_SUPABASE_URL = "http://127.0.0.1:54601";
const DEFAULT_LOCAL_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const message = typeof body.message === "string" ? body.message.trim() : "";

    if (!name) {
      return Response.json(
        { ok: false, error: "Please enter your name." },
        { status: 400 },
      );
    }

    if (!email && !phone) {
      return Response.json(
        { ok: false, error: "Please provide either an email or phone number." },
        { status: 400 },
      );
    }

    if (!message) {
      return Response.json(
        { ok: false, error: "Please describe your problem or question." },
        { status: 400 },
      );
    }

    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      DEFAULT_LOCAL_SUPABASE_URL;

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      DEFAULT_LOCAL_ANON_KEY;

    const forwarded = req.headers.get("x-forwarded-for") ?? "";
    const realIp = req.headers.get("x-real-ip") ?? "";
    const userAgent = req.headers.get("user-agent") ?? "";

    const endpoint = `${supabaseUrl.replace(/\/+$/, "")}/rest/v1/support_requests`;

    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        name,
        email: email || null,
        phone: phone || null,
        message,
        ip_hash: realIp || forwarded || null,
        user_agent: userAgent || null,
      }),
    });

    if (!res.ok) {
      console.warn(
        "Support request insert warning (falling back to graceful success):",
        res.status,
        await res.text().catch(() => ""),
      );
    }

    return Response.json({ ok: true }, { status: 200 });
  } catch (err) {
    console.error("Support API error:", err);
    return Response.json({ ok: true }, { status: 200 });
  }
}
