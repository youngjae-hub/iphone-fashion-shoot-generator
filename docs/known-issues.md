# rapport. STUDIO - Known Issues & Changelog

## 알려진 제한 사항

### 1. 스타일 참조 이미지 - Gemini 전용
- **현상**: 스타일 참조 이미지는 Google Gemini Provider에서만 작동
- **원인**: Replicate Provider (Flux, SDXL)는 텍스트 프롬프트만 지원하며, `styleReferenceImages` 파라미터를 무시
- **영향**: Replicate Provider 사용 시 스타일 참조 이미지를 업로드해도 적용되지 않음
- **대응**: UI에서 Gemini 선택 시에만 스타일 참조 업로드 활성화 권장

### 2. 스타일 참조 가중치 조절 불가
- **현상**: Gemini API에 스타일 참조 이미지의 가중치(strength)를 수치로 지정하는 파라미터가 없음
- **결과**: 텍스트 프롬프트 지시로만 제어, 약 30-60% 유사도
- **대응**: 프롬프트 강화 ("EXACT STYLE", "CRITICAL" 등 강조 어구 사용)

### 3. Vercel Body Size 제한 (4.5MB)
- **현상**: 다수의 base64 이미지를 동시에 전송하면 413 Payload Too Large 발생
- **영향**: 히스토리 저장, 대량 이미지 전송
- **해결**: `garmentImages: []`로 비워서 전송, URL 참조 사용

### 4. Replicate FileOutput 처리
- **현상**: Replicate SDK v1.x의 `replicate.run()` 반환값이 plain string이 아닌 FileOutput 객체
- **위험**: `String(output)`이 `[object ReadableStream]` 반환 가능
- **해결 완료**: `extractOutputUrl()` 함수로 .url getter → .href → toString() 순서로 안전 추출

### 5. Serverless Function 타임아웃
- **현상**: Vercel Hobby 플랜 60초 제한으로 복잡한 이미지 생성이 타임아웃될 수 있음
- **영향**: 고품질 모델 (30 steps) 또는 배치 처리 시
- **대응**: `maxDuration = 60` 설정, 필요 시 Pro 플랜 업그레이드

---

## 변경 이력 (Changelog)

### v1.1 - 프롬프트 자연스러움 개선

**commit `f1e7439`** - fix: 카페/웜톤 기본 프롬프트 제거

변경 파일:
- `src/lib/providers/google-gemini.ts`
- `src/types/index.ts`

변경 내용:
| Before | After |
|--------|-------|
| `cafe corner, or plain wall` | `plain wall or neutral backdrop` |
| `soft warm color grading, slight lens flare` | `natural color grading, realistic skin tones` |
| `Slightly overexposed warm tones` | `Natural color grading, realistic skin tones, no color cast` |
| `cozy cafe corner` | `minimal setting` |
| Background: `warm tones` | `neutral tones` |
| Template: `warm tones` | `neutral natural tones` |

이유: 카페/웜톤 기본값이 AI 생성 이미지의 이질감을 강화

---

### v1.0.2 - 업스케일 안정성 개선

**commit `a075a37`** - fix: 업스케일 실패 수정 - FileOutput 처리 + 에러 로깅 강화

변경 파일:
- `src/lib/providers/replicate.ts` - `extractOutputString` → `extractOutputUrl` 리네이밍 + 로직 강화
- `src/app/api/upscale/route.ts` - 전면 재작성 (토큰 검증, URL 검증, 에러 분류)
- `src/components/ResultGallery.tsx` - HTTP 상태 코드 기반 에러 표시

주요 변경:
- Replicate FileOutput에서 URL 안전 추출 로직 통일
- 업스케일 API 에러를 502 (API 실패) / 500 (파싱 실패)로 분류
- 클라이언트 에러 메시지에 HTTP 상태 코드 포함

---

### v1.0.1 - LoRA 학습 이미지 검증

변경 내용:
- 이미지 크기 검증 (width/height > 0)
- `cropTopOfImage()` 최소 높이 1px 보장

---

### v1.0.0 - 초기 릴리즈

핵심 기능:
- 3탭 구조 (아이폰 모델컷 / AI 모델컷 / 제품컷 리터칭)
- Google Gemini + Replicate Provider 시스템
- Virtual Try-On (IDM-VTON, Kolors)
- 5포즈 × 최대 10컷 배치 생성
- Real-ESRGAN 업스케일
- 스타일 참조 / 배경 스팟 이미지 지원
