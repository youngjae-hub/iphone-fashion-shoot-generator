#!/usr/bin/env node
/**
 * IDM-VTON Steps 비교 테스트
 * Steps 25 vs Steps 20의 품질과 속도를 비교합니다.
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = process.argv[2] || 'http://localhost:3000';

function imageToBase64(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  return `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
}

async function testWithSteps(steps, label) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🧪 ${label} (steps: ${steps})`);
  console.log('='.repeat(60));

  const garmentPath = path.join(__dirname, 'colorful-blouse.jpg');
  const referencePath = path.join(__dirname, 'navy-cardigan-1.jpg');

  const garmentImage = imageToBase64(garmentPath);
  const styleReferenceImage = imageToBase64(referencePath);

  console.log('\n📤 API 요청 전송...');
  const startTime = Date.now();

  try {
    const response = await fetch(`${BASE_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        garmentImage,
        styleReferenceImages: [styleReferenceImage],
        poses: ['front'],
        settings: {
          poses: ['front'],
          shotsPerPose: 4,
          modelStyle: 'natural',
          seed: 42,
        },
        providers: {
          imageGeneration: 'replicate-flux',
          tryOn: 'idm-vton',
        },
        promptSettings: {
          useCustomPrompt: true,
          basePrompt: 'clean white background, minimal studio setting, natural soft lighting, professional fashion photography, remove mirror and background objects',
          negativePrompt: 'mirror, cluttered background, messy room, busy background, decorative items',
          styleModifiers: [],
        },
      }),
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    const data = await response.json();

    console.log(`\n📥 응답 (${elapsed}초):`);
    console.log(`  - Status: ${response.status}`);
    console.log(`  - Success: ${data.success}`);

    if (data.success && data.images && data.images.length > 0) {
      console.log(`\n✅ 성공: ${data.images.length}개 이미지 생성`);

      const urls = [];
      data.images.forEach((img, idx) => {
        console.log(`\n  ${idx + 1}. ${img.pose} - ${img.provider}`);
        console.log(`     URL: ${img.url}`);
        urls.push(img.url);
      });

      if (data.warnings) {
        console.log(`\n⚠️  경고: ${data.warnings}`);
      }

      return {
        success: true,
        duration: parseFloat(elapsed),
        count: data.images.length,
        urls: urls,
      };
    } else {
      console.log(`\n❌ 실패: ${data.error}`);
      if (data.details) {
        console.log(`   상세: ${data.details}`);
      }
      return {
        success: false,
        error: data.error,
      };
    }
  } catch (error) {
    console.error('\n❌ 에러:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}

async function compareResults() {
  console.log('🎨 IDM-VTON Steps 비교 테스트');
  console.log(`서버: ${BASE_URL}\n`);

  // 이 스크립트는 로컬에서 steps를 동적으로 변경할 수 없으므로
  // Vercel에 배포된 버전을 테스트하거나, 수동으로 steps를 변경한 후 실행해야 합니다.

  console.log('⚠️  주의: 이 스크립트는 현재 배포된 버전의 steps 설정을 사용합니다.');
  console.log('비교 테스트를 하려면:');
  console.log('1. steps: 25로 배포 → 이 스크립트 실행 → 결과 저장');
  console.log('2. steps: 20으로 배포 → 이 스크립트 실행 → 결과 저장');
  console.log('3. 두 결과를 비교\n');

  const result = await testWithSteps('current', '현재 배포된 버전');

  if (result.success) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 결과 요약');
    console.log('='.repeat(60));
    console.log(`소요 시간: ${result.duration}초`);
    console.log(`생성 컷 수: ${result.count}/4`);
    console.log('\n전체 URL:');
    result.urls.forEach((url, idx) => {
      console.log(`${idx + 1}. ${url}`);
    });
  }
}

compareResults();
