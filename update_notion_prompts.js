const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const pageId = '2ef466b6-2099-809a-a9e2-ce2c0260bf6d';

// 1단계: 페이지의 모든 블록 가져오기
async function getPageBlocks() {
  const response = await notion.blocks.children.list({
    block_id: pageId,
    page_size: 100,
  });
  return response.results;
}

// 2단계: 모든 블록 삭제
async function deleteAllBlocks() {
  const blocks = await getPageBlocks();
  console.log(`삭제할 블록 수: ${blocks.length}`);

  for (const block of blocks) {
    try {
      await notion.blocks.delete({ block_id: block.id });
    } catch (e) {
      console.error(`블록 ${block.id} 삭제 실패:`, e.message);
    }
  }
  console.log('✅ 기존 블록 삭제 완료');
}

// 3단계: 새로운 실용적인 프롬프트 추가
const practicalPrompts = [
  {
    object: 'block',
    type: 'heading_2',
    heading_2: {
      rich_text: [{ type: 'text', text: { content: '💼 실무 시나리오별 커스텀 프롬프트' } }],
    },
  },
  {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{
        type: 'text',
        text: { content: '실제 업무에서 바로 사용할 수 있는 상황별 프롬프트입니다. 스타일 참조 이미지와 함께 사용하세요.' },
        annotations: { color: 'gray' }
      }],
    },
  },
  {
    object: 'block',
    type: 'divider',
    divider: {},
  },

  // 케이스 1
  {
    object: 'block',
    type: 'heading_3',
    heading_3: {
      rich_text: [{ type: 'text', text: { content: '🎯 Case 1: 스타일 참조 100% 복사 (옷만 변경)' } }],
    },
  },
  {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{
        type: 'text',
        text: { content: '👉 상황: 마음에 드는 룩북 컷이 있는데, 우리 옷으로만 바꾸고 싶을 때' },
        annotations: { bold: true }
      }],
    },
  },
  {
    object: 'block',
    type: 'code',
    code: {
      rich_text: [{
        type: 'text',
        text: { content: 'Exact same pose, exact same facial expression, exact same background, exact same lighting setup, exact same camera angle, exact same composition, only the clothing is different, maintain all other elements identical' }
      }],
      language: 'plain text',
    },
  },
  {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [
        { type: 'text', text: { content: '✓ 스타일 참조 필수 | ' }, annotations: { color: 'green' } },
        { type: 'text', text: { content: '모델 얼굴, 포즈, 배경, 조명 모두 그대로 유지' } }
      ],
    },
  },
  {
    object: 'block',
    type: 'divider',
    divider: {},
  },

  // 케이스 2
  {
    object: 'block',
    type: 'heading_3',
    heading_3: {
      rich_text: [{ type: 'text', text: { content: '👔 Case 2: 같은 모델로 여러 옷 일괄 촬영' } }],
    },
  },
  {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{
        type: 'text',
        text: { content: '👉 상황: 한 모델이 여러 옷을 입은 것처럼 일관된 룩북 만들 때' },
        annotations: { bold: true }
      }],
    },
  },
  {
    object: 'block',
    type: 'code',
    code: {
      rich_text: [{
        type: 'text',
        text: { content: 'Consistent model face and body type throughout all images, same facial features and skin tone, uniform studio lighting, neutral white background, standing front-facing pose, professional e-commerce product photography style' }
      }],
      language: 'plain text',
    },
  },
  {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [
        { type: 'text', text: { content: '✓ 시드값 고정 권장 | ' }, annotations: { color: 'green' } },
        { type: 'text', text: { content: '모델 일관성 유지, 여러 제품 촬영에 최적' } }
      ],
    },
  },
  {
    object: 'block',
    type: 'divider',
    divider: {},
  },

  // 케이스 3
  {
    object: 'block',
    type: 'heading_3',
    heading_3: {
      rich_text: [{ type: 'text', text: { content: '🏬 Case 3: 쇼핑몰 스타일 모방 (무신사/에이블리)' } }],
    },
  },
  {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{
        type: 'text',
        text: { content: '👉 상황: 특정 쇼핑몰의 룩북 스타일을 그대로 따라하고 싶을 때' },
        annotations: { bold: true }
      }],
    },
  },
  {
    object: 'block',
    type: 'code',
    code: {
      rich_text: [{
        type: 'text',
        text: { content: 'Korean fashion e-commerce style, clean minimal aesthetic like Musinsa or Ably, bright even lighting, simple solid color backdrop, full body shot showing entire outfit, casual natural pose, commercial product photography' }
      }],
      language: 'plain text',
    },
  },
  {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [
        { type: 'text', text: { content: '✓ URL 크롤링 + 스타일참조 | ' }, annotations: { color: 'green' } },
        { type: 'text', text: { content: '쇼핑몰 URL에서 이미지 가져와서 스타일 참조로 사용' } }
      ],
    },
  },
  {
    object: 'block',
    type: 'divider',
    divider: {},
  },

  // 케이스 4
  {
    object: 'block',
    type: 'heading_3',
    heading_3: {
      rich_text: [{ type: 'text', text: { content: '📸 Case 4: 상세페이지용 정면 4컷 (정면/측면/뒷면/디테일)' } }],
    },
  },
  {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{
        type: 'text',
        text: { content: '👉 상황: 제품 상세페이지에 들어갈 정석 컷 4장 필요할 때' },
        annotations: { bold: true }
      }],
    },
  },
  {
    object: 'block',
    type: 'code',
    code: {
      rich_text: [{
        type: 'text',
        text: { content: 'Product detail photography set: front view standing straight / side profile 90 degree / back view showing garment back / close-up detail shot. Clean studio setup, consistent lighting across all angles, professional catalog style' }
      }],
      language: 'plain text',
    },
  },
  {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [
        { type: 'text', text: { content: '✓ 포즈 설정: 정면/측면/뒷면/디테일 각 1장씩 | ' }, annotations: { color: 'green' } },
        { type: 'text', text: { content: 'EC 상세페이지 필수 컷' } }
      ],
    },
  },
  {
    object: 'block',
    type: 'divider',
    divider: {},
  },

  // 케이스 5
  {
    object: 'block',
    type: 'heading_3',
    heading_3: {
      rich_text: [{ type: 'text', text: { content: '📱 Case 5: SNS용 자연스러운 일상 컷' } }],
    },
  },
  {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{
        type: 'text',
        text: { content: '👉 상황: 인스타그램/블로그용 자연스러운 착샷 필요할 때' },
        annotations: { bold: true }
      }],
    },
  },
  {
    object: 'block',
    type: 'code',
    code: {
      rich_text: [{
        type: 'text',
        text: { content: 'Casual Instagram aesthetic, natural candid moment, outdoor or cafe setting, soft natural lighting, relaxed everyday pose, lifestyle photography vibe, authentic and approachable feel, shot with iPhone camera style' }
      }],
      language: 'plain text',
    },
  },
  {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [
        { type: 'text', text: { content: '✓ 배경스팟 활용 권장 | ' }, annotations: { color: 'green' } },
        { type: 'text', text: { content: '카페, 거리 등 배경 이미지와 함께 사용' } }
      ],
    },
  },
  {
    object: 'block',
    type: 'divider',
    divider: {},
  },

  // 케이스 6
  {
    object: 'block',
    type: 'heading_3',
    heading_3: {
      rich_text: [{ type: 'text', text: { content: '🎨 Case 6: 룩북 전체를 통일된 무드로' } }],
    },
  },
  {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{
        type: 'text',
        text: { content: '👉 상황: 시즌 룩북 전체를 하나의 톤앤매너로 통일하고 싶을 때' },
        annotations: { bold: true }
      }],
    },
  },
  {
    object: 'block',
    type: 'code',
    code: {
      rich_text: [{
        type: 'text',
        text: { content: 'Cohesive lookbook aesthetic, consistent color grading with [muted tones/warm palette/cool tones], uniform lighting style throughout, same location or backdrop type, unified mood and atmosphere, editorial fashion photography series' }
      }],
      language: 'plain text',
    },
  },
  {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [
        { type: 'text', text: { content: '✓ [  ] 안을 시즌 무드로 변경 | ' }, annotations: { color: 'green' } },
        { type: 'text', text: { content: 'ex) warm spring tones, cool winter palette' } }
      ],
    },
  },
  {
    object: 'block',
    type: 'divider',
    divider: {},
  },

  // 케이스 7
  {
    object: 'block',
    type: 'heading_3',
    heading_3: {
      rich_text: [{ type: 'text', text: { content: '⏰ Case 7: 시간대별 분위기 (골든아워/블루아워)' } }],
    },
  },
  {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{
        type: 'text',
        text: { content: '👉 상황: 특정 시간대의 자연광 느낌을 살리고 싶을 때' },
        annotations: { bold: true }
      }],
    },
  },
  {
    object: 'block',
    type: 'code',
    code: {
      rich_text: [{
        type: 'text',
        text: { content: 'Golden hour photography (sunset lighting / blue hour twilight / bright midday sun / soft morning light), natural outdoor setting, warm golden tones and long soft shadows, romantic atmospheric lighting, shot during [time of day]' }
      }],
      language: 'plain text',
    },
  },
  {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [
        { type: 'text', text: { content: '✓ [  ] 안을 원하는 시간으로 변경 | ' }, annotations: { color: 'green' } },
        { type: 'text', text: { content: 'sunset/sunrise/noon 등' } }
      ],
    },
  },
  {
    object: 'block',
    type: 'divider',
    divider: {},
  },

  // 케이스 8
  {
    object: 'block',
    type: 'heading_3',
    heading_3: {
      rich_text: [{ type: 'text', text: { content: '🔄 Case 8: 착용컷 → 단품컷 변환' } }],
    },
  },
  {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [{
        type: 'text',
        text: { content: '👉 상황: 모델 착용샷을 깔끔한 제품 단품 이미지로 바꾸고 싶을 때' },
        annotations: { bold: true }
      }],
    },
  },
  {
    object: 'block',
    type: 'code',
    code: {
      rich_text: [{
        type: 'text',
        text: { content: 'Product flatlay photography, garment laid flat on clean white surface, overhead top-down view, even studio lighting with no shadows, commercial product shot, clothing item only without model, sharp focus on fabric texture and details' }
      }],
      language: 'plain text',
    },
  },
  {
    object: 'block',
    type: 'paragraph',
    paragraph: {
      rich_text: [
        { type: 'text', text: { content: '✓ 착장 이미지만 업로드 | ' }, annotations: { color: 'green' } },
        { type: 'text', text: { content: '스타일참조 없이 단품컷으로 전환' } }
      ],
    },
  },
  {
    object: 'block',
    type: 'divider',
    divider: {},
  },

  // 팁
  {
    object: 'block',
    type: 'callout',
    callout: {
      rich_text: [{
        type: 'text',
        text: { content: '💡 Pro Tip: 각 케이스별 프롬프트를 시작점으로 삼아, 브랜드 고유의 톤앤매너에 맞게 키워드를 추가/삭제하세요. 예: "vintage film aesthetic" 추가하면 빈티지 무드, "high contrast black and white" 추가하면 흑백 전환' }
      }],
      icon: { emoji: '💡' },
      color: 'blue_background',
    },
  },
  {
    object: 'block',
    type: 'callout',
    callout: {
      rich_text: [{
        type: 'text',
        text: { content: '⚡ 효율 Hack: Case 1~3은 스타일참조 필수, Case 4는 포즈 여러개 설정, Case 5~6은 배경스팟 활용, Case 8은 참조 없이 의류만 업로드' }
      }],
      icon: { emoji: '⚡' },
      color: 'yellow_background',
    },
  },
];

async function main() {
  await deleteAllBlocks();

  console.log('새로운 프롬프트 추가 중...');
  const response = await notion.blocks.children.append({
    block_id: pageId,
    children: practicalPrompts,
  });

  console.log(`✅ 실용적인 프롬프트 ${response.results.length}개 블록 추가 완료!`);
}

main().catch(console.error);
