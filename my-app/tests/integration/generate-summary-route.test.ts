import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server/document-service', () => {
  return {
    generateSummaryForDocument: vi.fn(async () => ({
      id: '75a00cb4-7510-4adb-b7a4-cdc126b9af39',
      contentMarkdown: '# Summary',
      language: 'English',
      length: 'medium',
      tone: 'neutral',
      isCurrent: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
  };
});

describe('POST /api/summaries/generate', () => {
  it('returns 201 for valid request', async () => {
    const route = await import('@/app/api/summaries/generate/route');
    const request = new Request('http://localhost/api/summaries/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId: 'a6f3bc7f-df1f-4e02-adb2-89f7850db00f',
        options: { language: 'English', length: 'medium', tone: 'neutral' },
      }),
    });

    const response = await route.POST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json.summary.contentMarkdown).toContain('# Summary');
  });

  it('returns 400 for invalid payload', async () => {
    const route = await import('@/app/api/summaries/generate/route');
    const request = new Request('http://localhost/api/summaries/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentId: 'not-a-uuid',
        options: { language: '', length: 'x', tone: 'y' },
      }),
    });

    const response = await route.POST(request);
    expect(response.status).toBe(400);
  });
});
