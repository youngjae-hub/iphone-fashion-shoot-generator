import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';

// Vercel Serverless Function 설정
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

interface DownloadZipRequest {
  images: {
    url: string;
    filename: string;
  }[];
  zipFilename?: string;
}

// POST: 이미지들을 ZIP으로 묶어서 반환
export async function POST(request: NextRequest) {
  try {
    const body: DownloadZipRequest = await request.json();
    const { images, zipFilename = 'fashion_images.zip' } = body;

    if (!images || images.length === 0) {
      return NextResponse.json(
        { success: false, error: '이미지가 필요합니다.' },
        { status: 400 }
      );
    }

    if (images.length > 100) {
      return NextResponse.json(
        { success: false, error: '최대 100개의 이미지만 ZIP으로 묶을 수 있습니다.' },
        { status: 400 }
      );
    }

    const zip = new JSZip();
    const errors: string[] = [];

    // 이미지들을 병렬로 다운로드
    const downloadPromises = images.map(async (img, index) => {
      try {
        const response = await fetch(img.url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // 파일명 생성 (중복 방지)
        const filename = img.filename || `image_${index + 1}.png`;
        return { filename, buffer };
      } catch (err) {
        errors.push(`${img.filename || index}: ${err instanceof Error ? err.message : 'Failed'}`);
        return null;
      }
    });

    const downloadResults = await Promise.all(downloadPromises);

    // ZIP에 파일 추가
    for (const result of downloadResults) {
      if (result) {
        zip.file(result.filename, result.buffer);
      }
    }

    // ZIP 생성
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    // ZIP 파일 반환 (Buffer를 Uint8Array로 변환)
    const uint8Array = new Uint8Array(zipBuffer);
    return new NextResponse(uint8Array, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipFilename}"`,
        'Content-Length': zipBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('ZIP generation error:', error);
    return NextResponse.json(
      { success: false, error: 'ZIP 생성 실패' },
      { status: 500 }
    );
  }
}
