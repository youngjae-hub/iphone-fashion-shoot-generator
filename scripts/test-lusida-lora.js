/**
 * 루시다 LoRA 테스트 생성 스크립트
 */

const fs = require('fs');
const path = require('path');

async function testLoRA() {
  const baseUrl = 'http://localhost:3000';

  // 학습 정보 로드
  const infoPath = path.join(__dirname, '../lora-training-info.json');
  let modelId = 'a122f68b-544d-4345-96d8-c986466ca166';

  if (fs.existsSync(infoPath)) {
    const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
    modelId = info.model.id;
    console.log(`✅ 모델 ID 로드: ${modelId}`);
  }

  console.log('🎨 루시다 LoRA 테스트 생성...\n');

  // 테스트 프롬프트
  const testPrompt = `
    LUSIDA, young Korean woman,
    minimalist white studio background,
    natural casual pose,
    soft natural lighting,
    full body shot,
    daily fashion lookbook style,
    clean aesthetic
  `.trim().replace(/\s+/g, ' ');

  console.log('📝 프롬프트:', testPrompt);
  console.log('');

  const request = {
    loraModelId: modelId,
    prompt: testPrompt,
    pose: 'front',
    seed: 42,
  };

  try {
    console.log('🚀 생성 요청 중...');
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

  } catch (error) {
    console.error('\n❌ 오류:', error.message);
    process.exit(1);
  }
}

testLoRA();
