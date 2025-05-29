export const runInParallelBatches = async <T>(
  items: T[],
  task: (item: T) => Promise<void>,
  batchSize: number,
): Promise<void> => {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    // this.logger.log(`Running parallel batch [${i}–${i + batch.length - 1}]`);
    await Promise.all(batch.map(task));
  }
};
