/**
 * 테스트용 샘플 이미지 다운로드 스크립트
 * Unsplash에서 무료 패션 이미지를 다운로드합니다.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// 샘플 이미지 URL (Unsplash 무료 이미지)
const SAMPLE_IMAGES = {
  garment: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800&q=80', // 흰색 셔츠
  reference: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80', // 모델 룩북
};

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    console.log(`📥 다운로드 중: ${path.basename(filepath)}`);

    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // 리다이렉트 처리
        downloadImage(response.headers.location, filepath).then(resolve).catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(filepath);
      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log(`✅ 저장 완료: ${filepath}`);
        resolve();
      });

      file.on('error', (err) => {
        fs.unlink(filepath, () => {});
        reject(err);
      });
    }).on('error', reject);
  });
}

async function main() {
  const testImagesDir = path.join(__dirname, 'test-images');

  // 디렉토리 생성
  if (!fs.existsSync(testImagesDir)) {
    fs.mkdirSync(testImagesDir, { recursive: true });
  }

  console.log('\n🖼️  테스트 이미지 다운로드 시작...\n');

  try {
    // 의류 이미지 다운로드
    const garmentPath = path.join(testImagesDir, 'garment.jpg');
    if (!fs.existsSync(garmentPath)) {
      await downloadImage(SAMPLE_IMAGES.garment, garmentPath);
    } else {
      console.log(`⏭️  건너뛰기: ${garmentPath} (이미 존재)`);
    }

    // 참조 이미지 다운로드
    const referencePath = path.join(testImagesDir, 'reference.jpg');
    if (!fs.existsSync(referencePath)) {
      await downloadImage(SAMPLE_IMAGES.reference, referencePath);
    } else {
      console.log(`⏭️  건너뛰기: ${referencePath} (이미 존재)`);
    }

    console.log('\n✅ 모든 이미지 다운로드 완료!');
    console.log('\n다음 명령어로 테스트를 실행하세요:');
    console.log('  node test-api.js https://iphone-fashion-shoot-generator.vercel.app\n');
  } catch (error) {
    console.error('\n❌ 다운로드 실패:', error.message);
    console.log('\n💡 직접 이미지를 준비하세요:');
    console.log(`   - ${path.join(testImagesDir, 'garment.jpg')}: 의류 이미지`);
    console.log(`   - ${path.join(testImagesDir, 'reference.jpg')}: 참조 이미지\n`);
    process.exit(1);
  }
}

main();
