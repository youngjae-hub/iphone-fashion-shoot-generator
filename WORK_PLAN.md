# 작업 계획서 (Work Plan)

## 현재 상태 (2026-03-17 업데이트)

### 최근 완료된 작업 (2026-03-17)

#### CTR 스타일 프롬프트 시스템 전면 적용
1. **CTR 스타일 Face Crop** ✅ - 모든 25+ 포즈 템플릿에 적용
   - "Frame from chin/lips DOWN, upper face cleanly cropped at TOP EDGE"
   - "CRITICAL: If only neck/chest visible, cropped TOO LOW" 명시

2. **누락 포즈 추가** ✅
   - `dress_leaning` (원피스 기대기) 추가
   - `bottom_leaning` (하의 기대기) 추가
   - 포즈 매핑 수정: UI '기대기' → 각 카테고리별 leaning 포즈

3. **CTR 스타일 CLOTHING_TYPE_HINTS** ✅
   - 의류 타입별 디테일 보존 지시 (color, pattern, texture, design)
   - "CRITICAL: The garment must be IDENTICAL to PRODUCT" 강조

4. **CTR 스타일 BACKGROUND_SPOT_HINTS** ✅
   - 호리존(studio): "Clean white horizon studio background"
   - 자연광(home/outdoor): "Natural daylight with atmospheric shadows"

5. **레퍼런스 모드 UI 명확화** ✅
   - 레퍼런스 이미지 업로드 시 안내 메시지 표시
   - "포즈만 참고하여 1장 생성됩니다 (배경, 의상, 얼굴은 참고하지 않음)"
   - 레퍼런스 사용 시 포즈 선택 UI 숨김

### 이전 완료된 작업 (~ 2026-03-11)
1. **Direct 모드 구현** ✅ - VTON 없이 AI 직접 생성 (레퍼런스 방식)
2. **Studio 배경 기본값** ✅ - 깨끗한 흰색 스튜디오 배경
3. **한국인 모델 프롬프트** ✅ - 20대 슬렌더 여성 명시
4. **얼굴 크롭 강화** ✅ - 눈 절대 노출 금지
5. **상의 5가지 포즈 템플릿** ✅ - `TOP_POSE_TEMPLATES`
6. **SVG 포즈 아이콘** ✅ - 20개 생성 완료

### 현재 파이프라인 (Direct 모드)
```
누끼 제품컷 → Gemini 직접 생성 (모델+의류) → 얼굴 크롭 → 최종 이미지
```

---

## 다음 작업: 배경 스팟 + 포즈 선택 UI

### Task 1: 드롭박스 배경 스팟 선택

#### 1.1 구현 계획

