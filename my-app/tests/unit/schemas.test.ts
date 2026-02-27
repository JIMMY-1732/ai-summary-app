import {
  generateSummaryRequestSchema,
  summaryOptionsSchema,
  updateSummaryRequestSchema,
} from '@/lib/schemas';

describe('schemas', () => {
  it('accepts valid summary options', () => {
    const parsed = summaryOptionsSchema.safeParse({
      language: 'English',
      length: 'medium',
      tone: 'neutral',
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects invalid length option', () => {
    const parsed = summaryOptionsSchema.safeParse({
      language: 'English',
      length: 'huge',
      tone: 'neutral',
    });

    expect(parsed.success).toBe(false);
  });

  it('validates generate summary payload', () => {
    const parsed = generateSummaryRequestSchema.safeParse({
      documentId: 'a6f3bc7f-df1f-4e02-adb2-89f7850db00f',
      options: {
        language: 'English',
        length: 'short',
        tone: 'simple',
      },
    });

    expect(parsed.success).toBe(true);
  });

  it('rejects empty markdown update', () => {
    const parsed = updateSummaryRequestSchema.safeParse({
      contentMarkdown: '   ',
    });

    expect(parsed.success).toBe(false);
  });
});
