// ============================================
// Auto-Evaluation API - Gemini Vision으로 생성 결과 자동 평가
// ============================================

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const FEEDBACK_DIR = path.join(process.cwd(), 'feedback');
const FEEDBACK_LOG = path.join(FEEDBACK_DIR, 'logs', 'feedback.json');

interface EvaluationCriteria {
  realism: number; // 1-10: 실사 느낌
  garmentAccuracy: number; // 1-10: 의류 정확도
  poseCorrectness: number; // 1-10: 포즈 정확도
  cropQuality: number; // 1-10: 크롭 품질 (얼굴 노출 여부)
  overallQuality: number; // 1-10: 전체 품질
  issues: string[]; // 발견된 문제점
  suggestions: string[]; // 개선 제안
}

interface FeedbackEntry {
  timestamp: string;
  sessionId: string;
  pose: string;
  evaluation: EvaluationCriteria;
  imageUrl?: string;
}

// Gemini Vision으로 이미지 평가
async function evaluateWithGemini(imageBase64: string, pose: string): Promise<EvaluationCriteria> {
  const apiKey = process.env.GOOGLE_CLOUD_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_CLOUD_API_KEY not set');
  }

  const prompt = `You are an expert fashion photography critic. Analyze this AI-generated fashion lookbook image.

CONTEXT: This is supposed to be a Korean online shopping mall style photo, shot on iPhone 15 Pro, with natural daylight.
POSE TYPE: ${pose}

Evaluate on these criteria (1-10 scale):

1. REALISM (1-10): Does it look like a real iPhone photo? Or does it have an obvious AI/CGI feel?
   - 10: Indistinguishable from real photo
   - 5: Noticeable AI artifacts but acceptable
   - 1: Clearly artificial/animated

2. GARMENT_ACCURACY (1-10): How well does the garment match the reference?
   - Check: colors, patterns, texture, draping

3. POSE_CORRECTNESS (1-10): Is the pose natural and matching the requested type (${pose})?
   - front: standing facing camera
   - side: side profile view
   - styled: seated pose
   - detail: garment close-up

4. CROP_QUALITY (1-10): Is the face properly cropped at lips/chin level?
   - 10: Face cropped perfectly at lips
   - 5: Some face visible but acceptable
   - 1: Full face visible (privacy issue)

5. OVERALL_QUALITY (1-10): Overall impression

Also list:
- ISSUES: Specific problems found (list each on new line)
- SUGGESTIONS: Specific improvements needed (list each on new line)

Respond in this exact JSON format:
{
  "realism": <number>,
  "garmentAccuracy": <number>,
  "poseCorrectness": <number>,
  "cropQuality": <number>,
  "overallQuality": <number>,
  "issues": ["issue1", "issue2"],
  "suggestions": ["suggestion1", "suggestion2"]
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: 'image/jpeg',
                data: imageBase64.replace(/^data:image\/\w+;base64,/, ''),
              },
            },
          ],
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Gemini evaluation error:', error);
    throw new Error('Evaluation failed');
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  // Parse JSON from response
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      console.error('Failed to parse evaluation JSON:', text);
    }
  }

  // Default fallback
  return {
    realism: 5,
    garmentAccuracy: 5,
    poseCorrectness: 5,
    cropQuality: 5,
    overallQuality: 5,
    issues: ['Failed to parse evaluation'],
    suggestions: ['Manual review needed'],
  };
}

// 피드백 로그 저장
async function saveFeedback(entry: FeedbackEntry): Promise<void> {
  let feedbackLog: FeedbackEntry[] = [];

  try {
    const existing = await fs.readFile(FEEDBACK_LOG, 'utf-8');
    feedbackLog = JSON.parse(existing);
  } catch {
    // File doesn't exist, start fresh
  }

  feedbackLog.push(entry);

  // Keep only last 100 entries
  if (feedbackLog.length > 100) {
    feedbackLog = feedbackLog.slice(-100);
  }

  await fs.writeFile(FEEDBACK_LOG, JSON.stringify(feedbackLog, null, 2));
}

// 최근 피드백 요약 생성
async function getFeedbackSummary(): Promise<{
  averageScores: Record<string, number>;
  commonIssues: string[];
  topSuggestions: string[];
}> {
  let feedbackLog: FeedbackEntry[] = [];

  try {
    const existing = await fs.readFile(FEEDBACK_LOG, 'utf-8');
    feedbackLog = JSON.parse(existing);
  } catch {
    return {
      averageScores: {},
      commonIssues: [],
      topSuggestions: [],
    };
  }

  // Calculate averages from last 20 entries
  const recent = feedbackLog.slice(-20);
  const avgScores = {
    realism: 0,
    garmentAccuracy: 0,
    poseCorrectness: 0,
    cropQuality: 0,
    overallQuality: 0,
  };

  const allIssues: string[] = [];
  const allSuggestions: string[] = [];

  for (const entry of recent) {
    avgScores.realism += entry.evaluation.realism;
    avgScores.garmentAccuracy += entry.evaluation.garmentAccuracy;
    avgScores.poseCorrectness += entry.evaluation.poseCorrectness;
    avgScores.cropQuality += entry.evaluation.cropQuality;
    avgScores.overallQuality += entry.evaluation.overallQuality;
    allIssues.push(...entry.evaluation.issues);
    allSuggestions.push(...entry.evaluation.suggestions);
  }

  const count = recent.length || 1;
  for (const key of Object.keys(avgScores) as (keyof typeof avgScores)[]) {
    avgScores[key] = Math.round((avgScores[key] / count) * 10) / 10;
  }

  // Count frequency of issues/suggestions
  const issueCount: Record<string, number> = {};
  const suggestionCount: Record<string, number> = {};

  for (const issue of allIssues) {
    issueCount[issue] = (issueCount[issue] || 0) + 1;
  }
  for (const suggestion of allSuggestions) {
    suggestionCount[suggestion] = (suggestionCount[suggestion] || 0) + 1;
  }

  const commonIssues = Object.entries(issueCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([issue]) => issue);

  const topSuggestions = Object.entries(suggestionCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([suggestion]) => suggestion);

  return {
    averageScores: avgScores,
    commonIssues,
    topSuggestions,
  };
}

// POST: 이미지 평가
export async function POST(request: NextRequest) {
  try {
    const { imageBase64, pose, sessionId } = await request.json();

    if (!imageBase64) {
      return NextResponse.json({ success: false, error: 'No image provided' }, { status: 400 });
    }

    console.log(`🔍 Evaluating ${pose} pose...`);
    const evaluation = await evaluateWithGemini(imageBase64, pose);

    const entry: FeedbackEntry = {
      timestamp: new Date().toISOString(),
      sessionId: sessionId || 'unknown',
      pose,
      evaluation,
    };

    await saveFeedback(entry);

    console.log(`📊 Evaluation complete: Overall ${evaluation.overallQuality}/10`);
    console.log(`   Issues: ${evaluation.issues.join(', ')}`);

    return NextResponse.json({
      success: true,
      evaluation,
    });
  } catch (error) {
    console.error('Evaluation error:', error);
    return NextResponse.json(
      { success: false, error: 'Evaluation failed' },
      { status: 500 }
    );
  }
}

// GET: 피드백 요약 조회
export async function GET() {
  try {
    const summary = await getFeedbackSummary();
    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error) {
    console.error('Summary error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to get summary' },
      { status: 500 }
    );
  }
}
