import { InsurerConnector, ConnectorCredentials, TestConnectionResult } from './types';
import { SuraConnector } from './sura';
import { logger } from '../lib/logger';

export class ConnectorEngine {
  private static instance: ConnectorEngine;
  private connectors: Map<string, InsurerConnector> = new Map();

  private constructor() {
    this.registerConnector(new SuraConnector());
    // Register more connectors here as they are built:
    // this.registerConnector(new BolivarConnector());
    // this.registerConnector(new AllianzConnector());
    // this.registerConnector(new MapfreConnector());
    // this.registerConnector(new LibertySegurosConnector());
    // this.registerConnector(new ColpatriaConnector());
    // this.registerConnector(new PrevissoraConnector());
    // this.registerConnector(new HdiConnector());
    // this.registerConnector(new MundialConnector());
    // this.registerConnector(new EstadoConnector());
    // this.registerConnector(new EquidadConnector());
    // this.registerConnector(new SolidariaConnector());
    // this.registerConnector(new SbsConnector());
    // this.registerConnector(new ZurichConnector());
  }

  static getInstance(): ConnectorEngine {
    if (!ConnectorEngine.instance) {
      ConnectorEngine.instance = new ConnectorEngine();
    }
    return ConnectorEngine.instance;
  }

  registerConnector(connector: InsurerConnector) {
    this.connectors.set(connector.slug, connector);
    logger.info(`Connector registered: ${connector.slug} (${connector.name})`);
  }

  getConnector(slug: string): InsurerConnector | undefined {
    return this.connectors.get(slug);
  }

  listConnectors(): { slug: string; name: string }[] {
    return Array.from(this.connectors.values()).map((c) => ({
      slug: c.slug,
      name: c.name,
    }));
  }

  async testConnection(
    slug: string,
    credentials: ConnectorCredentials
  ): Promise<TestConnectionResult> {
    const connector = this.connectors.get(slug);
    if (!connector) {
      return { success: false, error: `No existe conector para: ${slug}` };
    }

    try {
      return await connector.testConnection(credentials);
    } catch (error: any) {
      logger.error(`Test connection failed for ${slug}:`, error);
      return { success: false, error: error.message || 'Error desconocido' };
    }
  }
}
