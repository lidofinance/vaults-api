export const waitFor = async (condition: () => boolean, interval = 1000, timeout = 60000): Promise<unknown> => {
  const start = Date.now();
  let attempts = 0;
  return new Promise((resolve, reject) => {
    const check = () => {
      attempts++;
      if (condition()) {
        console.log(`waitFor: condition met after ${attempts} tries`);
        return resolve(undefined);
      }
      if (Date.now() - start > timeout) {
        return reject(new Error(`Timeout after ${attempts} attempts`));
      }
      setTimeout(check, interval);
    };
    check();
  });
};
