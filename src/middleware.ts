import { NextResponse, NextRequest } from 'next/server';

// 개발 환경에서는 인증 우회 (AUTH_SECRET이 없으면 개발 모드로 간주)
const isDevelopment = !process.env.AUTH_SECRET || process.env.NODE_ENV === 'development';

export default function middleware(_req: NextRequest) {
  // 개발 환경에서는 모든 요청 허용
  if (isDevelopment) {
    return NextResponse.next();
  }

  // 프로덕션에서는 auth 미들웨어 사용
  // (AUTH_SECRET 설정 시 이 부분은 별도 처리 필요)
  return NextResponse.next();
}

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
