import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { HistoryService } from './history.service';

@Module({
  imports: [DatabaseModule],
  providers: [HistoryService],
  exports: [HistoryService],
})
export class HistoryModule {}
