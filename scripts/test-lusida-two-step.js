/**
 * 루시다 LoRA 2단계 워크플로우 테스트
 *
 * Step 1: LoRA로 루시다 스타일 모델 생성 (얼굴 크롭)
 * Step 2: Virtual Try-On으로 회색 원피스 착장
 */

const fs = require('fs');
const path = require('path');

async function testTwoStepWorkflow() {
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
    process.exit(1);
  }

  const dressBuffer = fs.readFileSync(dressImagePath);
  const dressBase64 = `data:image/jpeg;base64,${dressBuffer.toString('base64')}`;
  console.log(`✅ 회색 원피스 이미지 로드 (${(dressBuffer.length / 1024).toFixed(1)} KB)`);
  console.log('');

  console.log('🎨 루시다 2단계 워크플로우 시작...\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  // ============================================
  // STEP 1: LoRA로 루시다 스타일 모델 생성
  // ============================================
  console.log('📍 STEP 1: 루시다 스타일 모델 생성 (LoRA)');
  console.log('   → 얼굴 크롭된 자연스러운 포즈');
  console.log('   → 미니멀 화이트 배경');
  console.log('   → 캐주얼 홈 인테리어 세팅\n');

  const loraPrompt = `
    LUSIDA, young Korean woman,
    face cropped from neck down, headless shot, no face visible,
    natural standing pose with hands by sides,
    full body from shoulders to feet,
    minimalist white indoor background,
    soft natural window lighting,
    casual home interior with clean aesthetic,
    daily lookbook photography style
  `.trim().replace(/\s+/g, ' ');

  console.log('📝 프롬프트:', loraPrompt);
  console.log('');

  let modelImageUrl;

  try {
    console.log('⏳ LoRA 모델 생성 중...');
    const loraResponse = await fetch(`${baseUrl}/api/lora/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        loraModelId: modelId,
        prompt: loraPrompt,
        pose: 'front',
        seed: 42,
      }),
    });

    const loraResult = await loraResponse.json();

    if (!loraResult.success) {
      console.error('\n❌ STEP 1 실패:', loraResult.error);
      process.exit(1);
    }

    modelImageUrl = loraResult.image.url;
    console.log('✅ STEP 1 완료!');
    console.log(`   모델 이미지: ${modelImageUrl}`);
    console.log('');

  } catch (error) {
    console.error('\n❌ STEP 1 오류:', error.message);
    process.exit(1);
  }

  // ============================================
  // STEP 2: Virtual Try-On으로 의류 착장
  // ============================================
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📍 STEP 2: 회색 원피스 착장 (Virtual Try-On)');
  console.log('   → IDM-VTON 사용');
  console.log('   → 카테고리: dresses\n');

  // 모델 이미지를 다운로드해서 base64로 변환
  console.log('⏳ 모델 이미지 다운로드 중...');
  const modelResponse = await fetch(modelImageUrl);
  const modelBuffer = await modelResponse.arrayBuffer();
  const modelBase64 = `data:image/png;base64,${Buffer.from(modelBuffer).toString('base64')}`;
  console.log(`✅ 모델 이미지 다운로드 완료 (${(modelBuffer.byteLength / 1024).toFixed(1)} KB)`);
  console.log('');

  try {
    console.log('⏳ Virtual Try-On 실행 중...');
    const vtonRequest = {
      garmentImage: dressBase64,
      styleReferenceImages: [],
      poses: ['front'],
      settings: {
        modelStyle: 'iphone-natural',
        backgroundStyle: 'minimal-studio',
        shotsPerPose: 1,
        totalShots: 1,
        seed: 42,
        garmentCategory: 'dresses',
      },
      providers: {
        imageGeneration: 'replicate-flux',
        tryOn: 'idm-vton',
        background: 'replicate-flux',
      },
      // 생성된 루시다 모델 이미지 사용
      baseModelImage: modelBase64,
    };

    const vtonResponse = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(vtonRequest),
    });

    const vtonResult = await vtonResponse.json();

    if (!vtonResult.success) {
      console.error('\n❌ STEP 2 실패:', vtonResult.error);
      process.exit(1);
    }

    console.log('✅ STEP 2 완료!');
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('🎉 루시다 스타일 이미지 생성 완료!\n');
    console.log('📊 최종 결과:');
    console.log(`   이미지 URL: ${vtonResult.images[0].url}`);
    console.log(`   포즈: ${vtonResult.images[0].pose}`);
    console.log('');
    console.log('💡 브라우저에서 확인:');
    console.log(`   STEP 1 (모델): ${modelImageUrl}`);
    console.log(`   STEP 2 (최종): ${vtonResult.images[0].url}`);

  } catch (error) {
    console.error('\n❌ STEP 2 오류:', error.message);
    process.exit(1);
  }
}

testTwoStepWorkflow();
