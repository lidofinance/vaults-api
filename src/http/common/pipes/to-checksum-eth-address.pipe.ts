import { BadRequestException, Injectable, PipeTransform } from '@nestjs/common';
import { getAddress } from '@ethersproject/address';

@Injectable()
export class ToChecksumEthAddressPipe implements PipeTransform {
  // use `new ToChecksumEthAddressPipe()` - when the parameter is mandatory
  // use `new ToChecksumEthAddressPipe(false)` - when the parameter is optional
  constructor(private readonly strict = true) {}

  transform(value: string) {
    if (!this.strict && !value) {
      // if the parameter is optional
      return undefined;
    }

    try {
      return getAddress(value);
    } catch {
      throw new BadRequestException(`Address must be an Ethereum address: ${value}`);
    }
  }
}
