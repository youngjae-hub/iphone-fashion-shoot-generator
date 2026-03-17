// ============================================
// iPhone Style Lookbook - Prime Directives
// CTR 방식 참고: 핵심 원칙을 명확히 분리
// ============================================

/**
 * Universal Prime Directives
 * 모든 촬영 타입에 공통으로 적용되는 핵심 원칙
 */
export const PRIME_DIRECTIVES = `[Universal Prime Directives]
1. Product Integrity is Paramount: Preserve the garment from PRODUCT with 100% accuracy. Do not alter its color, pattern, logos, fabric texture, or design details.
2. iPhone Aesthetic is Key: The output must look like a casual photo taken on iPhone - natural lighting, slight depth of field, authentic feel. NOT studio photography.
3. Background Adherence: If BACKGROUND_SPOT is provided, match that environment exactly. Otherwise use clean minimal background.
4. Output: High quality image, 1200x1200 pixels.

[Model Specification - CRITICAL]
Korean young woman in her early 20s (university student or early career vibe).
- Ethnicity: Korean / East Asian
- Build: Slender, slim figure (160-170cm, lean body type)
- Hair: Long dark brown or black hair, natural soft waves
- Makeup: Very natural, almost bare-faced, dewy skin
- Vibe: Effortlessly stylish, Instagram-casual, approachable
- Expression: Soft, natural - NOT overly posed or model-like
This is a KOREAN fashion e-commerce model, NOT Western/Caucasian.

[Styling Consistency - MUST FOLLOW]
Keep the same coordinated outfit across ALL poses:
- If PRODUCT is TOP/OUTER: Pair with dark navy/black slim-fit jeans or tailored pants. Same pants in every image.
- If PRODUCT is BOTTOM: Pair with simple white or cream basic tee/blouse. Same top in every image.
- If PRODUCT is DRESS: No additional pairing needed.
- Shoes: Minimal white sneakers or simple nude/black heels, consistent across all poses.
- Accessories: None or very minimal (small stud earrings only).
CRITICAL: The non-product clothing items must be IDENTICAL in every generated image.`;

/**
 * iPhone Look - 아이폰 촬영 스타일의 핵심 특징
 * CTR에는 없는 우리만의 차별점
 */
export const IPHONE_LOOK_DIRECTIVE = `[iPhone Look - #1 PRIORITY]
This must look like a friend took this photo on their iPhone.
- Natural, slightly warm lighting (NOT studio flash)
- Subtle depth of field on background
- Casual, relaxed pose (NOT stiff fashion pose)
- Authentic texture - slight grain is acceptable
- Real-life feel, not overly retouched
CRITICAL: If it looks like a professional studio shot, you have FAILED.`;

/**
 * 금지사항 - 명확한 네거티브 지시
 */
export const NEGATIVE_DIRECTIVES = `[NEVER Do These]
- Studio flash or artificial lighting setup
- Stiff, unnatural model pose
- Overly edited or HDR look
- Perfect symmetrical composition
- Visible watermarks or logos (except on garment)`;
