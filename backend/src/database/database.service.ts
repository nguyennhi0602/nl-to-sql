import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as path from 'path';

export interface SchemaTable {
  name: string;
  columns: { name: string; type: string; notnull: number; pk: number }[];
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private db: Database.Database;

  onModuleInit() {
    this.db = new Database(path.join(process.cwd(), 'store.db'));
    this.db.pragma('journal_mode = WAL');
    this.seed();
    this.initHistory();
  }

  onModuleDestroy() {
    this.db?.close();
  }

  private seed() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        city TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (date('now'))
      );

      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price REAL NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        status TEXT NOT NULL DEFAULT 'pending',
        total REAL NOT NULL,
        created_at TEXT NOT NULL DEFAULT (date('now'))
      );

      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL REFERENCES orders(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL
      );
    `);

    const alreadySeeded = this.db.prepare('SELECT COUNT(*) as n FROM customers').get() as { n: number };
    if (alreadySeeded.n > 0) return;

    this.db.exec(`
      INSERT INTO customers (name, email, city, created_at) VALUES
        ('Alice Johnson', 'alice@example.com', 'New York', '2024-01-15'),
        ('Bob Smith', 'bob@example.com', 'Los Angeles', '2024-02-03'),
        ('Carol White', 'carol@example.com', 'Chicago', '2024-02-20'),
        ('David Brown', 'david@example.com', 'Houston', '2024-03-10'),
        ('Eva Martinez', 'eva@example.com', 'New York', '2024-03-25'),
        ('Frank Lee', 'frank@example.com', 'Seattle', '2024-04-01'),
        ('Grace Kim', 'grace@example.com', 'Chicago', '2024-04-15'),
        ('Henry Wilson', 'henry@example.com', 'Los Angeles', '2024-05-05');

      INSERT INTO products (name, category, price, stock) VALUES
        ('Wireless Headphones', 'Electronics', 89.99, 150),
        ('Running Shoes', 'Sports', 129.99, 80),
        ('Coffee Maker', 'Kitchen', 59.99, 200),
        ('Python Cookbook', 'Books', 39.99, 300),
        ('Yoga Mat', 'Sports', 34.99, 120),
        ('Mechanical Keyboard', 'Electronics', 149.99, 60),
        ('Air Fryer', 'Kitchen', 99.99, 90),
        ('Noise Cancelling Earbuds', 'Electronics', 199.99, 45),
        ('Resistance Bands', 'Sports', 24.99, 250),
        ('SQL Mastery Book', 'Books', 44.99, 180);

      INSERT INTO orders (customer_id, status, total, created_at) VALUES
        (1, 'delivered', 219.98, '2024-03-01'),
        (1, 'delivered', 39.99,  '2024-04-10'),
        (2, 'delivered', 129.99, '2024-03-15'),
        (3, 'shipped',   249.98, '2024-05-01'),
        (4, 'pending',   84.98,  '2024-05-10'),
        (5, 'delivered', 199.99, '2024-04-20'),
        (6, 'delivered', 149.99, '2024-03-30'),
        (7, 'shipped',   164.98, '2024-05-08'),
        (8, 'pending',   59.99,  '2024-05-12'),
        (2, 'delivered', 44.99,  '2024-04-05');

      INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
        (1, 1, 1, 89.99), (1, 6, 1, 129.99),
        (2, 4, 1, 39.99),
        (3, 2, 1, 129.99),
        (4, 8, 1, 199.99), (4, 5, 1, 49.99),
        (5, 5, 1, 34.99), (5, 9, 2, 24.99),
        (6, 8, 1, 199.99),
        (7, 6, 1, 149.99),
        (8, 2, 1, 129.99), (8, 5, 1, 34.99),
        (9, 3, 1, 59.99),
        (10, 10, 1, 44.99);
    `);
  }

  private initHistory() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS query_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        question TEXT NOT NULL,
        sql TEXT NOT NULL,
        explanation TEXT NOT NULL DEFAULT '',
        columns TEXT NOT NULL DEFAULT '[]',
        rows TEXT NOT NULL DEFAULT '[]',
        error TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      CREATE INDEX IF NOT EXISTS idx_query_history_created_at ON query_history (created_at DESC);
    `);
  }

  execute(sql: string): { columns: string[]; rows: unknown[][] } {
    const stmt = this.db.prepare(sql);
    if (stmt.reader) {
      const rows = stmt.all() as Record<string, unknown>[];
      if (rows.length === 0) return { columns: [], rows: [] };
      const columns = Object.keys(rows[0]);
      return { columns, rows: rows.map((r) => columns.map((c) => r[c])) };
    }
    const info = stmt.run();
    return {
      columns: ['changes', 'lastInsertRowid'],
      rows: [[info.changes, info.lastInsertRowid]],
    };
  }

  getSchema(): SchemaTable[] {
    const tables = this.db
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
      .all() as { name: string }[];

    return tables.map(({ name }) => {
      const columns = this.db
        .prepare(`PRAGMA table_info(${name})`)
        .all() as { name: string; type: string; notnull: number; pk: number }[];
      return { name, columns };
    });
  }
}
