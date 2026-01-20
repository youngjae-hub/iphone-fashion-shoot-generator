# iPhone Style Fashion Photo Generator

## 프로젝트 개요
아이폰으로 촬영한 것 같은 패션 룩북 이미지를 AI로 생성하는 웹 애플리케이션

## 기술 스택
- **Frontend**: Next.js 16+ (App Router) + React 19+
- **Styling**: Tailwind CSS v4 (Google AI Studio 스타일 UI)
- **AI Image Generation**: 유연한 Provider 시스템
  - Google Imagen API
  - Replicate Flux Pro
  - Stability AI (SDXL)
- **Virtual Try-On**:
  - IDM-VTON (기본)
  - Kolors Virtual Try-On (대안)

## 핵심 기능

### 1. 의류 업로드
- 드래그 앤 드롭 / 클릭 업로드
- 최대 5장 동시 업로드
- 이미지 미리보기

### 2. AI 모델 생성
- 아이폰 촬영 스타일 한국인 여성 모델
- 얼굴 입술 윗부분 크롭 (익명성 보장)
- 시드값으로 일관된 스타일 유지 가능

### 3. 배경 생성
- 미니멀 스튜디오 / 소프트 그라데이션 / 라이프스타일 / 아웃도어

### 4. Virtual Try-On
- IDM-VTON 또는 Kolors VTON 선택 가능
- 자연스러운 착장 표현

### 5. 다중 포즈 생성
- 정면/측면/뒷면/연출/디테일 포즈
- 포즈당 1~10컷 설정 가능
- 착장당 최대 50컷 배치 생성

### 6. 유연한 Provider 시스템
- **언제든 AI 모델 변경 가능**
- 결과가 마음에 안 들면 다른 Provider로 재생성
- UI에서 실시간 Provider 전환

## 개발 명령어

```bash
# 개발 서버 실행
npm run dev

# 빌드
npm run build

# 프로덕션 실행
npm start

# 린트
npm run lint
```

## 환경 변수 설정

`.env.example`을 `.env.local`로 복사 후 API 키 입력:

```bash
# 필수 - Replicate API (IDM-VTON, Flux 등)
REPLICATE_API_TOKEN=your_replicate_token

# 선택 - Google Imagen
GOOGLE_CLOUD_API_KEY=your_google_api_key

# 선택 - Vertex AI (고급)
GOOGLE_CLOUD_PROJECT_ID=your_project_id
GOOGLE_ACCESS_TOKEN=your_access_token
```

## 디렉토리 구조

```
src/
├── app/
│   ├── page.tsx              # 메인 페이지 (Google AI Studio 스타일)
│   ├── layout.tsx            # 앱 레이아웃
│   ├── globals.css           # 글로벌 스타일
│   └── api/
│       ├── generate/route.ts # 이미지 생성 API
│       └── providers/route.ts # Provider 상태 조회 API
├── components/
│   ├── ImageUploader.tsx     # 드래그앤드롭 업로더
│   ├── ProviderSelector.tsx  # AI Provider 선택 UI
│   ├── GenerationSettings.tsx # 생성 설정 패널
│   ├── ResultGallery.tsx     # 결과물 갤러리 + 다운로드
│   └── index.ts              # 컴포넌트 re-export
├── lib/
│   └── providers/
│       ├── base.ts           # Provider 인터페이스 정의
│       ├── replicate.ts      # Replicate Providers (Flux, SDXL, IDM-VTON, Kolors)
│       ├── google-imagen.ts  # Google Imagen Provider
│       └── index.ts          # Provider Factory & Registry
└── types/
    └── index.ts              # TypeScript 타입 정의
```

## Provider 시스템

### 이미지 생성 Provider
| Provider | 설명 | API 키 |
|----------|------|--------|
| `google-imagen` | Google Imagen 3.0 | GOOGLE_CLOUD_API_KEY |
| `replicate-flux` | Flux 1.1 Pro | REPLICATE_API_TOKEN |
| `stability-ai` | Stable Diffusion XL | REPLICATE_API_TOKEN |

### Virtual Try-On Provider
| Provider | 설명 | API 키 |
|----------|------|--------|
| `idm-vton` | IDM-VTON (고품질) | REPLICATE_API_TOKEN |
| `kolors-virtual-tryon` | Kwai Kolors VTON | REPLICATE_API_TOKEN |

### Provider 변경 방법
1. UI의 "AI 모델" 탭에서 선택
2. 결과 불만족 시 다른 Provider로 재생성 가능

## 포즈 설정

```typescript
const POSE_CONFIGS = [
  { type: 'front', label: '정면', promptEn: 'front view, looking forward, standing pose' },
  { type: 'side', label: '측면', promptEn: 'side profile view, 90 degree angle' },
  { type: 'back', label: '뒷면', promptEn: 'back view, showing back of outfit' },
  { type: 'styled', label: '연출', promptEn: 'dynamic pose, natural movement, editorial style' },
  { type: 'detail', label: '디테일', promptEn: 'close-up shot, fabric texture detail' },
];
```

## UI 특징
- Google AI Studio 스타일 다크 테마
- 좌측 사이드바: 업로드/설정/Provider 탭
- 우측 메인: 결과 갤러리
- 반응형 디자인

## 코드 컨벤션
- TypeScript strict mode
- ESLint + Next.js 규칙
- 'use client' 컴포넌트 분리
- API routes는 App Router 방식

## 참고사항
- 아이폰 촬영 특성: 자연스러운 색감, 선명한 디테일
- 모델 일관성 유지를 위해 시드값 고정 권장
- Provider별 결과 차이가 있으므로 여러 Provider 테스트 권장
