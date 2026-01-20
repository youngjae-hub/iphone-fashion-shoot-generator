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

      // 2. Replicate 학습 시작
      // flux-dev-lora-trainer 모델 사용
      const training = await this.replicate.trainings.create(
        'ostris',
        'flux-dev-lora-trainer',
        '885394e6a31c6f349dd4f9e6e7ffbabd8d9840ab2c4a6c2fdbf8d13ec0c407cf',
        {
          destination: `${process.env.REPLICATE_USERNAME || 'user'}/${request.name.toLowerCase().replace(/\s+/g, '-')}`,
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
      model.error = error instanceof Error ? error.message : 'Unknown error';
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

    // ZIP 파일 생성
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    if (zipBuffer.length === 0) {
      throw new Error('Failed to create ZIP file');
    }

    // Replicate files API로 ZIP 업로드
    const file = await this.replicate.files.create(zipBuffer, {
      type: 'application/zip',
    });

    console.log('ZIP uploaded successfully:', file.urls.get);
    return file.urls.get;
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
