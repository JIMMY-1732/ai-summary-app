import { NextResponse } from 'next/server';
import { badRequest, internalError } from '@/lib/http';
import { generateSummaryRequestSchema } from '@/lib/schemas';
import { generateSummaryForDocument } from '@/lib/server/document-service';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const parsed = generateSummaryRequestSchema.safeParse(payload);

    if (!parsed.success) {
      return badRequest(parsed.error.issues[0]?.message ?? 'Invalid request');
    }

    const summary = await generateSummaryForDocument(parsed.data.documentId, parsed.data.options);
    return NextResponse.json({ ok: true, summary }, { status: 201 });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to generate summary');
  }
}
