export interface NetworkConfig {
  contracts: {
    lido: string;
    lidoLocator: string;
  };
  apis: {
    someApiBasePath: string;
  };
}
