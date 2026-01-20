// ============================================
// Replicate LoRA Training Provider
// ============================================

import Replicate from 'replicate';
import { v4 as uuidv4 } from 'uuid';
import JSZip from 'jszip';
import {
  LoRAModel,
  LoRATrainingRequest,
  LoRATrainingResponse,
  LoRAStatus,
  PoseType,
} from '@/types';
import { generateIPhoneStylePrompt, DEFAULT_NEGATIVE_PROMPT } from './base';

// Replicate 클라이언트 (싱글톤)
let replicateClient: Replicate | null = null;

function getReplicateClient(): Replicate {
  if (!replicateClient) {
    replicateClient = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN,
    });
  }
  return replicateClient;
}

// LoRA 모델 저장소 (실제 프로덕션에서는 DB 사용)
const loraModels: Map<string, LoRAModel> = new Map();

// ============================================
// LoRA Training Service
// ============================================

export class LoRATrainingService {
  private replicate: Replicate;

  constructor() {
    this.replicate = getReplicateClient();
  }

  /**
   * LoRA 학습 시작
   * Replicate의 flux-dev-lora-trainer 사용
   */
  async startTraining(request: LoRATrainingRequest): Promise<LoRATrainingResponse> {
    const modelId = uuidv4();
    const triggerWord = request.triggerWord || `STYLE_${modelId.slice(0, 8).toUpperCase()}`;

    // 모델 초기 상태 생성
    const model: LoRAModel = {
      id: modelId,
      name: request.name,
      description: request.description,
      status: 'uploading',
      trainingImages: [],
      triggerWord,
      createdAt: Date.now(),
      estimatedCost: this.estimateCost(request.images.length, request.trainingSteps),
    };

    loraModels.set(modelId, model);

    try {
      // 1. 이미지들을 ZIP 파일로 묶어서 업로드
      const zipUrl = await this.uploadImagesToStorage(request.images);

      model.trainingImages = [zipUrl];
      model.status = 'training';
      loraModels.set(modelId, model);

      // 2. Replicate에 모델 생성 (destination용)
      const modelSlug = request.name.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
      const destination = `${process.env.REPLICATE_USERNAME}/${modelSlug}` as `${string}/${string}`;

      // 모델이 없으면 생성
      try {
        await this.replicate.models.create(
          process.env.REPLICATE_USERNAME!,
          modelSlug,
          {
            visibility: 'private',
            hardware: 'gpu-t4',
            description: request.description || `LoRA model: ${request.name}`,
          }
        );
        console.log('Created new model:', destination);
      } catch (createError: unknown) {
        // 이미 존재하면 무시 (409 Conflict 또는 already exists)
        const errorMessage = createError instanceof Error ? createError.message : String(createError);
        if (!errorMessage.includes('already exists') && !errorMessage.includes('409')) {
          // 다른 에러면 로그만 출력하고 계속 진행 (모델이 이미 있을 수 있음)
          console.log('Model creation note:', errorMessage);
        }
      }

      // 3. Replicate 학습 시작
      // flux-dev-lora-trainer 모델 사용 (최신 버전)
      console.log('Starting training with destination:', destination);
      console.log('Input images URL:', zipUrl);

      const training = await this.replicate.trainings.create(
        'ostris',
        'flux-dev-lora-trainer',
        '26dce37af90b9d997eeb970d92e47de3064d46c300504ae376c75bef6a9022d2',
        {
          destination,
          input: {
            input_images: zipUrl, // ZIP 파일 URL
            trigger_word: triggerWord,
            steps: request.trainingSteps || 1000,
            lora_rank: 16,
            optimizer: 'adamw8bit',
            batch_size: 1,
            resolution: '512,768,1024',
            autocaption: true,
            autocaption_prefix: `a photo of ${triggerWord}, `,
          },
        }
      );

      console.log('Training started successfully:', training.id);

      // 학습 ID 저장
      model.replicateModelId = training.id;
      loraModels.set(modelId, model);

      return {
        success: true,
        model,
        trainingId: training.id,
      };
    } catch (error) {
      model.status = 'failed';

      // 에러 메시지 파싱
      console.error('LoRA Training error:', error);
      let errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // 에러 객체에서 추가 정보 추출
      if (error && typeof error === 'object' && 'response' in error) {
        const response = (error as { response?: { status?: number; data?: unknown } }).response;
        console.error('Error response:', response);
      }

      // destination 관련 에러 처리
      if (errorMessage.includes('destination does not exist')) {
        errorMessage = `Replicate에 모델을 생성할 수 없습니다. replicate.com에서 '${process.env.REPLICATE_USERNAME}' 계정으로 로그인 후, 새 모델을 먼저 생성해주세요.`;
      } else if (errorMessage.includes('permission') || errorMessage.includes('403')) {
        errorMessage = 'Replicate 계정 권한이 없습니다. API 토큰과 사용자명을 확인해주세요.';
      } else if (errorMessage.includes('500') || errorMessage.includes('Internal Server')) {
        errorMessage = 'Replicate 서버에 일시적인 문제가 있습니다. 잠시 후 다시 시도해주세요.';
      } else if (errorMessage.includes('업로드')) {
        // 업로드 에러는 그대로 전달
      } else if (errorMessage.includes('timeout') || errorMessage.includes('ETIMEDOUT')) {
        errorMessage = '요청 시간이 초과되었습니다. 이미지 수를 줄이거나 다시 시도해주세요.';
      }

      model.error = errorMessage;
      loraModels.set(modelId, model);

      return {
        success: false,
        error: model.error,
      };
    }
  }

