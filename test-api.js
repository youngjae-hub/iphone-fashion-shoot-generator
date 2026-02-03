/**
 * API 테스트 스크립트 - Virtual Try-On 필수화 검증
 *
 * 사용법:
 * 1. test-images/ 폴더에 테스트 이미지 준비
 *    - garment.jpg: 업로드할 의류 이미지
 *    - reference.jpg: 스타일 참조 이미지 (선택)
 *
 * 2. 테스트 실행:
 *    node test-api.js [vercel-url]
 *
 * 예시:
 *    node test-api.js https://your-app.vercel.app
 */

const fs = require('fs');
const path = require('path');

// 이미지를 base64로 인코딩
function imageToBase64(imagePath) {
  if (!fs.existsSync(imagePath)) {
    throw new Error(`이미지를 찾을 수 없습니다: ${imagePath}`);
  }
  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString('base64');
  const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';
  return `data:${mimeType};base64,${base64}`;
}

// API 호출
async function testGeneration(baseUrl, testCase) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 테스트: ${testCase.name}`);
  console.log(`${'='.repeat(60)}`);

  const requestBody = {
    garmentImage: testCase.garmentImage,
    styleReferenceImages: testCase.styleReferenceImages || [],
    backgroundSpotImages: [],
    poses: testCase.poses || ['front'],
    settings: {
      modelStyle: 'natural',
      shotsPerPose: 1,
      seed: 42,
    },
    providers: {
      imageGeneration: 'replicate-flux',
      tryOn: 'idm-vton',
    },
    promptSettings: {
      useCustomPrompt: false,
      templateId: null,
      basePrompt: '',
      styleModifiers: [],
      negativePrompt: 'blurry, low quality, distorted',
    },
  };

  console.log('\n📤 요청 데이터:');
  console.log(`- 의류 이미지: ${testCase.garmentImage ? 'O' : 'X'}`);
  console.log(`- 스타일 참조: ${testCase.styleReferenceImages?.length || 0}장`);
  console.log(`- 포즈: ${testCase.poses?.join(', ') || 'front'}`);
  console.log(`- Provider: ${requestBody.providers.imageGeneration} + ${requestBody.providers.tryOn}`);

  try {
    const startTime = Date.now();

    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const data = await response.json();

    console.log(`\n📥 응답 (${elapsed}초):`);
    console.log(`- Status: ${response.status}`);
    console.log(`- Success: ${data.success}`);

    if (data.success) {
      console.log(`✅ 성공: ${data.images?.length || 0}개 이미지 생성`);

      if (data.images && data.images.length > 0) {
        data.images.forEach((img, idx) => {
          console.log(`   ${idx + 1}. ${img.pose} - ${img.provider}`);
          console.log(`      URL: ${img.url.substring(0, 80)}...`);
        });
      }

      if (data.warnings) {
        console.log(`\n⚠️  경고: ${data.warnings.length}개`);
        data.warnings.forEach(w => console.log(`   - ${w}`));
      }

      return { success: true, data };
    } else {
      console.log(`❌ 실패: ${data.error}`);
      if (data.details) {
        console.log(`   상세: ${data.details}`);
      }
      return { success: false, data };
    }
  } catch (error) {
    console.log(`\n💥 네트워크 오류: ${error.message}`);
    return { success: false, error: error.message };
  }
}

// 메인 테스트 실행
async function main() {
  const baseUrl = process.argv[2] || 'http://localhost:3000';
  console.log(`\n🚀 API 테스트 시작: ${baseUrl}`);
  console.log(`Timestamp: ${new Date().toISOString()}\n`);

  // 테스트 이미지 경로
  const testImagesDir = path.join(__dirname, 'test-images');
  const garmentPath = path.join(testImagesDir, 'garment.jpg');
  const referencePath = path.join(testImagesDir, 'reference.jpg');

  // 이미지 존재 여부 확인
  const hasGarment = fs.existsSync(garmentPath);
  const hasReference = fs.existsSync(referencePath);

  console.log('📂 테스트 이미지 상태:');
  console.log(`   - ${garmentPath}: ${hasGarment ? '✅' : '❌'}`);
  console.log(`   - ${referencePath}: ${hasReference ? '✅' : '❌'}`);

  if (!hasGarment) {
    console.log('\n⚠️  test-images/garment.jpg 파일이 필요합니다.');
    console.log('   의류 이미지를 준비한 후 다시 실행하세요.\n');
    process.exit(1);
  }

  // Base64 인코딩
  const garmentImage = imageToBase64(garmentPath);
  const styleReferenceImages = hasReference ? [imageToBase64(referencePath)] : [];

  // 테스트 케이스 정의
  const testCases = [
    {
      name: '케이스 1: 스타일 참조 이미지 있음 (옷만 교체)',
      garmentImage,
      styleReferenceImages,
      poses: ['front'],
      enabled: hasReference,
    },
    {
      name: '케이스 2: 스타일 참조 없음 (AI 생성 + Try-On)',
      garmentImage,
      styleReferenceImages: [],
      poses: ['front'],
      enabled: true,
    },
    {
      name: '케이스 3: 다중 포즈 테스트',
      garmentImage,
      styleReferenceImages,
      poses: ['front', 'side'],
      enabled: hasReference,
    },
  ];

  // 테스트 실행
  const results = [];
  for (const testCase of testCases) {
    if (!testCase.enabled) {
      console.log(`\n⏭️  ${testCase.name} - 스킵 (참조 이미지 없음)`);
      continue;
    }

    const result = await testGeneration(baseUrl, testCase);
    results.push({ name: testCase.name, ...result });

    // 다음 테스트 전 잠시 대기 (Rate limit 방지)
    if (testCases.indexOf(testCase) < testCases.length - 1) {
      console.log('\n⏳ 5초 대기 중...');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  // 최종 결과 요약
  console.log(`\n${'='.repeat(60)}`);
  console.log('📊 테스트 결과 요약');
  console.log(`${'='.repeat(60)}`);

  const successCount = results.filter(r => r.success).length;
  const totalCount = results.length;

  results.forEach((result, idx) => {
    const icon = result.success ? '✅' : '❌';
    console.log(`${icon} ${idx + 1}. ${result.name}`);
  });

  console.log(`\n총 ${totalCount}개 테스트 중 ${successCount}개 성공\n`);

  process.exit(successCount === totalCount ? 0 : 1);
}

// 실행
main().catch(error => {
  console.error('\n💥 예상치 못한 오류:', error);
  process.exit(1);
});
