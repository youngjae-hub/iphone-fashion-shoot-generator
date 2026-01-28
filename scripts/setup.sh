#!/bin/bash
# ============================================
# rapport. STUDIO - 새 머신 초기 세팅 스크립트
# ============================================
# 사용법:
#   1. git clone https://github.com/youngjae-hub/iphone-fashion-shoot-generator.git
#   2. cd iphone-fashion-shoot-generator
#   3. chmod +x scripts/setup.sh
#   4. ./scripts/setup.sh
# ============================================

set -e

echo ""
echo "=========================================="
echo "  rapport. STUDIO - 초기 세팅"
echo "=========================================="
echo ""

# 1. Node.js 확인
echo "[1/4] Node.js 확인..."
if ! command -v node &> /dev/null; then
    echo "❌ Node.js가 설치되어 있지 않습니다."
    echo "   https://nodejs.org 에서 설치 후 다시 실행하세요."
    exit 1
fi
NODE_VERSION=$(node -v)
echo "  ✅ Node.js $NODE_VERSION"

# 2. npm install
echo ""
echo "[2/4] 패키지 설치 중..."
npm install
echo "  ✅ 패키지 설치 완료"

# 3. .env.local 확인
echo ""
echo "[3/4] 환경 변수 파일 확인..."
if [ -f .env.local ]; then
    echo "  ✅ .env.local 파일이 이미 존재합니다."
else
    echo "  ⚠️  .env.local 파일이 없습니다!"
    echo ""
    echo "  A 랩탑에서 .env.local 파일을 복사해 오세요."
    echo "  방법 1: 카카오톡/슬랙으로 파일 전송"
    echo "  방법 2: USB로 복사"
    echo "  방법 3: 아래 내용을 직접 입력"
    echo ""
    echo "  파일 위치: 프로젝트 루트/.env.local"
    echo ""
    echo "  필요한 환경 변수:"
    echo "  ─────────────────────────────────────"
    echo "  REPLICATE_API_TOKEN=your_token"
    echo "  GOOGLE_CLOUD_API_KEY=your_key"
    echo "  NOTION_API_KEY=your_notion_key"
    echo "  NOTION_DATABASE_ID=your_database_id"
    echo "  ─────────────────────────────────────"
    echo ""

    read -p "  .env.local을 지금 생성하시겠습니까? (y/n): " CREATE_ENV
    if [ "$CREATE_ENV" = "y" ] || [ "$CREATE_ENV" = "Y" ]; then
        echo ""
        read -p "  REPLICATE_API_TOKEN: " REPLICATE_TOKEN
        read -p "  GOOGLE_CLOUD_API_KEY (없으면 Enter): " GOOGLE_KEY
        read -p "  NOTION_API_KEY (없으면 Enter): " NOTION_KEY
        read -p "  NOTION_DATABASE_ID (없으면 Enter): " NOTION_DB

        cat > .env.local << EOF
# Replicate API (IDM-VTON, Flux 등) - 필수
REPLICATE_API_TOKEN=$REPLICATE_TOKEN

# Google Imagen (선택)
GOOGLE_CLOUD_API_KEY=$GOOGLE_KEY

# Notion Integration (생성 로그 기록용)
NOTION_API_KEY=$NOTION_KEY
NOTION_DATABASE_ID=$NOTION_DB
EOF
        echo "  ✅ .env.local 생성 완료"
    else
        echo "  ℹ️  나중에 .env.local 파일을 수동으로 추가하세요."
    fi
fi

# 4. 빌드 테스트
echo ""
echo "[4/4] 빌드 테스트..."
if npm run build 2>/dev/null; then
    echo "  ✅ 빌드 성공"
else
    echo "  ⚠️  빌드 실패 - .env.local 설정 후 다시 시도하세요."
fi

echo ""
echo "=========================================="
echo "  세팅 완료!"
echo "=========================================="
echo ""
echo "  개발 서버 실행: npm run dev"
echo "  브라우저 접속:  http://localhost:3000"
echo ""
echo "  A 랩탑 작업 가져오기: git pull"
echo "  B 랩탑 작업 올리기:   git add . && git commit -m \"설명\" && git push"
echo ""
