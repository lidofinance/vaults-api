import { PrometheusController as PrometheusControllerSource } from '@willsoto/nestjs-prometheus';
import { Controller } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { SkipCache } from 'common/decorators';

@Controller()
@ApiExcludeController()
@SkipThrottle()
@SkipCache()
export class PrometheusController extends PrometheusControllerSource {}
