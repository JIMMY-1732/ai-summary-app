declare module 'pdf-parse-v1' {
  type PdfParseResult = {
    text?: string;
  };

  function pdfParse(dataBuffer: Buffer | Uint8Array): Promise<PdfParseResult>;

  export default pdfParse;
}
