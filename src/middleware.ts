import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

// Server-side fetch of the platform setup status, with a short timeout so a
// slow/unreachable API never stalls navigation.
async function fetchSetupStatus(): Promise<{
  isSetup: boolean;
  onboardingComplete: boolean;
} | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${API_URL}/setup/status`, {
      signal: controller.signal,
      cache: 'no-store',
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    return (await res.json()) as { isSetup: boolean; onboardingComplete: boolean };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Issue a real HTTP redirect (not a client-side bounce) between the setup
  // wizard and the login page depending on the platform setup state.
  if (pathname === '/' || pathname === '/login') {
    const status = await fetchSetupStatus();
    if (status && (!status.isSetup || !status.onboardingComplete)) {
      return NextResponse.redirect(new URL('/setup', request.url));
    }
  } else if (pathname.startsWith('/setup')) {
    const status = await fetchSetupStatus();
    if (status && status.onboardingComplete) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  }

  // Public paths — no auth required.
  if (pathname.startsWith('/login') || pathname.startsWith('/setup')) {
    return NextResponse.next();
  }

  // Allow API routes, static files, etc.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Auth token lives in localStorage and is checked client-side; this
  // middleware only handles setup-state routing.
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
