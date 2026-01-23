import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

export const maxDuration = 300; // Pro plan: 최대 300초 허용
export const dynamic = 'force-dynamic';

interface BrandConfig {
  name: string;
  format: 'jpg' | 'png';
  nukki: boolean;
  backgroundColor: string | null;
  shadow: boolean;
  cropWidth: number;
  cropHeight: number;
  flatlay?: boolean; // 도식화(플랫레이) 스타일 변환 옵션
  silhouetteRefine?: boolean; // 실루엣 다듬기 옵션
  flatlayMethod?: 'sdxl' | 'idm-vton' | 'tps' | 'skeleton'; // 도식화 방법 선택
  // 새로운 리터칭 옵션
  retouchMethod?: 'none' | 'photoroom' | 'edge-inpaint' | 'clipping-magic' | 'pixelcut' | 'magic-refiner-mask'; // 리터칭 방법 선택
}

interface RetouchRequest {
  image: string; // base64 data URL
  brand: string;
  config: BrandConfig;
}

// Replicate 출력에서 URL 추출하는 헬퍼 함수
function extractUrlFromOutput(output: unknown): string {
  if (typeof output === 'string') {
    return output;
  } else if (output instanceof URL) {
    return output.href;
  } else if (typeof output === 'object' && output !== null) {
    const fileOutput = output as { href?: string; toString?: () => string };
    if (fileOutput.href) {
      return fileOutput.href;
    } else if (typeof fileOutput.toString === 'function') {
      return fileOutput.toString();
    }
    return JSON.stringify(output);
  }
  return String(output);
}

