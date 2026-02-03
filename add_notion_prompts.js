require('dotenv').config({ path: '.env.local' });
const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const pageId = '2ef466b6-2099-809a-a9e2-ce2c0260bf6d';

const blocks = [
  {
    object: 'block',
    type: 'heading_2',
    heading_2: {
      rich_text: [{ type: 'text', text: { content: '💡 커스텀 프롬프트 실전 예시' } }],
    },
  },
  {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ 
        type: 'text', 
        text: { content: '다양한 룩북 스타일에 맞는 커스텀 프롬프트 예시입니다. 상황에 맞게 활용하세요.' } 
      }],
    },
  },
  {
    object: 'block',
    type: 'heading_3',
    heading_3: {
      rich_text: [{ type: 'text', text: { content: '1️⃣ 미니멀 스튜디오 룩' } }],
    },
  },
  {
    object: 'block',
    type: 'code',
    code: {
      rich_text: [{ 
        type: 'text', 
        text: { content: 'Clean studio backdrop, soft diffused lighting, minimalist aesthetic, professional fashion photography, standing pose, neutral expression, modern and simple' } 
      }],
      language: 'plain text',
    },
  },
  {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: '→ 깔끔한 배경, 부드러운 조명의 전문적인 스튜디오 촬영 느낌' } }],
    },
  },
  {
    object: 'block',
    type: 'divider',
    divider: {},
  },
  {
    object: 'block',
    type: 'heading_3',
    heading_3: {
      rich_text: [{ type: 'text', text: { content: '2️⃣ 자연광 아웃도어' } }],
    },
  },
  {
    object: 'block',
    type: 'code',
    code: {
      rich_text: [{ 
        type: 'text', 
        text: { content: 'Natural sunlight, outdoor urban setting, golden hour lighting, candid street style photography, relaxed pose, soft shadows, warm color temperature' } 
      }],
      language: 'plain text',
    },
  },
  {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: '→ 자연스러운 야외 골든아워 촬영, 스트리트 스타일' } }],
    },
  },
  {
    object: 'block',
    type: 'divider',
    divider: {},
  },
  {
    object: 'block',
    type: 'heading_3',
    heading_3: {
      rich_text: [{ type: 'text', text: { content: '3️⃣ 빈티지 감성' } }],
    },
  },
  {
    object: 'block',
    type: 'code',
    code: {
      rich_text: [{ 
        type: 'text', 
        text: { content: 'Vintage film photography aesthetic, muted pastel colors, soft focus, nostalgic mood, grainy texture, 90s fashion editorial style' } 
      }],
      language: 'plain text',
    },
  },
  {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: '→ 필름 카메라 느낌의 감성적인 빈티지 무드' } }],
    },
  },
  {
    object: 'block',
    type: 'divider',
    divider: {},
  },
  {
    object: 'block',
    type: 'heading_3',
    heading_3: {
      rich_text: [{ type: 'text', text: { content: '4️⃣ 모던 하이패션' } }],
    },
  },
  {
    object: 'block',
    type: 'code',
    code: {
      rich_text: [{ 
        type: 'text', 
        text: { content: 'High fashion editorial, dramatic lighting, bold colors, dynamic pose, avant-garde styling, contemporary art gallery background, sharp focus' } 
      }],
      language: 'plain text',
    },
  },
  {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: '→ 강렬한 조명과 대담한 포즈의 하이패션 에디토리얼' } }],
    },
  },
  {
    object: 'block',
    type: 'divider',
    divider: {},
  },
  {
    object: 'block',
    type: 'heading_3',
    heading_3: {
      rich_text: [{ type: 'text', text: { content: '5️⃣ 캐주얼 라이프스타일' } }],
    },
  },
  {
    object: 'block',
    type: 'code',
    code: {
      rich_text: [{ 
        type: 'text', 
        text: { content: 'Lifestyle photography, cozy indoor setting, natural window light, everyday casual vibe, candid moment, warm and inviting atmosphere' } 
      }],
      language: 'plain text',
    },
  },
  {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: '→ 일상적이고 편안한 느낌의 라이프스타일 컷' } }],
    },
  },
  {
    object: 'block',
    type: 'divider',
    divider: {},
  },
  {
    object: 'block',
    type: 'heading_3',
    heading_3: {
      rich_text: [{ type: 'text', text: { content: '6️⃣ 블랙앤화이트 아티스틱' } }],
    },
  },
  {
    object: 'block',
    type: 'code',
    code: {
      rich_text: [{ 
        type: 'text', 
        text: { content: 'Black and white photography, high contrast, dramatic shadows, artistic composition, timeless elegance, fine art fashion portrait' } 
      }],
      language: 'plain text',
    },
  },
  {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{ type: 'text', text: { content: '→ 흑백의 강렬한 대비와 예술적인 구도' } }],
    },
  },
  {
    object: 'block',
    type: 'divider',
    divider: {},
  },
  {
    object: 'block',
    type: 'callout',
    callout: {
      rich_text: [{ 
        type: 'text', 
        text: { content: '💡 Tip: 위 프롬프트들을 조합하거나 수정해서 원하는 스타일을 만들어보세요. 구체적일수록 더 정확한 결과를 얻을 수 있습니다.' } 
      }],
      icon: { emoji: '💡' },
      color: 'blue_background',
    },
  },
];

async function addBlocks() {
  console.log('API Key:', process.env.NOTION_API_KEY ? '✅ 있음' : '❌ 없음');
  console.log('Page ID:', pageId);
  
  try {
    const response = await notion.blocks.children.append({
      block_id: pageId,
      children: blocks,
    });
    console.log('✅ Notion 페이지에 프롬프트 예시를 추가했습니다!');
    console.log(`추가된 블록 수: ${response.results.length}`);
  } catch (error) {
    console.error('❌ 에러:', error.message);
    if (error.code === 'object_not_found') {
      console.error('페이지를 찾을 수 없습니다. Integration이 해당 페이지에 연결되어 있는지 확인하세요.');
    } else if (error.code === 'unauthorized') {
      console.error('Integration이 페이지에 접근할 권한이 없습니다.');
      console.error('해결 방법: Notion 페이지 → ... → 연결 추가 → Integration 선택');
    }
  }
}

addBlocks();
