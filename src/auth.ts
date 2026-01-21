import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';

// 허용된 이메일 목록 (환경변수로 관리)
const getAllowedEmails = (): string[] => {
  const emails = process.env.ALLOWED_EMAILS || '';
  return emails.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user }) {
      const allowedEmails = getAllowedEmails();

      // 허용 목록이 비어있으면 모든 사용자 허용 (개발 환경)
      if (allowedEmails.length === 0) {
        console.warn('ALLOWED_EMAILS not set - allowing all users');
        return true;
      }

      const email = user.email?.toLowerCase();
      if (!email) return false;

      // 이메일이 허용 목록에 있는지 확인
      const isAllowed = allowedEmails.includes(email);

      if (!isAllowed) {
        console.log(`Access denied for: ${email}`);
      }

      return isAllowed;
    },
    async session({ session, token }) {
      // 세션에 사용자 정보 추가
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
    error: '/login',
  },
  trustHost: true,
});
