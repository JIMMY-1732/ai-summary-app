import OpenAI from 'openai';
import type { SummaryOptions } from '@/lib/schemas';
import { getAiEnv } from './env';

const DAILY_CALL_LIMIT = 50;
const TEN_MINUTE_WINDOW_MS = 10 * 60 * 1000;
const TEN_MINUTE_CALL_LIMIT = 25;

type AiRateLimitState = {
  dayKey: string;
  dayCount: number;
  recentTimestamps: number[];
};

const aiRateLimitState: AiRateLimitState = {
  dayKey: '',
  dayCount: 0,
  recentTimestamps: [],
};

const LENGTH_GUIDANCE: Record<SummaryOptions['length'], string> = {
  short: 'Keep it brief (about 3-5 bullet points total).',
  medium: 'Provide moderate detail (about 6-10 bullet points total).',
  long: 'Provide detailed coverage with clear sectioning and complete key points.',
};

export const SUMMARY_PROMPT_TEMPLATE = [
  'You are a precise document summarization assistant.',
  '',
  '## Output Requirements',
  '- Language: {{language}}',
  '- Tone: {{tone}}',
  '- Length: {{length}}',
  '- Length guidance: {{lengthGuidance}}',
  '- Output format: valid Markdown only',
  '',
  '## Required Structure',
  '1. Title heading',
  '2. Key points (bulleted)',
  '3. Action items or conclusions',
  '',
  '## Rules',
  '- Keep facts grounded in the source text.',
  '- Do not add external facts.',
  '- Be clear and concise.',
  '',
  '## Source Text',
  '{{inputText}}',
].join('\n');

export function buildSummaryPrompt(inputText: string, options: SummaryOptions): string {
  return SUMMARY_PROMPT_TEMPLATE.replace('{{language}}', options.language)
    .replace('{{tone}}', options.tone)
    .replace('{{length}}', options.length)
    .replace('{{lengthGuidance}}', LENGTH_GUIDANCE[options.length])
    .replace('{{inputText}}', inputText);
}

function getUtcDayKey(timestampMs: number): string {
  return new Date(timestampMs).toISOString().slice(0, 10);
}

export function enforceAiCallRateLimits(nowMs: number = Date.now()): void {
  aiRateLimitState.recentTimestamps = aiRateLimitState.recentTimestamps.filter(
    (timestamp) => nowMs - timestamp < TEN_MINUTE_WINDOW_MS,
  );

  if (aiRateLimitState.recentTimestamps.length >= TEN_MINUTE_CALL_LIMIT) {
    throw new Error('AI request limit reached: maximum 25 calls within 10 minutes. Please wait and try again.');
  }

  const currentDayKey = getUtcDayKey(nowMs);
  if (aiRateLimitState.dayKey !== currentDayKey) {
    aiRateLimitState.dayKey = currentDayKey;
    aiRateLimitState.dayCount = 0;
  }

  if (aiRateLimitState.dayCount >= DAILY_CALL_LIMIT) {
    throw new Error('AI request limit reached: maximum 50 calls per day. Please try again tomorrow.');
  }

  aiRateLimitState.recentTimestamps.push(nowMs);
  aiRateLimitState.dayCount += 1;
}

export function resetAiCallRateLimitsForTests(): void {
  aiRateLimitState.dayKey = '';
  aiRateLimitState.dayCount = 0;
  aiRateLimitState.recentTimestamps = [];
}

export async function generateMarkdownSummary(
  extractedText: string,
  options: SummaryOptions,
): Promise<string> {
  enforceAiCallRateLimits();

  const env = getAiEnv();
  const client = new OpenAI({
    apiKey: env.apiKey,
    baseURL: env.baseUrl,
  });

  const prompt = buildSummaryPrompt(extractedText, options);

  const response = await client.chat.completions.create({
    model: env.model,
    messages: [
      {
        role: 'system',
        content: 'You write concise, high-quality markdown summaries.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ],
  });

  const output = response.choices[0]?.message?.content?.trim();
  if (!output) {
    throw new Error('AI returned an empty summary');
  }

  return output;
}
