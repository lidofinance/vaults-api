export interface NetworkConfig {
  contracts: {
    lido: string;
    lidoLocator: string;
    vaultViewer: string;
  };
  apis: {
    someApiBasePath: string;
  };
}
