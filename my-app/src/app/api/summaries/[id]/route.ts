import { NextResponse } from 'next/server';
import { badRequest, internalError } from '@/lib/http';
import { updateSummaryRequestSchema } from '@/lib/schemas';
import { updateSummaryContent } from '@/lib/server/document-service';

export const runtime = 'nodejs';

type Context = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (!id) {
      return badRequest('Summary id is required');
    }

    const payload = await request.json();
    const parsed = updateSummaryRequestSchema.safeParse(payload);

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
    }

    const summary = await updateSummaryContent(id, parsed.data.contentMarkdown);
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to update summary');
  }
}
