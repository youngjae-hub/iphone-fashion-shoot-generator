import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { GeneratedImage, PoseType, GenerationSettings, ProviderConfig } from '@/types';

// Vercel Serverless Function 설정
export const maxDuration = 300; // 5분 (배치 처리용)
export const dynamic = 'force-dynamic';

interface BatchGenerateRequest {
  garmentImages: string[]; // 여러 의류 이미지 (base64 또는 URL)
  poses: PoseType[];
  settings: GenerationSettings;
  providers: ProviderConfig;
  loraModelId?: string;
}

interface BatchResult {
  garmentIndex: number;
  garmentImage: string;
  generatedImages: GeneratedImage[];
  error?: string;
}

// POST: 배치 이미지 생성
export async function POST(request: NextRequest) {
  try {
    const body: BatchGenerateRequest = await request.json();
    const { garmentImages, poses, settings, providers, loraModelId } = body;

    if (!garmentImages || garmentImages.length === 0) {
      return NextResponse.json(
        { success: false, error: '의류 이미지가 필요합니다.' },
        { status: 400 }
      );
    }

    if (garmentImages.length > 10) {
      return NextResponse.json(
        { success: false, error: '한 번에 최대 10개의 의류만 처리할 수 있습니다.' },
        { status: 400 }
      );
    }

    const results: BatchResult[] = [];
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';

    // 각 의류에 대해 순차적으로 생성
    for (let i = 0; i < garmentImages.length; i++) {
      const garmentImage = garmentImages[i];
      const result: BatchResult = {
        garmentIndex: i,
        garmentImage: garmentImage.slice(0, 100) + '...', // 썸네일용 축약
        generatedImages: [],
      };

      try {
        if (loraModelId) {
          // LoRA 생성
          for (const pose of poses) {
            for (let shot = 0; shot < settings.shotsPerPose; shot++) {
              const response = await fetch(`${baseUrl}/api/lora/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  loraModelId,
                  garmentImage,
                  pose,
                  seed: settings.seed ? settings.seed + i * 100 + shot : undefined,
                }),
              });

              const data = await response.json();
              if (data.success && data.image) {
                result.generatedImages.push(data.image);
              }
            }
          }
        } else {
          // 일반 생성
          const response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              garmentImage,
              poses,
              settings: {
                ...settings,
                seed: settings.seed ? settings.seed + i * 100 : undefined,
              },
              providers,
            }),
          });

          const data = await response.json();
          if (data.success && data.images) {
            result.generatedImages = data.images;
          } else {
            result.error = data.error || '생성 실패';
          }
        }
      } catch (err) {
        result.error = err instanceof Error ? err.message : '알 수 없는 오류';
      }

      results.push(result);
    }

    // 통계 계산
    const totalGenerated = results.reduce((sum, r) => sum + r.generatedImages.length, 0);
    const failedCount = results.filter(r => r.error).length;

    return NextResponse.json({
      success: true,
      results,
      summary: {
        totalGarments: garmentImages.length,
        totalGenerated,
        failedCount,
      },
    });
  } catch (error) {
    console.error('Batch generate error:', error);
    return NextResponse.json(
      { success: false, error: '배치 생성 실패' },
      { status: 500 }
    );
  }
}
