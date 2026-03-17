// ============================================
// iPhone Style Lookbook - Shot Type Templates
// CTR 방식 참고: 촬영 타입별 완전히 다른 프롬프트
// ============================================

/**
 * 촬영 타입 정의
 */
export type ShotType = 'iphone_crop' | 'iphone_partial_face' | 'iphone_fullbody';

/**
 * 촬영 타입별 템플릿
 * CTR의 PROMPT_TEMPLATES 구조 참고
 */
export const SHOT_TEMPLATES: Record<ShotType, string> = {
  /**
   * 아이폰_크롭: 얼굴 완전 크롭 (익명성 최대)
   * 가장 많이 사용될 기본 타입
   */
  iphone_crop: `[Framing - CRITICAL]
Frame from neck/collarbone down to mid-thigh or knees.
NO face visible at all - crop cleanly above the chin.
Do NOT blur, mosaic, or cover the face - simply frame it OUT of the shot.
The top of the frame should cut off at the neck or just below chin.

[Model Pose]
Natural, relaxed standing pose as if photographed by a friend.
Weight slightly on one leg, arms relaxed or one hand in pocket/touching hair.
NOT a stiff fashion pose - think candid moment.

[Clothing]
Dress the model in the exact garment from PRODUCT.
Preserve ALL details: color, pattern, texture, logos, stitching.
The garment must be clearly the hero of the shot.

[Background Integration]
Integrate the model naturally into the BACKGROUND_SPOT environment.
Lighting should match the background - if outdoor, use natural daylight.
Subtle depth of field to separate model from background.`,

  /**
   * 아이폰_부분얼굴: 턱선~입술까지 살짝 보이는 컷
   * 약간의 인간미를 더하면서 익명성 유지
   */
  iphone_partial_face: `[Framing - IMPORTANT]
Show the model from mid-chest up to lips/chin area.
Include partial lower face (chin, lips, maybe nose tip) but NOT eyes.
The top of frame should cut off around the nose or just above lips.
This creates intimacy while maintaining anonymity.

[Face Crop Rule]
CRITICAL: Eyes must NEVER be visible.
Acceptable: chin, lips, lower cheeks, jawline
NOT acceptable: eyes, forehead, full face

[Model Pose]
Slight head tilt, natural expression on visible lips.
Can be looking down or to the side.
Relaxed shoulders, casual arm position.

[Clothing]
Dress the model in the exact garment from PRODUCT.
Preserve ALL details: color, pattern, texture, logos.

[Background Integration]
Match the environment from BACKGROUND_SPOT.
Natural lighting that wraps around the face softly.`,

  /**
   * 아이폰_전신: 머리부터 발끝까지
   * 거리감으로 자연스러운 익명성
   */
  iphone_fullbody: `[Framing]
Full body shot from top of head to feet.
Model should fill about 60-70% of frame height.
Leave some environment visible around the model.

[Face Privacy Through Distance]
The face will naturally be small in the frame due to full body framing.
Model can be looking away, down, or at phone - NOT directly at camera.
This creates natural anonymity through distance and gaze direction.

[Model Pose]
Walking, standing casually, or interacting with environment.
Dynamic but natural movement - NOT posed.
Think: someone caught you in a candid moment.

[Clothing]
Dress the model in the exact garment from PRODUCT.
Full garment must be visible from neckline to hem.
Preserve ALL details: color, pattern, texture, logos.

[Background Integration]
BACKGROUND_SPOT should be prominent - model is IN the environment.
Environmental context tells a story.
Natural depth and perspective.`,
};

/**
 * 촬영 타입 메타데이터
 */
export interface ShotTypeConfig {
  type: ShotType;
  label: string;
  labelKr: string;
  description: string;
  isDefault: boolean;
}

export const SHOT_TYPE_CONFIGS: ShotTypeConfig[] = [
  {
    type: 'iphone_crop',
    label: 'Cropped',
    labelKr: '크롭 (얼굴X)',
    description: '목부터 허벅지까지, 얼굴 완전 크롭',
    isDefault: true,
  },
  {
    type: 'iphone_partial_face',
    label: 'Partial Face',
    labelKr: '부분 얼굴',
    description: '턱선~입술까지 살짝 보이는 컷',
    isDefault: false,
  },
  {
    type: 'iphone_fullbody',
    label: 'Full Body',
    labelKr: '전신',
    description: '머리부터 발끝까지, 거리감 있는 전신샷',
    isDefault: false,
  },
];

// ============================================
// 상의(이너) 전용 5가지 표준 포즈 템플릿
// 레퍼런스: Dropbox 폴더2 (검은색 V넥 긴팔) 이미지 분석 기반
// ============================================

