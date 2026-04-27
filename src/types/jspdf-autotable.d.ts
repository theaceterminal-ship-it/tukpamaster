declare module 'jspdf-autotable' {
  import { jsPDF } from 'jspdf';
  
  interface AutoTableOptions {
    startY?: number;
    body?: string[][];
    theme?: string;
    styles?: Record<string, unknown>;
    columnStyles?: Record<number, Record<string, unknown>>;
    didParseCell?: (data: { cell: { text: string[]; styles: Record<string, unknown> } }) => void;
    [key: string]: unknown;
  }
  
  function autoTable(doc: jsPDF, options: AutoTableOptions): void;
  export default autoTable;
}
