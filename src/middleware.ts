import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const DEFAULT_SUPABASE_URL = 'https://fxkmsehoakkfpdxiglki.supabase.co';
const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4a21zZWhvYWtrZnBkeGlnbGtpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0ODI1ODksImV4cCI6MjA5OTA1ODU4OX0.G1IOJViyEM-WBWmL1_WWliapXnV6UbjT3NuzOw-_Qb4';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const pathname = request.nextUrl.pathname;

  // Public paths accessible without authentication
  const isAuthPath = pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname.startsWith('/auth');
  const isStaticAsset = pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

  try {
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    // Timeout protection: If Supabase auth takes > 1200ms in Vercel Edge, fail-safe to avoid 504 timeout
    const authPromise = supabase.auth.getUser();
    const timeoutPromise = new Promise<{ data: { user: null } }>((resolve) =>
      setTimeout(() => resolve({ data: { user: null } }), 1200)
    );

    const {
      data: { user },
    } = await Promise.race([authPromise, timeoutPromise]);

    // If user is not logged in and tries to access protected pages, redirect to /login
    if (!user && !isAuthPath && !isStaticAsset && pathname !== '/') {
      // Check if session cookie exists before forcing redirect to prevent false positives on timeout
      const hasAuthCookie = request.cookies.getAll().some((c) => c.name.includes('auth-token') || c.name.includes('sb-'));
      if (!hasAuthCookie) {
        const url = request.nextUrl.clone();
        url.pathname = '/login';
        return NextResponse.redirect(url);
      }
    }

    // If user is already logged in and visits /login or /signup, redirect to /dashboard
    if (user && isAuthPath && !pathname.startsWith('/auth/callback')) {
      const url = request.nextUrl.clone();
      url.pathname = '/dashboard';
      return NextResponse.redirect(url);
    }
  } catch (err) {
    console.warn('Middleware auth check non-fatal error:', err);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public assets like images, icons, etc.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