export type TopPoseType = 'top_front' | 'top_hair_touch' | 'top_side_glance' | 'top_leaning' | 'top_detail' | 'top_sitting';

/**
 * 상의(이너) 전용 포즈별 프롬프트 템플릿
 * 핵심: 상의가 주인공 → 상반신~무릎 미디엄 샷 위주
 */
export const TOP_POSE_TEMPLATES: Record<TopPoseType, string> = {
  /**
   * 1. Front Relaxed (정면 릴렉스)
   * 가장 기본적인 정면 스탠딩 포즈
   */
  top_front: `[Pose: Front Relaxed]
Standing naturally facing camera, weight slightly shifted to one leg.
Arms relaxed at sides with fingers loosely open.
Shoulders back, chest open to showcase neckline and front of garment.

[Face Crop - MANDATORY - CTR STYLE]
Frame the shot from chin/lips DOWN to hip level.
The upper face (eyes, nose) must be cleanly cropped out by the TOP EDGE of the frame.
Do NOT crop too low - chin/lips should be at the very top of the image.
CRITICAL: If only neck/chest is visible at top, you have cropped TOO LOW.

[Framing - UPPER BODY PRIORITY]
The TOP garment must fill 70-80% of the frame.
Show minimal lower body - just enough to establish standing pose.
CRITICAL: This is a TOP/upper garment shot - upper body is the HERO.`,

  /**
   * 2. Hair Touch (헤어 터치)
   * 레퍼런스: IMG_3655 - 한 손으로 머리카락 터치
   */
  top_hair_touch: `[Pose: Hair Touch]
One hand gently touching hair near ear, neck, or adjusting a strand.
Other arm relaxed at side or hand in pocket.
Slight natural head tilt, creating soft S-curve in posture.
Elbow bent to showcase sleeve detail of the garment.

[Face Crop - MANDATORY - CTR STYLE]
Frame the shot from chin/lips DOWN to hip level.
The upper face (eyes, nose) must be cleanly cropped out by the TOP EDGE of the frame.
The hand touching hair should be visible, but NOT the eyes.
Do NOT crop too low - chin/lips should be at the very top of the image.
CRITICAL: If only neck/chest is visible at top, you have cropped TOO LOW.

[Framing - UPPER BODY PRIORITY]
The TOP garment and sleeve must fill 70-80% of the frame.
Focus on torso and arm holding hair.
Natural window light from side preferred.`,

  /**
   * 3. Side Glance (사이드 시선)
   * 레퍼런스: IMG_3657 - 측면으로 시선, 턱 근처 손
   */
  top_side_glance: `[Pose: Side Glance]
Body at 3/4 angle to camera, face turned to look away.
One hand delicately near chin or jaw.
Other hand at side or on hip.
Creates elegant silhouette showing garment shape.

[Face Crop - MANDATORY - CTR STYLE]
Frame the shot from chin/lips DOWN to hip level.
The upper face (eyes, nose) must be cleanly cropped out by the TOP EDGE of the frame.
Side profile showing only: chin, lips at the very top.
Do NOT crop too low - chin/lips should be at the very top of the image.
CRITICAL: If only neck/chest is visible at top, you have cropped TOO LOW.

[Framing - UPPER BODY PRIORITY]
The TOP garment must fill 70-80% of the frame.
Neckline and collar detail clearly visible.
Side angle shows how garment drapes on the torso.`,

  /**
   * 4. Leaning Casual (기대기 캐주얼)
   * 레퍼런스: IMG_3656 - 창가에 기대기
   */
  top_leaning: `[Pose: Leaning Casual]
Leaning slightly against window sill, wall, or architectural element.
One leg slightly bent, weight on the leaning side.
One hand resting on surface, other arm relaxed or touching hair.
Comfortable, relaxed lifestyle moment.

[Face Crop - MANDATORY - CTR STYLE]
Frame the shot from chin/lips DOWN to hip level.
The upper face (eyes, nose) must be cleanly cropped out by the TOP EDGE of the frame.
Do NOT crop too low - chin/lips should be at the very top of the image.
CRITICAL: If only neck/chest is visible at top, you have cropped TOO LOW.

[Framing - UPPER BODY PRIORITY]
The TOP garment must fill 70-80% of the frame.
Show how the garment drapes when leaning - focus on torso.
Environmental element (window, wall) partially visible at edge.
Soft natural lighting from the lean-point direction.`,

  /**
   * 5. Detail Neckline (디테일 넥라인)
   * 클로즈업: 넥라인, 칼라, 소재 강조
   */
  top_detail: `[Pose: Detail Neckline]
Close-up focused on neckline, collar, and upper chest area.
Minimal pose - shoulders and collar bone visible.
Subtle fabric texture and material quality emphasized.
Clean, product-focused composition.

[Face Crop - MANDATORY - CTR STYLE]
Frame the shot from chin/lips DOWN to mid-chest.
The upper face (eyes, nose) must be cleanly cropped out by the TOP EDGE of the frame.
Do NOT crop too low - chin/lips should be at the very top of the image.
CRITICAL: If only neck/chest is visible at top, you have cropped TOO LOW.
This is a PRODUCT detail shot - focus on neckline, not face.

[Framing - DETAIL SHOT]
Neckline is the focal point - show collar construction, texture.
Arms NOT visible or just shoulder edges.
Even, soft lighting to show fabric texture.`,

  /**
   * 6. Sitting (앉은 포즈)
   * 의자/스툴에 앉은 캐주얼 포즈
   */
  top_sitting: `[Pose: Sitting - UPPER BODY FOCUS]
Model sitting on a stool, chair, or bench.
Relaxed seated posture with good posture - back straight but not stiff.
Hands resting on lap or one hand on thigh.
Natural, comfortable seated position that showcases the top garment.

[Face Crop - MANDATORY - CTR STYLE]
Frame the shot from chin/lips DOWN to lap level.
The upper face (eyes, nose) must be cleanly cropped out by the TOP EDGE of the frame.
Do NOT crop too low - chin/lips should be at the very top of the image.
CRITICAL: If only neck/chest is visible at top, you have cropped TOO LOW.

[Framing - UPPER BODY PRIORITY]
The TOP garment must fill 70-80% of the frame.
Show minimal lower body - just enough to establish seated pose.
CRITICAL: Upper body is the HERO - focus on torso, not legs.

[Clothing Focus]
The TOP garment is the hero - showcase:
- How fabric falls and drapes when seated
- Shoulder and chest fit in seated position
- Sleeve position and length
- Overall silhouette of the upper body`,
};

