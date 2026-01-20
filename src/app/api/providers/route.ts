import { NextResponse } from 'next/server';
import { checkProviderAvailability, getAvailableProviders } from '@/lib/providers';

// Provider 목록 및 가용성 조회
export async function GET() {
  try {
    const providers = getAvailableProviders();
    const availability = await checkProviderAvailability();

    return NextResponse.json({
      success: true,
      providers,
      availability,
    });
  } catch (error) {
    console.error('Provider check error:', error);
    return NextResponse.json(
      { success: false, error: 'Provider 상태 조회 실패' },
      { status: 500 }
    );
  }
}
