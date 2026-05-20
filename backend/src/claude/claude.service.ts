import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { SchemaTable } from '../database/database.service';

@Injectable()
export class ClaudeService {
  private client: Groq;

  constructor(private config: ConfigService) {
    this.client = new Groq({
      apiKey: this.config.get<string>('GROQ_API_KEY'),
    });
  }

  async naturalLanguageToSql(
    question: string,
    schema: SchemaTable[],
  ): Promise<{ sql: string; explanation: string }> {
    const schemaText = schema
      .map(
        (t) =>
          `Table: ${t.name}\n  Columns: ${t.columns.map((c) => `${c.name} (${c.type}${c.pk ? ', PRIMARY KEY' : ''}${c.notnull ? ', NOT NULL' : ''})`).join(', ')}`,
      )
      .join('\n\n');

    const systemPrompt = `You are a SQL expert assistant. Convert natural language questions into SQLite SQL queries.

Database schema:
${schemaText}

Rules:
- Return ONLY valid SQLite SQL — no markdown, no code fences, no prose.
- Use lowercase SQL keywords.
- Always use table aliases for readability in JOINs.
- Prefer readable column aliases (e.g. "customer_name" instead of "c.name").
- End your response with: ---EXPLANATION--- followed by a one-sentence plain-English explanation of what the query does.`;

    const completion = await this.client.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 1024,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: question },
      ],
    });

    const raw = completion.choices[0].message.content?.trim() ?? '';
    const parts = raw.split('---EXPLANATION---');
    const sql = parts[0].trim();
    const explanation = parts[1]?.trim() ?? '';

    return { sql, explanation };
  }
}
