import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

// Vercel Serverless Function 설정
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// Replicate 클라이언트
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

interface PreprocessRequest {
  image: string; // base64 이미지
  mode: 'crop_face' | 'blur_face' | 'remove_above_neck';
}

// POST: 이미지 전처리 (얼굴 제거/크롭)
export async function POST(request: NextRequest) {
  try {
    const body: PreprocessRequest = await request.json();
    const { image, mode } = body;

    if (!image) {
      return NextResponse.json(
        { success: false, error: '이미지가 필요합니다.' },
        { status: 400 }
      );
    }

    // 이미지를 직접 처리하는 방식으로 구현
    // face-to-sticker 모델로 얼굴 영역 감지 후 크롭

    if (mode === 'remove_above_neck' || mode === 'crop_face') {
      // 얼굴 영역을 감지하고 목 아래만 남기는 처리
      // GFPGAN이나 face detection 모델 사용

      try {
        // 1. 먼저 얼굴 영역 감지를 위해 face-detection 사용
        // Replicate의 face-detection 모델로 얼굴 위치 확인
        const faceDetection = await replicate.run(
          "andreasjansson/face-detection:2194bc7c9e09ac195cf06253a1659f3ae4146c6ad42a5dd4ce6b93d3cba8c6d7",
          {
            input: {
              image: image,
            },
          }
        );

        // 얼굴 감지 결과 확인
        console.log('Face detection result:', faceDetection);

        // 얼굴이 감지되지 않으면 원본 반환
        if (!faceDetection || (Array.isArray(faceDetection) && faceDetection.length === 0)) {
          return NextResponse.json({
            success: true,
            processedImage: image,
            faceDetected: false,
            message: '얼굴이 감지되지 않았습니다. 원본 이미지를 사용합니다.',
          });
        }

        // 2. 얼굴이 감지되면 inpainting으로 얼굴 영역 제거
        // 또는 이미지 크롭 처리
        const faces = Array.isArray(faceDetection) ? faceDetection : [faceDetection];

        // 가장 큰 얼굴 찾기 (메인 모델)
        let mainFace = faces[0];
        if (faces.length > 1) {
          mainFace = faces.reduce((prev: { box?: { width?: number; height?: number } }, curr: { box?: { width?: number; height?: number } }) => {
            const prevArea = (prev.box?.width || 0) * (prev.box?.height || 0);
            const currArea = (curr.box?.width || 0) * (curr.box?.height || 0);
            return currArea > prevArea ? curr : prev;
          });
        }

        // 얼굴 위치 정보
        const faceBox = mainFace.box || mainFace;

        return NextResponse.json({
          success: true,
          faceDetected: true,
          faceBox: faceBox,
          originalImage: image,
          message: '얼굴이 감지되었습니다. 클라이언트에서 크롭 처리가 필요합니다.',
          cropSuggestion: {
            // 목 아래부터 시작하도록 크롭 영역 제안
            startY: Math.min((faceBox.y || 0) + (faceBox.height || 0) * 1.3, 1.0),
            description: '이 위치 아래로 크롭하면 얼굴이 제거됩니다.',
          },
        });

      } catch (detectionError) {
        console.error('Face detection error:', detectionError);

        // 얼굴 감지 실패 시 대체 방법: 상단 30% 크롭
        return NextResponse.json({
          success: true,
          faceDetected: false,
          fallbackCrop: true,
          cropSuggestion: {
            startY: 0.3, // 상단 30% 제거
            description: '얼굴 감지 실패. 상단 30%를 크롭하는 것을 권장합니다.',
          },
          originalImage: image,
        });
      }
    }

    // blur_face 모드는 추후 구현
    return NextResponse.json({
      success: false,
      error: '지원하지 않는 모드입니다.',
    });

  } catch (error) {
    console.error('Preprocess error:', error);
    return NextResponse.json(
      { success: false, error: '전처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
