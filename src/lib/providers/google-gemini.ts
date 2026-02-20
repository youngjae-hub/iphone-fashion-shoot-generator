// ============================================
// Google Gemini / Nano Banana Pro Image Generation Provider
// ============================================

import {
  IImageGenerationProvider,
  ModelGenerationOptions,
  BackgroundOptions,
} from './base';

// ⭐️ Phase 1-3: 간결한 에이블리/지그재그 스타일 프롬프트
function generateAblelyStylePrompt(pose: string, garmentDescription?: string): string {
  const stylePrompt = `
    Korean fashion lookbook photography,
    iPhone quality with natural daylight,
    clean minimal background,
    young Korean woman model in early 20s,
    natural relaxed posture,
    authentic real-photo aesthetic,
    sharp details and true-to-life colors
  `.trim().replace(/\s+/g, ' ');

  const posePrompts: Record<string, string> = {
    front: 'full body standing naturally, weight on one leg',
    side: 'full body side view, candid walking moment',
    back: 'full body back view, looking over shoulder',
    styled: 'dynamic lifestyle pose with natural movement',
    sitting: 'sitting pose, relaxed casual posture',
    fullbody: 'full body shot from head to feet',
  };

  const poseStr = posePrompts[pose] || posePrompts.front;
  const garmentStr = garmentDescription ? `wearing ${garmentDescription}` : '';

  return `${stylePrompt}, ${poseStr}${garmentStr ? `, ${garmentStr}` : ''}`;
}

// Google Nano Banana Pro 모델 사용 (더 고품질 이미지 생성)
export class GoogleGeminiImageProvider implements IImageGenerationProvider {
  name = 'google-gemini';
  private apiKey: string;
  // ⚠️ 모델 변경 시 반드시 커밋할 것! (unstaged 변경으로 인한 혼란 방지)
  private model = 'nano-banana-pro-preview';

  // 디버깅용: 실제 사용 중인 모델명 반환
  getModelName(): string {
    return this.model;
  }

  constructor() {
    this.apiKey = process.env.GOOGLE_CLOUD_API_KEY || '';
    // 🔍 시작 시 실제 모델 로깅 (디버깅용)
    console.log(`[GoogleGeminiImageProvider] Initialized with model: ${this.model}`);
  }

