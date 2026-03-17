// ============================================
// iPhone Style Lookbook - Hints
// CTR 방식 참고: 서브타입 힌트, 의류 타입 힌트
// ============================================

/**
 * 배경 스팟 타입 정의
 * studio가 기본값 (레퍼런스 프로그램 참고: "Clean white horizon studio background")
 */
export type BackgroundSpotType = 'studio' | 'home' | 'cafe' | 'outdoor' | 'street' | 'custom' | 'dropbox';

/**
 * 배경 스팟 힌트
 * CTR의 SHOT_SUB_TYPE_HINTS 참고
 */
export const BACKGROUND_SPOT_HINTS: Record<BackgroundSpotType, string> = {
  studio: `[Background Spot: Studio - CTR STYLE 호리존]
Clean white horizon studio background with professional, even lighting.
Seamless white backdrop - no visible floor/wall seam or minimal gradient.
Soft, diffused lighting that wraps around the model evenly.
No harsh shadows, no colored backgrounds, no environmental elements.
Think: professional e-commerce studio, clean minimal product photography setup.
CRITICAL: Background must NOT distract from the PRODUCT.`,

  home: `[Background Spot: Home - CTR STYLE 자연광]
Natural daylight with atmospheric window shadows.
Clean minimalist home interior - white or light gray walls.
Window light streaming in creating soft, natural shadows.
Cozy but clean atmosphere, modern apartment feel.
Think: morning light, relaxed weekend vibe, Instagram-worthy home shot.
CRITICAL: Natural lighting is KEY - no artificial studio flash.`,

  cafe: `[Background Spot: Cafe - CTR STYLE]
Cozy cafe interior with warm wood tones.
Natural daylight from large windows mixed with ambient lighting.
Brick walls, wooden furniture, or marble counters visible but not dominant.
Think: trendy brunch spot, soft natural light atmosphere.
CRITICAL: Cafe elements should complement, NOT overpower the PRODUCT.`,

  outdoor: `[Background Spot: Outdoor - CTR STYLE 자연광]
Natural daylight with outdoor environmental background.
Park, garden, or tree-lined path with soft, diffused sunlight.
Dappled shadows through leaves, golden hour quality light.
Think: fresh air feeling, natural outdoor lifestyle shot.
CRITICAL: Natural lighting is KEY - authentic outdoor feel.`,

  street: `[Background Spot: Street - CTR STYLE]
Urban street setting with architectural elements.
Natural daylight on clean sidewalk, interesting building facades.
City atmosphere but not crowded - quiet side street vibe.
Think: morning light in a nice neighborhood, street style shot.
CRITICAL: Urban elements should add context, NOT distract from PRODUCT.`,

  custom: '', // 사용자 업로드 이미지 사용 시 빈 문자열

  dropbox: '', // 드롭박스에서 선택한 배경 이미지 사용 시 빈 문자열 (이미지로 대체)
};

/**
 * 배경 스팟 프리셋 메타데이터
 */
export interface BackgroundSpotPreset {
  type: BackgroundSpotType;
  label: string;
  labelKr: string;
  emoji: string;
  description: string;
}

export const BACKGROUND_SPOT_PRESETS: BackgroundSpotPreset[] = [
  {
    type: 'studio',
    label: 'Studio',
    labelKr: '스튜디오',
    emoji: '⬜',
    description: '깨끗한 흰색 배경, 기본값',
  },
  {
    type: 'home',
    label: 'Home',
    labelKr: '홈',
    emoji: '🏠',
    description: '미니멀한 집 인테리어, 자연광',
  },
  {
    type: 'cafe',
    label: 'Cafe',
    labelKr: '카페',
    emoji: '☕',
    description: '따뜻한 우드톤, 카페 분위기',
  },
  {
    type: 'outdoor',
    label: 'Outdoor',
    labelKr: '야외',
    emoji: '🌳',
    description: '공원, 자연 속 야외 촬영',
  },
  {
    type: 'street',
    label: 'Street',
    labelKr: '거리',
    emoji: '🏙️',
    description: '도시 거리, 어반 분위기',
  },
  {
    type: 'custom',
    label: 'Custom',
    labelKr: '커스텀',
    emoji: '📷',
    description: '직접 배경 이미지 업로드',
  },
  {
    type: 'dropbox',
    label: 'Dropbox',
    labelKr: '드롭박스',
    emoji: '📁',
    description: '드롭박스에서 배경 선택',
  },
];

/**
 * 의류 타입 힌트
 * CTR의 CLOTHING_TYPE_HINTS 참고
 */
export type ClothingType = 'top' | 'outer' | 'bottom' | 'dress' | 'set';

export const CLOTHING_TYPE_HINTS: Record<ClothingType, string> = {
  top: `[Clothing Type: Top - CTR STYLE]
Focus on the top/upper garment (shirt, blouse, t-shirt, sweater) from PRODUCT.
Dress the model in the EXACT garment from PRODUCT — preserve ALL clothing details:
- Color (exact shade, no color shift)
- Pattern (stripes, prints, logos exactly as shown)
- Texture (fabric weave, knit pattern, material feel)
- Design (neckline shape, sleeve style, hem cut)
Ensure neckline, sleeves, and hem are clearly visible.
CRITICAL: The garment must be IDENTICAL to PRODUCT.`,

  outer: `[Clothing Type: Outer - CTR STYLE]
Focus on the outer garment (jacket, coat, blazer, cardigan) from PRODUCT.
Dress the model in the EXACT garment from PRODUCT — preserve ALL clothing details:
- Color, pattern, texture, and design exactly as shown
- Button/zipper hardware, pocket placement, collar shape
- Lining color if visible
Show the garment open or naturally draped.
Inner layer should be simple solid color that doesn't distract.
CRITICAL: The garment must be IDENTICAL to PRODUCT.`,

  bottom: `[Clothing Type: Bottom - CTR STYLE]
Focus on the bottom garment (pants, skirt, shorts) from PRODUCT.
Dress the model in the EXACT garment from PRODUCT — preserve ALL clothing details:
- Color, pattern, texture, and design exactly as shown
- Waistband style, pocket placement, hem style
Ensure waistline, fit, and hem/length are clearly visible.
Top should be simple solid color that doesn't distract.
CRITICAL: The garment must be IDENTICAL to PRODUCT.`,

  dress: `[Clothing Type: Dress - CTR STYLE]
Focus on the one-piece dress/outfit from PRODUCT.
Dress the model in the EXACT garment from PRODUCT — preserve ALL clothing details:
- Color, pattern, texture, and design exactly as shown
- Neckline, waistline, skirt silhouette, sleeve style
Show the complete garment from neckline to hem.
The dress is the entire outfit - no additional layers needed.
CRITICAL: The garment must be IDENTICAL to PRODUCT.`,

  set: `[Clothing Type: Set - CTR STYLE]
This is a coordinated set (top + bottom or full outfit) from PRODUCT.
Dress the model in the EXACT garments from PRODUCT — preserve ALL clothing details:
- Color, pattern, texture, and design of BOTH pieces exactly as shown
Both pieces must be clearly visible and recognizable.
Maintain the styling relationship between pieces.
CRITICAL: Both garments must be IDENTICAL to PRODUCT.`,
};
