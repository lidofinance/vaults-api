import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { getAddress } from '@ethersproject/address';

@Injectable()
export class ToChecksumEthAddressPipe implements PipeTransform {
  // strict = false when the parameter is optional
  constructor(private readonly strict = true) {}

  transform(value: string) {
    if (!this.strict && !value) {
      return undefined;
    }

    try {
      return getAddress(value);
    } catch {
      throw new BadRequestException(`Invalid address: ${value}`);
    }
  }
}
