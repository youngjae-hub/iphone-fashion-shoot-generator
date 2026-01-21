import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isLoginPage = req.nextUrl.pathname === '/login';
  const isAuthRoute = req.nextUrl.pathname.startsWith('/api/auth');

  // 인증 라우트는 항상 허용
  if (isAuthRoute) {
    return NextResponse.next();
  }

  // 로그인 페이지 접근
  if (isLoginPage) {
    if (isLoggedIn) {
      // 이미 로그인된 경우 홈으로 리다이렉트
      return NextResponse.redirect(new URL('/', req.url));
    }
    return NextResponse.next();
  }

  // 로그인되지 않은 경우 로그인 페이지로 리다이렉트
  if (!isLoggedIn) {
    const loginUrl = new URL('/login', req.url);
    loginUrl.searchParams.set('callbackUrl', req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|logo.svg|.*\\.png$|.*\\.jpg$|.*\\.svg$).*)',
  ],
};
