/**
 * 루시다 LoRA 학습 스크립트
 *
 * 사용법:
 *   node scripts/train-lusida-lora.js
 */

const fs = require('fs');
const path = require('path');

// 재귀적으로 이미지 파일 찾기
function findImageFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      findImageFiles(filePath, fileList);
    } else if (/\.(jpg|jpeg|png|webp)$/i.test(file)) {
      fileList.push(filePath);
    }
  });

  return fileList;
}

async function main() {
  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  console.log('🎨 루시다 LoRA 학습 시작...\n');

  // 1. 루시다 이미지 수집
  console.log('1️⃣ 이미지 수집 중...');
  const lusidaDir = path.join(__dirname, '../reference-library/lusida');
  const imageFiles = findImageFiles(lusidaDir);

  console.log(`   ✅ ${imageFiles.length}장의 이미지 발견`);

  if (imageFiles.length < 10) {
    console.error('   ❌ 최소 10장의 이미지가 필요합니다.');
    process.exit(1);
  }

  // 2. 이미지를 base64로 인코딩 (최대 12장, 작은 것부터 선택)
  console.log('\n2️⃣ 이미지 인코딩 중...');

  // 파일 크기순 정렬
  const filesWithSize = imageFiles.map(file => ({
    path: file,
    size: fs.statSync(file).size
  })).sort((a, b) => a.size - b.size);

  const maxImages = 12;
  const selectedFiles = filesWithSize.slice(0, maxImages);

  const images = [];

  for (const { path: file, size } of selectedFiles) {
    const buffer = fs.readFileSync(file);
    const sizeKB = buffer.length / 1024;

    const ext = path.extname(file).toLowerCase();
    const mimeType = ext === '.png' ? 'image/png' : 'image/jpeg';
    const base64 = `data:${mimeType};base64,${buffer.toString('base64')}`;
    images.push(base64);

    const fileName = path.basename(file);
    console.log(`   ✓ ${fileName} (${sizeKB.toFixed(1)} KB)`);
  }

  console.log(`   ✅ ${images.length}장 선택 (작은 파일 우선)`);

  // 3. LoRA 학습 API 호출
  console.log('\n3️⃣ LoRA 학습 시작...');
  const trainingRequest = {
    name: 'Lusida Style',
    description: '루시다 브랜드 룩북 스타일 - 미니멀 화이트 배경, 자연스러운 포즈, 일상 캐주얼',
    images: images,
    triggerWord: 'LUSIDA',
    trainingSteps: 1500, // 고품질 학습
  };

  try {
    console.log(`   API 호출: ${baseUrl}/api/lora`);
    console.log(`   이미지 수: ${images.length}장`);
    console.log(`   트리거 워드: LUSIDA`);
    console.log(`   학습 스텝: 1500`);

    const response = await fetch(`${baseUrl}/api/lora`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(trainingRequest),
    });

    const result = await response.json();

    if (!result.success) {
      console.error(`\n❌ 학습 시작 실패: ${result.error}`);
      process.exit(1);
    }

    console.log('\n✅ 학습이 시작되었습니다!');
    console.log('\n📊 학습 정보:');
    console.log(`   모델 ID: ${result.model.id}`);
    console.log(`   Training ID: ${result.trainingId}`);
    console.log(`   예상 소요 시간: 15-30분`);
    console.log(`   예상 비용: ~$5`);

    console.log('\n🔍 학습 진행 상황 확인:');
    console.log(`   ${baseUrl}/api/lora?modelId=${result.model.id}&checkStatus=true`);

    console.log('\n⏳ 학습이 완료되면 "LUSIDA" 트리거 워드로 루시다 스타일을 생성할 수 있습니다.');

    // 학습 정보를 파일로 저장
    const infoFile = path.join(__dirname, '../lora-training-info.json');
    fs.writeFileSync(infoFile, JSON.stringify(result, null, 2));
    console.log(`\n💾 학습 정보 저장: ${infoFile}`);

  } catch (error) {
    console.error(`\n❌ API 호출 오류:`, error.message);
    process.exit(1);
  }
}

main().catch(console.error);
