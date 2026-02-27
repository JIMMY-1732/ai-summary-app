import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/server/document-service', () => {
  return {
    updateSummaryContent: vi.fn(async (summaryId: string, contentMarkdown: string) => ({
      id: summaryId,
      documentId: 'a6f3bc7f-df1f-4e02-adb2-89f7850db00f',
      contentMarkdown,
      language: 'English',
      length: 'medium',
      tone: 'neutral',
      isCurrent: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })),
  };
});

describe('PATCH /api/summaries/[id]', () => {
  it('updates summary markdown', async () => {
    const route = await import('@/app/api/summaries/[id]/route');
    const request = new Request('http://localhost/api/summaries/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentMarkdown: '# Updated Summary' }),
    });

    const response = await route.PATCH(request, {
      params: Promise.resolve({ id: '75a00cb4-7510-4adb-b7a4-cdc126b9af39' }),
    });

    const json = await response.json();
    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.summary.contentMarkdown).toBe('# Updated Summary');
  });

  it('rejects empty markdown', async () => {
    const route = await import('@/app/api/summaries/[id]/route');
    const request = new Request('http://localhost/api/summaries/1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentMarkdown: '' }),
    });

    const response = await route.PATCH(request, {
      params: Promise.resolve({ id: '75a00cb4-7510-4adb-b7a4-cdc126b9af39' }),
    });

    expect(response.status).toBe(400);
  });
});
