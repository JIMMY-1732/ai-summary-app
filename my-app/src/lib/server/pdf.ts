import { createWorker } from 'tesseract.js';
import path from 'node:path';
import fs from 'node:fs';

type LegacyPdfParseResult = {
  text?: string;
};

type CanvasGlobals = typeof globalThis & {
  DOMMatrix?: unknown;
  ImageData?: unknown;
  Path2D?: unknown;
};

function getOcrLanguage() {
  return process.env.OCR_LANGUAGE ?? 'eng';
}

function resolveOcrPaths() {
  const workerPath = path.resolve(
    process.cwd(),
    'node_modules',
    'tesseract.js',
    'src',
    'worker-script',
    'node',
    'index.js',
  );

  const corePath = path.resolve(
    process.cwd(),
    'node_modules',
    'tesseract.js-core',
    'tesseract-core.wasm.js',
  );

  if (!fs.existsSync(workerPath)) {
    throw new Error(`OCR worker script not found at ${workerPath}`);
  }

  if (!fs.existsSync(corePath)) {
    throw new Error(`OCR core script not found at ${corePath}`);
  }

  return { workerPath, corePath };
}

async function extractPdfTextByParser(buffer: Buffer): Promise<string> {
  const { default: pdfParse } = (await import('pdf-parse-v1')) as {
    default: (dataBuffer: Buffer | Uint8Array) => Promise<LegacyPdfParseResult>;
  };

  const parsed = await pdfParse(buffer);
  const extractedText = parsed.text?.trim() ?? '';

  if (!extractedText) {
    throw new Error('Standard PDF text extraction returned no readable text');
  }

  return extractedText;
}

async function ensureNodePdfGlobals() {
  const globalScope = globalThis as CanvasGlobals;

  if (globalScope.DOMMatrix && globalScope.ImageData && globalScope.Path2D) {
    return;
  }

  const canvasModule = (await import('@napi-rs/canvas')) as Record<string, unknown>;

  if (!globalScope.DOMMatrix && canvasModule.DOMMatrix) {
    globalScope.DOMMatrix = canvasModule.DOMMatrix;
  }

  if (!globalScope.ImageData && canvasModule.ImageData) {
    globalScope.ImageData = canvasModule.ImageData;
  }

  if (!globalScope.Path2D && canvasModule.Path2D) {
    globalScope.Path2D = canvasModule.Path2D;
  }
}

async function extractPdfTextByOcr(buffer: Buffer): Promise<string> {
  await ensureNodePdfGlobals();

  const { PDFParse } = await import('pdf-parse');
  const parser = new PDFParse({ data: buffer });
  const ocrPaths = resolveOcrPaths();
  const worker = await createWorker(getOcrLanguage(), undefined, {
    workerPath: ocrPaths.workerPath,
    corePath: ocrPaths.corePath,
  });

  try {
    const screenshots = await parser.getScreenshot({
      scale: 1.5,
    });

    const pageBuffers = (screenshots.pages ?? [])
      .map((page) => page.data)
      .filter((data): data is Uint8Array => Boolean(data && data.length > 0));

    const chunks: string[] = [];
    for (const pageData of pageBuffers) {
      const result = await worker.recognize(Buffer.from(pageData));
      const text = result.data.text.trim();
      if (text) {
        chunks.push(text);
      }
    }

    const extractedText = chunks.join('\n\n').trim();
    if (!extractedText) {
      throw new Error('OCR could not extract readable text from this PDF');
    }

    return extractedText;
  } finally {
    await worker.terminate();
    await parser.destroy();
  }
}

export async function extractPdfTextWithOcr(buffer: Buffer): Promise<string> {
  let parserError: string | null = null;

  try {
    return await extractPdfTextByParser(buffer);
  } catch (error) {
    parserError = error instanceof Error ? error.message : 'Unknown parser error';
  }

  try {
    return await extractPdfTextByOcr(buffer);
  } catch (error) {
    const ocrError = error instanceof Error ? error.message : 'Unknown OCR error';

    if (parserError) {
      throw new Error(`PDF text extraction failed. Parser: ${parserError}. OCR: ${ocrError}`);
    }

    throw new Error(`PDF OCR extraction failed: ${ocrError}`);
  }
}

export const extractPdfText = extractPdfTextWithOcr;
