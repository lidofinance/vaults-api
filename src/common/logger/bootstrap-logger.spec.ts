describe('bootstrap logger RPC/CL credential masking', () => {
  const originalCl = process.env.CL_API_URLS;
  const originalEl = process.env.EL_RPC_URLS;
  let stderrWrite: jest.SpyInstance;

  beforeEach(() => {
    stderrWrite = jest.spyOn(process.stderr, 'write').mockImplementation(() => true);
  });

  afterEach(() => {
    stderrWrite.mockRestore();
    if (originalCl === undefined) delete process.env.CL_API_URLS;
    else process.env.CL_API_URLS = originalCl;
    if (originalEl === undefined) delete process.env.EL_RPC_URLS;
    else process.env.EL_RPC_URLS = originalEl;
  });

  const logWithFreshMask = (message: string): string => {
    // The mask is cached after its first use. Load the module only after
    // setting process.env, as is done during bootstrap.
    let logBootstrapError: (message: string, context: string) => void;
    jest.isolateModules(() => {
      ({ logBootstrapError } = require('./bootstrap-logger'));
    });
    logBootstrapError(message, 'SecurityTest');
    return stderrWrite.mock.calls.map(([chunk]) => String(chunk)).join('');
  };

  it('redacts both EL path keys and CL dkey query credentials', () => {
    const elKey = 'fixture-el-secret-0123456789';
    const clKey = 'fixture-cl-secret-0123456789';
    process.env.EL_RPC_URLS = `https://el.example/v3/${elKey}`;
    process.env.CL_API_URLS = `https://cl.example/ogrpc?network=hoodi&dkey=${clKey}`;

    const output = logWithFreshMask(`EL failed: ${elKey}; CL failed: ${clKey}; network=hoodi`);
    expect(output).not.toContain(elKey);
    expect(output).not.toContain(clKey);
    expect(output).toContain('network=hoodi');
  });

  it('redacts derived Basic Auth credentials from CL URLs', () => {
    const password = 'fixture-password-0123456789';
    const token = Buffer.from(`client:${password}`).toString('base64');
    process.env.CL_API_URLS = `https://client:${password}@cl.example/endpoint`;
    process.env.EL_RPC_URLS = 'https://el.example/endpoint';

    const output = logWithFreshMask(`Authorization: Basic ${token}; password=${password}`);
    expect(output).not.toContain(password);
    expect(output).not.toContain(token);
  });
});
