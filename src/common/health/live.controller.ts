import { Controller, Get, Header } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { LIVE_URL } from './health.constants';

import { SkipCache } from '../decorators';

@Controller(LIVE_URL)
@ApiExcludeController()
@SkipThrottle()
@SkipCache()
export class LiveController {
  @Get()
  @Header('Cache-Control', 'no-store')
  live() {
    return { status: 'ok', uptime: Math.floor(process.uptime()) };
  }
}
