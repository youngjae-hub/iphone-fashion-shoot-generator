# rapport. STUDIO - Architecture Document

## 1. 기술 스택

| 영역 | 기술 | 버전 |
|------|------|------|
| Framework | Next.js (App Router) | 16.1.2 |
| UI | React | 19.2.3 |
| Styling | Tailwind CSS | v4 |
| AI (이미지 생성) | Google Gemini API | nano-banana-pro-preview |
| AI (Try-On) | Replicate SDK | ^1.4.0 |
| AI (업스케일) | Real-ESRGAN via Replicate | - |
| 배포 | Vercel | Serverless Functions |
| 언어 | TypeScript | strict mode |

---

## 2. 디렉토리 구조

```
src/
├── app/
│   ├── page.tsx                    # 메인 페이지 (3탭 구조)
│   ├── layout.tsx                  # 앱 레이아웃
│   ├── providers.tsx               # React Context Providers
│   ├── globals.css                 # 글로벌 스타일 (Tailwind)
│   └── api/
│       ├── generate/route.ts       # 이미지 생성 API
│       ├── upscale/route.ts        # 이미지 업스케일 API
│       ├── providers/route.ts      # Provider 상태 조회 API
│       └── history/route.ts        # 생성 히스토리 API
├── components/
│   ├── ImageUploader.tsx           # 드래그앤드롭 업로더
│   ├── ProviderSelector.tsx        # AI Provider 선택 UI
│   ├── GenerationSettings.tsx      # 생성 설정 패널
│   ├── ResultGallery.tsx           # 결과물 갤러리 + 다운로드/업스케일
│   └── index.ts                    # 컴포넌트 re-export
├── lib/
│   ├── providers/
│   │   ├── base.ts                 # Provider 인터페이스 + Registry
│   │   ├── google-gemini.ts        # Google Gemini Provider
│   │   ├── replicate.ts            # Replicate Providers (Flux, SDXL, VTON)
│   │   └── index.ts                # Provider Factory
│   └── image-preprocess.ts         # 이미지 전처리 (크롭, 리사이즈)
├── middleware.ts                   # Next.js 미들웨어
└── types/
    └── index.ts                    # TypeScript 타입 정의
```

---

## 3. Provider 시스템 아키텍처

### 인터페이스 설계

```typescript
// 이미지 생성 Provider
interface IImageGenerationProvider {
  name: string;
  generateModelImage(options: ModelGenerationOptions): Promise<string>;
  generateBackground(options: BackgroundOptions): Promise<string>;
  isAvailable(): Promise<boolean>;
}

// Virtual Try-On Provider
interface ITryOnProvider {
  name: string;
  tryOn(options: TryOnOptions): Promise<string>;
  isAvailable(): Promise<boolean>;
}
```

### Provider Registry 패턴
- `ProviderRegistry` 클래스로 런타임 Provider 등록/교체
- UI에서 사용자가 Provider 선택 → API로 전달 → 해당 Provider 실행
- 새 Provider 추가 시 인터페이스 구현 + Registry 등록만 하면 됨

### 구현된 Provider 목록

**이미지 생성:**
| 클래스 | name | 백엔드 |
|--------|------|--------|
| `GoogleGeminiImageProvider` | google-gemini | Google Generative AI API |
| `FluxImageProvider` | replicate-flux | Replicate (SDXL Turbo) |
| `StableDiffusionProvider` | stability-ai | Replicate (SDXL) |

**Virtual Try-On:**
| 클래스 | name | 백엔드 |
|--------|------|--------|
| `IDMVTONProvider` | idm-vton | Replicate (cuuupid/idm-vton) |
| `KolorsVTONProvider` | kolors-virtual-tryon | Replicate (kwai-kolors) |

---

## 4. 데이터 흐름

### 이미지 생성 플로우

