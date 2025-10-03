export type SingleFlightKey = string | ((args: any[], ctx: any) => string);

export interface SingleFlightOptions {
  key?: SingleFlightKey;
  log?: boolean;
}

const InFlight = new WeakMap<object, Map<string, Promise<any>>>();

export function SingleFlight(opts: SingleFlightOptions = {}) {
  const { key: keyOpt, log = true } = opts;

  return function <T extends (...a: any[]) => Promise<any>>(
    _target: any,
    propertyKey: string,
    descriptor: TypedPropertyDescriptor<T>,
  ) {
    const original = descriptor.value!;
    const wrapped = function (this: any, ...args: any[]): Promise<any> {
      const key = (typeof keyOpt === 'function' ? keyOpt(args, this) : keyOpt) || propertyKey;

      let map = InFlight.get(this);
      if (!map) {
        map = new Map<string, Promise<any>>();
        InFlight.set(this, map);
      }

      const logger = (this?.logger ?? this?.Logger ?? this?.log) as
        | { log?: (m: any) => void; warn?: (m: any) => void }
        | undefined;

      const existing = map.get(key);
      if (existing) {
        if (log && logger?.warn) logger.warn?.(`[${key}] SingleFlight: already running — joining`);
        // ALWAYS: joiners return the same promise, but do not propagate errors (rejections) to the caller
        return existing.catch(() => undefined);
      }

      if (log && logger?.log) logger.log?.(`[${key}] SingleFlight: started`);

      const p = Promise.resolve()
        .then(() => original.apply(this, args))
        .finally(() => {
          map!.delete(key);
          if (log && logger?.log) logger.log?.(`[${key}] SingleFlight: finished`);
        });

      map.set(key, p);
      return p;
    };

    // cast
    descriptor.value = wrapped as unknown as T;
  };
}
