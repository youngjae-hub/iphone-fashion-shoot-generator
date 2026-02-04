/**
 * 간단한 API 테스트 - 에러 확인용
 */

const fs = require('fs');

// 작은 더미 이미지 (1x1 픽셀)
const DUMMY_IMAGE = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

async function testVercel() {
  const baseUrl = 'https://iphone-fashion-shoot-generator.vercel.app';

  console.log('🧪 Vercel 배포 테스트...\n');

  // 1. Provider 확인
  console.log('1. Provider 확인...');
  const providersRes = await fetch(`${baseUrl}/api/providers`);
  const providers = await providersRes.json();
  console.log(`   Status: ${providersRes.status}`);
  console.log(`   Try-On available: ${providers.availability?.tryOn?.['idm-vton']}`);

  // 2. 최소 요청 테스트
  console.log('\n2. 최소 생성 요청 테스트...');
  const testBody = {
    garmentImage: DUMMY_IMAGE,
    styleReferenceImages: [],
    backgroundSpotImages: [],
    poses: ['front'],
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
      negativePrompt: 'blurry',
    },
  };

  try {
    const genRes = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testBody),
    });

    const result = await genRes.json();
    console.log(`   Status: ${genRes.status}`);
    console.log(`   Success: ${result.success}`);

    if (!result.success) {
      console.log(`   Error: ${result.error}`);
      if (result.details) {
        console.log(`   Details: ${result.details}`);
      }
    } else {
      console.log(`   ✅ 생성 성공!`);
    }
  } catch (error) {
    console.log(`   ❌ 네트워크 오류: ${error.message}`);
  }

  console.log('\n완료');
}

testVercel();
