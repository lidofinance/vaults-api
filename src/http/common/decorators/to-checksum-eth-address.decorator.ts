import { Transform } from 'class-transformer';
import { getAddress } from '@ethersproject/address';

export function ToChecksumEthAddress() {
  return Transform(({ value }) => {
    try {
      return getAddress(value);
    } catch {
      return value;
    }
  });
}
