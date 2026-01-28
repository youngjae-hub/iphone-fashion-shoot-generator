#!/usr/bin/env npx tsx

/**
 * Pikes AI Batch Processing Script
 *
 * 폴더 내 이미지를 Pikes AI로 일괄 처리
 *
 * 사용법:
 *   npx tsx scripts/pikes-batch.ts --input ./images --output ./output --action edit --prompt "스튜디오 품질 제품 사진으로 리터칭"
 *
 * 옵션:
 *   --input, -i     입력 폴더 경로
 *   --output, -o    출력 폴더 경로
 *   --action, -a    작업 유형 (edit, remix, expand, generate)
 *   --prompt, -p    프롬프트
 *   --resolution    해상도 (1K, 2K, 4K)
 *   --aspect-ratio  비율 (1:1, 9:16, 16:9 등)
 *   --concurrency   동시 처리 수 (기본: 3)
 *   --dry-run       실제 실행 없이 테스트
 */

import * as fs from "fs";
import * as path from "path";

// 설정 타입
interface BatchConfig {
  inputDir: string;
  outputDir: string;
  action: "edit" | "remix" | "expand" | "generate";
  prompt: string;
  resolution: "1K" | "2K" | "4K";
  aspectRatio: string;
  concurrency: number;
  dryRun: boolean;
  sceneImageUrl?: string; // remix용
}

interface ProcessResult {
  file: string;
  success: boolean;
  outputUrl?: string;
  outputPath?: string;
  error?: string;
  duration?: number;
}

// 이미지 확장자
const IMAGE_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp"];

// 명령줄 인자 파싱
function parseArgs(): BatchConfig {
  const args = process.argv.slice(2);
  const config: BatchConfig = {
    inputDir: "./input",
    outputDir: "./output",
    action: "edit",
    prompt: "스튜디오 품질의 깔끔한 제품 사진으로 리터칭. 흰색 배경, 부드러운 조명, 선명한 디테일",
    resolution: "1K",
    aspectRatio: "1:1",
    concurrency: 3,
    dryRun: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case "--input":
      case "-i":
        config.inputDir = nextArg;
        i++;
        break;
      case "--output":
      case "-o":
        config.outputDir = nextArg;
        i++;
        break;
      case "--action":
      case "-a":
        config.action = nextArg as BatchConfig["action"];
        i++;
        break;
      case "--prompt":
      case "-p":
        config.prompt = nextArg;
        i++;
        break;
      case "--resolution":
        config.resolution = nextArg as BatchConfig["resolution"];
        i++;
        break;
      case "--aspect-ratio":
        config.aspectRatio = nextArg;
        i++;
        break;
      case "--concurrency":
        config.concurrency = parseInt(nextArg, 10);
        i++;
        break;
      case "--scene":
        config.sceneImageUrl = nextArg;
        i++;
        break;
      case "--dry-run":
        config.dryRun = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
    }
  }

  return config;
}

function printHelp(): void {
  console.log(`
Pikes AI Batch Processing Script

사용법:
  npx tsx scripts/pikes-batch.ts [options]

옵션:
  --input, -i <path>      입력 폴더 경로 (기본: ./input)
  --output, -o <path>     출력 폴더 경로 (기본: ./output)
  --action, -a <type>     작업 유형: edit, remix, expand, generate (기본: edit)
  --prompt, -p <text>     프롬프트 (기본: 스튜디오 품질 리터칭)
  --resolution <res>      해상도: 1K, 2K, 4K (기본: 1K)
  --aspect-ratio <ratio>  비율: 1:1, 9:16, 16:9 등 (기본: 1:1)
  --concurrency <num>     동시 처리 수 (기본: 3)
  --scene <url>           remix용 씬 이미지 URL
  --dry-run               실제 실행 없이 테스트
  --help, -h              도움말 표시

예시:
  # 제품 사진 리터칭
  npx tsx scripts/pikes-batch.ts -i ./products -o ./retouched -a edit -p "깔끔한 흰색 배경 스튜디오 사진"

  # 모델 합성 (remix)
  npx tsx scripts/pikes-batch.ts -i ./products -o ./on-model -a remix --scene "https://example.com/model.jpg" -p "모델이 제품을 착용"

  # 이미지 확장
  npx tsx scripts/pikes-batch.ts -i ./photos -o ./expanded -a expand --aspect-ratio 16:9 -p "배경 자연스럽게 확장"
`);
}

// 폴더 내 이미지 파일 목록 가져오기
function getImageFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) {
    console.error(`❌ 입력 폴더가 존재하지 않습니다: ${dir}`);
    process.exit(1);
  }

  const files = fs.readdirSync(dir);
  return files
    .filter((file) =>
      IMAGE_EXTENSIONS.includes(path.extname(file).toLowerCase())
    )
    .map((file) => path.join(dir, file));
}

// 이미지 파일을 base64 Data URL로 변환
function imageToDataUrl(filePath: string): string {
  const data = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType =
    ext === ".png"
      ? "image/png"
      : ext === ".webp"
        ? "image/webp"
        : "image/jpeg";
  return `data:${mimeType};base64,${data.toString("base64")}`;
}

// URL에서 이미지 다운로드
async function downloadImage(url: string, outputPath: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.writeFileSync(outputPath, buffer);
}

