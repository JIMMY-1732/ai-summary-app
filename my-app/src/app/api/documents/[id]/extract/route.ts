import { NextResponse } from 'next/server';
import { badRequest, internalError } from '@/lib/http';
import { extractDocumentTextById } from '@/lib/server/document-service';

export const runtime = 'nodejs';

type Context = {
  params: Promise<{ id: string }>;
};

export async function POST(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (!id) {
      return badRequest('Document id is required');
    }

    const result = await extractDocumentTextById(id);

    return NextResponse.json({
      ok: true,
      documentId: result.documentId,
      extractedText: result.extractedText,
      message: result.extractionError
        ? `Extraction completed with warning: ${result.extractionError}`
        : undefined,
    });
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Failed to extract text');
  }
}
