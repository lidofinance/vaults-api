export const vaultsOverviewExample = {
  tvlWei: '123456789012345678901234',
  totalVaults: 10,
  updatedAt: '2026-01-01T12:34:56.000Z',
};

export const vaultExample = {
  "address": "0x7228FC874C1D08cAE68a558d7B650fc4862B1DB7",
  "ens": null,
  "customName": null,
  "totalValue": "65067839043411226337",
  "liabilityStETH": "3002027513547902260",
  "liabilityShares": "3000000000000000000",
  "healthFactor": "1777.3197538932493",
  "shareLimit": "500000000000000000000",
  "reserveRatioBP": 2000,
  "forcedRebalanceThresholdBP": 1800,
  "infraFeeBP": 500,
  "liquidityFeeBP": 400,
  "reservationFeeBP": 100,
  "nodeOperatorFeeRate": "100",
  "updatedAt": "2025-07-08T08:49:04.511Z",
  "blockNumber": 761353,
  "isReportFresh": true,
  "isQuarantineActive": false,
  "quarantinePendingTotalValueIncrease": "0",
  "quarantineStartTimestamp": 0,
  "quarantineEndTimestamp": 0,
  "rebaseReward": 17111723808928,
  "grossStakingRewards": "382803000000000",
  "nodeOperatorRewards": "3828030000000",
  "dailyLidoFees": "10462204117321",
  "netStakingRewards": "368512765882679",
  "grossStakingAprPercent": 2.01408086659,
  "netStakingAprPercent": 1.93889418541,
  "bottomLine": "351401042073751",
  "carrySpreadAprPercent": 1.84886250981,
  "grossStakingAprSma": 1.3199419416942109,
  "netStakingAprSma": 0.7468657897526315,
  "carrySpreadAprSma": 0.7468657897526315,
  "lastReport": {
    "fee": "795605196857045",
    "inOutDelta": "65019709677226272543",
    "totalValueWei": "65045881277226272543",
    "liabilityShares": "3000000000000000000",
    "slashingReserve": "0"
  }
}

export const vaultsExample = {
  "nextUpdateAt": "2025-07-08T15:00:00.000Z",
  "lastReportMeta": {
    "cid": "QmeBTR7BbfAHUKoEnQVYsyyCZo8Qk6vLeAVj8Sxw15ix9e",
    "refSlot": 762047,
    "blockNumber": 713892,
    "timestamp": 1751357964
  },
  "total": 2,
  "data": [vaultExample, vaultExample]
};

export const vaultLatestMetricsExample = {
  "rebaseReward": 8620052069287,
  "grossStakingRewards": "190180000000000",
  "nodeOperatorRewards": "1901800000000",
  "dailyLidoFees": "5404649809954",
  "netStakingRewards": "182873550190046",
  "grossStakingAprPercent": 2.00173300708,
  "netStakingAprPercent": 1.9248292225099999,
  "bottomLine": "174253498120759",
  "carrySpreadAprPercent": 1.83409916283,
  "updatedAt": "2025-07-01T09:05:01.036Z"
};

export const vaultLatestMetricsRangeExample = [
  {
    "rebaseReward": 91045487192767,
    "grossStakingRewards": "180669000000000",
    "nodeOperatorRewards": "1806690000000",
    "dailyLidoFees": "5360615224230",
    "netStakingRewards": "173501694775770",
    "grossStakingAprPercent": 1.89542624499,
    "netStakingAprPercent": 1.82023294438,
    "bottomLine": "82456207583003",
    "carrySpreadAprPercent": 0.86506074598,
    "updatedAt": "2025-08-13T20:44:52.574Z",
    "blockNumber": 1000360,
    "timestamp": 1755113484,
    "reportCid": "QmS4GrsfDBkFVggKj4Fn7zWLrDb9SgRjNz2GfmMJxrWnU5"
  },
  {
    "rebaseReward": 12515272803860,
    "grossStakingRewards": "355431000000000",
    "nodeOperatorRewards": "3554310000000",
    "dailyLidoFees": "38457404424114",
    "netStakingRewards": "313419285575886",
    "grossStakingAprPercent": 1.86444828376,
    "netStakingAprPercent": 1.64407170193,
    "bottomLine": "300904012772026",
    "carrySpreadAprPercent": 1.57842160698,
    "updatedAt": "2025-08-13T20:44:51.873Z",
    "blockNumber": 1000009,
    "timestamp": 1755108876,
    "reportCid": "QmczZwXmYg6aZaZuXMxrPbomE98PkNRoXieByjJH28oWej"
  },
];
