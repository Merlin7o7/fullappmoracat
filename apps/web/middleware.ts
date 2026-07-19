import { NextResponse, type NextRequest } from "next/server";

/**
 * Edge route guard for the authenticated areas. The API is the real security
 * boundary (every /portal & /admin data call is JWT-checked server-side), but
 * this stops the app from serving protected shells to anonymous visitors and
 * bounces them to /login with a `next` param so they land back where they meant
 * to go. Presence is signalled by a non-secret `mrc_auth` cookie that the auth
 * provider sets on login and clears on logout (the tokens themselves stay in
 * localStorage; this cookie carries no secret).
 */
// The vet portal is protected too, EXCEPT its three public doors: a clinic
// applying to join, a staff member signing in, and an invited colleague
// accepting their invitation. Everything behind those is patient data.
const PROTECTED = [/^\/portal(\/|$)/, /^\/admin(\/|$)/, /^\/vet(\/|$)/];
const PUBLIC_VET = [/^\/vet\/login(\/|$)/, /^\/vet\/apply(\/|$)/, /^\/vet\/invite(\/|$)/];

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (PUBLIC_VET.some((re) => re.test(pathname))) return NextResponse.next();
  if (!PROTECTED.some((re) => re.test(pathname))) return NextResponse.next();

  const authed = req.cookies.get("mrc_auth")?.value === "1";
  if (authed) return NextResponse.next();

  const login = req.nextUrl.clone();
  // Clinic staff sign in at their own door, so the bounce keeps them in the
  // vet context instead of dropping them on the member login.
  login.pathname = pathname.startsWith("/vet") ? "/vet/login" : "/login";
  login.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/portal/:path*", "/admin/:path*", "/vet/:path*"],
};