/**
 * 상의 포즈 메타데이터
 */
export interface TopPoseConfig {
  type: TopPoseType;
  label: string;
  labelKr: string;
  description: string;
}

export const TOP_POSE_CONFIGS: TopPoseConfig[] = [
  {
    type: 'top_front',
    label: 'Front Relaxed',
    labelKr: '정면 릴렉스',
    description: '자연스러운 정면 스탠딩, 상의 전면 강조',
  },
  {
    type: 'top_hair_touch',
    label: 'Hair Touch',
    labelKr: '헤어 터치',
    description: '머리카락 터치 포즈, 소매 디테일 강조',
  },
  {
    type: 'top_side_glance',
    label: 'Side Glance',
    labelKr: '사이드 시선',
    description: '3/4 측면 앵글, 실루엣 강조',
  },
  {
    type: 'top_leaning',
    label: 'Leaning Casual',
    labelKr: '기대기 캐주얼',
    description: '창가/벽 기대기, 라이프스타일 무드',
  },
  {
    type: 'top_detail',
    label: 'Detail Neckline',
    labelKr: '디테일 넥라인',
    description: '넥라인 클로즈업, 소재/디테일 강조',
  },
  {
    type: 'top_sitting',
    label: 'Sitting',
    labelKr: '앉은 포즈',
    description: '앉은 자세, 상의 드레이프 강조',
  },
];

// ============================================
// 하의(바지/스커트) 전용 포즈 템플릿
// ============================================

export type BottomPoseType = 'bottom_front' | 'bottom_side' | 'bottom_walking' | 'bottom_sitting' | 'bottom_back' | 'bottom_leaning';

/**
 * 하의 전용 포즈별 프롬프트 템플릿
 * 핵심: 하의가 주인공 → 허리~발목 프레이밍, 다리 라인/실루엣 강조
 */
