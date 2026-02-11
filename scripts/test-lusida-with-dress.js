/**
 * 루시다 LoRA + 회색 원피스 제품 테스트
 */

const fs = require('fs');
const path = require('path');

async function testWithDress() {
  const baseUrl = 'http://localhost:3000';

  // 학습 정보 로드
  const infoPath = path.join(__dirname, '../lora-training-info.json');
  let modelId = 'a122f68b-544d-4345-96d8-c986466ca166';

  if (fs.existsSync(infoPath)) {
    const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
    modelId = info.model.id;
    console.log(`✅ 모델 ID 로드: ${modelId}`);
  }

  // 회색 원피스 이미지 로드
  const dressImagePath = path.join(__dirname, '../test-dress-gray.jpg');
  if (!fs.existsSync(dressImagePath)) {
    console.error('❌ 회색 원피스 이미지를 찾을 수 없습니다:', dressImagePath);
    console.log('💡 이미지를 저장해주세요: test-dress-gray.jpg');
    process.exit(1);
  }

  const dressBuffer = fs.readFileSync(dressImagePath);
  const dressBase64 = `data:image/jpeg;base64,${dressBuffer.toString('base64')}`;
  console.log(`✅ 회색 원피스 이미지 로드 (${(dressBuffer.length / 1024).toFixed(1)} KB)`);
  console.log('');

  console.log('🎨 루시다 LoRA + 회색 원피스 테스트 생성...\n');

  // 테스트 프롬프트 (얼굴 크롭 강조)
  const testPrompt = `
    LUSIDA, young Korean woman wearing gray knit dress,
    face cropped above lips, headless composition, no face visible,
    shot from shoulders down to feet,
    minimalist white indoor background,
    natural standing pose with hands by sides,
    soft natural lighting from window,
    full body outfit shot,
    daily fashion lookbook style,
    clean aesthetic,
    casual home interior setting,
    professional product photography
  `.trim().replace(/\s+/g, ' ');

  console.log('📝 프롬프트:', testPrompt);
  console.log('');

  const request = {
    loraModelId: modelId,
    prompt: testPrompt,
    garmentImage: dressBase64,
    pose: 'front',
    seed: 42,
  };

  try {
    console.log('🚀 생성 요청 중...');
    console.log('   LoRA 모델로 루시다 스타일 적용');
    console.log('   회색 원피스 제품 이미지 포함');
    console.log('');

    const response = await fetch(`${baseUrl}/api/lora/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });

    const result = await response.json();

    if (!result.success) {
      console.error('\n❌ 생성 실패:', result.error);
      process.exit(1);
    }

    console.log('\n✅ 생성 성공!');
    console.log('\n📊 결과:');
    console.log(`   이미지 URL: ${result.image.url}`);
    console.log(`   포즈: ${result.image.pose}`);
    console.log(`   Provider: ${result.image.provider}`);
    console.log('\n💡 브라우저에서 이미지 확인:');
    console.log(`   ${result.image.url}`);
    console.log('\n🎉 루시다 스타일로 회색 원피스가 착장된 모델 이미지가 생성되었습니다!');

  } catch (error) {
    console.error('\n❌ 오류:', error.message);
    process.exit(1);
  }
}

testWithDress();
