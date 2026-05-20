import { Controller, Delete, Get } from '@nestjs/common';
import { HistoryService } from './history.service';

@Controller('api')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get('history')
  findAll() {
    return this.historyService.findAll();
  }

  @Delete('history')
  deleteAll() {
    const deleted = this.historyService.deleteAll();
    return { deleted };
  }
}
