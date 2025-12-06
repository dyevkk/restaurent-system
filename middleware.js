// middleware.js (project root)
import { NextResponse } from 'next/server';

export function middleware(request) {
  const { pathname } = request.nextUrl;

  // Allow everything in these public paths without auth
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/qrcodes') ||
    pathname.startsWith('/public') ||
    pathname.startsWith('/order') ||   // customer ordering page
    pathname.startsWith('/t') ||       // redirect short links (see option B)
    pathname.startsWith('/print-qrcards.html') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/robots.txt') ||
    pathname.startsWith('/sitemap.xml')
  ) {
    return NextResponse.next();
  }

  // Protect admin routes only
  if (pathname.startsWith('/admin') || pathname.startsWith('/dashboard') || pathname.startsWith('/staff')) {
    // Example: check cookie set by Supabase or your auth
    const token = request.cookies.get('sb-access-token')?.value || request.cookies.get('supabase-auth-token')?.value;
    if (!token) {
      // redirect to your admin login page (not Vercel)
      const loginUrl = new URL('/auth/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Default: continue
  return NextResponse.next();
}

// Apply middleware only to potentially protected paths (speeds up processing)
export const config = {
  matcher: ['/admin/:path*', '/dashboard/:path*', '/staff/:path*', '/(.*)'] // we included (.*) to allow top-level passes; adjust if needed
};