```
┌─────────────────────────────────────────────────────────┐
│  UI: 배경 스팟 선택                                      │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │ ⬜ 스튜디오│  │ 🏠 홈    │  │ 📁 드롭박스│             │
│  │ (기본)    │  │          │  │ (커스텀)  │             │
│  └──────────┘  └──────────┘  └──────────┘              │
│                                    │                    │
│                    ┌───────────────┴───────────────┐   │
│                    │   드롭박스 폴더 선택 모달      │   │
│                    │   📁 spots/                   │   │
│                    │     📷 cafe-window.jpg        │   │
│                    │     📷 home-minimal.jpg       │   │
│                    │     📷 outdoor-park.jpg       │   │
│                    └───────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

#### 1.2 필요 파일
| 파일 | 작업 | 설명 |
|------|------|------|
| `src/app/api/dropbox-spots/route.ts` | 신규 | 드롭박스 스팟 이미지 목록 조회 |
| `src/components/BackgroundSpotSelector.tsx` | 신규 | 배경 스팟 선택 UI |
| `src/lib/prompts/hints.ts` | 수정 | `dropbox` 타입 추가 |

#### 1.3 자가 점검
| # | 점검 항목 | 상태 | 비고 |
|---|----------|------|------|
| 1 | 드롭박스 API 키 설정 | ❓ | 사용자 확인 필요 |
| 2 | 스팟 이미지 저장 경로 | ❓ | 사용자 확인 필요 |
| 3 | Base64 변환 로직 | ✅ | 기존 코드 재사용 |
| 4 | 이미지 포맷 지원 | ✅ | jpg/png 둘 다 가능 |

---

### Task 2: 상의 포즈 선택 (5가지 기본)

#### 2.1 구현 계획

```
┌─────────────────────────────────────────────────────────┐
│  UI: 상의 포즈 선택 (기본 5개 선택됨)                    │
│                                                         │
│  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐  ┌─────┐          │
│  │[SVG]│  │[SVG]│  │[SVG]│  │[SVG]│  │[SVG]│          │
│  │정면 │  │헤어 │  │측면 │  │기대기│  │디테일│          │
│  │ ✓  │  │ ✓  │  │ ✓  │  │ ✓  │  │ ✓  │          │
│  └─────┘  └─────┘  └─────┘  └─────┘  └─────┘          │
│                                                         │
│  [5개 포즈로 생성] 버튼                                  │
└─────────────────────────────────────────────────────────┘
```

#### 2.2 SVG 아이콘 매핑
| 포즈 ID | 라벨 | SVG 파일 | 상태 |
|---------|------|----------|------|
| `top_front` | 정면 릴렉스 | `public/poses/top-front.svg` | ✅ |
| `top_hair_touch` | 헤어 터치 | `public/poses/top-hair-touch.svg` | ✅ |
| `top_side_glance` | 사이드 시선 | `public/poses/top-side-glance.svg` | ✅ |
| `top_leaning` | 기대기 캐주얼 | `public/poses/top-leaning.svg` | ✅ |
| `top_detail` | 디테일 넥라인 | `public/poses/top-detail.svg` | ✅ |

#### 2.3 필요 파일
| 파일 | 작업 | 설명 |
|------|------|------|
| `src/components/TopPoseSelector.tsx` | 신규 | 포즈 선택 UI (SVG 아이콘) |
| `src/app/api/generate/route.ts` | 수정 | `topPoses` 배열 처리 |

#### 2.4 자가 점검
| # | 점검 항목 | 상태 | 비고 |
|---|----------|------|------|
| 1 | SVG 아이콘 5개 존재 | ✅ | `public/poses/top-*.svg` |
| 2 | 포즈 템플릿 5개 정의 | ✅ | `src/lib/prompts/templates.ts` |
| 3 | Direct 모드 topPose 처리 | ✅ | `route.ts` 구현됨 |
| 4 | 다중 포즈 순차 생성 | ✅ | 타임아웃 방지 로직 있음 |

#### 2.5 API 요청 예시
```json
{
  "garmentImage": "data:image/...",
  "garmentCategory": "upper_body",
  "topPoses": ["top_front", "top_hair_touch", "top_side_glance", "top_leaning", "top_detail"],
  "settings": { "shotsPerPose": 1 },
  "providers": {
    "imageGeneration": "google-gemini",
    "generationMode": "direct"
  }
}
```

---

## 질문 사항 (구현 전 확인 필요)

### 드롭박스 관련
1. **스팟 이미지 경로**: 드롭박스 내 스팟 이미지 폴더 경로?
   - 예: `/spots/`, `/backgrounds/`

2. **연동 방식**:
   - [ ] Google Apps Script 통해 접근
   - [ ] Dropbox API 직접 사용
   - [ ] 로컬 동기화 폴더 사용

3. **Dropbox API 토큰**: `.env.local`에 설정되어 있나요?

### 포즈 관련
4. **기본 선택**: 5개 모두 기본 선택? 또는 일부만?

---

## 구현 순서

```
Phase A: 포즈 선택 UI (Task 2) - 먼저 구현
├── 1. TopPoseSelector.tsx 컴포넌트 생성
├── 2. route.ts에 topPoses 배열 처리
├── 3. 테스트: 5개 포즈 동시 생성
└── 예상 시간: ~30분

Phase B: 드롭박스 스팟 (Task 1) - 연동 방식 확인 후
├── 1. 드롭박스 접근 방식 결정
├── 2. API 엔드포인트 생성
├── 3. BackgroundSpotSelector.tsx 컴포넌트
├── 4. 테스트
└── 예상 시간: 연동 방식에 따라 다름
```

---

## 주요 파일 참조

| 파일 | 설명 |
|------|------|
| `src/lib/prompts/templates.ts` | 포즈 템플릿 (CTR 스타일 Face Crop 적용) |
| `src/lib/prompts/hints.ts` | 배경 스팟 힌트 + 의류 타입 힌트 (CTR 스타일) |
| `src/lib/prompts/prime-directives.ts` | 핵심 원칙 (iPhone Look, 한국인 모델 등) |
| `src/app/api/generate/route.ts` | 이미지 생성 API + 포즈 매핑 |
| `src/types/index.ts` | 포즈 타입 정의 (TopPoseType, BottomPoseType, DressPoseType 등) |
| `src/components/ResultGallery.tsx` | 결과 갤러리 + 포즈 라벨 |
| `public/poses/*.svg` | 포즈 아이콘 |

---

## CTR 스타일 적용 요약

### Face Crop 규칙 (모든 포즈에 적용)
```
[Face Crop - MANDATORY - CTR STYLE]
Frame the shot from chin/lips DOWN to include full garment.
The upper face (eyes, nose) must be cleanly cropped out by the TOP EDGE of the frame.
Do NOT crop too low - chin/lips should be at the very top of the image.
CRITICAL: If only neck/chest is visible at top, you have cropped TOO LOW.
```

### 포즈별 카테고리 매핑
| UI 포즈 | TOP | BOTTOM | OUTER | DRESS |
|---------|-----|--------|-------|-------|
| 정면 | top_front | bottom_front | outer_front | dress_front |
| 측면 | top_side_glance | bottom_side | outer_side | dress_side |
| 뒷면 | top_back | bottom_back | outer_back | dress_back |
| 기대기 | top_leaning | **bottom_leaning** ✅ | outer_leaning | **dress_leaning** ✅ |
| 디테일 | top_detail | bottom_detail | outer_detail | dress_detail |

✅ = 2026-03-17 세션에서 새로 추가됨

---

*마지막 업데이트: 2026-03-17*
