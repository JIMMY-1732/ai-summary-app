import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';
import path from 'node:path';
import fs from 'node:fs';

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

async function extractPdfTextByOcr(buffer: Buffer): Promise<string> {
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
  return extractPdfTextByOcr(buffer);
}

export const extractPdfText = extractPdfTextWithOcr;
