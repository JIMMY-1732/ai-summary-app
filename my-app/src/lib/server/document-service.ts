import type { SummaryOptions } from '@/lib/schemas';
import { extractPdfTextWithOcr } from './pdf';
import { generateMarkdownSummary } from './ai';
import { getSupabaseAdminClient } from './supabase-admin';
import { getSupabaseEnv } from './env';

export type DocumentListItem = {
  id: string;
  fileName: string;
  sizeBytes: number;
  status: string;
  createdAt: string;
};

export type DocumentDetail = {
  id: string;
  fileName: string;
  sizeBytes: number;
  status: string;
  extractedText: string;
  storagePath: string;
  createdAt: string;
  currentSummary: null | {
    id: string;
    contentMarkdown: string;
    language: string;
    length: string;
    tone: string;
    updatedAt: string;
  };
};

function normalizeSupabaseErrorMessage(message: string, tableName: string): string {
  const lower = message.toLowerCase();
  const missingSchemaCache = lower.includes(`could not find the table 'public.${tableName}' in the schema cache`);
  const missingRelation = lower.includes(`relation "${tableName}" does not exist`);

  if (missingSchemaCache || missingRelation) {
    return `Supabase table '${tableName}' is missing. Run the SQL in supabase/schema.sql on your Supabase project, then refresh the app.`;
  }

  return message;
}

function mapDocumentRow(row: Record<string, unknown>): DocumentListItem {
  return {
    id: String(row.id),
    fileName: String(row.file_name),
    sizeBytes: Number(row.size_bytes),
    status: String(row.status),
    createdAt: String(row.created_at),
  };
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function listDocuments(): Promise<DocumentListItem[]> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('documents')
    .select('id, file_name, size_bytes, status, created_at')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(
      `Failed to list documents: ${normalizeSupabaseErrorMessage(error.message, 'documents')}`,
    );
  }

  return (data ?? []).map((row) => mapDocumentRow(row));
}

export async function uploadDocument(params: {
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  buffer: Buffer;
}) {
  const supabase = getSupabaseAdminClient();
  const env = getSupabaseEnv();
  const objectPath = `documents/${Date.now()}-${crypto.randomUUID()}-${sanitizeFilename(params.fileName)}`;

  const upload = await supabase.storage
    .from(env.bucket)
    .upload(objectPath, params.buffer, {
      contentType: params.mimeType,
      upsert: false,
    });

  if (upload.error) {
    throw new Error(`Failed to upload PDF: ${upload.error.message}`);
  }

  let extractedText = '';
  let extractionError: string | null = null;
  try {
    extractedText = await extractPdfTextWithOcr(params.buffer);
  } catch (error) {
    extractionError = error instanceof Error ? error.message : 'Unknown extraction error';
    console.error('PDF extraction failed:', extractionError);
    extractedText = '';
  }

  const { data, error } = await supabase
    .from('documents')
    .insert({
      file_name: params.fileName,
      mime_type: params.mimeType,
      size_bytes: params.sizeBytes,
      storage_path: objectPath,
      extracted_text: extractedText,
      status: extractedText ? 'extracted' : 'uploaded',
    })
    .select('id, file_name, size_bytes, status, created_at')
    .single();

  if (error) {
    await supabase.storage.from(env.bucket).remove([objectPath]);
    throw new Error(`Failed to persist document metadata: ${error.message}`);
  }

  return {
    ...mapDocumentRow(data),
    extractedText,
    extractionError,
  };
}

