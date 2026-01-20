import { NextRequest, NextResponse } from 'next/server';

// 지원하는 소스 타입
type SourceType = 'google-drive' | 'ably' | 'zigzag' | 'musinsa' | 'wconcept' | 'generic';

interface ScrapeRequest {
  url: string;
  maxImages?: number;
}

interface ScrapeResponse {
  success: boolean;
  images?: string[];
  sourceType?: SourceType;
  error?: string;
}

// URL에서 소스 타입 감지
function detectSourceType(url: string): SourceType {
  const hostname = new URL(url).hostname.toLowerCase();

  if (hostname.includes('drive.google.com')) return 'google-drive';
  if (hostname.includes('a-bly.com') || hostname.includes('ably')) return 'ably';
  if (hostname.includes('zigzag.kr') || hostname.includes('croquis')) return 'zigzag';
  if (hostname.includes('musinsa.com')) return 'musinsa';
  if (hostname.includes('wconcept.co.kr')) return 'wconcept';

  return 'generic';
}

// Google Drive 폴더에서 이미지 추출
async function scrapeGoogleDrive(url: string): Promise<string[]> {
  // Google Drive 폴더 ID 추출
  const folderId = url.match(/folders\/([a-zA-Z0-9_-]+)/)?.[1];
  if (!folderId) {
    throw new Error('Google Drive 폴더 ID를 찾을 수 없습니다.');
  }

  // Google Drive API 사용 (API 키 필요)
  // 대안: 공개 폴더의 경우 직접 파싱
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  if (!apiKey) {
    throw new Error('Google API 키가 설정되지 않았습니다.');
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+mimeType+contains+'image'&key=${apiKey}&fields=files(id,name,mimeType,webContentLink,thumbnailLink)`
  );

  if (!response.ok) {
    throw new Error('Google Drive API 요청 실패');
  }

  const data = await response.json();
  const images: string[] = [];

  for (const file of data.files || []) {
    // 공개 이미지 URL 생성
    const imageUrl = `https://drive.google.com/uc?export=view&id=${file.id}`;

    try {
      // 이미지를 base64로 변환
      const imgResponse = await fetch(imageUrl);
      if (imgResponse.ok) {
        const buffer = await imgResponse.arrayBuffer();
        const base64 = Buffer.from(buffer).toString('base64');
        const mimeType = file.mimeType || 'image/jpeg';
        images.push(`data:${mimeType};base64,${base64}`);
      }
    } catch (e) {
      console.error(`Failed to fetch image ${file.id}:`, e);
    }
  }

  return images;
}

// 커머스 사이트에서 이미지 추출 (범용)
async function scrapeCommerceImages(url: string, sourceType: SourceType): Promise<string[]> {
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    const images: string[] = [];

    // 이미지 URL 패턴 추출
    const imgPatterns = [
      // 일반적인 img src 패턴
      /<img[^>]+src=["']([^"']+)["'][^>]*>/gi,
      // data-src (lazy loading)
      /<img[^>]+data-src=["']([^"']+)["'][^>]*>/gi,
      // srcset
      /srcset=["']([^"'\s]+)/gi,
      // background-image
      /background-image:\s*url\(['"]?([^'")\s]+)['"]?\)/gi,
      // JSON 내 이미지 URL
      /"(https?:\/\/[^"]+\.(?:jpg|jpeg|png|webp)[^"]*)"/gi,
    ];

    const foundUrls = new Set<string>();

    for (const pattern of imgPatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        let imgUrl = match[1];

        // 상대 경로를 절대 경로로 변환
        if (imgUrl.startsWith('//')) {
          imgUrl = 'https:' + imgUrl;
        } else if (imgUrl.startsWith('/')) {
          const baseUrl = new URL(url);
          imgUrl = baseUrl.origin + imgUrl;
        }

        // 유효한 이미지 URL만 필터링
        if (isValidImageUrl(imgUrl, sourceType)) {
          foundUrls.add(imgUrl);
        }
      }
    }

    // 이미지 다운로드 및 base64 변환
    const imagePromises = Array.from(foundUrls).slice(0, 50).map(async (imgUrl) => {
      try {
        const imgResponse = await fetch(imgUrl, {
          headers: {
            'Referer': url,
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          },
        });

        if (!imgResponse.ok) return null;

        const contentType = imgResponse.headers.get('content-type');
        if (!contentType?.startsWith('image/')) return null;

        const buffer = await imgResponse.arrayBuffer();

        // 최소 크기 필터 (너무 작은 이미지 제외)
        if (buffer.byteLength < 10000) return null; // 10KB 미만 제외

        const base64 = Buffer.from(buffer).toString('base64');
        return `data:${contentType};base64,${base64}`;
      } catch {
        return null;
      }
    });

    const results = await Promise.all(imagePromises);
    return results.filter((img): img is string => img !== null);
  } catch (error) {
    console.error('Scrape error:', error);
    throw new Error('페이지에서 이미지를 추출할 수 없습니다.');
  }
}

