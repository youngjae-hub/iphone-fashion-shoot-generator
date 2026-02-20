import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';

// Vercel Serverless Function 설정
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

// 의류 카테고리 타입
export type GarmentCategory = 'top' | 'bottom' | 'dress' | 'outer' | 'accessory' | 'unknown';

interface ClassifyRequest {
  image: string; // base64 이미지
}

interface ClassifyResponse {
  success: boolean;
  category: GarmentCategory;
  confidence: number;
  details?: {
    subcategory?: string; // 세부 카테고리 (예: t-shirt, jeans, coat 등)
    color?: string;
    pattern?: string;
  };
  error?: string;
}

// 카테고리별 최적화된 포즈 추천 (back 제외 - Gemini가 뒷모습 생성 불가)
export const CATEGORY_POSES: Record<GarmentCategory, string[]> = {
  top: ['front', 'side', 'styled', 'sitting', 'fullbody'],
  bottom: ['front', 'side', 'styled', 'sitting', 'fullbody'],
  dress: ['front', 'side', 'styled', 'sitting', 'fullbody'],
  outer: ['front', 'side', 'styled', 'sitting', 'fullbody'],
  accessory: ['front', 'styled'],
  unknown: ['front', 'side', 'styled', 'sitting', 'fullbody'],
};

// 카테고리별 프롬프트 힌트
export const CATEGORY_PROMPTS: Record<GarmentCategory, string> = {
  top: 'upper body clothing, shirt, blouse, top',
  bottom: 'lower body clothing, pants, skirt, shorts',
  dress: 'full body dress, one-piece outfit',
  outer: 'outerwear, jacket, coat, cardigan',
  accessory: 'fashion accessory, bag, hat, scarf',
  unknown: 'clothing item',
};

// Replicate 클라이언트
const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

// 타임아웃 헬퍼
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
  ]);
}

// POST: 의류 이미지 분류
export async function POST(request: NextRequest) {
  try {
    const body: ClassifyRequest = await request.json();
    const { image } = body;

    if (!image) {
      return NextResponse.json(
        { success: false, error: '이미지가 필요합니다.' },
        { status: 400 }
      );
    }

    // BLIP 모델 호출 (8초 타임아웃)
    try {
      const output = await withTimeout(
        replicate.run(
          "salesforce/blip:2e1dddc8621f72155f24cf2e0adbde548458d3cab9f00c0139eea840d0ac4746",
          {
            input: {
              image: image,
              task: "image_captioning",
            },
          }
        ),
        8000 // 8초 타임아웃
      );

      const caption = typeof output === 'string' ? output : String(output);
      console.log('🔍 BLIP-2 Caption:', caption);

      const category = extractCategory(caption.toLowerCase());
      console.log(`📊 Classification: ${category.type} (confidence: ${(category.confidence * 100).toFixed(1)}%)`);
      const details = extractDetails(caption.toLowerCase());

      return NextResponse.json({
        success: true,
        category: category.type,
        confidence: category.confidence,
        details,
      });
    } catch (timeoutError) {
      // 타임아웃 시 기본값 'dress' 반환
      console.warn('⏱️ Classification timeout, defaulting to dress');
      return NextResponse.json({
        success: true,
        category: 'dress' as GarmentCategory,
        confidence: 0.3,
        details: {},
        error: '분류 시간 초과, 기본값 사용',
      });
    }
  } catch (error) {
    console.error('Garment classification error:', error);

    return NextResponse.json({
      success: true,
      category: 'dress' as GarmentCategory,
      confidence: 0.3,
      details: {},
      error: 'AI 분류 실패, 기본값 사용',
    });
  }
}