// 이미지 URL을 base64로 변환
async function urlToBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image: ${response.status}`);
  }
  const buffer = await response.arrayBuffer();
  return `data:image/png;base64,${Buffer.from(buffer).toString('base64')}`;
}

// Replicate 클라이언트 초기화
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

export async function POST(request: NextRequest) {
  console.log('[Retouch API] Request received');

  try {
    const body: RetouchRequest = await request.json();
    const { image, brand, config } = body;

    console.log(`[Retouch API] Brand: ${brand}, Nukki: ${config.nukki}, Flatlay: ${config.flatlay}`);
    console.log(`[Retouch API] Image length: ${image?.length || 0} chars`);

    if (!image) {
      console.error('[Retouch API] No image provided');
      return NextResponse.json(
        { success: false, error: '이미지가 필요합니다.' },
        { status: 400 }
      );
    }

    if (!process.env.REPLICATE_API_TOKEN) {
      console.error('[Retouch API] No REPLICATE_API_TOKEN');
      return NextResponse.json(
        { success: false, error: 'Replicate API 토큰이 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    console.log('[Retouch API] Token exists, proceeding...');

    let processedImageUrl = image;

    const timings: { step: string; duration: number }[] = [];

    // 1. 실루엣 다듬기 (SDXL) - config.silhouetteRefine가 true인 경우
    // 원본 이미지에 먼저 적용하여 실루엣 정리 + 클립/자석 제거
    if (config.silhouetteRefine) {
      const sdxlStart = Date.now();
      console.log(`[Retouch API][${brand}] Starting silhouette refinement (SDXL)...`);

      try {
        // SDXL img2img로 도식화 스타일 변환 + 클립/자석 제거
        const refineOutput = await replicate.run(
          "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
          {
            input: {
              image: processedImageUrl,
              prompt: "flat lay clothing photography, garment laid perfectly flat on surface, top-down view, symmetrical spread sleeves, clean silhouette, professional fashion catalog, e-commerce product photo, smooth fabric, no gravity effect, studio lighting, high quality",
              negative_prompt: "hanging, hanger, mannequin, standing, vertical, clips, magnets, tags, labels, pins, clamps, holders, gravity, drooping, sagging, wrinkles, creases, folded, bunched, messy, distorted, blurry, low quality, 3d depth, perspective",
              prompt_strength: 0.5, // 도식화 변환 - 중간 강도 테스트
              num_inference_steps: 30,
              guidance_scale: 8.0,
              scheduler: "K_EULER",
            }
          }
        );

        if (refineOutput && Array.isArray(refineOutput) && refineOutput.length > 0) {
          const refinedUrl = extractUrlFromOutput(refineOutput[0]);
          processedImageUrl = await urlToBase64(refinedUrl);
          const sdxlDuration = Date.now() - sdxlStart;
          timings.push({ step: 'SDXL 실루엣', duration: sdxlDuration });
          console.log(`[Retouch API][${brand}] Silhouette refinement completed (${(sdxlDuration / 1000).toFixed(1)}s)`);
        }
      } catch (refineError: unknown) {
        console.error('[Retouch API] Silhouette refinement error:', refineError);
        console.log(`[Retouch API][${brand}] Continuing with original image...`);
      }
    }

    // 2. 누끼 처리 (배경 제거) - config.nukki가 true인 경우
    // 실루엣 다듬기 후 배경 제거 (API 호출 1회로 최적화)
    if (config.nukki) {
      const birefnetStart = Date.now();
      console.log(`[Retouch API][${brand}] Starting background removal (BiRefNet)...`);

      try {
        console.log(`[Retouch API][${brand}] Image size: ${processedImageUrl.length} chars`);

        // BiRefNet 모델 사용 (고해상도, 복잡한 배경에 강함)
        const output = await replicate.run(
          "men1scus/birefnet:f74986db0355b58403ed20963af156525e2891ea3c2d499bfbfb2a28cd87c5d7",
          {
            input: {
              image: processedImageUrl,
            }
          }
        );

        if (!output) {
          return NextResponse.json(
            { success: false, error: '배경 제거 결과가 비어 있습니다.' },
            { status: 500 }
          );
        }

        const resultUrl = extractUrlFromOutput(output);
        console.log(`[Retouch API][${brand}] Background removal completed`);

        // base64로 변환
        processedImageUrl = await urlToBase64(resultUrl);
        const birefnetDuration = Date.now() - birefnetStart;
        timings.push({ step: 'BiRefNet 누끼', duration: birefnetDuration });
        console.log(`[Retouch API][${brand}] Background removal completed (${(birefnetDuration / 1000).toFixed(1)}s)`);

      } catch (birefnetError: unknown) {
        console.error('[Retouch API] BiRefNet error:', birefnetError);
        const errorMessage = birefnetError instanceof Error ? birefnetError.message : String(birefnetError);
        return NextResponse.json(
          { success: false, error: `배경 제거 실패 (BiRefNet): ${errorMessage}` },
          { status: 500 }
        );
      }
    }

    // 3. 리터칭 처리 (Photoroom 또는 Edge Inpainting)
    const retouchMethod = config.retouchMethod || 'none';

    if (retouchMethod === 'photoroom') {
      // Plan A: Photoroom API로 제품 이미지 보정
      const photoroomStart = Date.now();
      console.log(`[Retouch API][${brand}] Starting Photoroom beautify...`);

      if (!process.env.PHOTOROOM_API_KEY) {
        console.warn('[Retouch API] PHOTOROOM_API_KEY not set, skipping...');
      } else {
        try {
          // base64에서 이미지 데이터 추출
          const base64Data = processedImageUrl.replace(/^data:image\/\w+;base64,/, '');
          const imageBuffer = Buffer.from(base64Data, 'base64');

          // Photoroom API 호출 (v2/edit - Plus plan)
          const formData = new FormData();
          formData.append('imageFile', new Blob([imageBuffer], { type: 'image/png' }), 'image.png');

          const photoroomResponse = await fetch('https://image-api.photoroom.com/v2/edit', {
            method: 'POST',
            headers: {
              'x-api-key': process.env.PHOTOROOM_API_KEY,
            },
            body: formData,
          });

          if (photoroomResponse.ok) {
            const resultBuffer = await photoroomResponse.arrayBuffer();
            processedImageUrl = `data:image/png;base64,${Buffer.from(resultBuffer).toString('base64')}`;
            const photoroomDuration = Date.now() - photoroomStart;
            timings.push({ step: 'Photoroom', duration: photoroomDuration });
            console.log(`[Retouch API][${brand}] Photoroom completed (${(photoroomDuration / 1000).toFixed(1)}s)`);
          } else {
            const errorText = await photoroomResponse.text();
            console.error('[Retouch API] Photoroom error:', photoroomResponse.status, errorText);
          }
        } catch (photoroomError: unknown) {
          console.error('[Retouch API] Photoroom error:', photoroomError);
        }
      }
    } else if (retouchMethod === 'edge-inpaint') {
      // Plan B: Real-ESRGAN으로 이미지 업스케일 + 품질 개선 (빠름, ~10초)
      const refinerStart = Date.now();
      console.log(`[Retouch API][${brand}] Starting image enhancement (Real-ESRGAN)...`);

      try {
        // Real-ESRGAN: 빠른 이미지 품질 개선 (약 10초)
        const esrganOutput = await replicate.run(
          "nightmareai/real-esrgan:f121d640bd286e1fdc67f9799164c1d5be36ff74576ee11c803ae5b665dd46aa",
          {
            input: {
              image: processedImageUrl,
              scale: 2, // 2배 업스케일 후 다운샘플링으로 품질 개선
              face_enhance: false,
            }
          }
        );

        if (esrganOutput) {
          const esrganUrl = extractUrlFromOutput(esrganOutput);
          processedImageUrl = await urlToBase64(esrganUrl);
          const refinerDuration = Date.now() - refinerStart;
          timings.push({ step: 'Real-ESRGAN', duration: refinerDuration });
          console.log(`[Retouch API][${brand}] Real-ESRGAN completed (${(refinerDuration / 1000).toFixed(1)}s)`);
        }
      } catch (refinerError: unknown) {
        console.error('[Retouch API] Real-ESRGAN error:', refinerError);
        console.log(`[Retouch API][${brand}] Continuing with previous image...`);
      }
    } else if (retouchMethod === 'clipping-magic') {
      // Plan C: Clipping Magic API - Smart Smoothing (가장자리 스무딩)
      const cmStart = Date.now();
      console.log(`[Retouch API][${brand}] Starting Clipping Magic Smart Smoothing...`);

      if (!process.env.CLIPPING_MAGIC_API_KEY) {
        console.warn('[Retouch API] CLIPPING_MAGIC_API_KEY not set, skipping...');
      } else {
        try {
          const base64Data = processedImageUrl.replace(/^data:image\/\w+;base64,/, '');

          // Clipping Magic API 호출
          const cmResponse = await fetch('https://clippingmagic.com/api/v1/images', {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${Buffer.from(process.env.CLIPPING_MAGIC_API_KEY + ':').toString('base64')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              image: {
                base64: base64Data,
              },
              // Smart Smoothing 설정 - 텍스타일에 최적화
              format: 'png',
              // 가장자리 스무딩 옵션
              output: {
                background: { color: 'transparent' },
              },
            }),
          });

          if (cmResponse.ok) {
            const cmResult = await cmResponse.json();
            if (cmResult.image && cmResult.image.base64) {
              processedImageUrl = `data:image/png;base64,${cmResult.image.base64}`;
              const cmDuration = Date.now() - cmStart;
              timings.push({ step: 'Clipping Magic', duration: cmDuration });
              console.log(`[Retouch API][${brand}] Clipping Magic completed (${(cmDuration / 1000).toFixed(1)}s)`);
            }
          } else {
            const errorText = await cmResponse.text();
            console.error('[Retouch API] Clipping Magic error:', cmResponse.status, errorText);
          }
        } catch (cmError: unknown) {
          console.error('[Retouch API] Clipping Magic error:', cmError);
        }
      }
    } else if (retouchMethod === 'pixelcut') {
      // Plan D: Pixelcut API - 화질 보정 (주름 제거 + 텍스처 향상)
      const pcStart = Date.now();
      console.log(`[Retouch API][${brand}] Starting Pixelcut quality enhancement...`);

      if (!process.env.PIXELCUT_API_KEY) {
        console.warn('[Retouch API] PIXELCUT_API_KEY not set, skipping...');
      } else {
        try {
          const base64Data = processedImageUrl.replace(/^data:image\/\w+;base64,/, '');
          const imageBuffer = Buffer.from(base64Data, 'base64');

          // Pixelcut API 호출 - Upscale & Enhance
          const formData = new FormData();
          formData.append('image', new Blob([imageBuffer], { type: 'image/png' }), 'image.png');

          const pcResponse = await fetch('https://api.pixelcut.ai/v1/upscale', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${process.env.PIXELCUT_API_KEY}`,
            },
            body: formData,
          });

          if (pcResponse.ok) {
            const pcResult = await pcResponse.json();
            if (pcResult.url) {
              processedImageUrl = await urlToBase64(pcResult.url);
              const pcDuration = Date.now() - pcStart;
              timings.push({ step: 'Pixelcut', duration: pcDuration });
              console.log(`[Retouch API][${brand}] Pixelcut completed (${(pcDuration / 1000).toFixed(1)}s)`);
            }
          } else {
            const errorText = await pcResponse.text();
            console.error('[Retouch API] Pixelcut error:', pcResponse.status, errorText);
          }
        } catch (pcError: unknown) {
          console.error('[Retouch API] Pixelcut error:', pcError);
        }
      }
    } else if (retouchMethod === 'magic-refiner-mask') {
      // Plan E: Magic Image Refiner + Edge Mask (가장자리 선택적 리파인)
      const mrStart = Date.now();
      console.log(`[Retouch API][${brand}] Starting Magic Refiner with edge mask...`);

      try {
        // 1. 먼저 clothing segmentation으로 마스크 생성
        console.log(`[Retouch API][${brand}] Creating edge mask...`);

        // Magic Image Refiner: 가장자리 중심 리파인
        // creativity 낮게, resemblance 높게 설정하여 원본 유지하면서 가장자리만 스무딩
        const refinerOutput = await replicate.run(
          "fermatresearch/magic-image-refiner:507ddf6f977a7e30e46c0daefd30de7d563c72322f9e4cf7cbac52ef0f667b13",
          {
            input: {
              image: processedImageUrl,
              prompt: "professional product photography, smooth clean edges, seamless silhouette, pristine fabric texture, high quality e-commerce photo, perfect cutout, no jagged edges",
              negative_prompt: "rough edges, jagged silhouette, pixelated edges, artifacts, noise, uneven borders, frayed edges",
              resolution: "original",
              resemblance: 0.95, // 원본 최대 유지
              creativity: 0.05, // 미세한 가장자리 스무딩만
              hdr: 0,
              steps: 15, // 빠른 처리
              guidance_scale: 5,
            }
          }
        );

        if (refinerOutput) {
          const refinerUrl = extractUrlFromOutput(refinerOutput);
          processedImageUrl = await urlToBase64(refinerUrl);
          const mrDuration = Date.now() - mrStart;
          timings.push({ step: 'Magic Refiner', duration: mrDuration });
          console.log(`[Retouch API][${brand}] Magic Refiner completed (${(mrDuration / 1000).toFixed(1)}s)`);
        }
      } catch (mrError: unknown) {
        console.error('[Retouch API] Magic Refiner error:', mrError);
        console.log(`[Retouch API][${brand}] Continuing with previous image...`);
      }
    }

    // 4. 도식화(플랫레이) 처리 - config.flatlay가 true인 경우
    // 선택한 방법에 따라 다른 모델 사용
    if (config.flatlay) {
      const flatlayMethod = config.flatlayMethod || 'sdxl';
      const flatlayStart = Date.now();
      console.log(`[Retouch API][${brand}] Starting flatlay transformation (method: ${flatlayMethod})...`);

      try {
        if (flatlayMethod === 'idm-vton') {
          // Plan A: IDM-VTON + T-pose 인체
          // T-pose 마네킹/인체 이미지에 의류 착장 후 배경 제거
          console.log(`[Retouch API][${brand}] Using IDM-VTON for flatlay...`);

          // T-pose 인체 이미지 (팔 벌린 자세) - 임시 플레이스홀더 URL
          // 실제로는 프로젝트에 T-pose 이미지를 저장하고 사용해야 함
          const tposeHumanUrl = "https://replicate.delivery/pbxt/KgH4s9cYbTSVtKcNnHZTqHvKNlLwXNPKPgZQsZDplKcNnHZT/tpose-mannequin.png";

          const vtonOutput = await replicate.run(
            "cuuupid/idm-vton:c871bb9b046f351a536f5dde9c5c08c919bdde4305de8a0ec25329f0c01a5745",
            {
              input: {
                human_img: tposeHumanUrl,
                garm_img: processedImageUrl,
                category: "upper_body", // TODO: 의류 종류에 따라 동적으로 설정
                crop: false,
                steps: 30,
              }
            }
          );

          if (vtonOutput) {
            const vtonUrl = extractUrlFromOutput(vtonOutput);
            // 착장된 이미지에서 배경 제거 (의류만 추출)
            const nukkiOutput = await replicate.run(
              "men1scus/birefnet:f74986db0355b58403ed20963af156525e2891ea3c2d499bfbfb2a28cd87c5d7",
              { input: { image: vtonUrl } }
            );
            if (nukkiOutput) {
              processedImageUrl = await urlToBase64(extractUrlFromOutput(nukkiOutput));
            }
            const vtonDuration = Date.now() - flatlayStart;
            timings.push({ step: 'IDM-VTON 도식화', duration: vtonDuration });
            console.log(`[Retouch API][${brand}] IDM-VTON flatlay completed (${(vtonDuration / 1000).toFixed(1)}s)`);
          }
        } else if (flatlayMethod === 'tps') {
          // Plan B: Thin-Plate Spline 워핑
          // TODO: TPS 워핑 구현
          console.log(`[Retouch API][${brand}] TPS warping not yet implemented, falling back to SDXL...`);
          // SDXL 폴백
        } else if (flatlayMethod === 'skeleton') {
          // Plan D: Skeleton 기반 부위별 워핑
          // TODO: DWPose + 세그먼트 워핑 구현
          console.log(`[Retouch API][${brand}] Skeleton-based warping not yet implemented, falling back to SDXL...`);
          // SDXL 폴백
        }

        // 기본값 또는 폴백: SDXL img2img
        if (flatlayMethod === 'sdxl' || !['idm-vton'].includes(flatlayMethod)) {
          const flatlayOutput = await replicate.run(
            "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
            {
              input: {
                image: processedImageUrl,
                prompt: "flat lay clothing photography, perfectly symmetrical garment laid flat on white background, professional product photography, clean minimal style, no wrinkles, studio lighting, top-down view, fashion catalog style, high quality",
                negative_prompt: "hanger, mannequin, model, person, wrinkles, creases, shadows, 3d, perspective, angled view, worn, dirty",
                prompt_strength: 0.35,
                num_inference_steps: 25,
                guidance_scale: 7.5,
                scheduler: "K_EULER",
              }
            }
          );

          if (flatlayOutput && Array.isArray(flatlayOutput) && flatlayOutput.length > 0) {
            const flatlayUrl = extractUrlFromOutput(flatlayOutput[0]);
            processedImageUrl = await urlToBase64(flatlayUrl);
            const flatlayDuration = Date.now() - flatlayStart;
            timings.push({ step: 'SDXL 도식화', duration: flatlayDuration });
            console.log(`[Retouch API][${brand}] SDXL flatlay completed (${(flatlayDuration / 1000).toFixed(1)}s)`);
          }
        }
      } catch (flatlayError: unknown) {
        // 도식화 실패해도 배경 제거된 이미지는 반환
        console.error('[Retouch API] flatlay error:', flatlayError);
        console.log(`[Retouch API][${brand}] Continuing with background-removed image...`);
      }
    }

    // 3. 배경색/그림자/크롭은 클라이언트에서 Canvas로 처리

    // 총 처리 시간 로그
    const totalDuration = timings.reduce((sum, t) => sum + t.duration, 0);
    console.log(`[Retouch API][${brand}] Total processing time: ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`[Retouch API][${brand}] Timings:`, timings.map(t => `${t.step}: ${(t.duration / 1000).toFixed(1)}s`).join(', '));

    return NextResponse.json({
      success: true,
      processedImage: processedImageUrl,
      brand,
      config,
      timings, // 각 단계별 처리 시간
    });
  } catch (error) {
    console.error('[Retouch API] Unhandled error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[Retouch API] Error message:', errorMessage);
    return NextResponse.json(
      { success: false, error: `서버 오류: ${errorMessage}` },
      { status: 500 }
    );
  }
}
