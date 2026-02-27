import { NextResponse } from 'next/server';
import { badRequest, internalError } from '@/lib/http';
import {
  createViewerSignedUrl,
  deleteDocumentById,
  getDocumentById,
} from '@/lib/server/document-service';

export const runtime = 'nodejs';

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;

    if (!id) {
      return badRequest('Document id is required');
    }

    const document = await getDocumentById(id);
    if (!document) {
      return NextResponse.json({ ok: false, message: 'Document not found' }, { status: 404 });
    }

    const viewerUrl = await createViewerSignedUrl(document.storagePath);

    return NextResponse.json({
      ok: true,
      document: {
        id: document.id,
        fileName: document.fileName,
        sizeBytes: document.sizeBytes,
        status: document.status,
        extractedText: document.extractedText,
        createdAt: document.createdAt,
      },
      viewerUrl,
      summary: document.currentSummary,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to fetch document');
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (!id) {
      return badRequest('Document id is required');
    }

    const deleted = await deleteDocumentById(id);
    if (!deleted) {
      return NextResponse.json({ ok: false, message: 'Document not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to delete document');
  }
}
