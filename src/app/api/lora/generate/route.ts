import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { getLoRATrainingService } from '@/lib/providers/lora-training';
import { LoRAGenerationRequest, GeneratedImage, PoseType } from '@/types';

// Vercel Serverless Function 설정
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// POST: 학습된 LoRA로 이미지 생성
export async function POST(request: NextRequest) {
  try {
    const body: LoRAGenerationRequest = await request.json();
    const { loraModelId, prompt, garmentImage, pose, seed } = body;

    if (!loraModelId) {
      return NextResponse.json(
        { success: false, error: 'LoRA 모델 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const service = getLoRATrainingService();
    const model = service.getModel(loraModelId);

    if (!model) {
      return NextResponse.json(
        { success: false, error: '모델을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    if (model.status !== 'completed') {
      return NextResponse.json(
        { success: false, error: '모델 학습이 완료되지 않았습니다.' },
        { status: 400 }
      );
    }

    // 기본 프롬프트 생성
    const defaultPrompt = `
      Korean online shopping mall style fashion photo,
      young Korean female model, face cropped above lips,
      natural iPhone photography, casual everyday background
    `.trim().replace(/\s+/g, ' ');

    const finalPrompt = prompt || defaultPrompt;

    const imageUrl = await service.generateWithLoRA(
      model,
      finalPrompt,
      pose || 'front',
      garmentImage,
      seed
    );

    const generatedImage: GeneratedImage = {
      id: uuidv4(),
      url: imageUrl,
      pose: pose || 'front',
      timestamp: Date.now(),
      settings: {
        modelStyle: 'iphone-natural',
        backgroundStyle: 'minimal-studio',
        poses: [pose || 'front'],
        shotsPerPose: 1,
        totalShots: 1,
        seed,
      },
      provider: `LoRA: ${model.name}`,
    };

    return NextResponse.json({
      success: true,
      image: generatedImage,
    });
  } catch (error) {
    console.error('LoRA generation error:', error);
    return NextResponse.json(
      { success: false, error: 'LoRA 이미지 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