// 단일 이미지 처리 (Claude Code MCP 도구 직접 호출용 - 실제로는 Claude가 호출)
async function processImageWithMCP(
  _filePath: string,
  config: BatchConfig
): Promise<ProcessResult> {
  const startTime = Date.now();
  const fileName = path.basename(_filePath);

  if (config.dryRun) {
    console.log(`  [DRY RUN] Would process: ${fileName}`);
    return {
      file: fileName,
      success: true,
      duration: 0,
    };
  }

  // 실제 처리는 Claude Code의 MCP 도구를 통해 수행
  // 이 스크립트는 처리할 파일 목록과 명령을 생성하는 용도

  console.log(
    `  ⏳ Processing: ${fileName} (이 파일은 Claude Code MCP를 통해 처리됩니다)`
  );

  return {
    file: fileName,
    success: true,
    duration: Date.now() - startTime,
  };
}

// 배치 처리 실행
async function runBatch(config: BatchConfig): Promise<void> {
  console.log("\n🚀 Pikes AI Batch Processing");
  console.log("━".repeat(50));
  console.log(`📁 입력 폴더: ${config.inputDir}`);
  console.log(`📁 출력 폴더: ${config.outputDir}`);
  console.log(`🎯 작업: ${config.action}`);
  console.log(`📝 프롬프트: ${config.prompt}`);
  console.log(`📐 해상도: ${config.resolution}`);
  console.log(`📏 비율: ${config.aspectRatio}`);
  console.log(`⚡ 동시 처리: ${config.concurrency}`);
  if (config.dryRun) console.log(`🧪 DRY RUN 모드`);
  console.log("━".repeat(50));

  // 출력 폴더 생성
  if (!fs.existsSync(config.outputDir)) {
    fs.mkdirSync(config.outputDir, { recursive: true });
  }

  // 이미지 파일 목록
  const imageFiles = getImageFiles(config.inputDir);
  console.log(`\n📷 발견된 이미지: ${imageFiles.length}개\n`);

  if (imageFiles.length === 0) {
    console.log("❌ 처리할 이미지가 없습니다.");
    return;
  }

  // Claude Code MCP 명령 생성
  console.log("\n" + "=".repeat(50));
  console.log("📋 Claude Code에서 실행할 명령들:");
  console.log("=".repeat(50) + "\n");

  for (const file of imageFiles) {
    const fileName = path.basename(file);
    const dataUrl = imageToDataUrl(file);
    const outputFileName = `pikes_${path.basename(file, path.extname(file))}.png`;

    console.log(`\n### ${fileName}`);
    console.log("```");

    if (config.action === "edit") {
      console.log(`// 1. 이미지 업로드`);
      console.log(
        `const uploaded = await mcp__pikes-ai__upload_image({ imageData: "${dataUrl.substring(0, 50)}..." });`
      );
      console.log(`\n// 2. 이미지 편집`);
      console.log(`const result = await mcp__pikes-ai__edit_image({`);
      console.log(`  imageUrl: uploaded.imageUrl,`);
      console.log(`  prompt: "${config.prompt}",`);
      console.log(`  resolution: "${config.resolution}",`);
      console.log(`  aspectRatio: "${config.aspectRatio}"`);
      console.log(`});`);
    } else if (config.action === "remix") {
      console.log(`// 제품+씬 합성`);
      console.log(`const result = await mcp__pikes-ai__remix_images({`);
      console.log(`  productImageUrl: "${dataUrl.substring(0, 50)}...",`);
      console.log(`  sceneImageUrl: "${config.sceneImageUrl || "SCENE_URL"}",`);
      console.log(`  prompt: "${config.prompt}",`);
      console.log(`  resolution: "${config.resolution}"`);
      console.log(`});`);
    } else if (config.action === "expand") {
      console.log(`// 이미지 확장`);
      console.log(`const result = await mcp__pikes-ai__expand_image({`);
      console.log(`  imageUrl: "${dataUrl.substring(0, 50)}...",`);
      console.log(`  prompt: "${config.prompt}",`);
      console.log(`  aspectRatio: "${config.aspectRatio}"`);
      console.log(`});`);
    }

    console.log(`\n// 결과 저장: ${outputFileName}`);
    console.log("```");
  }

  // 간편 실행용 프롬프트 생성
  console.log("\n" + "=".repeat(50));
  console.log("💡 Claude Code에 복사해서 붙여넣기:");
  console.log("=".repeat(50) + "\n");

  console.log(`다음 이미지들을 Pikes AI로 ${config.action} 처리해줘:\n`);

  for (const file of imageFiles) {
    console.log(`- ${file}`);
  }

  console.log(`\n프롬프트: "${config.prompt}"`);
  console.log(`해상도: ${config.resolution}`);
  console.log(`비율: ${config.aspectRatio}`);
  console.log(`출력 폴더: ${config.outputDir}\n`);

  // 요약
  console.log("\n" + "━".repeat(50));
  console.log("📊 요약");
  console.log("━".repeat(50));
  console.log(`총 이미지: ${imageFiles.length}개`);
  console.log(
    `예상 크레딧: ${imageFiles.length * (config.resolution === "1K" ? 6 : config.resolution === "2K" ? 8 : 12)}`
  );
  console.log("\n✅ Claude Code에서 위 명령을 실행하세요!");
}

// 메인 실행
const config = parseArgs();
runBatch(config).catch(console.error);
