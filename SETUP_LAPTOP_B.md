# 랩탑 B 셋업 가이드

다른 컴퓨터에서 이 프로젝트를 작업하기 위한 셋업 가이드입니다.

## 1. 프로젝트 클론

```bash
git clone https://github.com/youngjae-hub/iphone-fashion-shoot-generator.git
cd iphone-fashion-shoot-generator
```

## 2. 의존성 설치

```bash
npm install
```

## 3. 환경 변수 설정

`.env.local` 파일 생성:

```bash
cp .env.example .env.local
```

필수 환경 변수 입력 (`.env.local` 파일 편집):

```bash
# Replicate API (필수 - Virtual Try-On)
REPLICATE_API_TOKEN=your_replicate_token

# Google AI (선택)
GOOGLE_CLOUD_API_KEY=your_google_api_key

# Notion (선택 - 로깅)
NOTION_API_KEY=your_notion_api_key
NOTION_DATABASE_ID=your_database_id
```

## 4. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 http://localhost:3000 접속

## 5. 테스트 (선택)

### API 테스트 준비

```bash
# 샘플 이미지 다운로드
node download-test-images.js

# 또는 직접 이미지 준비
cp /path/to/garment.jpg test-images/
cp /path/to/reference.jpg test-images/
```

### 로컬 테스트

```bash
node test-api.js http://localhost:3000
```

### Vercel 테스트

```bash
node test-api.js https://iphone-fashion-shoot-generator.vercel.app
```

## 6. Vercel 배포 (선택)

```bash
# Vercel CLI 설치 (처음 한번만)
npm i -g vercel

# 배포
vercel

# 프로덕션 배포
vercel --prod
```

Vercel 환경 변수도 설정 필요:
- Vercel Dashboard → Settings → Environment Variables
- `REPLICATE_API_TOKEN` 추가
- `NOTION_API_KEY`, `NOTION_DATABASE_ID` 추가 (선택)

## 7. 주요 파일 구조

```
src/
├── app/
│   ├── api/
│   │   ├── generate/route.ts      # 이미지 생성 API
│   │   └── notion-log/            # Notion 로깅 API
│   └── page.tsx                   # 메인 페이지
├── lib/
│   ├── providers/                 # AI Provider 구현
│   │   ├── base.ts
│   │   ├── replicate.ts          # IDM-VTON, Flux 등
│   │   └── google-imagen.ts
│   └── notion.ts                  # Notion 통합
└── components/                    # React 컴포넌트

test-api.js                        # API 테스트 스크립트
download-test-images.js            # 샘플 이미지 다운로드
```

## 주요 변경사항 (최신)

### Virtual Try-On 필수화
- 스타일 참조 이미지가 있으면 그것을 모델로 직접 사용
- 옷만 업로드한 의류로 교체
- Try-On 실패 시 명확한 에러 반환

### 버그 수정
- IDM-VTON 최신 버전 (0513734a)
- SDXL guidance_scale 1.0
- category 파라미터 'upper_body'

## 문제 해결

### "REPLICATE_API_TOKEN is not set" 에러
→ `.env.local` 파일에 API 토큰 추가

### Virtual Try-On 실패
→ Replicate API 토큰 확인, API 할당량 확인

### Notion 로깅 안됨
→ NOTION_API_KEY, NOTION_DATABASE_ID 확인
→ Notion Integration 권한 확인

### NSFW 감지 에러
→ AI 생성 모델 대신 스타일 참조 이미지 사용 권장

## 도움말

문제가 있으면 다음을 확인하세요:
1. `.env.local` 파일이 제대로 설정되었는지
2. `npm install`이 정상 완료되었는지
3. Node.js 버전 (18.17 이상 권장)
4. Replicate API 할당량 남아있는지
