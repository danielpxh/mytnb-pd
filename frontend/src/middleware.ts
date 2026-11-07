import { NextRequest, NextResponse } from "next/server";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export function middleware(request: NextRequest) {
  const trustProxyHeaders = process.env.TRUST_PROXY_HEADERS === "true";
  const forwardedProtocol = trustProxyHeaders
    ? request.headers.get("x-forwarded-proto")?.split(",")[0].trim()
    : undefined;
  const protocol =
    forwardedProtocol ?? request.nextUrl.protocol.replace(/:$/, "");
  const forwardedHost = trustProxyHeaders
    ? request.headers.get("x-forwarded-host")?.split(",")[0].trim()
    : undefined;
  const host = forwardedHost ?? request.headers.get("host") ?? request.nextUrl.host;

  let hostname: string;
  try {
    hostname = new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return NextResponse.json({ detail: "Invalid host header." }, { status: 400 });
  }

  if (protocol !== "https" && !LOCAL_HOSTS.has(hostname)) {
    return NextResponse.json(
      { detail: "Sign-in requires HTTPS outside local development." },
      { status: 426 },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/auth/login"],
};
