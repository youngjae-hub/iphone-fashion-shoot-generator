# rapport. STUDIO - Design Document

## 1. 제품 개요

**rapport. STUDIO**는 AI 기반 패션 룩북 이미지 생성 웹 애플리케이션입니다.
의류 이미지를 업로드하면 아이폰으로 촬영한 것 같은 자연스러운 모델 착용 사진을 자동 생성합니다.

### 핵심 가치
- **진짜 같은 사진**: AI 생성 이미지의 이질감 최소화, 아이폰 촬영 느낌
- **빠른 생산**: 스튜디오 촬영 없이 다양한 포즈/스타일의 룩북 이미지 대량 생성
- **유연한 제어**: 스타일 참조 이미지, 배경 스팟 이미지, 커스텀 프롬프트로 세밀한 조정

---

## 2. 주요 기능 탭

### Tab 1: 아이폰 모델컷
- Google Gemini (Nano Banana Pro) 기반 이미지 생성
- 의류 이미지 + 스타일 참조 이미지 + 배경 스팟 이미지 조합
- 5가지 포즈 (정면/측면/뒷면/연출/디테일)
- 커스텀 프롬프트 에디터

### Tab 2: AI 모델컷
- Replicate 기반 (Flux, SDXL, IDM-VTON, Kolors VTON)
- Virtual Try-On 지원
- Provider 선택/전환 가능

### Tab 3: 의류 제품컷 리터칭
- 배경 제거 + 고화질 업스케일
- Real-ESRGAN / Clarity Upscaler 선택

---

## 3. 프롬프트 설계

### 기본 스타일 방향
```
Korean online shopping mall style photography
iPhone camera quality, natural daylight
Natural color grading, realistic skin tones
Authentic social media aesthetic, not too perfect
```

### 제거된 기본값 (v1.1+)
- ~~카페 배경~~ → plain wall, neutral backdrop
- ~~웜톤 색감~~ → natural color grading, no color cast
- ~~lens flare~~ → natural shadows and lighting inconsistencies

**이유**: 카페/웜톤이 "AI가 만든 느낌"을 강화시켜 이질감 유발

### 포즈별 프롬프트 전략
| 포즈 | 프레이밍 | 핵심 지시 |
|------|----------|-----------|
| front | WIDE FULL BODY SHOT | 카메라 정면, 한쪽 다리에 무게, 자연스러운 스탠스 |
| side | WIDE FULL BODY SHOT | 사이드 프로필, 카메라에서 시선 돌림, 캔디드 |
| back | WIDE FULL BODY SHOT | 뒷모습, 어깨 너머 살짝 시선 |
| styled | WIDE SHOT | 의자 앉기/돌기/옷 매만지기 등 라이프스타일 |
| detail | 3/4 BODY SHOT | 옷감 질감, 디테일, 액세서리 포커스 |

### 프레이밍 규칙
- 모델이 프레임 높이의 60-70% 차지
- 사방에 충분한 여백 (breathing room)
- 환경/배경이 함께 보이도록

### 스타일 참조 이미지 사용
- Google Gemini 전용 기능 (Replicate 미지원)
- `inlineData`로 이미지를 API에 직접 전달
- 텍스트 프롬프트로 "이 스타일을 복제하라" 지시
- 수치적 가중치 파라미터 없음 (약 30-60% 유사도)

### 배경 스팟 이미지 사용
- 촬영 장소를 참조 이미지로 지정
- "이 정확한 장소에서 촬영된 것처럼" 지시
- 스타일 참조와 동시 사용 가능

---

## 4. UI/UX 설계

### 레이아웃
- Google AI Studio 스타일 다크 테마
- 좌측 사이드바: 업로드/설정/Provider 선택
- 우측 메인: 결과 갤러리 (그리드)
- 반응형 디자인

### 인터랙션
- 드래그 앤 드롭 이미지 업로드
- 실시간 생성 진행률 표시
- 이미지별 업스케일/다운로드 액션
- Provider 실시간 전환

### 색상 체계
- 배경: 다크 그레이 (#1a1a2e 계열)
- 강조: 블루/퍼플 계열
- 텍스트: 화이트/라이트 그레이

---

## 5. 모델 익명성

### 얼굴 처리 전략
- 생성 시: "face cropped above lips showing only chin and lips" 프롬프트
- 후처리: `cropTopOfImage()` 함수로 상단 30% 크롭
- 결과: 입술과 턱만 보이고 눈/코 미노출

---

## 6. 이미지 품질 파이프라인

```
의류 이미지 업로드
    ↓
AI 모델 생성 (Gemini / Replicate)
    ↓
얼굴 크롭 (상단 30%)
    ↓
[선택] 업스케일 (Real-ESRGAN 2x)
    ↓
결과 갤러리 표시 + 다운로드
```
