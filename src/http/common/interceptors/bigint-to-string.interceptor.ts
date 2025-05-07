import { Observable, map } from 'rxjs';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';

@Injectable()
export class BigIntToStringInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(map((data) => this.serialize(data)));
  }

  private serialize(obj: any): any {
    if (typeof obj === 'bigint') return obj.toString();
    if (Array.isArray(obj)) return obj.map((item) => this.serialize(item));
    if (obj !== null && typeof obj === 'object') {
      return Object.fromEntries(Object.entries(obj).map(([key, val]) => [key, this.serialize(val)]));
    }
    return obj;
  }
}
