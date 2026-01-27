/**
 * Pikes AI API Route
 *
 * Pikes AI MCP 도구를 REST API 형태로 제공
 * 대량 처리 및 UI 통합용
 */

import { NextRequest, NextResponse } from "next/server";

// Pikes MCP 도구들을 직접 호출 (mcp__pikes-ai__ 도구 사용)
// 현재는 Claude Code 세션에서만 작동하므로, 별도 API 키 기반 호출 필요

export interface PikesRequest {
  action:
    | "generate"
    | "edit"
    | "remix"
    | "expand"
    | "animate"
    | "upload"
    | "batch";
  // generate
  prompt?: string;
  aspectRatio?: string;
  imageCount?: number;
  resolution?: string;
  // edit, expand, animate
  imageUrl?: string;
  // remix
  productImageUrl?: string;
  sceneImageUrl?: string;
  // animate
  duration?: number;
  // expand
  direction?: string;
  // upload
  imageData?: string;
  filename?: string;
  // batch
  items?: Array<{
    action: string;
    params: Record<string, unknown>;
  }>;
}

export interface PikesResponse {
  success: boolean;
  data?: {
    imageUrl?: string;
    imageUrls?: string[];
    videoUrl?: string;
  };
  error?: string;
  batchResults?: Array<{
    index: number;
    success: boolean;
    data?: Record<string, unknown>;
    error?: string;
  }>;
}

// Pikes API 키 (환경 변수에서 가져옴)
const PIKES_API_KEY = process.env.PIKES_API_KEY;
const PIKES_API_URL = "https://api.pikes.ai/v1"; // 가정 - 실제 API URL 확인 필요

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const body: PikesRequest = await request.json();

    // API 키 확인
    if (!PIKES_API_KEY) {
      // MCP를 통해 호출해야 함을 알림
      return NextResponse.json(
        {
          success: false,
          error:
            "PIKES_API_KEY not configured. Use Claude Code MCP tools directly or configure API key.",
          hint: "현재 Pikes AI는 MCP를 통해서만 사용 가능합니다. Claude Code에서 직접 도구를 호출하세요.",
          mcpTools: [
            "mcp__pikes-ai__generate_image",
            "mcp__pikes-ai__edit_image",
            "mcp__pikes-ai__remix_images",
            "mcp__pikes-ai__expand_image",
            "mcp__pikes-ai__animate_image",
            "mcp__pikes-ai__upload_image",
          ],
        },
        { status: 501 }
      );
    }

    const { action } = body;

    switch (action) {
      case "generate":
        return await handleGenerate(body);
      case "edit":
        return await handleEdit(body);
      case "remix":
        return await handleRemix(body);
      case "expand":
        return await handleExpand(body);
      case "animate":
        return await handleAnimate(body);
      case "upload":
        return await handleUpload(body);
      case "batch":
        return await handleBatch(body);
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("[Pikes API] Error:", error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}

async function handleGenerate(body: PikesRequest): Promise<NextResponse> {
  const { prompt, aspectRatio = "1:1", imageCount = 1 } = body;

  if (!prompt) {
    return NextResponse.json(
      { success: false, error: "prompt is required" },
      { status: 400 }
    );
  }

  // Pikes REST API 호출 (API 키 있을 때)
  const response = await fetch(`${PIKES_API_URL}/generate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PIKES_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, aspectRatio, imageCount }),
  });

  const data = await response.json();

  return NextResponse.json({
    success: response.ok,
    data: response.ok ? data : undefined,
    error: response.ok ? undefined : data.error,
  });
}

async function handleEdit(body: PikesRequest): Promise<NextResponse> {
  const {
    imageUrl,
    prompt,
    aspectRatio,
    resolution = "1K",
    imageCount = 1,
  } = body;

  if (!imageUrl || !prompt) {
    return NextResponse.json(
      { success: false, error: "imageUrl and prompt are required" },
      { status: 400 }
    );
  }

  const response = await fetch(`${PIKES_API_URL}/edit`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PIKES_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      imageUrl,
      prompt,
      aspectRatio,
      resolution,
      imageCount,
    }),
  });

  const data = await response.json();

  return NextResponse.json({
    success: response.ok,
    data: response.ok ? data : undefined,
    error: response.ok ? undefined : data.error,
  });
}

async function handleRemix(body: PikesRequest): Promise<NextResponse> {
  const {
    productImageUrl,
    sceneImageUrl,
    prompt,
    aspectRatio = "auto",
    resolution = "1K",
    imageCount = 1,
  } = body;

  if (!productImageUrl || !sceneImageUrl || !prompt) {
    return NextResponse.json(
      {
        success: false,
        error: "productImageUrl, sceneImageUrl, and prompt are required",
      },
      { status: 400 }
    );
  }

  const response = await fetch(`${PIKES_API_URL}/remix`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PIKES_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      productImageUrl,
      sceneImageUrl,
      prompt,
      aspectRatio,
      resolution,
      imageCount,
    }),
  });

  const data = await response.json();

  return NextResponse.json({
    success: response.ok,
    data: response.ok ? data : undefined,
    error: response.ok ? undefined : data.error,
  });
}

async function handleExpand(body: PikesRequest): Promise<NextResponse> {
  const { imageUrl, prompt, aspectRatio, direction = "all" } = body;

  if (!imageUrl) {
    return NextResponse.json(
      { success: false, error: "imageUrl is required" },
      { status: 400 }
    );
  }

  const response = await fetch(`${PIKES_API_URL}/expand`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PIKES_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageUrl, prompt, aspectRatio, direction }),
  });

  const data = await response.json();

  return NextResponse.json({
    success: response.ok,
    data: response.ok ? data : undefined,
    error: response.ok ? undefined : data.error,
  });
}

async function handleAnimate(body: PikesRequest): Promise<NextResponse> {
  const { imageUrl, prompt, duration = 5 } = body;

  if (!imageUrl || !prompt) {
    return NextResponse.json(
      { success: false, error: "imageUrl and prompt are required" },
      { status: 400 }
    );
  }

  const response = await fetch(`${PIKES_API_URL}/animate`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PIKES_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageUrl, prompt, duration }),
  });

  const data = await response.json();

  return NextResponse.json({
    success: response.ok,
    data: response.ok ? data : undefined,
    error: response.ok ? undefined : data.error,
  });
}

async function handleUpload(body: PikesRequest): Promise<NextResponse> {
  const { imageData, filename } = body;

  if (!imageData) {
    return NextResponse.json(
      { success: false, error: "imageData is required" },
      { status: 400 }
    );
  }

  const response = await fetch(`${PIKES_API_URL}/upload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PIKES_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ imageData, filename }),
  });

  const data = await response.json();

  return NextResponse.json({
    success: response.ok,
    data: response.ok ? data : undefined,
    error: response.ok ? undefined : data.error,
  });
}

