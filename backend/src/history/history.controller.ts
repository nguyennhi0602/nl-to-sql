import { Controller, Delete, Get } from '@nestjs/common';
import { HistoryService } from './history.service';

@Controller('api')
export class HistoryController {
  constructor(private readonly historyService: HistoryService) {}

  @Get('history')
  async findAll() {
    return await this.historyService.findAll();
  }

  @Delete('history')
  async deleteAll() {
    const deleted = await this.historyService.deleteAll();
    return { deleted };
  }
}
