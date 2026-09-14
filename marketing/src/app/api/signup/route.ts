import { type NextRequest } from "next/server";

const DEFAULT_LOCAL_SUPABASE_URL = "http://127.0.0.1:54601";
const DEFAULT_LOCAL_PUBLISHABLE_KEY = "sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      DEFAULT_LOCAL_SUPABASE_URL;

    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      DEFAULT_LOCAL_PUBLISHABLE_KEY;

    const forwarded = req.headers.get("x-forwarded-for") ?? "";
    const realIp = req.headers.get("x-real-ip") ?? "";
    const userAgent = req.headers.get("user-agent") ?? "";

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (supabaseKey) {
      headers["apikey"] = supabaseKey;
      headers["Authorization"] = `Bearer ${supabaseKey}`;
    }
    if (forwarded) {
      headers["x-forwarded-for"] = forwarded;
    }
    if (realIp) {
      headers["x-real-ip"] = realIp;
    }
    if (userAgent) {
      headers["user-agent"] = userAgent;
    }

    const endpoint = `${supabaseUrl.replace(/\/+$/, "")}/functions/v1/request-workspace`;

    const upstreamRes = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    const data = await upstreamRes.json().catch(() => null);

    if (upstreamRes.status === 429) {
      return Response.json(
        { ok: false, error: "rate_limited" },
        { status: 429 },
      );
    }

    if (!upstreamRes.ok) {
      return Response.json(
        {
          ok: false,
          error:
            data && typeof data.error === "string"
              ? data.error
              : "Unable to process request",
        },
        { status: upstreamRes.status },
      );
    }

    return Response.json(data ?? { ok: true }, { status: 200 });
  } catch (err) {
    console.error("Signup API error:", err);
    return Response.json(
      { ok: false, error: "Internal server error" },
      { status: 500 },
    );
  }
}