async function handleBatch(body: PikesRequest): Promise<NextResponse> {
  const { items } = body;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { success: false, error: "items array is required for batch processing" },
      { status: 400 }
    );
  }

  const results = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      // 각 아이템을 개별 처리
      const mockRequest = {
        action: item.action,
        ...item.params,
      } as PikesRequest;

      let result;
      switch (item.action) {
        case "generate":
          result = await handleGenerate(mockRequest);
          break;
        case "edit":
          result = await handleEdit(mockRequest);
          break;
        case "remix":
          result = await handleRemix(mockRequest);
          break;
        case "expand":
          result = await handleExpand(mockRequest);
          break;
        case "animate":
          result = await handleAnimate(mockRequest);
          break;
        case "upload":
          result = await handleUpload(mockRequest);
          break;
        default:
          results.push({
            index: i,
            success: false,
            error: `Unknown action: ${item.action}`,
          });
          continue;
      }

      const data = await result.json();
      results.push({
        index: i,
        success: data.success,
        data: data.data,
        error: data.error,
      });
    } catch (error) {
      results.push({
        index: i,
        success: false,
        error: String(error),
      });
    }
  }

  const allSuccess = results.every((r) => r.success);

  return NextResponse.json({
    success: allSuccess,
    batchResults: results,
  });
}

// GET: API 상태 확인
export async function GET(): Promise<NextResponse> {
  return NextResponse.json({
    service: "Pikes AI",
    status: PIKES_API_KEY ? "ready" : "mcp_only",
    message: PIKES_API_KEY
      ? "API ready for use"
      : "No API key configured. Use MCP tools directly in Claude Code.",
    availableActions: [
      "generate",
      "edit",
      "remix",
      "expand",
      "animate",
      "upload",
      "batch",
    ],
    mcpEndpoint: "https://pikes.ai/mcp/sse",
  });
}
