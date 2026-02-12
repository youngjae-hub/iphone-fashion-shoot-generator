#!/usr/bin/env node

const fs = require('fs');
const Replicate = require('replicate');

function encodeImage(path) {
  const ext = path.split('.').pop().toLowerCase();
  let mime = 'image/jpeg';
  if (ext === 'webp') mime = 'image/webp';
  else if (ext === 'png') mime = 'image/png';

  return `data:${mime};base64,${fs.readFileSync(path).toString('base64')}`;
}

async function testIDMVTON() {
  console.log('🧪 IDM-VTON 직접 테스트\n');
  console.log('='.repeat(60));

  // API 키 확인
  if (!process.env.REPLICATE_API_TOKEN) {
    console.error('❌ REPLICATE_API_TOKEN이 설정되지 않았습니다.');
    return;
  }

  console.log('✅ REPLICATE_API_TOKEN 확인됨');

  // 이미지 준비
  const garmentPath = '/Users/hwiminhan/Downloads/mm onepiece.webp';
  const modelPath = '/Users/hwiminhan/ai-project/260116_iphone/reference-library/lusida/dress/lusida_dress_007.png';

  if (!fs.existsSync(garmentPath)) {
    console.error(`❌ 의류 이미지 없음: ${garmentPath}`);
    return;
  }

  if (!fs.existsSync(modelPath)) {
    console.error(`❌ 모델 이미지 없음: ${modelPath}`);
    return;
  }

  console.log(`✅ 의류 이미지: ${garmentPath}`);
  console.log(`✅ 모델 이미지: ${modelPath}`);
  console.log('');

  const garmentImage = encodeImage(garmentPath);
  const modelImage = encodeImage(modelPath);

  console.log('⏳ IDM-VTON 실행 중...');
  console.log('   Category: dresses');
  console.log('   Steps: 35');
  console.log('');

  const startTime = Date.now();

  try {
    const replicate = new Replicate({
      auth: process.env.REPLICATE_API_TOKEN
    });

    const output = await replicate.run(
      "cuuupid/idm-vton:0513734a452173b8173e907e3a59d19a36266e55b48528559432bd21c7d7e985",
      {
        input: {
          crop: false,
          seed: 42,
          steps: 35,
          category: "dresses",
          force_dc: false,
          garm_img: garmentImage,
          human_img: modelImage,
          mask_only: false,
          garment_des: "high quality fashion garment, sharp details, clear fabric texture, accurate sleeve length",
        }
      }
    );

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`✅ 성공 (${duration}초)`);
    console.log(`URL: ${output}`);

    // 결과 다운로드
    const imgResponse = await fetch(String(output));
    const buffer = Buffer.from(await imgResponse.arrayBuffer());
    const filename = '/Users/hwiminhan/Downloads/idm_vton_test.jpg';
    fs.writeFileSync(filename, buffer);

    console.log(`💾 저장: ${filename}`);
    require('child_process').exec(`open "${filename}"`);

  } catch (error) {
    const duration = ((Date.now() - startTime) / 1000).toFixed(1);
    console.error(`❌ 실패 (${duration}초):`, error.message);
    console.error('상세:', error);
  }

  console.log('');
  console.log('='.repeat(60));
}

testIDMVTON();
