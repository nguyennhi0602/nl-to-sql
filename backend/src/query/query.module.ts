import { Module } from '@nestjs/common';
import { QueryController } from './query.controller';
import { DatabaseModule } from '../database/database.module';
import { ClaudeModule } from '../claude/claude.module';
import { HistoryModule } from '../history/history.module';

@Module({
  imports: [DatabaseModule, ClaudeModule, HistoryModule],
  controllers: [QueryController],
})
export class QueryModule {}
