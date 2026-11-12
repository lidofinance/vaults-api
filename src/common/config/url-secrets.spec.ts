import { getProviderUrlSecrets, getUrlSecrets } from './url-secrets';

describe('RPC and CL URL credentials extraction', () => {
  it('extracts EL and CL API keys from URL paths and long dRPC query values', () => {
    const elKey = 'fixture-el-key-0123456789';
    const clKey = 'fixture-cl-key-0123456789';
    expect(getProviderUrlSecrets([`https://el.example/v3/${elKey}`])).toContain(elKey);
    expect(getProviderUrlSecrets(`https://cl.example/v1/${clKey},https://lb.drpc.org/ogrpc?network=hoodi&dkey=fixture-drpc-key-0123456789`))
      .toEqual(expect.arrayContaining([clKey, 'fixture-drpc-key-0123456789']));
  });

  it('extracts short values only from named secret query parameters', () => {
    const secrets = getUrlSecrets('https://cl.example/ogrpc?network=hoodi&dkey=short-key&api_key=another-key');
    expect(secrets).toEqual(expect.arrayContaining(['short-key', 'another-key']));
    expect(secrets).not.toContain('hoodi');
  });

  it('extracts userinfo password and derived Basic Authorization token', () => {
    const basic = Buffer.from('client:fixture-password-0123456789').toString('base64');
    const secrets = getUrlSecrets('https://client:fixture-password-0123456789@cl.example/endpoint');
    expect(secrets).toEqual(expect.arrayContaining(['fixture-password-0123456789', 'client:fixture-password-0123456789', basic]));
  });

  it('does not fail on absent values or malformed URLs', () => {
    expect(getProviderUrlSecrets(undefined)).toEqual([]);
    expect(getProviderUrlSecrets('')).toEqual([]);
    expect(getUrlSecrets('not a valid URL')).toEqual(['not a valid URL']);
  });
});
