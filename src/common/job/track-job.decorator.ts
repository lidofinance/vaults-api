enum TaskStatus {
  COMPLETE = 'complete',
  ERROR = 'error',
}

export function TrackJob(name: string) {
  return (target: any, propertyKey: string, descriptor: PropertyDescriptor) => {
    const originalValue = descriptor.value;

    descriptor.value = function (...args) {
      // "this" here will refer to the class instance
      if (!this.prometheusService)
        throw Error(`'${this.constructor.name}' class object must contain 'prometheusService' property`);
      const stop = this.prometheusService.jobDuration.startTimer({
        name: name,
      });
      this.logger.debug(`Task '${name}' in progress`);
      return originalValue
        .apply(this, args)
        .then((r) => {
          this.prometheusService.jobCount.inc({
            name: name,
            status: TaskStatus.COMPLETE,
          });
          return r;
        })
        .catch((e) => {
          this.logger.error(`Task '${name}' ended with an error`, e.stack);
          this.prometheusService.jobCount.inc({
            name: name,
            status: TaskStatus.ERROR,
          });
          throw e;
        })
        .finally(() => {
          const duration = stop();
          const used = process.memoryUsage().heapUsed / 1024 / 1024;
          this.logger.debug(`Task '${name}' is complete. Used MB: ${used}. Duration: ${duration}`);
        });
    };
  };
}
