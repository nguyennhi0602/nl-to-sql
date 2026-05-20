import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { HistoryEntryDto } from './history.dto';

const MAX_STORED_ROWS = 100;

@Injectable()
export class HistoryService {
  constructor(private readonly db: DatabaseService) {}

  save(entry: {
    question: string;
    sql: string;
    explanation: string;
    columns: string[];
    rows: unknown[][];
    error: string | null;
  }): void {
    const cappedRows = entry.rows.slice(0, MAX_STORED_ROWS);
    this.db
      .prepare(
        'INSERT INTO query_history (question, sql, explanation, columns, rows, error) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        entry.question,
        entry.sql,
        entry.explanation,
        JSON.stringify(entry.columns),
        JSON.stringify(cappedRows),
        entry.error,
      );
  }

  findAll(): HistoryEntryDto[] {
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
    const raw = this.db
      .prepare(
        'SELECT id, question, sql, explanation, columns, rows, error, created_at FROM query_history ORDER BY id DESC',
      )
      .all() as RawRow[];
    return raw.map((r) => ({
      ...r,
      columns: JSON.parse(r.columns) as string[],
      rows: JSON.parse(r.rows) as unknown[][],
    }));
  }
}
