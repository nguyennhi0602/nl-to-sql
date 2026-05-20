export class HistoryEntryDto {
  id: number;
  question: string;
  sql: string;
  explanation: string;
  columns: string[];
  rows: unknown[][];
  error: string | null;
  created_at: string;
}
