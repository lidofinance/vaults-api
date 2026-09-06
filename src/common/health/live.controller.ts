import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';

import { LIVE_URL } from './health.constants';

@Controller(LIVE_URL)
@ApiExcludeController()
export class LiveController {
  @Get()
  @Header('Cache-Control', 'no-store')
  live() {
    return { status: 'ok' };
  }
}
