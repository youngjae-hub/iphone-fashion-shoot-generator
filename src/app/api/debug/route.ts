import { NextResponse } from 'next/server';
import { GoogleGeminiImageProvider } from '@/lib/providers/google-gemini';
import { execSync } from 'child_process';

/**
 * 디버그 API - 현재 실행 중인 설정 확인
 *
 * 사용법: GET /api/debug
 *
 * 이 API는 실제 런타임에서 사용되는 모델과 설정을 보여줍니다.
 * Git 히스토리와 실제 실행 코드가 다른 경우를 감지하는 데 유용합니다.
 */
export async function GET() {
  try {
    // 실제 Provider 인스턴스 생성하여 모델명 확인
    const geminiProvider = new GoogleGeminiImageProvider();
    const actualModel = (geminiProvider as any).model; // private 접근

    // Git 상태 확인 (서버 환경에서만)
    let gitStatus = 'unknown';
    let uncommittedChanges: string[] = [];

    try {
      const status = execSync('git status --porcelain', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        timeout: 5000
      });

      uncommittedChanges = status
        .split('\n')
        .filter(line => line.trim())
        .filter(line => line.includes('src/lib/providers/') || line.includes('src/app/api/generate/'));

      gitStatus = uncommittedChanges.length > 0 ? 'HAS_UNCOMMITTED_CHANGES' : 'CLEAN';
    } catch {
      gitStatus = 'GIT_NOT_AVAILABLE';
    }

    // 마지막 커밋 해시
    let lastCommit = 'unknown';
    try {
      lastCommit = execSync('git rev-parse --short HEAD', {
        cwd: process.cwd(),
        encoding: 'utf-8',
        timeout: 5000
      }).trim();
    } catch {
      // ignore
    }

    const debugInfo = {
      timestamp: new Date().toISOString(),
      runtime: {
        geminiModel: actualModel,
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV || 'local',
      },
      git: {
        status: gitStatus,
        lastCommit,
        uncommittedProviderChanges: uncommittedChanges,
      },
      warning: uncommittedChanges.length > 0
        ? '⚠️ Provider 파일에 커밋되지 않은 변경사항이 있습니다! 배포 전 확인 필요.'
        : null,
    };

    return NextResponse.json(debugInfo);
  } catch (error) {
    return NextResponse.json(
      { error: 'Debug info retrieval failed', details: String(error) },
      { status: 500 }
    );
  }
}
