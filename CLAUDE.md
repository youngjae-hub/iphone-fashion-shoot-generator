# iPhone Style Fashion Photo Generator

## 이 앱의 본질 (반드시 읽을 것)

**누끼 제품컷을 넣으면 아이폰 스타일 쇼핑몰 룩북이 나오는 앱.**

핵심 파이프라인:
```
누끼 제품컷 업로드 → AI 모델 생성 (얼굴 크롭) → Virtual Try-On 착장 → 다중 포즈 배치 생성
```

### 이 앱이 잘하는 것
- 배경 제거된 순수 의류 이미지(누끼) → 룩북 변환
- AI 모델 생성 + VTON으로 의류 정확 반영
- 아이폰 촬영 느낌 (자연광, 선명한 디테일, 미니멀 배경)
- 다중 포즈 배치 생성 (정면/측면/뒷면/연출/디테일)
- 얼굴 크롭으로 익명성 보장

### 이 앱으로 안 되는 것 (시도하지 말 것)
- 모델착용컷에서 옷 갈아입히기 (VTON은 "옷 입히기"이지 "옷 갈아입히기"가 아님)
- 특정 브랜드 스타일 1:1 복제 (LoRA로도 한계)
- 레퍼런스 이미지의 모델+배경 유지하면서 옷만 교체

이 경계를 벗어나는 기능 요청이 들어오면, 먼저 사용자에게 경계 밖임을 알릴 것.

---

## 개발 로드맵

아래 Phase 순서대로만 작업할 것. Phase 1이 완료되기 전에 Phase 2로 넘어가지 않는다.

### Phase 1: 핵심 품질 안정화 (현재 단계)

| # | 과제 | 현재 문제 | 작업 내용 | 관련 파일 |
|---|------|-----------|-----------|-----------|
| 1-1 | 얼굴 크롭 일관성 | 포즈마다 크롭 기준 제각각, 가끔 얼굴 전체 노출 | 프롬프트 표준화 + 생성 후 크롭 후처리(상단 N% 잘라내기) | `src/lib/providers/base.ts:79-96` |
| 1-2 | garmentCategory 자동 매칭 | 기본값 `'dresses'` 고정, 상의 넣어도 원피스 모드 동작 | classify-garment API 결과를 VTON category에 자동 연결 | `src/app/api/generate/route.ts:159` |
| 1-3 | 프롬프트 품질 튜닝 | "아이폰 느낌"이 텍스트에만 의존, 불안정 | 기본 Provider(google-gemini) 최적 프롬프트 튜닝 | `src/lib/providers/google-gemini.ts` |

### Phase 2: 결과물 신뢰도 (Phase 1 완료 후)

| # | 과제 | 설명 |
|---|------|------|
| 2-1 | A/B 비교 | 같은 입력으로 Provider 2개 결과를 나란히 비교 |
| 2-2 | 시드 고정 재현성 | 마음에 든 결과를 시드로 저장 → 같은 스타일로 다른 옷 생성 |
| 2-3 | 품질 자동 체크 | 생성 결과에 얼굴 노출 여부, 의류 반영도 자동 검증 |

### Phase 3: 실무 효율 (Phase 2 완료 후)

| # | 과제 | 설명 |
|---|------|------|
| 3-1 | 벌크 처리 | 제품컷 10장 올리면 한 번에 전체 룩북 생성 |
| 3-2 | 템플릿 저장 | 좋은 설정 저장 → 다음에 바로 적용 |
| 3-3 | Vercel Pro 마이그레이션 | 60초→300초 타임아웃, steps 올려서 품질 확보 |

### 하지 않는 것 (로드맵에 추가하지 말 것)
- 크롤링 기능 확장 (깨지기 쉬운 기능)
- 새로운 AI Provider 추가 (현재 것 안정화가 우선)
- 리터칭/후보정 기능 (외부 서비스 영역)
- 브랜드 스타일 이식 기능 (본질 밖)

---

## 기술 스택
- **Frontend**: Next.js 16+ (App Router) + React 19+
- **Styling**: Tailwind CSS v4
- **AI Image Generation**: Google Gemini (기본), Flux Pro, SDXL, Google Imagen
- **Virtual Try-On**: IDM-VTON (기본), Kolors VTON (대안)
- **Storage**: Vercel KV (히스토리, LoRA 모델)
- **Logging**: Notion API (생성 로그)

## 개발 명령어

```bash
npm run dev      # 개발 서버 (localhost:3000)
npm run build    # 프로덕션 빌드
npm start        # 프로덕션 실행
npm run lint     # ESLint
```

## 환경 변수 (.env.local)

```bash
# 필수
REPLICATE_API_TOKEN=...

# 선택
GOOGLE_CLOUD_API_KEY=...
NOTION_API_KEY=...
NOTION_DATABASE_ID=...
```

## 디렉토리 구조 (다이어트 후)

```
src/
├── app/
│   ├── page.tsx                    # 메인 페이지
│   ├── layout.tsx                  # 앱 레이아웃
│   └── api/
│       ├── generate/route.ts       # [핵심] 이미지 생성 파이프라인
│       ├── providers/route.ts      # Provider 가용성 체크
│       ├── classify-garment/       # 의류 카테고리 자동 분류
│       ├── lora/                   # LoRA 학습/생성
│       ├── model-shot/             # AI 모델컷 생성
│       ├── enhance/                # 이미지 향상
│       ├── upscale/                # 업스케일
│       ├── scrape-images/          # URL 이미지 스크래핑
│       ├── history/                # 세션 히스토리
│       ├── notion-log/             # Notion 로그
│       ├── download-zip/           # ZIP 다운로드
│       ├── preprocess/             # 이미지 전처리
│       └── auth/                   # 인증 (비활성)
├── components/
│   ├── ImageUploader.tsx           # 드래그앤드롭 업로더
│   ├── GenerationSettings.tsx      # 생성 설정
│   ├── PromptEditor.tsx            # 프롬프트 커스터마이징
│   ├── ProviderSelector.tsx        # Provider 선택
│   ├── ResultGallery.tsx           # 결과 갤러리 + 다운로드
│   ├── LoRATraining.tsx            # LoRA 학습
│   ├── ModelShotGenerator.tsx      # AI 모델컷
│   ├── History.tsx                 # 히스토리
│   └── HelpTooltip.tsx             # 도움말
├── lib/
│   ├── providers/
│   │   ├── base.ts                 # Provider 인터페이스 + 프롬프트 유틸
│   │   ├── index.ts                # Provider Factory
│   │   ├── google-gemini.ts        # [기본] Gemini Provider
│   │   ├── replicate.ts            # Flux, SDXL, IDM-VTON, Kolors
│   │   ├── google-imagen.ts        # Imagen Provider
│   │   ├── huggingface.ts          # HuggingFace Provider
│   │   └── lora-training.ts        # LoRA 학습
│   └── notion.ts                   # Notion 로깅
└── types/
    └── index.ts                    # 타입 정의 + 설정 상수
```

## 코드 컨벤션
- TypeScript strict mode
- ESLint + Next.js 규칙
- 'use client' 컴포넌트 분리
- API routes는 App Router 방식
- 새 기능 추가 전에 반드시 로드맵 확인 — 로드맵에 없는 기능은 만들지 않는다
