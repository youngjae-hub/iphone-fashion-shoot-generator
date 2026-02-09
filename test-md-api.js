#!/usr/bin/env node
/**
 * MD 요청 테스트 스크립트
 * 스타일 참조 이미지 기반 Virtual Try-On 테스트
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = process.argv[2] || 'http://localhost:3000';

// 이미지를 base64로 변환
function imageToBase64(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  return `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
}

async function testMDRequest() {
  console.log('🧪 MD 요청 테스트 시작...\n');

  const garmentPath = path.join(__dirname, 'colorful-blouse.jpg');
  const referencePath = path.join(__dirname, 'navy-cardigan-1.jpg');

  if (!fs.existsSync(garmentPath)) {
    console.error('❌ 의류 이미지가 없습니다:', garmentPath);
    return;
  }

  if (!fs.existsSync(referencePath)) {
    console.error('❌ 참조 이미지가 없습니다:', referencePath);
    return;
  }

  console.log('📷 이미지 준비:');
  console.log('  - 의류: colorful-blouse.jpg (화려한 블라우스)');
  console.log('  - 참조: navy-cardigan-1.jpg (네이비 가디건 모델)\n');

  const garmentImage = imageToBase64(garmentPath);
  const styleReferenceImage = imageToBase64(referencePath);

  console.log('📤 API 요청 전송...');
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
          shotsPerPose: 4, // 4컷 생성
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
      data.images.forEach((img, idx) => {
        console.log(`  ${idx + 1}. ${img.pose} - ${img.provider}`);
        console.log(`     URL: ${img.url.substring(0, 80)}...`);
      });

      if (data.warnings) {
        console.log(`\n⚠️  경고: ${data.warnings}`);
      }
    } else {
      console.log(`\n❌ 실패: ${data.error}`);
      if (data.details) {
        console.log(`   상세: ${data.details}`);
      }
    }
  } catch (error) {
    console.error('\n❌ 에러:', error.message);
  }
}

testMDRequest();
