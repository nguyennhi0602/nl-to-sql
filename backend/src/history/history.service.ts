import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { HistoryEntryDto } from './history.dto';

const MAX_STORED_ROWS = 100;

@Injectable()
export class HistoryService {
  constructor(private readonly db: DatabaseService) {}

  async save(entry: {
    question: string;
    sql: string;
    explanation: string;
    columns: string[];
    rows: unknown[][];
    error: string | null;
  }): Promise<void> {
    const cappedRows = entry.rows.slice(0, MAX_STORED_ROWS);
    await this.db.query(
      'INSERT INTO query_history (question, sql, explanation, columns, rows, error) VALUES ($1, $2, $3, $4, $5, $6)',
      [entry.question, entry.sql, entry.explanation, JSON.stringify(entry.columns), JSON.stringify(cappedRows), entry.error],
    );
  }

  async deleteAll(): Promise<number> {
    const result = await this.db.query('DELETE FROM query_history');
    return result.rows.length;
  }

  async findAll(): Promise<HistoryEntryDto[]> {
    type RawRow = {
      id: number;
      question: string;
      sql: string;
      explanation: string;
      columns: string;
      rows: string;
      error: string | null;
      created_at: string;
    };
    const result = await this.db.query(
      'SELECT id, question, sql, explanation, columns, rows, error, created_at FROM query_history ORDER BY id DESC',
    );
    return (result.rows as RawRow[]).map((r) => ({
      ...r,
      columns: JSON.parse(r.columns) as string[],
      rows: JSON.parse(r.rows) as unknown[][],
    }));
  }
}
