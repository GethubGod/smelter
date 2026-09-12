import { NextResponse } from "next/server";

const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);

function notFound(): NextResponse {
  return NextResponse.json({ error: "Not found." }, { status: 404 });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object";
}

export async function POST(request: Request): Promise<NextResponse> {
  const hostname = new URL(request.url).hostname;
  if (process.env.NODE_ENV !== "development" || !LOCAL_HOSTS.has(hostname)) {
    return notFound();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publicKey =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const entryToken = process.env.E2E_SUSHI_TOKEN;
  if (!supabaseUrl || !publicKey || !entryToken) {
    return NextResponse.json(
      { error: "Local test access is not configured." },
      { status: 503 },
    );
  }

  let response: Response;
  try {
    response = await fetch(
      `${supabaseUrl.replace(/\/$/, "")}/functions/v1/tip-entry-auth`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${publicKey}`,
          apikey: publicKey,
        },
        body: JSON.stringify({ action: "validate_token", token: entryToken }),
        cache: "no-store",
        referrerPolicy: "no-referrer",
      },
    );
  } catch {
    return NextResponse.json(
      { error: "Local test sign-in could not reach the server." },
      { status: 502 },
    );
  }

  const payload: unknown = await response.json().catch(() => null);
  const location = isRecord(payload) && isRecord(payload.location)
    ? payload.location
    : null;
  if (
    !response.ok ||
    !isRecord(payload) ||
    payload.ok !== true ||
    typeof payload.sessionToken !== "string" ||
    !payload.sessionToken ||
    !location ||
    typeof location.id !== "string" ||
    !location.id ||
    typeof location.name !== "string"
  ) {
    return NextResponse.json(
      { error: "Local test sign-in was rejected." },
      { status: 502 },
    );
  }

  return NextResponse.json(
    {
      token: payload.sessionToken,
      locationId: location.id,
      locationName: location.name,
      closerId: null,
      closerName: null,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
