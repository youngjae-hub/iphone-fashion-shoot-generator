const Replicate = require('replicate');
const path = require('path');
const fs = require('fs');

// .env.local 파일 수동 로드
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      const value = valueParts.join('=').replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

async function createModel() {
  const apiToken = process.env.REPLICATE_API_TOKEN;
  const username = process.env.REPLICATE_USERNAME || 'youngjae-hub';

  console.log('API Token:', apiToken ? `Found (${apiToken.slice(0, 5)}...)` : 'NOT FOUND');
  console.log('Username:', username);
  console.log('');

  if (!apiToken) {
    console.error('❌ REPLICATE_API_TOKEN not found in environment variables');
    process.exit(1);
  }

  const replicate = new Replicate({ auth: apiToken });

  try {
    console.log(`Creating model: ${username}/lusida-style...`);
    const model = await replicate.models.create(
      username,
      'lusida-style',
      {
        visibility: 'public',
        hardware: 'gpu-t4',
        description: '루시다 브랜드 룩북 스타일 LoRA',
      }
    );
    console.log('✅ Model created:', `${model.owner}/${model.name}`);
  } catch (error) {
    if (error.message && error.message.includes('already exists')) {
      console.log(`✅ Model already exists: ${username}/lusida-style`);
    } else {
      console.error('❌ Error:', error.message);
      process.exit(1);
    }
  }
}

createModel();