  async generateModelImage(options: ModelGenerationOptions): Promise<string> {
    // ⭐️ Phase 1-3: 포즈별 프롬프트 - VTON용 전신 + 자연스러운 포즈
    const poseDescriptions: Record<string, string> = {
      front: 'FULL BODY standing naturally, weight on one leg, arms relaxed at sides, TALL slim fashion model',
      side: 'FULL BODY side profile walking, arms natural, LONG legs, elegant stride',
      back: 'FULL BODY REAR VIEW - model facing AWAY from camera with back to viewer, standing relaxed, hair in bun visible from behind, shoulder blades visible through fabric, CAMERA BEHIND THE MODEL looking at her back',
      styled: 'FULL BODY casual standing, one hand in pocket, relaxed, TALL model proportions',
      sitting: 'FULL BODY sitting on stool, legs visible, hands on knee, slim figure',
      fullbody: 'FULL BODY standing straight, arms at sides, TALL SLIM silhouette with long legs',
    };

    const posePrompt = poseDescriptions[options.pose] || poseDescriptions.front;

    // 스타일 참조 이미지가 있는 경우 다른 프롬프트 사용
    const styleRefCount = options.styleReferenceImages?.length || 0;
    const hasStyleRef = styleRefCount > 0;

    // 배경 스팟 이미지 확인
    const backgroundSpotCount = options.backgroundSpotImages?.length || 0;
    const hasBackgroundSpot = backgroundSpotCount > 0;

    // ⭐️ 카테고리별 프레이밍 (VTON용 전신 유지 + 카테고리별 강조점)
    const category = options.garmentCategory || 'dresses';
    const framingByCategory: Record<string, string> = {
      upper_body: `- FULL BODY from head to feet (required for processing)
- EMPHASIS on upper body/torso area
- Show the top garment prominently`,
      lower_body: `- FULL BODY from head to feet (required for processing)
- Show from PANT HEM up to BELLY/LOWER CHEST area
- Simple fitted top tucked in
- ⚠️ PRESERVE original pants SILHOUETTE - do not alter fit or shape`,
      dresses: `- FULL BODY from head to feet (required for processing)
- Show complete dress silhouette
- Balance upper and lower portions`,
    };

    const garmentDetailsByCategory: Record<string, string> = {
      upper_body: `- Show collar, buttons, pockets, sleeves clearly
- Capture fabric texture and draping on torso
- If cardigan/jacket: show how it layers over inner clothing`,
      lower_body: `- ⚠️ PRESERVE EXACT SILHOUETTE from product image
- Same leg width, same fit (wide-leg, straight, slim)
- Show waistband, drawstring, pockets EXACTLY as in product
- SAME drawstring COLOR in ALL poses
- Do NOT change the pants shape or proportions`,
      dresses: `- Show neckline, waist, skirt/hem details
- Capture how dress flows and drapes
- Show full silhouette`,
    };

    // ⭐️ Phase 1-3: 프롬프트 - 스타일 참조는 분위기만, 의류 디테일 강조
    const textPrompt = options.garmentImage
      ? `Generate a NEW fashion lookbook photo with iPhone photography aesthetic.

${hasStyleRef ? `🚨 MANDATORY - COPY REFERENCE IMAGE EXACTLY (ALL POSES INCLUDING FRONT):

⚠️ INNER CLOTHING - THIS IS THE MOST IMPORTANT RULE:
- LOOK at the reference image FIRST
- The model wears a SPECIFIC garment (hoodie/jacket/t-shirt/etc)
- You MUST use the EXACT SAME garment in your output
- SAME color, SAME style, SAME type
- This applies to EVERY pose: front, side, back, styled, fullbody
- DO NOT use white t-shirt unless reference shows white t-shirt
- DO NOT use short sleeves unless reference shows short sleeves
- COPY THE REFERENCE EXACTLY

⚠️ BACKGROUND - ALSO MANDATORY:
- Use the EXACT SAME background/location as reference
- Same wall color, same floor, same lighting
- This applies to ALL poses including front pose

✅ ONLY vary the pose angle
❌ DO NOT change inner clothing
❌ DO NOT change background
` : `CORE STYLE - iPhone Photography:
- Natural daylight, soft window lighting
- Sharp focus with natural depth of field
- True-to-life colors, no heavy filters
- Clean composition

⚠️ CONSISTENT BACKGROUND (same across ALL poses):
- Simple PLAIN WHITE or light gray studio wall
- Wooden floor
- NO furniture, NO plants, NO props
- Same background in every shot

🚨 MANDATORY STYLING (MUST be identical in ALL poses):
${category === 'upper_body' ? `- PANTS: GRAY wide-leg sweatpants ONLY
- ❌ NO red pants, NO black pants, NO jeans - ONLY GRAY SWEATPANTS
- The same gray sweatpants MUST appear in EVERY single shot` : ''}
${category === 'lower_body' ? `- TOP: Simple WHITE t-shirt tucked in ONLY
- ❌ NO other colors, NO patterns - ONLY WHITE T-SHIRT
- The same white t-shirt MUST appear in EVERY single shot` : ''}
${category === 'dresses' ? `- Just the dress alone, no additional layers` : ''}
- ⚠️ THIS IS NON-NEGOTIABLE: Check your output - if styling differs between poses, regenerate
`}
${options.customPrompt ? `CUSTOM STYLE: ${options.customPrompt}\n` : ''}
MODEL & FRAMING (Category: ${category.toUpperCase()}):
⚠️ CRITICAL - CONSISTENT MODEL (same person across all poses):
- Korean woman, early 20s, TALL SLIM fashion model build
- Black straight hair tied back, natural makeup
- 8-head body ratio with LONG legs
- Same model appearance in every shot (consistency is key)

⚠️ CRITICAL - HEAD POSITION FOR CROPPING:
- Head must start at TOP 5% of frame (very little headroom)
- Eyes should be at approximately 10-12% from top of image
- This ensures consistent cropping across all shots
${framingByCategory[category] || framingByCategory.dresses}

POSE: ${posePrompt}

${options.pose === 'back' ? `🚨 CRITICAL - THIS IS A BACK VIEW SHOT:
- The MODEL is facing AWAY from the camera (we see her back)
- Her face is NOT visible (facing away from camera)

⚠️ GARMENT BACK STRUCTURE - VERY IMPORTANT:
- The BACK of this garment is FULLY CLOSED with solid fabric
- ❌ NO open back design, ❌ NO cutouts, ❌ NO skin visible through the back
- Cardigans/sweaters/jackets: front opens with buttons, but BACK is SOLID CLOSED fabric
- The back should be plain fabric matching the main garment color (black/navy/etc)
- NO decorations on back, just solid fabric covering the entire back` : `⚠️ CRITICAL - GARMENT DETAILS (${category.toUpperCase()}):
The model must wear the EXACT garment from the product image.
- Preserve ALL details IDENTICALLY in every pose
- Drawstring/string color must be EXACTLY the same (check product image)
- Button color, pocket style, stitching - ALL must match product
- Exact color match for entire garment
- Correct fabric texture and draping
${garmentDetailsByCategory[category] || garmentDetailsByCategory.dresses}`}

Output: Professional fashion photo with CONSISTENT garment details across all poses.`
      : generateAblelyStylePrompt(options.pose, options.style);

    // 요청 body 구성
    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];