export async function getDocumentById(documentId: string): Promise<DocumentDetail | null> {
  const supabase = getSupabaseAdminClient();
  const { data, error } = await supabase
    .from('documents')
    .select('id, file_name, size_bytes, status, extracted_text, storage_path, created_at')
    .eq('id', documentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch document: ${error.message}`);
  }

  if (!data) {
    return null;
  }

  const { data: summaryData, error: summaryError } = await supabase
    .from('summary_versions')
    .select('id, content_markdown, language, length, tone, updated_at')
    .eq('document_id', documentId)
    .eq('is_current', true)
    .maybeSingle();

  if (summaryError) {
    throw new Error(`Failed to fetch current summary: ${summaryError.message}`);
  }

  return {
    id: String(data.id),
    fileName: String(data.file_name),
    sizeBytes: Number(data.size_bytes),
    status: String(data.status),
    extractedText: String(data.extracted_text ?? ''),
    storagePath: String(data.storage_path),
    createdAt: String(data.created_at),
    currentSummary: summaryData
      ? {
          id: String(summaryData.id),
          contentMarkdown: String(summaryData.content_markdown),
          language: String(summaryData.language),
          length: String(summaryData.length),
          tone: String(summaryData.tone),
          updatedAt: String(summaryData.updated_at),
        }
      : null,
  };
}

export async function createViewerSignedUrl(storagePath: string): Promise<string> {
  const supabase = getSupabaseAdminClient();
  const env = getSupabaseEnv();

  const signed = await supabase.storage.from(env.bucket).createSignedUrl(storagePath, 3600);
  if (signed.error || !signed.data?.signedUrl) {
    throw new Error(signed.error?.message ?? 'Failed to create signed URL');
  }

  return signed.data.signedUrl;
}

export async function deleteDocumentById(documentId: string) {
  const supabase = getSupabaseAdminClient();
  const env = getSupabaseEnv();

  const existing = await getDocumentById(documentId);
  if (!existing) {
    return false;
  }

  const deleteSummaries = await supabase.from('summary_versions').delete().eq('document_id', documentId);
  if (deleteSummaries.error) {
    throw new Error(`Failed to delete summary versions: ${deleteSummaries.error.message}`);
  }

  const deleteDoc = await supabase.from('documents').delete().eq('id', documentId);
  if (deleteDoc.error) {
    throw new Error(`Failed to delete document row: ${deleteDoc.error.message}`);
  }

  const storageDelete = await supabase.storage.from(env.bucket).remove([existing.storagePath]);
  if (storageDelete.error) {
    throw new Error(`Failed to delete storage object: ${storageDelete.error.message}`);
  }

  return true;
}

export async function extractDocumentTextById(documentId: string) {
  const supabase = getSupabaseAdminClient();
  const env = getSupabaseEnv();

  const existing = await getDocumentById(documentId);
  if (!existing) {
    throw new Error('Document not found');
  }

  const downloaded = await supabase.storage.from(env.bucket).download(existing.storagePath);
  if (downloaded.error || !downloaded.data) {
    throw new Error(`Failed to download PDF for extraction: ${downloaded.error?.message ?? 'Unknown error'}`);
  }

  const buffer = Buffer.from(await downloaded.data.arrayBuffer());

  let extractedText = '';
  let extractionError: string | null = null;
  try {
    extractedText = await extractPdfTextWithOcr(buffer);
  } catch (error) {
    extractionError = error instanceof Error ? error.message : 'Unknown extraction error';
    console.error('Manual PDF extraction failed:', extractionError);
    extractedText = '';
  }

  const update = await supabase
    .from('documents')
    .update({
      extracted_text: extractedText,
      status: extractedText ? 'extracted' : 'uploaded',
    })
    .eq('id', documentId)
    .select('id')
    .single();

  if (update.error) {
    throw new Error(`Failed to update extracted text: ${update.error.message}`);
  }

  return {
    documentId,
    extractedText,
    extractionError,
  };
}

export async function generateSummaryForDocument(documentId: string, options: SummaryOptions) {
  const supabase = getSupabaseAdminClient();
  const detail = await getDocumentById(documentId);

  if (!detail) {
    throw new Error('Document not found');
  }

  let sourceText = detail.extractedText.trim();
  if (!sourceText) {
    const extraction = await extractDocumentTextById(documentId);
    sourceText = extraction.extractedText.trim();
  }

  if (!sourceText) {
    throw new Error('Document text is empty after OCR extraction. Upload a clearer PDF and try again.');
  }

  const contentMarkdown = await generateMarkdownSummary(sourceText, options);

  const unsetCurrent = await supabase
    .from('summary_versions')
    .update({ is_current: false })
    .eq('document_id', documentId)
    .eq('is_current', true);

  if (unsetCurrent.error) {
    throw new Error(`Failed to archive previous summary version: ${unsetCurrent.error.message}`);
  }

  const insert = await supabase
    .from('summary_versions')
    .insert({
      document_id: documentId,
      content_markdown: contentMarkdown,
      language: options.language,
      length: options.length,
      tone: options.tone,
      is_current: true,
    })
    .select('id, content_markdown, language, length, tone, is_current, created_at, updated_at')
    .single();

  if (insert.error || !insert.data) {
    throw new Error(`Failed to save generated summary: ${insert.error?.message ?? 'Unknown error'}`);
  }

  return {
    id: String(insert.data.id),
    contentMarkdown: String(insert.data.content_markdown),
    language: String(insert.data.language),
    length: String(insert.data.length),
    tone: String(insert.data.tone),
    isCurrent: Boolean(insert.data.is_current),
    createdAt: String(insert.data.created_at),
    updatedAt: String(insert.data.updated_at),
  };
}

export async function updateSummaryContent(summaryId: string, contentMarkdown: string) {
  const supabase = getSupabaseAdminClient();
  const update = await supabase
    .from('summary_versions')
    .update({ content_markdown: contentMarkdown })
    .eq('id', summaryId)
    .select('id, document_id, content_markdown, language, length, tone, is_current, created_at, updated_at')
    .single();

  if (update.error || !update.data) {
    throw new Error(`Failed to update summary: ${update.error?.message ?? 'Unknown error'}`);
  }

  return {
    id: String(update.data.id),
    documentId: String(update.data.document_id),
    contentMarkdown: String(update.data.content_markdown),
    language: String(update.data.language),
    length: String(update.data.length),
    tone: String(update.data.tone),
    isCurrent: Boolean(update.data.is_current),
    createdAt: String(update.data.created_at),
    updatedAt: String(update.data.updated_at),
  };
}
