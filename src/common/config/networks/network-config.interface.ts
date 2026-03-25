export interface NetworkConfig {
  contracts: {
    lido: string;
    lidoLocator: string;
    vaultViewer: string;
    multicall3: string;
  };
  apis: {
    someApiBasePath: string;
  };
}