export const BOTTOM_POSE_TEMPLATES: Record<BottomPoseType, string> = {
  /**
   * 1. Front Standing (정면 스탠딩)
   * 바지 전면 실루엣 강조
   */
  bottom_front: `[Pose: Front Standing - BOTTOM FOCUS]
Standing naturally facing camera, weight slightly shifted to one leg.
Arms relaxed at sides or hands in pockets.
Legs together or slightly apart to show pants silhouette.

[Face Crop - MANDATORY - CTR STYLE]
Frame the shot from mid-chest DOWN to include BOTH FEET with shoes.
The upper face (eyes, nose) must be cleanly cropped out by the TOP EDGE of the frame.
For PANTS shots, chest-level crop is acceptable (lower than tops/dresses).
CRITICAL: Focus is on the PANTS, not the face.

[Framing - CRITICAL FOR PANTS]
The pants must be fully visible from waistband to hem/cuff.
Show the full length and drape of the pants clearly.

[Clothing Focus]
The PANTS are the hero product - showcase:
- Waistband fit and style
- Front crease/pleat if any
- Full leg silhouette and drape
- Hem style (straight, tapered, wide-leg)
- Length relative to shoes`,

  /**
   * 2. Side Profile (측면 프로필) - 90도 완전 측면
   */
  bottom_side: `[Pose: Side Profile - 90 DEGREE SIDE VIEW]
CRITICAL: Model standing in TRUE SIDE PROFILE - body rotated 90 degrees from camera.
The camera sees ONLY the side of the body - NOT 3/4 angle.
One leg slightly in front of the other to show leg shape.
Arms naturally positioned, one may be slightly forward.

[Face Crop - MANDATORY - CTR STYLE]
Frame the shot from shoulder/chest level DOWN to include BOTH FEET.
The upper face (eyes, nose) must be cleanly cropped out by the TOP EDGE of the frame.
Only side profile silhouette of chin/neck visible at most.
CRITICAL: Focus is on the PANTS side silhouette.

[Framing - CRITICAL FOR SIDE VIEW]
This is a TRUE SIDE VIEW - camera perpendicular to model's facing direction.
Show the complete side profile of the pants from hip to ankle.

[Clothing Focus - SIDE SILHOUETTE]
Showcase the PANTS side profile:
- Hip/thigh curve and fit
- Side seam line
- Leg taper or width from side view
- Back pocket detail visible
- How fabric drapes along the leg line
- Full length from waist to ankle hem`,

  /**
   * 3. Walking (워킹)
   * 동적 포즈, 움직임 강조
   */
  bottom_walking: `[Pose: Walking - DYNAMIC STRIDE]
Natural walking pose - one foot forward, weight shifting.
Arms swing naturally with the stride.
Mid-step captured, showing natural movement.

[Face Crop - MANDATORY - CTR STYLE]
Frame the shot from mid-chest DOWN to include BOTH FEET touching ground.
The upper face (eyes, nose) must be cleanly cropped out by the TOP EDGE of the frame.
Model may be looking ahead but face cropped out.
CRITICAL: Focus is on the PANTS in motion.

[Framing - WALKING SHOT]
Capture the dynamic movement - fabric flow, leg position in stride.

[Clothing Focus - MOVEMENT]
Show how the PANTS move and drape during walking:
- Fabric flow and wrinkle pattern
- Leg separation showing width/cut
- Natural movement of material
- How pants fit during motion`,

  /**
   * 4. Sitting (앉은 포즈)
   * 바지 핏 강조
   */
  bottom_sitting: `[Pose: Sitting - PANTS FIT FOCUS]
Sitting on stool or chair, legs extended or crossed.
Natural relaxed seated posture.
Hands may rest on thighs or chair.

[Face Crop - MANDATORY - CTR STYLE]
Frame the shot from chest level DOWN to include feet.
The upper face (eyes, nose) must be cleanly cropped out by the TOP EDGE of the frame.
CRITICAL: Focus is on the PANTS fit when seated.

[Framing - SEATED]
Show how pants fit when seated - thigh stretch, knee area, leg drape.

[Clothing Focus - SEATED FIT]
Showcase the PANTS in seated position:
- Thigh fit when bent
- Knee fabric behavior
- How material settles when sitting
- Overall comfort appearance`,

  /**
   * 5. Back View (뒷모습)
   * 뒷면 디자인/포켓 강조
   */
  bottom_back: `[Pose: Back View - REAR DESIGN FOCUS]
Model facing AWAY from camera - back visible.
Standing naturally, weight on one leg.
Arms relaxed at sides, one hand may touch back pocket.

[Face Not Visible - NATURALLY]
Model is facing away, so face is naturally not visible.
May show back of head/hair but NOT face.

[Framing - BACK VIEW]
Frame from upper back down to include BOTH FEET.
Full rear view of the pants from waistband to hem.

[Clothing Focus - BACK DESIGN]
Showcase the PANTS from behind:
- Back pocket design and placement
- Rear yoke construction if any
- Back rise and fit
- Full leg view from behind
- Hem and length clarity`,

  /**
   * 6. Leaning (기대기)
   * 창가/벽에 기대는 캐주얼 포즈
   */
  bottom_leaning: `[Pose: Leaning - CASUAL LIFESTYLE]
Leaning gently against window sill, wall, or pillar.
One shoulder resting against the surface.
One leg slightly bent or crossed in front of the other.
Natural, relaxed casual stance with comfortable lifestyle vibe.

[Face Crop - MANDATORY - CTR STYLE]
Frame the shot from mid-chest DOWN to include BOTH FEET.
The upper face (eyes, nose) must be cleanly cropped out by the TOP EDGE of the frame.
CRITICAL: Focus is on the PANTS, not the face.

[Framing - LEANING VIEW]
Show full length of the pants with relaxed leaning posture.
Natural lighting from window if available.

[Clothing Focus - LEANING POSTURE]
Showcase the PANTS in leaning pose:
- Natural drape when weight is shifted
- Leg silhouette with bent knee
- How fabric falls in relaxed stance
- Waistband to hem fully visible
- Casual lifestyle aesthetic`,
};

