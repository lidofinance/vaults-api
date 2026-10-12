import {
  extractRpcErrorCode,
  normalizeRpcProvider,
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
