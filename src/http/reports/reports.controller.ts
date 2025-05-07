import { Controller, Get, Param, Version, ClassSerializerInterceptor, UseInterceptors } from '@nestjs/common';
import { Inject, LoggerService } from '@nestjs/common';
import { ApiResponse, ApiTags } from '@nestjs/swagger';
import { BadRequestException } from '@nestjs/common';
import { LOGGER_PROVIDER } from '@lido-nestjs/logger';

import { fetchAndVerifyFile } from '@lidofinance/lsv-cli/dist/utils/ipfs';
import { getVaultReport, getVaultReportProofByCid } from '@lidofinance/lsv-cli/dist/utils/report';

import { LsvService } from 'lsv/lsv.service';
import { VaultHubContractService } from 'common/contracts/modules/vault-hub-contract/vault-hub-contract.service';
import { ConfigService } from 'common/config';

import { ReportParamsDto } from './dto';
import { reportByVaultExample } from './example';

function bigintToString(obj: any): any {
  if (typeof obj === 'bigint') return obj.toString();
  if (Array.isArray(obj)) return obj.map(bigintToString);
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(Object.entries(obj).map(([key, val]) => [key, bigintToString(val)]));
  }
  return obj;
}

@Controller('report')
@ApiTags('Reports')
@UseInterceptors(ClassSerializerInterceptor)
export class ReportsController {
  constructor(
    @Inject(LOGGER_PROVIDER) protected readonly logger: LoggerService,
    protected readonly configService: ConfigService,
    private readonly lsvService: LsvService,
    private readonly vaultHubService: VaultHubContractService,
  ) {}

  @Version('1')
  @Get('/last/:vaultAddress')
  @ApiResponse({
    status: 200,
    description: 'Last report data for a vault',
    schema: {
      example: reportByVaultExample,
    },
  })
  async getLast(@Param() params: ReportParamsDto) {
    const vault = params.vaultAddress;

    const latestReportData = await this.vaultHubService.getLatestReportData();

    try {
      // TODO: disable logger inside fetchAndVerifyFile
      await fetchAndVerifyFile(latestReportData.reportCid, this.configService.get('IPFS_GATEWAY'));
    } catch (error) {
      this.logger.error(`Failed to verify report CID: ${error.message}`);
      throw new BadRequestException(`Failed to verify report!`);
    }

    const vaultReport = await getVaultReport(vault, latestReportData.reportCid, this.configService.get('IPFS_GATEWAY'));
    const reportProof = await getVaultReportProofByCid(
      vault,
      vaultReport.proofsCID,
      this.configService.get('IPFS_GATEWAY'),
    );

    try {
      // TODO: disable logger inside fetchAndVerifyFile
      await fetchAndVerifyFile(vaultReport.proofsCID, this.configService.get('IPFS_GATEWAY'));
    } catch (error) {
      this.logger.error(`Failed to verify report proofsCID: ${error.message}`);
      throw new BadRequestException(`Failed to verify report!`);
    }

    // TODO: response can be changed
    return {
      vaultReport,
      reportProof: bigintToString(reportProof),
    };
  }

  @Version('1')
  @Get('/previous/:vaultAddress')
  @ApiResponse({
    status: 200,
    description: 'Previous report data for a vault',
    schema: {
      example: reportByVaultExample,
    },
  })
  async getPrevious(@Param() params: ReportParamsDto) {
    const vault = params.vaultAddress;

    const latestReportData = await this.vaultHubService.getLatestReportData();

    const lastVaultReport = await getVaultReport(
      vault,
      latestReportData.reportCid,
      this.configService.get('IPFS_GATEWAY'),
    );
    if (!lastVaultReport.prevTreeCID) {
      throw new BadRequestException(`Previous report CID not found in the latest report`);
    }

    const prevVaultReport = await getVaultReport(
      vault,
      lastVaultReport.prevTreeCID,
      this.configService.get('IPFS_GATEWAY'),
    );

    const reportProof = await getVaultReportProofByCid(
      vault,
      prevVaultReport.proofsCID,
      this.configService.get('IPFS_GATEWAY'),
    );

    try {
      // TODO: disable logger inside fetchAndVerifyFile
      await fetchAndVerifyFile(prevVaultReport.proofsCID, this.configService.get('IPFS_GATEWAY'));
    } catch (error) {
      this.logger.error(`Failed to verify report proofsCID: ${error.message}`);
      throw new BadRequestException(`Failed to verify report!`);
    }

    // TODO: response can be changed
    return {
      vaultReport: prevVaultReport,
      reportProof: bigintToString(reportProof),
    };
  }
}