/**
 * 하의 포즈 메타데이터
 */
export interface BottomPoseConfig {
  type: BottomPoseType;
  label: string;
  labelKr: string;
  description: string;
}

export const BOTTOM_POSE_CONFIGS: BottomPoseConfig[] = [
  {
    type: 'bottom_front',
    label: 'Front Standing',
    labelKr: '정면 스탠딩',
    description: '정면 전신, 바지 전체 실루엣 강조',
  },
  {
    type: 'bottom_side',
    label: 'Side Profile',
    labelKr: '측면 프로필',
    description: '90도 측면, 다리 라인/핏 강조',
  },
  {
    type: 'bottom_walking',
    label: 'Walking',
    labelKr: '워킹',
    description: '걷는 포즈, 움직임/드레이프 강조',
  },
  {
    type: 'bottom_sitting',
    label: 'Sitting',
    labelKr: '앉은 포즈',
    description: '앉은 자세, 핏/편안함 강조',
  },
  {
    type: 'bottom_back',
    label: 'Back View',
    labelKr: '뒷모습',
    description: '뒷면, 포켓/뒤태 디자인 강조',
  },
  {
    type: 'bottom_leaning',
    label: 'Leaning',
    labelKr: '기대기',
    description: '창가/벽에 기대는 캐주얼 포즈',
  },
];

// ============================================
// 아우터(코트/자켓) 전용 포즈 템플릿
// ============================================

export type OuterPoseType = 'outer_front_open' | 'outer_front_closed' | 'outer_side' | 'outer_back' | 'outer_walking' | 'outer_detail';

/**
 * 아우터 전용 포즈별 프롬프트 템플릿
 * 핵심: 아우터가 주인공 → 전신 또는 상반신+힙 라인까지, 여밈/실루엣 강조
 */
