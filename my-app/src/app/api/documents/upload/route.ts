import { NextResponse } from 'next/server';
import { badRequest, internalError } from '@/lib/http';
import { uploadDocument } from '@/lib/server/document-service';

export const runtime = 'nodejs';

const MAX_SIZE_BYTES = 20 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const filePart = formData.get('file');

    if (!(filePart instanceof File)) {
      return badRequest('File is required');
    }

    if (filePart.type !== 'application/pdf') {
      return badRequest('Only PDF files are allowed');
    }

    if (filePart.size > MAX_SIZE_BYTES) {
      return badRequest('File exceeds 20MB limit');
    }

    const buffer = Buffer.from(await filePart.arrayBuffer());

    const document = await uploadDocument({
      fileName: filePart.name,
      mimeType: filePart.type,
      sizeBytes: filePart.size,
      buffer,
    });

    return NextResponse.json(
      {
        ok: true,
        document,
        message: document.extractionError
          ? `Uploaded, but text extraction failed: ${document.extractionError}`
          : undefined,
      },
      { status: 201 },
    );
  } catch (error) {
    return internalError(error instanceof Error ? error.message : 'Upload failed');
  }
}
