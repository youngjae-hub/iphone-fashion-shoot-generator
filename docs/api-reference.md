# rapport. STUDIO - API Reference

## Base URL

- 로컬: `http://localhost:3000`
- 프로덕션: Vercel 배포 URL

---

## POST /api/generate

이미지 생성 API. 의류 이미지와 설정을 받아 AI 모델 착용 이미지를 생성합니다.

### Request Body

```json
{
  "provider": "google-gemini",
  "pose": "front",
  "style": "natural",
  "garmentImage": "data:image/jpeg;base64,...",
  "styleReferenceImages": ["data:image/jpeg;base64,..."],
  "backgroundSpotImages": ["data:image/jpeg;base64,..."],
  "customPrompt": "빈티지 필름 느낌, 약간 어두운 조명",
  "seed": 42,
  "negativePrompt": "low quality, blurry"
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| provider | string | O | `google-gemini`, `replicate-flux`, `stability-ai` |
| pose | string | O | `front`, `side`, `back`, `styled`, `detail` |
| style | string | O | 스타일 키워드 |
| garmentImage | string | X | 의류 이미지 base64 |
| styleReferenceImages | string[] | X | 스타일 참조 이미지 (최대 10장, Gemini만 지원) |
| backgroundSpotImages | string[] | X | 배경 스팟 참조 이미지 (최대 5장, Gemini만 지원) |
| customPrompt | string | X | 사용자 정의 추가 프롬프트 |
| seed | number | X | 시드값 (재현성) |
| negativePrompt | string | X | 네거티브 프롬프트 |

### Response

```json
{
  "success": true,
  "image": "data:image/png;base64,..." 또는 "https://replicate.delivery/...",
  "provider": "google-gemini",
  "pose": "front"
}
```

### 에러 응답

```json
{
  "success": false,
  "error": "에러 메시지"
}
```

---

## POST /api/upscale

단일 이미지 업스케일 API.

### Request Body

```json
{
  "image": "https://replicate.delivery/...",
  "scale": 2,
  "model": "real-esrgan",
  "faceEnhance": false
}
```

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| image | string | O | 이미지 URL (http/https/data:image) |
| scale | number | X | 업스케일 배율 (기본 2) |
| model | string | X | `real-esrgan` (기본) 또는 `clarity-upscaler` |
| faceEnhance | boolean | X | 얼굴 개선 여부 (기본 false) |

### Response (200)

```json
{
  "success": true,
  "upscaledImage": "https://replicate.delivery/..."
}
```

### 에러 응답

| HTTP | 의미 |
|------|------|
| 400 | 이미지 누락 또는 유효하지 않은 URL |
| 500 | REPLICATE_API_TOKEN 미설정 또는 결과 파싱 실패 |
| 502 | Replicate API 호출 자체 실패 |

---

## PUT /api/upscale

배치 업스케일 API (최대 10장).

### Request Body

```json
{
  "images": [
    "https://replicate.delivery/...",
    "https://replicate.delivery/..."
  ],
  "scale": 2,
  "model": "real-esrgan"
}
```

### Response (200)

```json
{
  "success": true,
  "upscaledImages": [
    "https://replicate.delivery/...",
    "https://replicate.delivery/..."
  ],
  "errors": ["Image 3: Output URL extraction failed"]
}
```

---

## GET /api/providers

사용 가능한 Provider 목록 조회.

### Response (200)

```json
{
  "imageGeneration": [
    { "name": "google-gemini", "available": true },
    { "name": "replicate-flux", "available": true },
    { "name": "stability-ai", "available": true }
  ],
  "tryOn": [
    { "name": "idm-vton", "available": true },
    { "name": "kolors-virtual-tryon", "available": true }
  ]
}
```

---

## Serverless Function 공통 설정

모든 API 라우트에 적용:

```typescript
export const maxDuration = 60;      // 최대 실행 시간 60초
export const dynamic = 'force-dynamic'; // 캐시 비활성화
```