export const OUTER_POSE_TEMPLATES: Record<OuterPoseType, string> = {
  /**
   * 1. Front Open (정면 오픈)
   * 자켓/코트를 열고 있는 상태
   */
  outer_front_open: `[Pose: Front Open - OUTER GARMENT SHOWCASE]
Standing naturally facing camera, coat/jacket OPEN and unbuttoned.
Arms relaxed at sides, allowing the open garment to show its interior lining.
Inner clothing visible - creates layered look.
Weight on one leg for natural stance.

[Face Crop - MANDATORY - CTR STYLE]
Frame the shot from chin/lips DOWN to below knees or ankles.
The upper face (eyes, nose) must be cleanly cropped out by the TOP EDGE of the frame.
Do NOT crop too low - chin/lips should be at the very top of the image.
CRITICAL: If only neck/chest is visible at top, you have cropped TOO LOW.

[Framing - FULL OUTER VISIBILITY]
Show the FULL LENGTH of the coat/jacket.
Interior lining and inner layer visible through open front.
Shoulders and lapel construction clearly visible.

[Clothing Focus]
The OUTER garment is the hero - showcase:
- Open front showing lapels, collar, button placement
- How it drapes when open
- Sleeve length and cuff detail
- Overall silhouette and length
- Interior lining if visible`,

  /**
   * 2. Front Closed (정면 클로즈드)
   * 자켓/코트를 닫고 있는 상태
   */
  outer_front_closed: `[Pose: Front Closed - BUTTONED/ZIPPED]
Standing naturally facing camera, coat/jacket CLOSED and buttoned/zipped.
Arms relaxed at sides or one hand in pocket.
Clean, polished look showing the garment fully closed.

[Face Crop - MANDATORY - CTR STYLE]
Frame the shot from chin/lips DOWN to below knees or ankles.
The upper face (eyes, nose) must be cleanly cropped out by the TOP EDGE of the frame.
Do NOT crop too low - chin/lips should be at the very top of the image.
CRITICAL: If only neck/chest is visible at top, you have cropped TOO LOW.

[Framing - CLOSED SILHOUETTE]
Show the complete closed silhouette.
Button line or zipper track clearly visible.

[Clothing Focus]
Showcase the OUTER garment closed:
- Closed front silhouette and fit
- Button/zipper line and hardware
- How fabric falls when closed
- Collar and lapel when buttoned
- Overall shape and structure`,

  /**
   * 3. Side Profile (측면)
   * 아우터 측면 실루엣
   */
  outer_side: `[Pose: Side Profile - OUTER SILHOUETTE]
Standing in TRUE SIDE PROFILE - body rotated 90 degrees from camera.
Coat/jacket visible from the side showing its depth and structure.
Arms naturally positioned.

[Face Crop - MANDATORY - CTR STYLE]
Frame the shot from shoulder level DOWN to below hem.
The upper face (eyes, nose) must be cleanly cropped out by the TOP EDGE of the frame.
Only side profile of neck visible at most.
CRITICAL: Focus on the OUTER garment side silhouette.

[Framing - SIDE VIEW]
Full side silhouette of the outer garment.

[Clothing Focus]
Side profile showcase:
- Depth and structure of shoulders
- Back length and tail
- Pocket placement from side
- How garment hangs and moves
- Sleeve shape from side angle`,

  /**
   * 4. Back View (뒷모습)
   * 아우터 뒷면 디자인
   */
  outer_back: `[Pose: Back View - REAR DESIGN]
Model facing AWAY from camera - back fully visible.
Standing naturally, showing the complete back of the coat/jacket.
Arms at sides or slightly forward.

[Face Not Visible - NATURALLY]
Model is facing away, so face is naturally not visible.

[Framing - BACK VIEW]
Frame from upper back/shoulders down to below hem.
Full rear view of the outer garment.

[Clothing Focus]
Back design showcase:
- Back panel construction
- Vent or slit details
- Back yoke and seaming
- Overall back silhouette
- Belt or back details if any`,

  /**
   * 5. Walking (워킹)
   * 동적인 움직임
   */
  outer_walking: `[Pose: Walking - DYNAMIC MOVEMENT]
Natural walking pose - mid-stride, capturing movement.
Coat/jacket flowing with the movement.
Arms swinging naturally.

[Face Crop - MANDATORY - CTR STYLE]
Frame the shot from chest level DOWN to include feet.
The upper face (eyes, nose) must be cleanly cropped out by the TOP EDGE of the frame.
CRITICAL: Focus on the OUTER garment in motion.

[Framing - WALKING SHOT]
Capture the dynamic movement of the outer garment.

[Clothing Focus]
Movement showcase:
- How the coat/jacket moves when walking
- Fabric flow and drape in motion
- Opening/closing movement
- Dynamic silhouette`,

  /**
   * 6. Detail (디테일)
   * 칼라, 소재, 버튼 등 디테일 강조
   */
  outer_detail: `[Pose: Detail - CONSTRUCTION CLOSE-UP]
Close-up focused on collar, lapel, and upper portion.
Subtle pose showing craftsmanship details.

[Face Crop - MANDATORY - CTR STYLE]
Frame the shot from chin/lips DOWN to mid-chest.
The upper face (eyes, nose) must be cleanly cropped out by the TOP EDGE of the frame.
Do NOT crop too low - chin/lips should be at the very top of the image.
CRITICAL: If only neck/chest is visible at top, you have cropped TOO LOW.

[Framing - DETAIL SHOT]
Focus on collar and lapel construction - this is a CLOSE-UP shot.

[Clothing Focus]
Detail showcase:
- Collar and lapel construction
- Button or zipper hardware
- Fabric texture and quality
- Stitching and seam details
- Lining peek at collar`,
};

/**
 * 아우터 포즈 메타데이터
 */
export interface OuterPoseConfig {
  type: OuterPoseType;
  label: string;
  labelKr: string;
  description: string;
}

