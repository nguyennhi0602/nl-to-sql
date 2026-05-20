import { Body, Controller, Get, HttpException, HttpStatus, Post } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ClaudeService } from '../claude/claude.service';
import { HistoryService } from '../history/history.service';
import { AskDto, ExecuteDto } from './query.dto';

@Controller('api')
export class QueryController {
  constructor(
    private readonly db: DatabaseService,
    private readonly claude: ClaudeService,
    private readonly historyService: HistoryService,
  ) {}

  @Get('schema')
  getSchema() {
    return this.db.getSchema();
  }

  @Post('ask')
  async ask(@Body() dto: AskDto) {
    if (!dto?.question?.trim()) {
      throw new HttpException('question is required', HttpStatus.BAD_REQUEST);
    }

    const schema = this.db.getSchema();
    const { sql, explanation } = await this.claude.naturalLanguageToSql(dto.question, schema);

    try {
      const result = this.db.execute(sql);
      try {
        this.historyService.save({
          question: dto.question,
          sql,
          explanation,
          columns: result.columns,
          rows: result.rows,
          error: null,
        });
      } catch (saveErr) {
        console.error('History save failed (success path):', saveErr);
      }
      return { sql, explanation, ...result };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      try {
        this.historyService.save({
          question: dto.question,
          sql,
          explanation,
          columns: [],
          rows: [],
          error: message,
        });
      } catch (saveErr) {
        console.error('History save failed (error path):', saveErr);
      }
      throw new HttpException({ sql, explanation, error: message }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
  }

  @Post('execute')
  execute(@Body() dto: ExecuteDto) {
    if (!dto?.sql?.trim()) {
      throw new HttpException('sql is required', HttpStatus.BAD_REQUEST);
    }
    try {
      return this.db.execute(dto.sql);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw new HttpException({ error: message }, HttpStatus.UNPROCESSABLE_ENTITY);
    }
  }
}
