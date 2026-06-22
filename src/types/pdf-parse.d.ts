declare module "pdf-parse/lib/pdf-parse.js" {
  interface PdfParseResult {
    text: string;
    numpages: number;
    info: any;
    metadata: any;
    version: string;
  }
  function pdfParse(
    dataBuffer: Buffer | Uint8Array,
    options?: any
  ): Promise<PdfParseResult>;
  export default pdfParse;
}
