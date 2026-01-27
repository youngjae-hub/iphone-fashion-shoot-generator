/**
 * Pikes AI MCP Client
 *
 * MCP 프로토콜을 통해 Pikes AI의 이미지 생성/편집 도구를 프로그래밍적으로 호출
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

const PIKES_MCP_URL = "https://pikes.ai/mcp/sse";

// Pikes AI 도구 타입 정의
export interface PikesGenerateImageParams {
  prompt: string;
  aspectRatio?: "1:1" | "9:16" | "16:9" | "4:3" | "3:4" | "3:2" | "2:3";
  imageCount?: number; // 1-4
}

export interface PikesEditImageParams {
  imageUrl: string;
  prompt: string;
  aspectRatio?: "1:1" | "9:16" | "16:9" | "4:3" | "3:4" | "3:2" | "2:3";
  resolution?: "1K" | "2K" | "4K";
  imageCount?: number;
}

export interface PikesRemixImagesParams {
  productImageUrl: string;
  sceneImageUrl: string;
  prompt: string;
  aspectRatio?: "auto" | "1:1" | "9:16" | "16:9" | "4:3" | "3:4" | "3:2" | "2:3";
  resolution?: "1K" | "2K" | "4K";
  imageCount?: number;
}

export interface PikesExpandImageParams {
  imageUrl: string;
  prompt?: string;
  aspectRatio?: "1:1" | "9:16" | "16:9" | "4:3" | "3:4" | "3:2" | "2:3";
  direction?: "left" | "right" | "up" | "down" | "all";
}

export interface PikesAnimateImageParams {
  imageUrl: string;
  prompt: string;
  duration?: 5 | 10;
}

export interface PikesUploadImageParams {
  imageData: string; // base64 data URL
  filename?: string;
}

export interface PikesResult {
  success: boolean;
  imageUrl?: string;
  imageUrls?: string[];
  videoUrl?: string;
  error?: string;
}

class PikesClient {
  private client: Client | null = null;
  private connected: boolean = false;
  private accessToken: string | null = null;

  constructor(accessToken?: string) {
    this.accessToken = accessToken || null;
  }

  async connect(): Promise<void> {
    if (this.connected && this.client) {
      return;
    }

    try {
      this.client = new Client({
        name: "pikes-batch-client",
        version: "1.0.0",
      });

      const headers: Record<string, string> = {};
      if (this.accessToken) {
        headers["Authorization"] = `Bearer ${this.accessToken}`;
      }

      const transport = new SSEClientTransport(new URL(PIKES_MCP_URL), {
        requestInit: { headers },
      });

      await this.client.connect(transport);
      this.connected = true;
      console.log("[PikesClient] Connected to Pikes AI MCP server");
    } catch (error) {
      console.error("[PikesClient] Connection failed:", error);
      throw new Error(`Failed to connect to Pikes AI: ${error}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.connected = false;
    }
  }

  private async callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.client || !this.connected) {
      await this.connect();
    }

    try {
      const result = await this.client!.callTool({ name, arguments: args });
      return result;
    } catch (error) {
      console.error(`[PikesClient] Tool call failed (${name}):`, error);
      throw error;
    }
  }

  /**
   * 새 이미지 생성
   */
  async generateImage(params: PikesGenerateImageParams): Promise<PikesResult> {
    try {
      const result = await this.callTool("generate_image", {
        prompt: params.prompt,
        aspectRatio: params.aspectRatio || "1:1",
        imageCount: params.imageCount || 1,
      });
      return this.parseResult(result);
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * 기존 이미지 편집/리터칭
   */
  async editImage(params: PikesEditImageParams): Promise<PikesResult> {
    try {
      const result = await this.callTool("edit_image", {
        imageUrl: params.imageUrl,
        prompt: params.prompt,
        aspectRatio: params.aspectRatio,
        resolution: params.resolution || "1K",
        imageCount: params.imageCount || 1,
      });
      return this.parseResult(result);
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * 제품 이미지 + 씬/모델 이미지 합성
   */
  async remixImages(params: PikesRemixImagesParams): Promise<PikesResult> {
    try {
      const result = await this.callTool("remix_images", {
        productImageUrl: params.productImageUrl,
        sceneImageUrl: params.sceneImageUrl,
        prompt: params.prompt,
        aspectRatio: params.aspectRatio || "auto",
        resolution: params.resolution || "1K",
        imageCount: params.imageCount || 1,
      });
      return this.parseResult(result);
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * 이미지 캔버스 확장 (outpaint)
   */
  async expandImage(params: PikesExpandImageParams): Promise<PikesResult> {
    try {
      const result = await this.callTool("expand_image", {
        imageUrl: params.imageUrl,
        prompt: params.prompt,
        aspectRatio: params.aspectRatio,
        direction: params.direction || "all",
      });
      return this.parseResult(result);
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * 이미지 애니메이션 (비디오 생성)
   */
  async animateImage(params: PikesAnimateImageParams): Promise<PikesResult> {
    try {
      const result = await this.callTool("animate_image", {
        imageUrl: params.imageUrl,
        prompt: params.prompt,
        duration: params.duration || 5,
      });
      return this.parseResult(result);
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  /**
   * 로컬 이미지 업로드 → URL 변환
   */
  async uploadImage(params: PikesUploadImageParams): Promise<PikesResult> {
    try {
      const result = await this.callTool("upload_image", {
        imageData: params.imageData,
        filename: params.filename,
      });
      return this.parseResult(result);
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private parseResult(result: unknown): PikesResult {
    // MCP 결과 파싱 로직
    if (!result || typeof result !== 'object') {
      return { success: false, error: "Invalid result" };
    }

    const res = result as Record<string, unknown>;

    // content 배열에서 텍스트/이미지 추출
    if (res.content && Array.isArray(res.content)) {
      const urls: string[] = [];
      let videoUrl: string | undefined;

      for (const item of res.content) {
        if (typeof item === 'object' && item !== null) {
          const content = item as Record<string, unknown>;

          // 이미지 URL 추출
          if (content.type === 'image' && content.data) {
            urls.push(String(content.data));
          }

          // 텍스트에서 URL 추출
          if (content.type === 'text' && typeof content.text === 'string') {
            const urlMatch = content.text.match(/https?:\/\/[^\s]+/g);
            if (urlMatch) {
              for (const url of urlMatch) {
                if (url.includes('.mp4') || url.includes('video')) {
                  videoUrl = url;
                } else if (url.includes('.png') || url.includes('.jpg') || url.includes('.webp') || url.includes('image')) {
                  urls.push(url);
                }
              }
            }
          }
        }
      }

      if (urls.length > 0 || videoUrl) {
        return {
          success: true,
          imageUrl: urls[0],
          imageUrls: urls.length > 1 ? urls : undefined,
          videoUrl,
        };
      }
    }

    // isError 체크
    if (res.isError) {
      return { success: false, error: String(res.content || "Unknown error") };
    }

    return { success: true };
  }
}

// 싱글톤 인스턴스 export
let pikesClientInstance: PikesClient | null = null;

export function getPikesClient(accessToken?: string): PikesClient {
  if (!pikesClientInstance) {
    pikesClientInstance = new PikesClient(accessToken);
  }
  return pikesClientInstance;
}

export { PikesClient };
