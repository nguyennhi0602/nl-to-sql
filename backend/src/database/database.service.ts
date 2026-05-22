import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createPool } from '@vercel/postgres';
import type { VercelPool } from '@vercel/postgres';
import Database from 'better-sqlite3';
import * as path from 'path';

export interface SchemaTable {
  name: string;
  columns: { name: string; type: string; notnull: number; pk: number }[];
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private db: Database.Database | undefined;
  private pgPool: VercelPool | undefined;

  async onModuleInit() {
    if (process.env.DATABASE_URL) {
      // Postgres path — createPool called inside onModuleInit after DATABASE_URL check (Pitfall 4)
      this.pgPool = createPool({ connectionString: process.env.DATABASE_URL });
      await this.initHistoryPg();
      await this.seedPg();
    } else {
      // SQLite path — local development
      this.db = new Database(path.join(process.cwd(), 'store.db'));
      this.db.pragma('journal_mode = WAL');
      this.initHistorySqlite();
      this.seedSqlite();
    }
  }

  onModuleDestroy() {
    this.db?.close();
    // pgPool has no explicit close needed
  }

  // ---------------------------------------------------------------------------
  // Public API — all methods return Promise<T> on both paths
  // ---------------------------------------------------------------------------

  async query(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: Record<string, unknown>[] }> {
    if (this.pgPool) {
      return this.pgPool.query(sql, params);
    }
    // SQLite path: normalize $N placeholders to ?
    const sqliteSql = sql.replace(/\$\d+/g, '?');
    const stmt = this.db!.prepare(sqliteSql);
    if (stmt.reader) {
      return Promise.resolve({
        rows: stmt.all(...(params ?? [])) as Record<string, unknown>[],
      });
    }
    stmt.run(...(params ?? []));
    return Promise.resolve({ rows: [] });
  }

  async execute(sql: string): Promise<{ columns: string[]; rows: unknown[][] }> {
    if (this.pgPool) {
      const result = await this.pgPool.query(sql);
      const columns = Object.keys(result.rows[0] ?? {});
      const rows = result.rows.map((r) => columns.map((c) => r[c]));
      return { columns, rows };
    }
    // SQLite path — synchronous, wrapped in Promise
    const stmt = this.db!.prepare(sql);
    if (stmt.reader) {
      const rows = stmt.all() as Record<string, unknown>[];
      if (rows.length === 0) return Promise.resolve({ columns: [], rows: [] });
      const columns = Object.keys(rows[0]);
      return Promise.resolve({
        columns,
        rows: rows.map((r) => columns.map((c) => r[c])),
      });
    }
    const info = stmt.run();
    return Promise.resolve({
      columns: ['changes', 'lastInsertRowid'],
      rows: [[info.changes, info.lastInsertRowid]],
    });
  }

