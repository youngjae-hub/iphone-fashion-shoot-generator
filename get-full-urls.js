#!/usr/bin/env node
/**
 * 전체 URL 출력 스크립트
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = process.argv[2] || 'http://localhost:3000';

function imageToBase64(imagePath) {
  const imageBuffer = fs.readFileSync(imagePath);
  return `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;
}

async function getFullURLs() {
  console.log('🔗 전체 URL 가져오기...\n');

  const garmentPath = path.join(__dirname, 'colorful-blouse.jpg');
  const referencePath = path.join(__dirname, 'navy-cardigan-1.jpg');

  const garmentImage = imageToBase64(garmentPath);
  const styleReferenceImage = imageToBase64(referencePath);

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
          shotsPerPose: 1,
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

    if (data.success && data.images && data.images.length > 0) {
      console.log(`✅ 성공: ${data.images.length}개 이미지 (${elapsed}초)\n`);
      console.log('📋 전체 URL 목록:\n');

      data.images.forEach((img, idx) => {
        console.log(`${idx + 1}. ${img.url}`);
      });

      console.log('\n\n📝 복사용 (쉼표 구분):\n');
      const urls = data.images.map(img => img.url);
      console.log(urls.join(',\n'));

      console.log('\n\n🔗 브라우저에서 열기:\n');
      data.images.forEach((img, idx) => {
        console.log(`${idx + 1}. open "${img.url}"`);
      });

    } else {
      console.log(`❌ 실패: ${data.error}`);
    }
  } catch (error) {
    console.error('❌ 에러:', error.message);
  }
}

getFullURLs();
