# 테스트 이미지 폴더

API 테스트를 위한 이미지를 이곳에 배치하세요.

## 필요한 파일

### 필수
- **garment.jpg**: 테스트할 의류 이미지 (상의 권장)

### 선택
- **reference.jpg**: 스타일 참조 이미지 (모델, 포즈, 배경이 포함된 룩북 이미지)

## 이미지 준비 방법

1. 의류 이미지 준비
   - 배경이 깔끔한 상의 사진
   - 해상도: 512x512 이상 권장
   - 형식: JPG, PNG

2. 참조 이미지 준비 (선택)
   - 모델이 옷을 입고 있는 룩북 사진
   - 이 이미지의 모델/포즈/배경은 유지되고, 옷만 garment.jpg로 교체됨
   - 해상도: 768x1024 이상 권장

## 테스트 실행

```bash
# 로컬 테스트
node test-api.js http://localhost:3000

# Vercel 배포 테스트
node test-api.js https://your-app.vercel.app
```

## 예상 결과

### 케이스 1: 스타일 참조 있음
- reference.jpg의 모델, 포즈, 배경 그대로 유지
- 옷만 garment.jpg로 교체
- Virtual Try-On 사용

### 케이스 2: 스타일 참조 없음
- AI가 모델 생성 (아이폰 스타일)
- 생성된 모델에 garment.jpg 착용
- AI 생성 + Virtual Try-On 사용
