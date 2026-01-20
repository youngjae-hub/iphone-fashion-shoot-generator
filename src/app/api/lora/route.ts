import { NextRequest, NextResponse } from 'next/server';
import {
  getLoRATrainingService,
  isLoRATrainingAvailable,
  checkLoRATrainingRequirements,
} from '@/lib/providers/lora-training';
import { LoRATrainingRequest } from '@/types';

// Vercel Serverless Function 설정
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// GET: 모든 LoRA 모델 목록 또는 특정 모델 상태 확인
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');
    const checkStatus = searchParams.get('checkStatus') === 'true';

    const service = getLoRATrainingService();

    // 특정 모델 상태 확인
    if (modelId) {
      if (checkStatus) {
        const model = await service.checkTrainingStatus(modelId);
        if (!model) {
          return NextResponse.json(
            { success: false, error: '모델을 찾을 수 없습니다.' },
            { status: 404 }
          );
        }
        return NextResponse.json({ success: true, model });
      }

      const model = service.getModel(modelId);
      if (!model) {
        return NextResponse.json(
          { success: false, error: '모델을 찾을 수 없습니다.' },
          { status: 404 }
        );
      }
      return NextResponse.json({ success: true, model });
    }

    // 모든 모델 목록
    const models = service.getAllModels();
    const available = await isLoRATrainingAvailable();

    return NextResponse.json({
      success: true,
      models,
      available,
    });
  } catch (error) {
    console.error('LoRA GET error:', error);
    return NextResponse.json(
      { success: false, error: '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}

// POST: 새 LoRA 학습 시작
export async function POST(request: NextRequest) {
  try {
    // 환경 변수 요구사항 확인
    const requirements = checkLoRATrainingRequirements();
    if (!requirements.valid) {
      return NextResponse.json(
        { success: false, error: requirements.error },
        { status: 400 }
      );
    }

    const available = await isLoRATrainingAvailable();
    if (!available) {
      return NextResponse.json(
        { success: false, error: 'Replicate API 키가 설정되지 않았습니다.' },
        { status: 400 }
      );
    }

    const body: LoRATrainingRequest = await request.json();

    // 유효성 검사
    if (!body.name || !body.name.trim()) {
      return NextResponse.json(
        { success: false, error: '모델 이름을 입력해주세요.' },
        { status: 400 }
      );
    }

    if (!body.images || body.images.length < 10) {
      return NextResponse.json(
        { success: false, error: '최소 10장의 이미지가 필요합니다.' },
        { status: 400 }
      );
    }

    if (body.images.length > 50) {
      return NextResponse.json(
        { success: false, error: '최대 50장까지 업로드 가능합니다.' },
        { status: 400 }
      );
    }

    const service = getLoRATrainingService();
    const result = await service.startTraining(body);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      model: result.model,
      trainingId: result.trainingId,
      message: '학습이 시작되었습니다. 약 15-30분 소요됩니다.',
    });
  } catch (error) {
    console.error('LoRA POST error:', error);

    // 구체적인 에러 메시지 제공
    let errorMessage = '학습 시작에 실패했습니다.';
    if (error instanceof Error) {
      if (error.message.includes('REPLICATE_USERNAME') || error.message.includes('destination')) {
        errorMessage = 'REPLICATE_USERNAME 환경 변수를 확인해주세요.';
      } else if (error.message.includes('timeout') || error.message.includes('TIMEOUT')) {
        errorMessage = '이미지 업로드 시간이 초과되었습니다. 이미지 수를 줄여주세요.';
      } else if (error.message.includes('upload')) {
        errorMessage = '이미지 업로드에 실패했습니다. 이미지 수를 줄이거나 다시 시도해주세요.';
      } else {
        errorMessage = `학습 오류: ${error.message}`;
      }
    }

    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE: LoRA 모델 삭제
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const modelId = searchParams.get('modelId');

    if (!modelId) {
      return NextResponse.json(
        { success: false, error: '모델 ID가 필요합니다.' },
        { status: 400 }
      );
    }

    const service = getLoRATrainingService();
    const deleted = service.deleteModel(modelId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: '모델을 찾을 수 없습니다.' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: '모델이 삭제되었습니다.',
    });
  } catch (error) {
    console.error('LoRA DELETE error:', error);
    return NextResponse.json(
      { success: false, error: '삭제에 실패했습니다.' },
      { status: 500 }
    );
  }
}