export const OUTER_POSE_CONFIGS: OuterPoseConfig[] = [
  {
    type: 'outer_front_open',
    label: 'Front Open',
    labelKr: '정면 오픈',
    description: '자켓/코트 열린 상태, 레이어드 룩',
  },
  {
    type: 'outer_front_closed',
    label: 'Front Closed',
    labelKr: '정면 클로즈드',
    description: '버튼/지퍼 닫힌 상태, 깔끔한 실루엣',
  },
  {
    type: 'outer_side',
    label: 'Side Profile',
    labelKr: '측면',
    description: '측면 실루엣, 구조/깊이 강조',
  },
  {
    type: 'outer_back',
    label: 'Back View',
    labelKr: '뒷모습',
    description: '뒷면 디자인, 벤트/디테일',
  },
  {
    type: 'outer_walking',
    label: 'Walking',
    labelKr: '워킹',
    description: '움직임, 코트/자켓 플로우',
  },
  {
    type: 'outer_detail',
    label: 'Detail',
    labelKr: '디테일',
    description: '칼라/라펠 클로즈업, 소재 강조',
  },
];

// ============================================
// 드레스/원피스 전용 포즈 템플릿
// ============================================

export type DressPoseType = 'dress_front' | 'dress_side' | 'dress_back' | 'dress_twirl' | 'dress_sitting' | 'dress_detail' | 'dress_leaning';

/**
 * 드레스/원피스 전용 포즈별 프롬프트 템플릿
 * 핵심: 원피스가 주인공 → 전신 강조, 드레이프/움직임/실루엣
 */
export const DRESS_POSE_TEMPLATES: Record<DressPoseType, string> = {
  /**
   * 1. Front Standing (정면 스탠딩)
   * 기본 정면 전신
   */
  dress_front: `[Pose: Front Standing - DRESS FULL VIEW]
Standing naturally facing camera, weight on one leg.
Arms relaxed at sides or one hand lightly touching dress fabric.
Elegant, natural stance showcasing the complete dress.

[Face Crop - MANDATORY - CTR STYLE]
Frame the shot from chin/lips DOWN to include feet.
The upper face (eyes, nose) must be cleanly cropped out by the TOP EDGE of the frame.
Do NOT crop too low - chin/lips should be at the very top of the image.
CRITICAL: If only neck/chest is visible at top, you have cropped TOO LOW.

[Framing - FULL DRESS VISIBILITY]
Show the COMPLETE dress from neckline to hem.
Full length and silhouette must be visible.

[Clothing Focus]
The DRESS is the hero - showcase:
- Neckline and bodice design
- Waistline and fit
- Skirt silhouette and length
- How fabric drapes on the body
- Overall proportion and style`,

  /**
   * 2. Side Profile (측면)
   * 드레스 측면 실루엣
   */
  dress_side: `[Pose: Side Profile - DRESS SILHOUETTE]
Standing in TRUE SIDE PROFILE - body rotated 90 degrees from camera.
One leg slightly forward for elegant line.
Arms natural, not blocking the dress silhouette.

[Face Crop - MANDATORY]
Frame cuts off at shoulder level.
Only side profile of neck/chin visible - EYES NEVER VISIBLE.

[Framing - SIDE VIEW]
Frame from shoulders down to include feet.
Full side silhouette of the dress.

[Clothing Focus]
Side silhouette showcase:
- Bodice fit from side
- Waist definition
- Skirt volume and flow
- How dress hangs from the side
- Back detail partially visible`,

  /**
   * 3. Back View (뒷모습)
   * 드레스 뒷면 디자인
   */
  dress_back: `[Pose: Back View - REAR DESIGN]
Model facing AWAY from camera - back fully visible.
Standing naturally, slight weight shift to one leg.
Arms at sides, not blocking the back design.

[Face Not Visible - NATURALLY]
Model is facing away, so face is naturally not visible.
May show back of head/hair.

[Framing - BACK VIEW]
Frame from upper back down to include full hem and feet.
Complete rear view of the dress.

[Clothing Focus]
Back design showcase:
- Back neckline or open back design
- Zipper or button closure
- Back silhouette and fit
- Skirt back and drape
- Any back details (bows, cutouts, etc.)`,

  /**
   * 4. Twirl/Movement (트윌/움직임)
   * 드레스 움직임 강조
   */
  dress_twirl: `[Pose: Twirl/Movement - FABRIC FLOW]
Capturing gentle movement or slight turn.
Dress fabric flowing with the motion.
Natural, graceful movement that shows dress fluidity.

[Face Crop - MANDATORY - CTR STYLE]
Frame the shot from chin/lips DOWN to include feet.
The upper face (eyes, nose) must be cleanly cropped out by the TOP EDGE of the frame.
Do NOT crop too low - chin/lips should be at the very top of the image.
CRITICAL: If only neck/chest is visible at top, you have cropped TOO LOW.

[Framing - MOVEMENT SHOT]
Capture the dynamic flow of the fabric with full dress visible.

[Clothing Focus]
Movement showcase:
- How skirt moves and flows
- Fabric weight and drape in motion
- Dynamic silhouette
- Swirl and volume of the skirt
- Natural grace and elegance`,

  /**
   * 5. Sitting (앉은 포즈)
   * 드레스 착용 앉은 자세
   */
  dress_sitting: `[Pose: Sitting - SEATED ELEGANCE]
Sitting elegantly on a chair, stool, or bench.
Legs together or crossed, dress arranged gracefully.
Hands on lap or one resting on the seat.

[Face Crop - MANDATORY - CTR STYLE]
Frame the shot from chin/lips DOWN to include visible legs.
The upper face (eyes, nose) must be cleanly cropped out by the TOP EDGE of the frame.
Do NOT crop too low - chin/lips should be at the very top of the image.
CRITICAL: If only neck/chest is visible at top, you have cropped TOO LOW.

[Framing - SEATED VIEW]
Show how dress falls and arranges when seated.

[Clothing Focus]
Seated dress showcase:
- How bodice fits when seated
- Skirt arrangement when sitting
- Fabric behavior and drape
- Overall seated elegance
- Visible detail and texture`,

  /**
   * 6. Detail (디테일)
   * 네크라인, 소재, 장식 등 디테일
   */
  dress_detail: `[Pose: Detail - NECKLINE/BODICE CLOSE-UP]
Close-up focused on neckline, bodice, and upper dress area.
Subtle pose emphasizing dress construction and fabric.

[Face Crop - MANDATORY - CTR STYLE]
Frame the shot from chin/lips DOWN to waist area.
The upper face (eyes, nose) must be cleanly cropped out by the TOP EDGE of the frame.
Do NOT crop too low - chin/lips should be at the very top of the image.
CRITICAL: If only neck/chest is visible at top, you have cropped TOO LOW.

[Framing - DETAIL SHOT]
Focus on neckline and bodice construction - this is a CLOSE-UP shot.

[Clothing Focus]
Detail showcase:
- Neckline shape and style
- Bodice construction and fit
- Fabric texture and quality
- Embellishments or details
- Strap or sleeve details`,

  /**
   * 7. Leaning (기대기)
   * 창가/벽에 기대는 캐주얼 포즈
   */
  dress_leaning: `[Pose: Leaning - CASUAL ELEGANCE]
Leaning gently against window sill, wall, or pillar.
One shoulder slightly against the surface.
One leg slightly bent, relaxed casual stance.
Natural, comfortable lifestyle moment.

[Face Crop - MANDATORY - CTR STYLE]
Frame the shot from chin/lips DOWN to include full dress and feet.
The upper face (eyes, nose) must be cleanly cropped out by the TOP EDGE of the frame.
Do NOT crop too low - chin/lips should be at the very top of the image.
CRITICAL: If only neck/chest is visible at top, you have cropped TOO LOW.

[Framing - LEANING VIEW]
Show full length of the dress with leaning posture.
Natural lighting from window if available.

[Clothing Focus]
Leaning pose showcase:
- How dress drapes when leaning
- Natural fabric fall and movement
- Relaxed silhouette
- Lifestyle casual elegance
- Full dress visibility from neckline to hem`,
};

