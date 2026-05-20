import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { HistoryService } from './history.service';
import { HistoryController } from './history.controller';

@Module({
  imports: [DatabaseModule],
  providers: [HistoryService],
  exports: [HistoryService],
  controllers: [HistoryController],
})
export class HistoryModule {}
