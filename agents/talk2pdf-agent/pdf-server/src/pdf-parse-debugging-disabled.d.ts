declare module 'pdf-parse-debugging-disabled' {
    import { Buffer } from 'buffer';
    interface PDFInfo {
        numpages: number;
        numrender: number;
        info: Record<string, any>;
        metadata: any;
        version: string;
        text: string;
    }
    function pdf(dataBuffer: Buffer | string, options?: any): Promise<PDFInfo>;
    export default pdf;
}