  /**
   * 학습 상태 확인
   */
  async checkTrainingStatus(modelId: string): Promise<LoRAModel | null> {
    const model = loraModels.get(modelId);
    if (!model || !model.replicateModelId) return null;

    try {
      const training = await this.replicate.trainings.get(model.replicateModelId);

      if (training.status === 'succeeded') {
        model.status = 'completed';
        model.completedAt = Date.now();
        model.replicateVersionId = training.output?.version;
      } else if (training.status === 'failed') {
        model.status = 'failed';
        model.error = typeof training.error === 'string' ? training.error : 'Training failed';
      } else if (training.status === 'canceled') {
        model.status = 'failed';
        model.error = 'Training was canceled';
      }
      // 'starting', 'processing' -> 여전히 'training' 상태

      loraModels.set(modelId, model);
      return model;
    } catch (error) {
      console.error('Failed to check training status:', error);
      return model;
    }
  }

  /**
   * 학습된 LoRA로 이미지 생성
   */
  async generateWithLoRA(
    model: LoRAModel,
    prompt: string,
    pose: PoseType,
    garmentImage?: string,
    seed?: number
  ): Promise<string> {
    if (model.status !== 'completed' || !model.replicateVersionId) {
      throw new Error('LoRA model is not ready');
    }

    const fullPrompt = `${model.triggerWord}, ${prompt}, ${generateIPhoneStylePrompt(pose)}`;

    // 학습된 LoRA 모델로 생성
    const output = await this.replicate.run(
      `${process.env.REPLICATE_USERNAME || 'user'}/${model.name.toLowerCase().replace(/\s+/g, '-')}:${model.replicateVersionId}` as `${string}/${string}:${string}`,
      {
        input: {
          prompt: fullPrompt,
          negative_prompt: DEFAULT_NEGATIVE_PROMPT,
          num_outputs: 1,
          guidance_scale: 7.5,
          num_inference_steps: 28,
          seed: seed,
          output_format: 'png',
        },
      }
    );

    if (Array.isArray(output) && output.length > 0) {
      return String(output[0]);
    }
    throw new Error('No output from LoRA generation');
  }

  /**
   * 모든 LoRA 모델 목록
   */
  getAllModels(): LoRAModel[] {
    return Array.from(loraModels.values());
  }

  /**
   * 특정 모델 가져오기
   */
  getModel(modelId: string): LoRAModel | undefined {
    return loraModels.get(modelId);
  }

  /**
   * 모델 삭제
   */
  deleteModel(modelId: string): boolean {
    return loraModels.delete(modelId);
  }

