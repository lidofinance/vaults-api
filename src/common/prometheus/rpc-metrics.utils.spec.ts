import {
  extractRpcErrorCode,
  normalizeConsensusApiPath,
  normalizeRpcProvider,
  toResponseCodeClass,
} from './rpc-metrics.utils';

describe('normalizeRpcProvider', () => {
  it('returns "unknown" for empty input', () => {
    expect(normalizeRpcProvider(undefined)).toBe('unknown');
    expect(normalizeRpcProvider('')).toBe('unknown');
  });

  it('strips protocol, lowercases and collapses to the registrable domain', () => {
    expect(normalizeRpcProvider('https://lb.drpc.org/abc')).toBe('drpc.org');
    expect(normalizeRpcProvider('https://Eth-Mainnet.g.alchemy.com/v2/key')).toBe('alchemy.com');
  });

  it('keeps an IP as-is, including the port', () => {
    expect(normalizeRpcProvider('https://1.2.3.4:8545')).toBe('1.2.3.4:8545');
    expect(normalizeRpcProvider('https://1.2.3.4')).toBe('1.2.3.4');
  });

  it('keeps a bare two-label host intact', () => {
    expect(normalizeRpcProvider('https://rpc.example.com')).toBe('example.com');
  });
});

describe('toResponseCodeClass', () => {
  it('maps a status to its class', () => {
    expect(toResponseCodeClass(200)).toBe('2xx');
    expect(toResponseCodeClass(404)).toBe('4xx');
    expect(toResponseCodeClass(503)).toBe('5xx');
  });

  it('returns an empty string for missing status', () => {
    expect(toResponseCodeClass(undefined)).toBe('');
  });
});

describe('extractRpcErrorCode', () => {
  it('extracts numeric codes', () => {
    expect(extractRpcErrorCode({ code: -32603 })).toBe('-32603');
    expect(extractRpcErrorCode({ code: 32000 })).toBe('32000');
  });

  it('extracts numeric-looking string codes', () => {
    expect(extractRpcErrorCode({ code: '-32603' })).toBe('-32603');
  });

  it('leaves non-RPC ethers string categories blank', () => {
    expect(extractRpcErrorCode({ code: 'SERVER_ERROR' })).toBe('');
    expect(extractRpcErrorCode({})).toBe('');
  });
});

describe('normalizeConsensusApiPath', () => {
  it('replaces dynamic segments with a placeholder', () => {
    expect(normalizeConsensusApiPath('/eth/v1/beacon/states/12345/validators')).toBe(
      '/eth/v1/beacon/states/{id}/validators',
    );
    expect(normalizeConsensusApiPath('/eth/v1/validator/0xabc123')).toBe('/eth/v1/validator/{id}');
  });

  it('keeps low-cardinality beacon ids as-is', () => {
    expect(normalizeConsensusApiPath('/eth/v1/beacon/states/head')).toBe('/eth/v1/beacon/states/head');
    expect(normalizeConsensusApiPath('/eth/v1/beacon/states/finalized')).toBe('/eth/v1/beacon/states/finalized');
  });

  it('drops the query string', () => {
    expect(normalizeConsensusApiPath('/eth/v1/beacon/states/head?foo=bar')).toBe('/eth/v1/beacon/states/head');
  });
});
