import { NextResponse } from 'next/server';
import { listDocuments } from '@/lib/server/document-service';
import { internalError } from '@/lib/http';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const documents = await listDocuments();
    return NextResponse.json({ ok: true, documents });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to list documents');
  }
}
