'use client';

import { ReactNode } from 'react';

// 개발 환경에서는 SessionProvider 없이 렌더링
// 프로덕션에서 인증 필요시 SessionProvider 활성화
export function Providers({ children }: { children: ReactNode }) {
  // 개발 환경에서는 직접 children 렌더링
  return <>{children}</>;
}