  async getSchema(): Promise<SchemaTable[]> {
    if (this.pgPool) {
      const tableResult = await this.pgPool.query<{ table_name: string }>(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
         ORDER BY table_name`,
      );
      const tables = tableResult.rows.map((r) => r.table_name);
      const result: SchemaTable[] = [];
      for (const name of tables) {
        const colResult = await this.pgPool.query<{
          column_name: string;
          data_type: string;
          is_nullable: string;
        }>(
          `SELECT column_name, data_type, is_nullable
           FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = $1
           ORDER BY ordinal_position`,
          [name],
        );
        result.push({
          name,
          columns: colResult.rows.map((c) => ({
            name: c.column_name,
            type: c.data_type,
            notnull: c.is_nullable === 'NO' ? 1 : 0,
            pk: 0, // information_schema does not expose pk directly
          })),
        });
      }
      return result;
    }
    // SQLite path — synchronous, wrapped in Promise
    const tables = this.db!
      .prepare(
        `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
      )
      .all() as { name: string }[];

    return Promise.resolve(
      tables.map(({ name }) => {
        const columns = this.db!.prepare(`PRAGMA table_info(${name})`).all() as {
          name: string;
          type: string;
          notnull: number;
          pk: number;
        }[];
        return { name, columns };
      }),
    );
  }

  // ---------------------------------------------------------------------------
  // Private — SQLite initialization
  // ---------------------------------------------------------------------------

  private seedSqlite() {
    this.db!.exec(`
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

    const alreadySeeded = this.db!.prepare('SELECT COUNT(*) as n FROM customers').get() as {
      n: number;
    };
    if (alreadySeeded.n > 0) return;

    this.db!.exec(`
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

  private initHistorySqlite() {
    this.db!.exec(`
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

  // ---------------------------------------------------------------------------
  // Private — PostgreSQL initialization
  // ---------------------------------------------------------------------------

  private async initHistoryPg() {
    await this.pgPool!.query(`
      CREATE TABLE IF NOT EXISTS query_history (
        id SERIAL PRIMARY KEY,
        question TEXT NOT NULL,
        sql TEXT NOT NULL,
        explanation TEXT NOT NULL DEFAULT '',
        columns TEXT NOT NULL DEFAULT '[]',
        rows TEXT NOT NULL DEFAULT '[]',
        error TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await this.pgPool!.query(
      `CREATE INDEX IF NOT EXISTS idx_query_history_created_at ON query_history (created_at DESC)`,
    );
  }

  private async seedPg() {
    await this.pgPool!.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        city TEXT NOT NULL,
        created_at DATE NOT NULL DEFAULT CURRENT_DATE
      )
    `);
    await this.pgPool!.query(`
      CREATE TABLE IF NOT EXISTS products (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL,
        price FLOAT8 NOT NULL,
        stock INTEGER NOT NULL DEFAULT 0
      )
    `);
    await this.pgPool!.query(`
      CREATE TABLE IF NOT EXISTS orders (
        id SERIAL PRIMARY KEY,
        customer_id INTEGER NOT NULL REFERENCES customers(id),
        status TEXT NOT NULL DEFAULT 'pending',
        total FLOAT8 NOT NULL,
        created_at DATE NOT NULL DEFAULT CURRENT_DATE
      )
    `);
    await this.pgPool!.query(`
      CREATE TABLE IF NOT EXISTS order_items (
        id SERIAL PRIMARY KEY,
        order_id INTEGER NOT NULL REFERENCES orders(id),
        product_id INTEGER NOT NULL REFERENCES products(id),
        quantity INTEGER NOT NULL,
        unit_price FLOAT8 NOT NULL
      )
    `);

    // Seed guard: skip if demo data already present
    const result = await this.pgPool!.query('SELECT COUNT(*) as n FROM customers');
    if (Number(result.rows[0].n) > 0) return;

    // Insert customers
    await this.pgPool!.query(
      `INSERT INTO customers (name, email, city, created_at) VALUES
        ($1, $2, $3, $4),
        ($5, $6, $7, $8),
        ($9, $10, $11, $12),
        ($13, $14, $15, $16),
        ($17, $18, $19, $20),
        ($21, $22, $23, $24),
        ($25, $26, $27, $28),
        ($29, $30, $31, $32)`,
      [
        'Alice Johnson', 'alice@example.com', 'New York', '2024-01-15',
        'Bob Smith', 'bob@example.com', 'Los Angeles', '2024-02-03',
        'Carol White', 'carol@example.com', 'Chicago', '2024-02-20',
        'David Brown', 'david@example.com', 'Houston', '2024-03-10',
        'Eva Martinez', 'eva@example.com', 'New York', '2024-03-25',
        'Frank Lee', 'frank@example.com', 'Seattle', '2024-04-01',
        'Grace Kim', 'grace@example.com', 'Chicago', '2024-04-15',
        'Henry Wilson', 'henry@example.com', 'Los Angeles', '2024-05-05',
      ],
    );

    // Insert products
    await this.pgPool!.query(
      `INSERT INTO products (name, category, price, stock) VALUES
        ($1, $2, $3, $4),
        ($5, $6, $7, $8),
        ($9, $10, $11, $12),
        ($13, $14, $15, $16),
        ($17, $18, $19, $20),
        ($21, $22, $23, $24),
        ($25, $26, $27, $28),
        ($29, $30, $31, $32),
        ($33, $34, $35, $36),
        ($37, $38, $39, $40)`,
      [
        'Wireless Headphones', 'Electronics', 89.99, 150,
        'Running Shoes', 'Sports', 129.99, 80,
        'Coffee Maker', 'Kitchen', 59.99, 200,
        'Python Cookbook', 'Books', 39.99, 300,
        'Yoga Mat', 'Sports', 34.99, 120,
        'Mechanical Keyboard', 'Electronics', 149.99, 60,
        'Air Fryer', 'Kitchen', 99.99, 90,
        'Noise Cancelling Earbuds', 'Electronics', 199.99, 45,
        'Resistance Bands', 'Sports', 24.99, 250,
        'SQL Mastery Book', 'Books', 44.99, 180,
      ],
    );

    // Insert orders
    await this.pgPool!.query(
      `INSERT INTO orders (customer_id, status, total, created_at) VALUES
        ($1, $2, $3, $4),
        ($5, $6, $7, $8),
        ($9, $10, $11, $12),
        ($13, $14, $15, $16),
        ($17, $18, $19, $20),
        ($21, $22, $23, $24),
        ($25, $26, $27, $28),
        ($29, $30, $31, $32),
        ($33, $34, $35, $36),
        ($37, $38, $39, $40)`,
      [
        1, 'delivered', 219.98, '2024-03-01',
        1, 'delivered', 39.99,  '2024-04-10',
        2, 'delivered', 129.99, '2024-03-15',
        3, 'shipped',   249.98, '2024-05-01',
        4, 'pending',   84.98,  '2024-05-10',
        5, 'delivered', 199.99, '2024-04-20',
        6, 'delivered', 149.99, '2024-03-30',
        7, 'shipped',   164.98, '2024-05-08',
        8, 'pending',   59.99,  '2024-05-12',
        2, 'delivered', 44.99,  '2024-04-05',
      ],
    );

    // Insert order_items
    await this.pgPool!.query(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
        ($1, $2, $3, $4),
        ($5, $6, $7, $8),
        ($9, $10, $11, $12),
        ($13, $14, $15, $16),
        ($17, $18, $19, $20),
        ($21, $22, $23, $24),
        ($25, $26, $27, $28),
        ($29, $30, $31, $32),
        ($33, $34, $35, $36),
        ($37, $38, $39, $40),
        ($41, $42, $43, $44),
        ($45, $46, $47, $48),
        ($49, $50, $51, $52),
        ($53, $54, $55, $56)`,
      [
        1, 1, 1, 89.99,   1, 6, 1, 129.99,
        2, 4, 1, 39.99,
        3, 2, 1, 129.99,
        4, 8, 1, 199.99,  4, 5, 1, 49.99,
        5, 5, 1, 34.99,   5, 9, 2, 24.99,
        6, 8, 1, 199.99,
        7, 6, 1, 149.99,
        8, 2, 1, 129.99,  8, 5, 1, 34.99,
        9, 3, 1, 59.99,
        10, 10, 1, 44.99,
      ],
    );
  }
}
