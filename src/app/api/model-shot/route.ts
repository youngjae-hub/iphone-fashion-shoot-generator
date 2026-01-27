/**
 * Model Shot Generator API
 *
 * EffectGen 스타일 모델컷 생성 - IDM-VTON 기반
 * 커스텀 모델 이미지 지원
 */

import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

// Replicate 클라이언트
const getReplicateClient = () => {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error('REPLICATE_API_TOKEN is not set');
  }
  return new Replicate({ auth: process.env.REPLICATE_API_TOKEN });
};

// 요청 타입
interface ModelShotRequest {
  garmentImage: string; // base64 data URL (의류 이미지)
  modelImage: string; // URL 또는 base64 data URL (모델 이미지)
  templateId: string;
  pose: string;
  category: 'upper_body' | 'lower_body' | 'dresses';
  backgroundId?: string;
  isCustomModel?: boolean; // true면 base64, false면 URL
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: ModelShotRequest = await request.json();
    const { garmentImage, modelImage, templateId, category } = body;

    // 유효성 검사
    if (!garmentImage) {
      return NextResponse.json(
        { success: false, error: 'garmentImage가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!modelImage) {
      return NextResponse.json(
        { success: false, error: 'modelImage가 필요합니다. 모델 이미지를 먼저 업로드해주세요.' },
        { status: 400 }
      );
    }

    console.log(`[ModelShot] Generating with template: ${templateId}, category: ${category}`);
    const startTime = Date.now();

    // IDM-VTON 호출
    const replicate = getReplicateClient();

    const output = await replicate.run(
      "cuuupid/idm-vton:c871bb9b046f351a536e7819bb21256cc1c7e0cd9ff4c782e3b4ad583f7febcc" as `${string}/${string}`,
      {
        input: {
          crop: false,
          seed: Math.floor(Math.random() * 1000000),
          steps: 30,
          category: category,
          force_dc: false,
          garm_img: garmentImage,
          human_img: modelImage, // 커스텀 모델 이미지 사용
          mask_only: false,
          garment_des: "high quality fashion garment, studio lighting, professional product photo",
        }
      }
    );

    const duration = Date.now() - startTime;
    console.log(`[ModelShot] Generated in ${(duration / 1000).toFixed(1)}s`);

    // 결과 처리
    const resultUrl = extractOutputString(output);

    return NextResponse.json({
      success: true,
      resultImage: resultUrl,
      templateId,
      duration,
    });

  } catch (error) {
    console.error('[ModelShot] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : '알 수 없는 오류' },
      { status: 500 }
    );
  }
}

// Helper function to extract string from Replicate output
function extractOutputString(output: unknown): string {
  if (typeof output === 'string') {
    return output;
  }
  if (Array.isArray(output) && output.length > 0) {
    return String(output[0]);
  }
  if (output && typeof output === 'object') {
    return String(output);
  }
  throw new Error('Unexpected output format from Replicate');
}

// GET: API 정보 반환
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    success: true,
    info: {
      name: 'Model Shot Generator',
      description: '커스텀 모델 이미지에 의류를 합성합니다',
      model: 'IDM-VTON',
      estimatedCost: '$0.025 per generation',
      estimatedTime: '15-20 seconds',
    },
    usage: {
      method: 'POST',
      body: {
        garmentImage: 'base64 data URL (의류 이미지)',
        modelImage: 'base64 data URL (모델 이미지)',
        category: 'upper_body | lower_body | dresses',
        templateId: 'string (선택)',
      },
    },
  });
}