// 캡션에서 의류 카테고리 추출
function extractCategory(caption: string): { type: GarmentCategory; confidence: number } {
  // 카테고리별 키워드 및 가중치
  const keywords: Record<GarmentCategory, { words: string[]; priority: number }> = {
    dress: {
      words: [
        'dress', 'gown', 'one-piece', 'onepiece', 'romper', 'jumpsuit',
        'maxi', 'midi', 'mini dress', 'sundress', 'frock', 'tunic',
        'long dress', 'short dress', 'sleeveless dress', 'floral dress',
        'black dress', 'white dress', 'wearing a', 'woman in a'
      ],
      priority: 4 // 최우선 (더 높은 우선순위)
    },
    top: {
      words: ['shirt', 'blouse', 't-shirt', 'tee', 'top', 'sweater', 'hoodie', 'polo', 'tank', 'crop top', 'knit'],
      priority: 2
    },
    bottom: {
      words: ['pants', 'jeans', 'skirt', 'shorts', 'trousers', 'leggings', 'slacks', 'culottes'],
      priority: 2
    },
    outer: {
      words: ['jacket', 'coat', 'cardigan', 'blazer', 'vest', 'parka', 'windbreaker', 'overcoat', 'trench'],
      priority: 2
    },
    accessory: {
      words: ['bag', 'purse', 'hat', 'cap', 'scarf', 'belt', 'watch', 'jewelry', 'sunglasses', 'necklace', 'bracelet', 'handbag', 'clutch'],
      priority: 1 // 최후순위 - 명확한 액세서리 키워드만
    },
    unknown: { words: [], priority: 0 },
  };

  let bestMatch: GarmentCategory = 'unknown';
  let maxScore = 0;
  let bestPriority = 0;

  for (const [category, config] of Object.entries(keywords)) {
    if (category === 'unknown') continue;

    let score = 0;
    for (const word of config.words) {
      if (caption.includes(word)) {
        score += 1;
        // 정확한 단어 매칭에 가중치
        if (caption.includes(` ${word} `) || caption.startsWith(word) || caption.endsWith(word)) {
          score += 0.5;
        }
      }
    }

    // 우선순위 적용: 점수가 같으면 우선순위가 높은 것 선택
    if (score > maxScore || (score === maxScore && config.priority > bestPriority)) {
      maxScore = score;
      bestMatch = category as GarmentCategory;
      bestPriority = config.priority;
    }
  }

  // 신뢰도 계산 (0-1)
  let confidence = maxScore > 0 ? Math.min(maxScore / 2, 1) : 0;

  // ⚠️ 액세서리 분류는 매우 엄격하게: 명확한 액세서리 단어가 있어야만 인정
  const strictAccessoryWords = ['handbag', 'purse', 'backpack', 'wallet', 'clutch bag', 'tote bag', 'shoulder bag'];
  const isStrictAccessory = strictAccessoryWords.some(word => caption.includes(word));

  // ⚠️ 신뢰도 검증 강화:
  // accessory는 매우 명확한 경우에만 유지, 그 외에는 모두 dress로 변경
  if (bestMatch === 'accessory' && !isStrictAccessory) {
    console.warn(`⚠️ Accessory classification overridden: not a strict accessory match, defaulting to 'dress'`);
    bestMatch = 'dress';
    confidence = 0.4;
  } else if (bestMatch === 'unknown') {
    console.warn(`⚠️ Unknown classification, defaulting to 'dress'`);
    bestMatch = 'dress';
    confidence = 0.3;
  }

  return { type: bestMatch, confidence };
}

// 캡션에서 추가 세부 정보 추출
function extractDetails(caption: string): ClassifyResponse['details'] {
  const details: ClassifyResponse['details'] = {};

  // 색상 추출
  const colors = ['white', 'black', 'red', 'blue', 'green', 'yellow', 'pink', 'purple', 'orange', 'brown', 'gray', 'grey', 'beige', 'navy'];
  for (const color of colors) {
    if (caption.includes(color)) {
      details.color = color;
      break;
    }
  }

  // 패턴 추출
  const patterns = ['striped', 'plaid', 'floral', 'solid', 'checkered', 'dotted', 'printed'];
  for (const pattern of patterns) {
    if (caption.includes(pattern)) {
      details.pattern = pattern;
      break;
    }
  }

  return details;
}
