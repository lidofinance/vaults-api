import { Injectable, PipeTransform } from '@nestjs/common';
import { getAddress } from '@ethersproject/address';

@Injectable()
export class ToChecksumEthAddressPipe implements PipeTransform {
  transform(value: string) {
    try {
      return getAddress(value);
    } catch {
      return value;
    }
  }
}
