#!/usr/bin/env node
/**
 * Notion 로깅 직접 테스트
 */

async function testNotionLogging() {
  console.log('🧪 Notion 로깅 테스트...\n');

  const testEntry = {
    title: '테스트 - replicate-flux',
    provider: 'replicate-flux',
    modelName: 'replicate-flux + idm-vton',
    pose: 'front',
    prompt: 'Test prompt for logging',
    customPrompt: 'clean white background, test',
    hasStyleReference: true,
    hasBackgroundSpot: false,
    success: true,
    resultImageUrl: 'https://example.com/test.jpg',
    totalShotsGenerated: 1,
    durationSeconds: 15.5,
  };

  try {
    const response = await fetch('http://localhost:3000/api/notion-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry: testEntry }),
    });

    const data = await response.json();

    if (data.success) {
      console.log('✅ 로깅 성공!');
      console.log(`   - Page ID: ${data.id}`);
      console.log('\n✨ Notion 데이터베이스를 확인하세요.');
    } else {
      console.log('❌ 로깅 실패:', data.error);
    }
  } catch (error) {
    console.error('❌ 에러:', error.message);
  }
}

testNotionLogging();