// 유효한 이미지 URL인지 확인
function isValidImageUrl(url: string, sourceType: SourceType): boolean {
  // 기본 필터
  if (!url || url.length < 10) return false;
  if (url.includes('data:image')) return false; // 이미 base64인 경우 제외

  // 아이콘, 로고 등 제외
  const excludePatterns = [
    /icon/i, /logo/i, /sprite/i, /banner/i, /ad[_-]/i,
    /placeholder/i, /loading/i, /spinner/i, /arrow/i,
    /button/i, /badge/i, /avatar/i, /profile/i,
    /1x1/, /pixel/, /tracking/, /analytics/,
  ];

  for (const pattern of excludePatterns) {
    if (pattern.test(url)) return false;
  }

  // 이미지 확장자 확인
  const imageExtensions = /\.(jpg|jpeg|png|webp|gif)(\?|$)/i;
  if (!imageExtensions.test(url)) {
    // CDN URL의 경우 확장자가 없을 수 있음
    const cdnPatterns = [
      /cloudinary/i, /imgix/i, /cloudfront/i,
      /cdn/i, /image/i, /img/i, /photo/i,
    ];
    const hasCdnPattern = cdnPatterns.some(p => p.test(url));
    if (!hasCdnPattern) return false;
  }

  // 소스별 추가 필터
  switch (sourceType) {
    case 'ably':
    case 'zigzag':
      // 상품 이미지만 필터링
      return url.includes('product') || url.includes('goods') || url.includes('item');
    case 'musinsa':
      return url.includes('image.msscdn.net') || url.includes('goods');
    case 'wconcept':
      return url.includes('wconcept') && !url.includes('common');
    default:
      return true;
  }
}

// 에이블리 전용 스크래퍼
async function scrapeAbly(url: string): Promise<string[]> {
  // 에이블리는 동적 렌더링이 많아서 API 엔드포인트 직접 호출 시도
  // 또는 상품 상세 페이지에서 이미지 추출
  return scrapeCommerceImages(url, 'ably');
}

// 지그재그 전용 스크래퍼
async function scrapeZigzag(url: string): Promise<string[]> {
  return scrapeCommerceImages(url, 'zigzag');
}

// POST: URL에서 이미지 추출
export async function POST(request: NextRequest) {
  try {
    const body: ScrapeRequest = await request.json();
    const { url, maxImages = 30 } = body;

    if (!url) {
      return NextResponse.json<ScrapeResponse>(
        { success: false, error: 'URL이 필요합니다.' },
        { status: 400 }
      );
    }

    // URL 유효성 검사
    try {
      new URL(url);
    } catch {
      return NextResponse.json<ScrapeResponse>(
        { success: false, error: '유효하지 않은 URL입니다.' },
        { status: 400 }
      );
    }

    const sourceType = detectSourceType(url);
    let images: string[] = [];

    switch (sourceType) {
      case 'google-drive':
        images = await scrapeGoogleDrive(url);
        break;
      case 'ably':
        images = await scrapeAbly(url);
        break;
      case 'zigzag':
        images = await scrapeZigzag(url);
        break;
      default:
        images = await scrapeCommerceImages(url, sourceType);
    }

    // 최대 이미지 수 제한
    images = images.slice(0, maxImages);

    if (images.length === 0) {
      return NextResponse.json<ScrapeResponse>(
        { success: false, error: '이미지를 찾을 수 없습니다. URL을 확인해주세요.' },
        { status: 404 }
      );
    }

    return NextResponse.json<ScrapeResponse>({
      success: true,
      images,
      sourceType,
    });
  } catch (error) {
    console.error('Scrape images error:', error);
    return NextResponse.json<ScrapeResponse>(
      {
        success: false,
        error: error instanceof Error ? error.message : '이미지 추출에 실패했습니다.'
      },
      { status: 500 }
    );
  }
}
