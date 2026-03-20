import { Module } from '@nestjs/common';
import { DashboardContractFactory } from './dashboard-contract.factory';

@Module({
  providers: [DashboardContractFactory],
  exports: [DashboardContractFactory],
})
export class DashboardContractModule {}