/**
 * 드레스 포즈 메타데이터
 */
export interface DressPoseConfig {
  type: DressPoseType;
  label: string;
  labelKr: string;
  description: string;
}

export const DRESS_POSE_CONFIGS: DressPoseConfig[] = [
  {
    type: 'dress_front',
    label: 'Front Standing',
    labelKr: '정면 전신',
    description: '정면 전신, 전체 실루엣 강조',
  },
  {
    type: 'dress_side',
    label: 'Side Profile',
    labelKr: '측면',
    description: '측면 실루엣, 드레이프 강조',
  },
  {
    type: 'dress_back',
    label: 'Back View',
    labelKr: '뒷모습',
    description: '뒷면 디자인, 지퍼/백 디테일',
  },
  {
    type: 'dress_twirl',
    label: 'Twirl',
    labelKr: '트윌',
    description: '움직임, 스커트 플로우',
  },
  {
    type: 'dress_sitting',
    label: 'Sitting',
    labelKr: '앉은 포즈',
    description: '앉은 자세, 우아한 드레이프',
  },
  {
    type: 'dress_detail',
    label: 'Detail',
    labelKr: '디테일',
    description: '네크라인/보디스 클로즈업',
  },
  {
    type: 'dress_leaning',
    label: 'Leaning',
    labelKr: '기대기',
    description: '창가/벽에 기대는 캐주얼 포즈',
  },
];
