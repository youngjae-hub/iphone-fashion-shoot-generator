# rapport. STUDIO - Provider 비교

## 이미지 생성 Provider

### Google Gemini (google-gemini)

| 항목 | 내용 |
|------|------|
| **모델** | nano-banana-pro-preview |
| **API** | Google Generative Language API |
| **API 키** | `GOOGLE_CLOUD_API_KEY` |
| **입력 방식** | base64 inline data + text prompt |
| **출력** | base64 이미지 (data URI) |
| **스타일 참조** | 지원 (inlineData로 전달, 최대 10장) |
| **배경 스팟 참조** | 지원 (inlineData로 전달, 최대 5장) |
| **커스텀 프롬프트** | 지원 |
| **의류 참조** | 지원 (inlineData로 전달) |

**장점:**
- 스타일 참조 이미지 지원 (유일)
- 배경 스팟 이미지 지원 (유일)
- 의류 이미지 직접 참조 가능
- 한국 온라인몰 스타일에 최적화된 프롬프트

**단점:**
- 스타일 참조 가중치 수치 조절 불가 (약 30-60% 유사도)
- API 응답 시간이 상대적으로 길 수 있음

---

### Replicate Flux (replicate-flux)

| 항목 | 내용 |
|------|------|
| **모델** | SDXL Turbo |
| **API** | Replicate SDK v1.x |
| **API 키** | `REPLICATE_API_TOKEN` |
| **입력 방식** | text prompt only |
| **출력** | FileOutput → URL 추출 필요 |
| **스타일 참조** | 미지원 |
| **배경 스팟 참조** | 미지원 |
| **커스텀 프롬프트** | 지원 (기본 프롬프트에 추가) |
| **의류 참조** | 미지원 |

**장점:**
- 빠른 생성 (4 inference steps)
- Rate limit 상대적으로 관대

**단점:**
- 텍스트 프롬프트만 가능, 이미지 참조 불가
- 의류 디자인 재현 불가

---

### Stability AI (stability-ai)

| 항목 | 내용 |
|------|------|
| **모델** | SDXL |
| **API** | Replicate SDK v1.x |
| **API 키** | `REPLICATE_API_TOKEN` |
| **입력 방식** | text prompt only |
| **출력** | FileOutput → URL 추출 필요 |
| **스타일 참조** | 미지원 |
| **추론 단계** | 30 steps |
| **Guidance Scale** | 7.5 |

**장점:**
- 높은 이미지 품질 (30 steps)
- Scheduler 선택 가능 (K_EULER)

**단점:**
- 느린 생성 속도
- 의류 참조 불가

---

## Virtual Try-On Provider

### IDM-VTON (idm-vton)

| 항목 | 내용 |
|------|------|
| **모델** | cuuupid/idm-vton |
| **입력** | garment image + human image |
| **카테고리** | upper_body, lower_body, full |
| **Steps** | 30 |

### Kolors VTON (kolors-virtual-tryon)

| 항목 | 내용 |
|------|------|
| **모델** | kwai-kolors/kolors-virtual-tryon |
| **입력** | garment image + person image |
| **Steps** | 30 |

---

## 업스케일 Provider

### Real-ESRGAN

| 항목 | 내용 |
|------|------|
| **모델** | nightmareai/real-esrgan |
| **배율** | 2x 또는 4x |
| **얼굴 개선** | 선택적 활성화 |
| **용도** | 범용 업스케일 |

### Clarity Upscaler

| 항목 | 내용 |
|------|------|
| **모델** | philz1337x/clarity-upscaler |
| **배율** | 2x 또는 4x |
| **Resemblance** | 0.8 |
| **Creativity** | 0.3 |
| **용도** | 패션 이미지 전문 업스케일 |

---

## Provider 선택 가이드

| 상황 | 추천 Provider |
|------|---------------|
| 의류 이미지 + 모델 생성 | **google-gemini** (의류 참조 지원) |
| 기존 사진 스타일 복제 | **google-gemini** (스타일 참조 지원) |
| 특정 장소 배경 | **google-gemini** (배경 스팟 지원) |
| 빠른 프로토타입 | **replicate-flux** (4 steps, 빠름) |
| 고품질 텍스트 기반 생성 | **stability-ai** (30 steps) |
| 기존 모델 사진에 옷 입히기 | **idm-vton** 또는 **kolors-vton** |
| 최종 이미지 업스케일 | **real-esrgan** (2x) |
