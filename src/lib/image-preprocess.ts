/**
 * 이미지 전처리 유틸리티
 * LoRA 학습용 이미지에서 얼굴 제거
 */

interface FaceDetectionResult {
  success: boolean;
  faceDetected: boolean;
  faceBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  cropSuggestion?: {
    startY: number;
    description: string;
  };
  fallbackCrop?: boolean;
}

/**
 * 서버에서 얼굴 감지 실행
 */
export async function detectFace(imageBase64: string): Promise<FaceDetectionResult> {
  try {
    const response = await fetch('/api/preprocess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: imageBase64,
        mode: 'remove_above_neck',
      }),
    });

    const data = await response.json();
    return {
      success: data.success,
      faceDetected: data.faceDetected || false,
      faceBox: data.faceBox,
      cropSuggestion: data.cropSuggestion,
      fallbackCrop: data.fallbackCrop,
    };
  } catch (error) {
    console.error('Face detection failed:', error);
    return {
      success: false,
      faceDetected: false,
      fallbackCrop: true,
      cropSuggestion: {
        startY: 0.25,
        description: '기본 크롭: 상단 25% 제거',
      },
    };
  }
}

/**
 * 이미지 상단 크롭 (얼굴 제거)
 * @param imageBase64 원본 이미지 (base64)
 * @param cropRatio 상단에서 제거할 비율 (0-1)
 * @returns 크롭된 이미지 (base64)
 */
export async function cropTopOfImage(imageBase64: string, cropRatio: number = 0.3): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }

      // 크롭 영역 계산
      const cropY = Math.floor(img.height * cropRatio);
      const newHeight = img.height - cropY;

      canvas.width = img.width;
      canvas.height = newHeight;

      // 크롭된 영역만 그리기
      ctx.drawImage(
        img,
        0, cropY, img.width, newHeight, // 소스 영역
        0, 0, img.width, newHeight // 대상 영역
      );

      // base64로 반환
      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.9);
      resolve(croppedBase64);
    };

    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };

    img.src = imageBase64;
  });
}

/**
 * 이미지 배치 전처리 (여러 이미지에서 얼굴 제거)
 * @param images base64 이미지 배열
 * @param onProgress 진행률 콜백
 * @returns 전처리된 이미지 배열
 */
export async function preprocessImagesForLoRA(
  images: string[],
  onProgress?: (current: number, total: number, status: string) => void
): Promise<{ processed: string[]; skipped: number; errors: number }> {
  const processed: string[] = [];
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    onProgress?.(i + 1, images.length, `이미지 ${i + 1}/${images.length} 처리 중...`);

    try {
      // 얼굴 감지
      const detection = await detectFace(image);

      if (detection.faceDetected && detection.cropSuggestion) {
        // 얼굴이 감지되면 크롭
        const croppedImage = await cropTopOfImage(image, detection.cropSuggestion.startY);
        processed.push(croppedImage);
        onProgress?.(i + 1, images.length, `이미지 ${i + 1}: 얼굴 제거됨`);
      } else if (detection.fallbackCrop) {
        // 얼굴 감지 실패 시 기본 크롭
        const croppedImage = await cropTopOfImage(image, 0.25);
        processed.push(croppedImage);
        onProgress?.(i + 1, images.length, `이미지 ${i + 1}: 기본 크롭 적용`);
      } else {
        // 얼굴이 없으면 원본 사용
        processed.push(image);
        skipped++;
        onProgress?.(i + 1, images.length, `이미지 ${i + 1}: 얼굴 없음 (원본 사용)`);
      }
    } catch (error) {
      console.error(`Error processing image ${i + 1}:`, error);
      // 에러 발생 시 원본 사용
      processed.push(image);
      errors++;
    }

    // API 레이트 리밋 방지를 위한 딜레이
    if (i < images.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  return { processed, skipped, errors };
}

/**
 * 단순 상단 크롭 (얼굴 감지 없이)
 * API 호출 없이 빠르게 처리
 */
export async function simpleTopCrop(images: string[], cropRatio: number = 0.3): Promise<string[]> {
  const results: string[] = [];

  for (const image of images) {
    try {
      const cropped = await cropTopOfImage(image, cropRatio);
      results.push(cropped);
    } catch {
      // 실패 시 원본 사용
      results.push(image);
    }
  }

  return results;
}
