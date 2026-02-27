import { buildSummaryPrompt, enforceAiCallRateLimits, resetAiCallRateLimitsForTests } from '@/lib/server/ai';

beforeEach(() => {
  resetAiCallRateLimitsForTests();
});

describe('buildSummaryPrompt', () => {
  it('renders template with language, tone, and length options', () => {
    const prompt = buildSummaryPrompt('Document body here', {
      language: 'Traditional Chinese',
      length: 'short',
      tone: 'professional',
    });

    expect(prompt).toContain('Language: Traditional Chinese');
    expect(prompt).toContain('Tone: professional');
    expect(prompt).toContain('Length: short');
    expect(prompt).toContain('Length guidance: Keep it brief');
    expect(prompt).toContain('## Required Structure');
    expect(prompt).toContain('Document body here');
  });

  it('blocks when more than 25 calls are made within 10 minutes', () => {
    const now = Date.UTC(2026, 1, 27, 10, 0, 0);

    for (let index = 0; index < 25; index += 1) {
      enforceAiCallRateLimits(now + index);
    }

    expect(() => enforceAiCallRateLimits(now + 2000)).toThrow(
      'AI request limit reached: maximum 25 calls within 10 minutes. Please wait and try again.',
    );
  });

  it('blocks when more than 50 calls are made in one day', () => {
    const now = Date.UTC(2026, 1, 27, 11, 0, 0);

    for (let index = 0; index < 50; index += 1) {
      enforceAiCallRateLimits(now + index * 600000);
    }

    expect(() => enforceAiCallRateLimits(now + 49 * 600000 + 1)).toThrow(
      'AI request limit reached: maximum 50 calls per day. Please try again tomorrow.',
    );
  });
});
