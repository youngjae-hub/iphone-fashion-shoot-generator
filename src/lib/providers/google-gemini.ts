// ============================================
// Google Gemini / Nano Banana Pro Image Generation Provider
// ============================================

import {
  IImageGenerationProvider,
  ModelGenerationOptions,
  BackgroundOptions,
} from './base';

// 에이블리/지그재그 스타일 프롬프트 생성
function generateAblelyStylePrompt(pose: string, garmentDescription?: string): string {
  const stylePrompt = `
    Korean online shopping mall style photography,
    iPhone camera quality, natural daylight,
    clean simple background (plain wall or neutral backdrop),
    young Korean female model in her early 20s,
    face cropped above lips showing only chin and lips,
    relaxed natural pose like friend took the photo,
    natural color grading, realistic skin tones,
    not too perfect - authentic social media aesthetic,
    WIDE SHOT with generous framing - shot from distance,
    full body shot with plenty of space around the model,
    include environment and surroundings in frame,
    model should occupy about 60-70% of the frame height
  `.trim().replace(/\s+/g, ' ');

  const posePrompts: Record<string, string> = {
    front: 'wide full body shot, standing casually facing camera, weight on one leg, natural stance, shot from distance with room around model',
    side: 'wide full body shot from side angle, looking away from camera, candid feel, plenty of negative space around model',
    back: 'wide full body shot from back view, looking over shoulder slightly, showing outfit back, shot from distance',
    styled: 'wide shot mid-movement pose, walking or adjusting clothes, lifestyle moment, full body visible with environment',
    detail: '3/4 body shot focusing on outfit details, fabric texture, accessories, still showing most of the outfit',
  };

  const poseStr = posePrompts[pose] || posePrompts.front;
  const garmentStr = garmentDescription ? `wearing ${garmentDescription}` : '';

  return `${stylePrompt}, ${poseStr}${garmentStr ? `, ${garmentStr}` : ''}`;
}

// Google Nano Banana Pro 모델 사용 (더 고품질 이미지 생성)
export class GoogleGeminiImageProvider implements IImageGenerationProvider {
  name = 'google-gemini';
  private apiKey: string;
  // Nano Banana Pro - 더 고품질 이미지 생성
  private model = 'nano-banana-pro-preview';

  constructor() {
    this.apiKey = process.env.GOOGLE_CLOUD_API_KEY || '';
  }

  async generateModelImage(options: ModelGenerationOptions): Promise<string> {
    // 포즈별 상세 프롬프트 - 넓은 프레이밍 강조
    const poseDescriptions: Record<string, string> = {
      front: 'WIDE FULL BODY SHOT from distance, standing casually facing camera, weight shifted to one leg, hands relaxed at sides or one hand touching hair, natural smile with chin down, plenty of space around model showing environment',
      side: 'WIDE FULL BODY SHOT, side profile walking pose, mid-stride, looking slightly away from camera, candid street style moment, shot from distance with generous framing',
      back: 'WIDE FULL BODY SHOT, back view showing outfit from behind, head turned slightly over shoulder, hair flowing naturally, include surroundings in frame',
      styled: 'WIDE SHOT lifestyle action pose - sitting on wooden chair with legs crossed, OR twirling/spinning making skirt flow, OR adjusting collar/sleeves, OR hand in pocket leaning against wall, full body visible with environment',
      detail: '3/4 BODY SHOT with comfortable framing, focusing on outfit details and fabric texture, hands visible interacting with clothing, not too tight',
    };

    const posePrompt = poseDescriptions[options.pose] || poseDescriptions.front;

    // 스타일 참조 이미지가 있는 경우 다른 프롬프트 사용
    const styleRefCount = options.styleReferenceImages?.length || 0;
    const hasStyleRef = styleRefCount > 0;

    // 배경 스팟 이미지 확인
    const backgroundSpotCount = options.backgroundSpotImages?.length || 0;
    const hasBackgroundSpot = backgroundSpotCount > 0;

    // 에이블리/지그재그 스타일 프롬프트 생성
    const textPrompt = options.garmentImage
      ? `Generate a fashion photo ${hasStyleRef ? 'that matches the EXACT STYLE of the reference images' : 'in Korean online shopping mall (Ably/Zigzag) style'}.

${hasStyleRef ? `CRITICAL - STYLE REFERENCE (${styleRefCount} images provided):
The first ${styleRefCount} image(s) show the EXACT photography style you must replicate:
- Copy the lighting, color grading, background style from these references
- Match the camera angle and composition
- Replicate the authentic, slightly imperfect feel
- Same level of image noise/grain if present
- Blend the best elements from all reference images
` : `STYLE REQUIREMENTS:
- iPhone camera quality, natural daylight from window
- Natural color grading, realistic skin tones, no color cast
${hasBackgroundSpot ? '' : '- Clean simple background: plain wall, neutral backdrop, or minimal setting'}
- Authentic social media aesthetic, not too perfect
- Add slight motion blur or soft focus for realism
- Include natural shadows and lighting inconsistencies
`}
${hasBackgroundSpot ? `CRITICAL - BACKGROUND/LOCATION REFERENCE (${backgroundSpotCount} images provided):
The background/location spot images show the EXACT location where the photo should be taken:
- Use the EXACT same background location shown in the reference images
- Match the environment, furniture, walls, floors, and decorations from the reference
- Maintain the lighting conditions and atmosphere of the location
- Place the model naturally in this environment as if she was actually photographed there
- Keep the background recognizable but with the model as the focus
- The final image should look like it was shot at this exact location
` : ''}
FRAMING REQUIREMENTS (CRITICAL):
- WIDE SHOT composition - shoot from distance
- Full body visible with generous space around the model
- Model should occupy about 60-70% of the frame height, NOT filling the entire frame
- Include environment and surroundings in the shot
- Avoid tight cropping - leave breathing room on all sides
- The viewer should see the full outfit from head to toe with space to spare
${options.customPrompt ? `\nADDITIONAL STYLE:\n${options.customPrompt}\n` : ''}
MODEL REQUIREMENTS:
- Korean female model in early 20s
- Face cropped above lips (show only chin and lips for anonymity)
- Natural relaxed expression, not posed

POSE: ${posePrompt}

CRITICAL - GARMENT:
The model MUST wear the EXACT garment shown in the ${hasStyleRef || hasBackgroundSpot ? 'garment' : ''} reference image.
- Same pattern, same colors, same fabric texture
- Natural fabric draping and wrinkles
- Do NOT change or interpret the garment differently

Make it look like a real photo taken by a friend, not AI-generated.`
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