```
[Client] page.tsx
    │
    ├─ 의류 이미지 (base64)
    ├─ 스타일 참조 이미지 (base64[])
    ├─ 배경 스팟 이미지 (base64[])
    ├─ 포즈/스타일 설정
    └─ 커스텀 프롬프트
    │
    ▼ POST /api/generate
    │
[Server] generate/route.ts
    │
    ├─ buildPromptFromSettings()
    ├─ Provider 선택 (google-gemini / replicate-flux / ...)
    └─ provider.generateModelImage(options)
    │
    ▼ External API Call
    │
[Google Gemini API]  또는  [Replicate API]
    │
    ▼ 응답
    │
[Server] 이미지 URL 또는 base64 반환
    │
    ▼ JSON Response
    │
[Client] ResultGallery.tsx 에 이미지 표시
```

### 업스케일 플로우

```
[Client] ResultGallery.tsx
    │
    ├─ image.url (Replicate에서 받은 HTTP URL)
    └─ scale: 2, model: 'real-esrgan'
    │
    ▼ POST /api/upscale
    │
[Server] upscale/route.ts
    │
    ├─ REPLICATE_API_TOKEN 검증
    ├─ 입력 URL 유효성 검증
    ├─ replicate.run("nightmareai/real-esrgan", {...})
    └─ extractUrl(output) → URL 추출
    │
    ▼ JSON { success: true, upscaledImage: url }
    │
[Client] 다운로드 또는 갤러리 교체
```

---

## 5. Replicate FileOutput 처리

Replicate SDK v1.x는 `replicate.run()` 반환값이 plain string이 아닌 `FileOutput` 객체(ReadableStream 서브클래스)입니다.

### 추출 로직 (`extractOutputUrl`)

```typescript
function extractOutputUrl(output: unknown): string {
  // 1. Plain string → 그대로 반환
  // 2. URL object → .href
  // 3. Array → 첫 번째 요소 재귀 추출
  // 4. Object (FileOutput)
  //    4a. .url getter → URL 객체 → .href
  //    4b. .href 속성
  //    4c. String(output) → "http..." 이면 사용
  //    4d. "[object" 시작하면 실패
  // 5. throw Error
}
```

이 로직은 `replicate.ts`와 `upscale/route.ts` 양쪽에 동일 패턴으로 구현되어 있습니다.

---

## 6. 환경 변수

| 변수 | 필수 | 용도 |
|------|------|------|
| `REPLICATE_API_TOKEN` | O | Replicate API (Try-On, 업스케일, Flux) |
| `GOOGLE_CLOUD_API_KEY` | O | Google Gemini 이미지 생성 |
| `GOOGLE_CLOUD_PROJECT_ID` | X | Vertex AI (고급) |
| `GOOGLE_ACCESS_TOKEN` | X | Vertex AI (고급) |

---

## 7. Vercel 배포 제약

| 항목 | 제한 |
|------|------|
| Serverless Function 타임아웃 | 60초 (Hobby) |
| Request Body 크기 | 4.5MB |
| `maxDuration` 설정 | `export const maxDuration = 60` |
| `dynamic` 설정 | `export const dynamic = 'force-dynamic'` |

### 413 Payload Too Large 대응
- `/api/history` 저장 시 `garmentImages: []`로 비워서 전송
- base64 이미지는 body에 직접 포함하지 않고 URL 참조 사용 권장

---

## 8. 타입 시스템

### 핵심 타입 (`types/index.ts`)

```typescript
type PoseType = 'front' | 'side' | 'back' | 'styled' | 'detail';

interface GeneratedImage {
  id: string;
  url: string;
  pose: PoseType;
  provider: string;
  timestamp: number;
}

interface GenerationSettings {
  provider: string;
  poses: PoseType[];
  shotsPerPose: number;
  style: string;
  template: string;
  customPrompt?: string;
}

interface ModelGenerationOptions {
  pose: PoseType;
  style: string;
  seed?: number;
  negativePrompt?: string;
  garmentImage?: string;           // 의류 이미지 (base64)
  styleReferenceImages?: string[]; // 스타일 참조 (최대 10장)
  backgroundSpotImages?: string[]; // 배경 스팟 참조
  customPrompt?: string;           // 사용자 정의 프롬프트
}
```