    // 스타일 참조 이미지들 먼저 추가 (최대 10장)
    if (options.styleReferenceImages && options.styleReferenceImages.length > 0) {
      for (const styleRef of options.styleReferenceImages) {
        const base64Data = styleRef.replace(/^data:image\/\w+;base64,/, '');
        const mimeType = styleRef.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

        parts.push({
          inlineData: {
            mimeType,
            data: base64Data,
          },
        });
      }
    }

    // 배경 스팟 이미지들 추가 (최대 5장)
    if (options.backgroundSpotImages && options.backgroundSpotImages.length > 0) {
      for (const bgSpot of options.backgroundSpotImages) {
        const base64Data = bgSpot.replace(/^data:image\/\w+;base64,/, '');
        const mimeType = bgSpot.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

        parts.push({
          inlineData: {
            mimeType,
            data: base64Data,
          },
        });
      }
    }

    // 의류 이미지 추가 (마지막에 추가하여 명확히 구분)
    if (options.garmentImage) {
      const base64Data = options.garmentImage.replace(/^data:image\/\w+;base64,/, '');
      const mimeType = options.garmentImage.match(/^data:(image\/\w+);base64,/)?.[1] || 'image/jpeg';

      parts.push({
        inlineData: {
          mimeType,
          data: base64Data,
        },
      });
    }

    parts.push({ text: textPrompt });

    // 🔍 실제 호출되는 모델 로깅 (디버깅용)
    console.log(`[Gemini] Calling model: ${this.model} for pose: ${options.pose}`);

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            responseModalities: ['image', 'text'],
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error('Gemini API Error:', error);
      throw new Error(`Google Gemini API error: ${error}`);
    }

    const data = await response.json();

    // 이미지 데이터 추출
    if (data.candidates && data.candidates[0]?.content?.parts) {
      for (const part of data.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }

    throw new Error('No image generated from Gemini');
  }

  async generateBackground(options: BackgroundOptions): Promise<string> {
    const prompt = options.prompt || `
      simple clean background,
      natural daylight from window,
      minimalist aesthetic, neutral tones,
      online shopping mall photo backdrop style
    `.trim();

    return this.generateModelImage({
      pose: 'front',
      style: prompt,
    });
  }

  async isAvailable(): Promise<boolean> {
    return !!this.apiKey;
  }
}
