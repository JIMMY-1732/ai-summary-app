import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const pdfParseV1 = vi.fn();
  const pdfParseConstructor = vi.fn();
  const getScreenshot = vi.fn();
  const destroy = vi.fn();
  const createWorker = vi.fn();
  const recognize = vi.fn();
  const terminate = vi.fn();
  const existsSync = vi.fn(() => true);

  return {
    pdfParseV1,
    pdfParseConstructor,
    getScreenshot,
    destroy,
    createWorker,
    recognize,
    terminate,
    existsSync,
  };
});

vi.mock('pdf-parse-v1', () => ({
  default: mocks.pdfParseV1,
}));

vi.mock('pdf-parse', () => ({
  PDFParse: mocks.pdfParseConstructor,
}));

vi.mock('tesseract.js', () => ({
  createWorker: mocks.createWorker,
}));

vi.mock('@napi-rs/canvas', () => ({
  DOMMatrix: class DOMMatrix {},
  ImageData: class ImageData {},
  Path2D: class Path2D {},
}));

vi.mock('node:fs', () => ({
  default: {
    existsSync: mocks.existsSync,
  },
}));

describe('extractPdfTextWithOcr', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    mocks.existsSync.mockReturnValue(true);
    mocks.pdfParseConstructor.mockImplementation(function MockPdfParse() {
      return {
        getScreenshot: mocks.getScreenshot,
        destroy: mocks.destroy,
      };
    });
    mocks.createWorker.mockResolvedValue({
      recognize: mocks.recognize,
      terminate: mocks.terminate,
    });

    delete (globalThis as Record<string, unknown>).DOMMatrix;
    delete (globalThis as Record<string, unknown>).ImageData;
    delete (globalThis as Record<string, unknown>).Path2D;
  });

  it('returns parsed text without starting OCR when readable PDF text exists', async () => {
    mocks.pdfParseV1.mockResolvedValue({ text: '  Extracted from PDF  ' });

    const { extractPdfTextWithOcr } = await import('@/lib/server/pdf');

    await expect(extractPdfTextWithOcr(Buffer.from('pdf'))).resolves.toBe('Extracted from PDF');
    expect(mocks.createWorker).not.toHaveBeenCalled();
    expect(mocks.pdfParseConstructor).not.toHaveBeenCalled();
  });

  it('falls back to OCR when standard parsing returns no readable text', async () => {
    mocks.pdfParseV1.mockResolvedValue({ text: '   ' });
    mocks.getScreenshot.mockResolvedValue({
      pages: [{ data: new Uint8Array([1, 2, 3]) }, { data: new Uint8Array([4, 5, 6]) }],
    });
    mocks.recognize
      .mockResolvedValueOnce({ data: { text: 'Page one' } })
      .mockResolvedValueOnce({ data: { text: ' Page two ' } });

    const { extractPdfTextWithOcr } = await import('@/lib/server/pdf');

    await expect(extractPdfTextWithOcr(Buffer.from('pdf'))).resolves.toBe('Page one\n\nPage two');
    expect(mocks.createWorker).toHaveBeenCalledOnce();
    expect(mocks.pdfParseConstructor).toHaveBeenCalledOnce();
    expect(mocks.terminate).toHaveBeenCalledOnce();
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });

  it('includes both parser and OCR errors when all extraction strategies fail', async () => {
    mocks.pdfParseV1.mockRejectedValue(new Error('legacy parser failed'));
    mocks.getScreenshot.mockRejectedValue(new Error('ocr render failed'));

    const { extractPdfTextWithOcr } = await import('@/lib/server/pdf');

    await expect(extractPdfTextWithOcr(Buffer.from('pdf'))).rejects.toThrow(
      'PDF text extraction failed. Parser: legacy parser failed. OCR: ocr render failed',
    );
    expect(mocks.terminate).toHaveBeenCalledOnce();
    expect(mocks.destroy).toHaveBeenCalledOnce();
  });
});