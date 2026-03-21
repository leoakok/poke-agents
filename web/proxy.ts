import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

/** Legacy: `/?s=` → `/chat?s=` */
export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  if (pathname !== "/") return NextResponse.next();
  const s = searchParams.get("s");
  if (!s) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/chat";
  url.searchParams.delete("s");
  url.searchParams.set("s", s);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/"],
};