  /**
   * 비용 추정
   */
  private estimateCost(imageCount: number, steps?: number): number {
    // Replicate flux-dev-lora-trainer 기준
    // 약 $0.001405/초, 평균 학습 시간 15-30분
    const baseMinutes = 15;
    const additionalMinutesPerImage = 0.5;
    const stepsMultiplier = (steps || 1000) / 1000;

    const totalMinutes = (baseMinutes + imageCount * additionalMinutesPerImage) * stepsMultiplier;
    const totalSeconds = totalMinutes * 60;
    const costPerSecond = 0.001405;

    return Math.round(totalSeconds * costPerSecond * 100) / 100;
  }

  /**
   * 이미지들을 ZIP 파일로 묶어서 업로드
   * flux-dev-lora-trainer는 ZIP URL을 input_images로 받음
   */
  private async uploadImagesToStorage(base64Images: string[]): Promise<string> {
    // JSZip으로 이미지들을 ZIP 파일로 묶기
    const zip = new JSZip();

    console.log(`Processing ${base64Images.length} images for ZIP...`);

    for (let i = 0; i < base64Images.length; i++) {
      try {
        const base64 = base64Images[i];
        // base64에서 실제 데이터 추출
        const base64Data = base64.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // 파일명: image_001.jpg, image_002.jpg, ...
        const filename = `image_${String(i + 1).padStart(3, '0')}.jpg`;
        zip.file(filename, buffer);
      } catch (error) {
        console.error(`Failed to add image ${i} to ZIP:`, error);
      }
    }

    // ZIP 파일 생성 (압축 레벨 낮춤 - 속도 향상)
    console.log('Generating ZIP file...');
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 1 }, // 낮은 압축 레벨로 속도 향상
    });

    if (zipBuffer.length === 0) {
      throw new Error('Failed to create ZIP file');
    }

    console.log(`ZIP file created: ${zipBuffer.length} bytes, uploading...`);

    // Replicate files API로 직접 업로드 (fetch 사용)
    try {
      const formData = new FormData();
      // Buffer를 Uint8Array로 변환하여 Blob 생성
      const uint8Array = new Uint8Array(zipBuffer);
      const blob = new Blob([uint8Array], { type: 'application/zip' });
      formData.append('content', blob, 'training_images.zip');

      const response = await fetch('https://api.replicate.com/v1/files', {
        method: 'POST',
        headers: {
          'Authorization': `Token ${process.env.REPLICATE_API_TOKEN}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('File upload failed:', response.status, errorText);
        throw new Error(`Upload failed: ${response.status} ${errorText}`);
      }

      const fileData = await response.json();
      console.log('ZIP uploaded successfully:', fileData.urls?.get || fileData.id);

      // URL 반환 (urls.get 또는 직접 구성)
      const fileUrl = fileData.urls?.get || `https://api.replicate.com/v1/files/${fileData.id}`;
      return fileUrl;
    } catch (uploadError) {
      console.error('File upload error:', uploadError);
      throw new Error(`이미지 업로드 실패: ${uploadError instanceof Error ? uploadError.message : 'Unknown error'}`);
    }
  }
}

// 싱글톤 인스턴스
let trainingService: LoRATrainingService | null = null;

export function getLoRATrainingService(): LoRATrainingService {
  if (!trainingService) {
    trainingService = new LoRATrainingService();
  }
  return trainingService;
}

// 유틸리티: LoRA 가용 여부 확인
export async function isLoRATrainingAvailable(): Promise<boolean> {
  return !!process.env.REPLICATE_API_TOKEN;
}

// 유틸리티: LoRA 학습 요구사항 확인
export function checkLoRATrainingRequirements(): { valid: boolean; error?: string } {
  if (!process.env.REPLICATE_API_TOKEN) {
    return { valid: false, error: 'REPLICATE_API_TOKEN 환경 변수가 설정되지 않았습니다.' };
  }
  if (!process.env.REPLICATE_USERNAME) {
    return { valid: false, error: 'REPLICATE_USERNAME 환경 변수가 설정되지 않았습니다. Replicate 계정 사용자명을 설정해주세요.' };
  }
  return { valid: true };
}
