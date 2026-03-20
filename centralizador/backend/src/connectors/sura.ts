import {
  InsurerConnector,
  ConnectorCredentials,
  ConnectorSession,
  TestConnectionResult,
  NormalizedPolicy,
  NormalizedClient,
  NormalizedPayment,
  NormalizedCommission,
  SyncResult,
  PaginatedFetchOptions,
} from './types';
import { logger } from '../lib/logger';

const SURA_API = 'https://apiasistentevirtualasesores.sura.com';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

interface SuraSession extends ConnectorSession {
  cookieString: string;
  codigoAsesor: string;
  userName: string;
}

export class SuraConnector implements InsurerConnector {
  readonly slug = 'sura';
  readonly name = 'Seguros SURA';

  // ═══════════════════════════════════════════════════════════
  // AUTH: Cookie-paste mode
  // User logs into SURA portal in browser, copies cookies, pastes them here.
  // The SAML SSO login cannot be done from Node.js because Incapsula WAF
  // blocks non-browser TLS fingerprints on seus.sura.com.
  // ═══════════════════════════════════════════════════════════
  async login(credentials: ConnectorCredentials): Promise<SuraSession> {
    const { extraConfig } = credentials;
    const cookieString = extraConfig?.cookies || '';

    if (!cookieString) {
      throw new Error('Se requieren cookies de sesión SURA. Inicia sesión en el portal SURA desde tu navegador y pega las cookies.');
    }

    // Parse cookie string: supports both "key=value; key2=value2" format
    // and Chrome DevTools table format (name\tvalue\n per line)
    const parsedCookies = this.parseCookieInput(cookieString);
    if (!parsedCookies) {
      throw new Error('Formato de cookies inválido. Pega las cookies en formato "nombre=valor; nombre2=valor2".');
    }

    // Validate session with identity
    const identity = await this.suraGet('/home/users/identity', parsedCookies);
    if (!identity.success) {
      throw new Error('Las cookies no son válidas o la sesión expiró. Inicia sesión de nuevo en el portal SURA.');
    }

    const userName = identity.data?.userName || '';
    const fullName = (identity.data?.fullName || 'SURA Asesor').trim();
    const codigoAsesor = await this.extractAgentCode(parsedCookies, userName);

    logger.info(`SURA cookie login OK: ${fullName}, agent ${codigoAsesor}`);

    return {
      cookieString: parsedCookies,
      codigoAsesor,
      userName: fullName,
    };
  }

  // ─── TEST CONNECTION ────────────────────────────────────
  async testConnection(credentials: ConnectorCredentials): Promise<TestConnectionResult> {
    try {
      const session = await this.login(credentials);

      // Validate with a polizas test call
      const testResult = await this.suraFetchPolizas(session.cookieString, session.codigoAsesor, 1, 1);
      if (!testResult.success) {
        return { success: false, error: 'Cookies válidas pero no se pudo consultar pólizas' };
      }

      return {
        success: true,
        sessionData: {
          cookieString: session.cookieString,
          codigoAsesor: session.codigoAsesor,
          userName: session.userName,
        },
        userInfo: {
          name: session.userName,
          code: session.codigoAsesor,
          totalPolizas: testResult.data?.totalRegistros || 0,
        },
      };
    } catch (error: any) {
      logger.error('SURA test connection failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  // ─── FETCH POLICIES ─────────────────────────────────────
  async fetchPolicies(
    session: ConnectorSession,
    _credentials: ConnectorCredentials,
    options?: PaginatedFetchOptions
  ): Promise<{ policies: NormalizedPolicy[]; total: number }> {
    const s = session as SuraSession;
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 50;

    const result = await this.suraFetchPolizas(s.cookieString, s.codigoAsesor, page, pageSize);
    if (!result.success) throw new Error(`SURA polizas fetch failed: ${result.error}`);

    const policies = (result.data?.polizas || []).map((p: any) => this.normalizePolicy(p));
    return { policies, total: result.data?.totalRegistros || 0 };
  }

  // ─── FETCH CLIENTS ──────────────────────────────────────
  async fetchClients(
    session: ConnectorSession,
    _credentials: ConnectorCredentials,
    options?: PaginatedFetchOptions
  ): Promise<{ clients: NormalizedClient[]; total: number }> {
    const s = session as SuraSession;
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 50;

    const result = await this.suraFetchClientes(s.cookieString, s.codigoAsesor, page, pageSize);
    if (!result.success) throw new Error(`SURA clientes fetch failed: ${result.error}`);

    const clients = (result.data?.clientes || []).map((c: any) => this.normalizeClient(c));
    return { clients, total: result.data?.totalRegistros || 0 };
  }

  // ─── FETCH PAYMENTS (from pending receipts) ─────────────
  async fetchPayments(
    session: ConnectorSession,
    _credentials: ConnectorCredentials,
    policyNumber?: string
  ): Promise<NormalizedPayment[]> {
    const s = session as SuraSession;
    if (!policyNumber) return [];

    const result = await this.suraPost(
      '/ohs-aseguramiento/polizas/recibos_pendientes',
      s.cookieString,
      { numeroPoliza: policyNumber },
      '/polizas'
    );
    if (!result.success) return [];

    const recibos = result.data?.recibos || result.data || [];
    if (!Array.isArray(recibos)) return [];
    return recibos.map((r: any, idx: number) => this.normalizePayment(r, policyNumber, idx));
  }

  // ─── FULL SYNC ──────────────────────────────────────────
  async fullSync(
    session: ConnectorSession,
    credentials: ConnectorCredentials,
    onProgress?: (message: string, current: number, total: number) => void
  ): Promise<SyncResult> {
    const result: SyncResult = {
      policies: [],
      clients: [],
      payments: [],
      commissions: [],
      errors: [],
    };

    try {
      const s = session as SuraSession;

      // Phase 1: Fetch policy listing (all pages)
      onProgress?.('Descargando listado de pólizas...', 0, 100);
      const rawPolizas: any[] = [];
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages && page <= 20) {
        const { policies, total } = await this.fetchPolicies(session, credentials, { page, pageSize: 50 });
        for (const p of policies) rawPolizas.push(p.rawData);
        totalPages = Math.ceil(total / 50);
        onProgress?.(`Listado pólizas: página ${page}/${totalPages}`, page, totalPages);
        page++;
        await this.delay(500);
      }

      // Phase 2: Fetch detail for each póliza
      const totalPolizas = rawPolizas.length;
      onProgress?.(`Descargando detalle de ${totalPolizas} pólizas...`, 0, totalPolizas);

      for (let i = 0; i < rawPolizas.length; i++) {
        const raw = rawPolizas[i];
        const polNum = raw.numeroContratoPrincipal || raw.numeroContrato;

        try {
          const detail = await this.suraFetchPolizaDetail(s.cookieString, s.codigoAsesor, raw);
          if (detail.success && detail.data) {
            // Merge listing + detail into normalized policy
            result.policies.push(this.normalizePolicy(raw, detail.data));
          } else {
            // Fallback: use listing data only
            result.policies.push(this.normalizePolicy(raw));
            if (detail.error) {
              logger.warn(`SURA detail failed for ${polNum}: ${detail.error}`);
            }
          }
        } catch (err: any) {
          result.policies.push(this.normalizePolicy(raw));
          logger.warn(`SURA detail error for ${polNum}: ${err.message}`);
        }

        if ((i + 1) % 5 === 0 || i === rawPolizas.length - 1) {
          onProgress?.(`Detalle pólizas: ${i + 1}/${totalPolizas}`, i + 1, totalPolizas);
        }
        await this.delay(300);
      }

      // Phase 3: Fetch clients (all pages)
      onProgress?.('Descargando clientes...', 0, 100);
      page = 1;
      totalPages = 1;

      while (page <= totalPages && page <= 20) {
        const { clients, total } = await this.fetchClients(session, credentials, { page, pageSize: 50 });
        result.clients.push(...clients);
        totalPages = Math.ceil(total / 50);
        onProgress?.(`Clientes: página ${page}/${totalPages}`, page, totalPages);
        page++;
        await this.delay(500);
      }

      logger.info(`SURA full sync completed: ${result.policies.length} policies, ${result.clients.length} clients`);
    } catch (error: any) {
      result.errors.push(error.message);
      logger.error('SURA full sync error:', error);
    }

    return result;
  }

  // ═══════════════════════════════════════════════════════════
  // Cookie parser: supports multiple input formats
  // - Standard: "name=value; name2=value2"
  // - document.cookie format: "name=value; name2=value2"
  // - Chrome DevTools table format (tab-separated name\tvalue per line)
  // ═══════════════════════════════════════════════════════════
  private parseCookieInput(input: string): string | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Check if it's Chrome DevTools table format (tab-separated lines)
    if (trimmed.includes('\t')) {
      const cookies: string[] = [];
      for (const line of trimmed.split('\n')) {
        const parts = line.split('\t');
        if (parts.length >= 2) {
          const name = parts[0].trim();
          const value = parts[1].trim();
          if (name && !name.startsWith('#')) {
            cookies.push(`${name}=${value}`);
          }
        }
      }
      if (cookies.length > 0) return cookies.join('; ');
    }

    // Standard cookie string format
    // Validate it has at least one "name=value" pair
    if (trimmed.includes('=')) {
      return trimmed;
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════
  // SURA API helpers (exact match to PHP SuraScraperController)
  // ═══════════════════════════════════════════════════════════
  private async suraGet(endpoint: string, cookieString: string): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch(`${SURA_API}${endpoint}`, {
        headers: this.suraHeaders(cookieString),
      });
      if (res.ok) {
        const data = await res.json();
        return { success: true, data };
      }
      return { success: false, error: `HTTP ${res.status}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  private async suraPost(endpoint: string, cookieString: string, body: any, relayState: string = ''): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const res = await fetch(`${SURA_API}${endpoint}`, {
        method: 'POST',
        headers: this.suraHeaders(cookieString, relayState),
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        return { success: true, data };
      }
      const errBody = await res.text().catch(() => '');
      return { success: false, error: `HTTP ${res.status}: ${errBody.substring(0, 200)}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  private suraHeaders(cookieString: string, relayState: string = ''): Record<string, string> {
    return {
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      'Cookie': cookieString,
      'Origin': 'https://asistentevirtualasesores.sura.com',
      'Referer': 'https://asistentevirtualasesores.sura.com/',
      'User-Agent': UA,
      'X-APP-RELAYSTATE': relayState,
    };
  }

  private async suraFetchPolizas(cookieString: string, codigoAsesor: string, page: number, perPage: number): Promise<{ success: boolean; data?: any; error?: string }> {
    return this.suraPost('/ohs-mercadeo/polizas', cookieString, {
      codigoAsesor,
      estadoPoliza: 'VIGENTES',
      consultaEps: null,
      filtrosOpcionales: [],
      paginacion: { pagina: String(page), registros: String(perPage) },
    }, '/polizas');
  }

  private async suraFetchClientes(cookieString: string, codigoAsesor: string, page: number, perPage: number): Promise<{ success: boolean; data?: any; error?: string }> {
    return this.suraPost('/ohs-mercadeo/clientes', cookieString, {
      dniCliente: '',
      paginacion: { pagina: String(page), registros: String(perPage) },
      codigoAsesor,
      consultaEps: null,
      codigoRamo: '',
    }, '/clientes');
  }

  // ─── POLICY DETAIL (per-ramo endpoints) ───────────────
  // Tested against live SURA API — only endpoints that return 200 are included.
  // bodyType: 'aseg' = ohs-aseguramiento (needs full polNum + codigoRol)
  //           'oracle' = ohs-oracle (needs short polNum + codigoAsesor)
  private static readonly RAMO_DETAIL_MAP: Record<string, { endpoint: string; slug: string; bodyType: 'aseg' | 'oracle' }> = {
    // Automóviles
    '040': { endpoint: '/ohs-aseguramiento/polizas/autos', slug: 'autos', bodyType: 'aseg' },
    // SOAT (uses autos endpoint — oracle /soat needs codigoRamo which we don't have reliably)
    '041': { endpoint: '/ohs-aseguramiento/polizas/autos', slug: 'autos', bodyType: 'aseg' },
    // Cumplimiento
    '012': { endpoint: '/ohs-oracle/polizas/cumplimiento', slug: 'cumplimiento', bodyType: 'oracle' },
    // Responsabilidad Civil → cumplimiento
    '013': { endpoint: '/ohs-oracle/polizas/cumplimiento', slug: 'cumplimiento', bodyType: 'oracle' },
    // HogarSura → empresariales (aseg)
    '028': { endpoint: '/ohs-aseguramiento/polizas/empresariales', slug: 'empresariales', bodyType: 'aseg' },
    // Incendio → empresariales
    '030': { endpoint: '/ohs-aseguramiento/polizas/empresariales', slug: 'empresariales', bodyType: 'aseg' },
    // Vida Individual (nested response: informacionBasicaPoliza, tomador[], primas{}, amparos[])
    '081': { endpoint: '/ohs-aseguramiento/polizas/vidaindividual', slug: 'vidaindividual', bodyType: 'aseg' },
    // Vida Grupo
    '083': { endpoint: '/ohs-aseguramiento/polizas/vidagrupo', slug: 'vidagrupo', bodyType: 'aseg' },
    // Juveniles
    '085': { endpoint: '/ohs-oracle/polizas/juveniles', slug: 'juveniles', bodyType: 'oracle' },
    // Exequiales
    '086': { endpoint: '/ohs-aseguramiento/polizas/exequiales', slug: 'exequiales', bodyType: 'aseg' },
    // Salud Familiar (tomador endpoint for collective; individual uses afiliado_asegurado)
    '090': { endpoint: '/ohs-aseguramiento/polizas/salud/tomador', slug: 'salud', bodyType: 'aseg' },
    // MasVida
    '181': { endpoint: '/ohs-aseguramiento/polizas/masvida', slug: 'masvida', bodyType: 'aseg' },
    // Renta / Educación
    '196': { endpoint: '/ohs-oracle/polizas/renta-educacion', slug: 'renta-educacion', bodyType: 'oracle' },
  };

  private async suraFetchPolizaDetail(
    cookieString: string,
    codigoAsesor: string,
    poliza: any
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    const ramoCode = (poliza.codigoRamo || '').trim();
    const mapping = SuraConnector.RAMO_DETAIL_MAP[ramoCode];
    if (!mapping) {
      return { success: false, error: `Ramo sin endpoint de detalle: ${ramoCode} ${poliza.nombreRamo || ''}` };
    }

    let body: Record<string, string>;
    if (mapping.bodyType === 'oracle') {
      // Oracle endpoints need short policy number + codigoAsesor
      body = {
        numeroPoliza: poliza.numeroContrato,
        codigoAsesor,
      };
    } else {
      // Aseguramiento endpoints need full policy number + codigoRol
      const fullNum = poliza.numeroContratoPrincipal || poliza.numeroContrato;
      body = {
        numeroPolizaPrincipal: fullNum,
        numeroPoliza: fullNum,
        codigoRol: poliza.codigoRol || '100',
      };
      if (poliza.fechaFinVigencia) {
        body.fechaFinVigencia = poliza.fechaFinVigencia;
      }
    }

    const result = await this.suraPost(mapping.endpoint, cookieString, body, `/polizas/${mapping.slug}`);

    // For oracle endpoints, also fetch coberturas from separate endpoint
    if (result.success && result.data && mapping.bodyType === 'oracle') {
      try {
        const cobRes = await this.suraPost(
          `${mapping.endpoint}/coberturas`,
          cookieString,
          body,
          `/polizas/${mapping.slug}`
        );
        if (cobRes.success && cobRes.data) {
          result.data._coberturas = cobRes.data.coberturas || cobRes.data;
        }
      } catch { /* coberturas optional */ }
    }

    // Also fetch recibos pendientes (works for all ramos)
    if (result.success && result.data) {
      try {
        const recibosRes = await this.suraPost(
          '/ohs-aseguramiento/polizas/recibos_pendientes',
          cookieString,
          { numeroPoliza: poliza.numeroContratoPrincipal || poliza.numeroContrato },
          '/polizas'
        );
        if (recibosRes.success && recibosRes.data) {
          result.data._recibos_pendientes = Array.isArray(recibosRes.data) ? recibosRes.data : (recibosRes.data.recibos || []);
        }
      } catch { /* recibos optional */ }
    }

    return result;
  }

  private async extractAgentCode(cookieString: string, userName: string): Promise<string> {
    // Try KAgente cookie (base64 encoded)
    const kMatch = cookieString.match(/KAgente=([^;]+)/);
    if (kMatch) {
      const decoded = Buffer.from(kMatch[1], 'base64').toString();
      if (/^\d+$/.test(decoded)) return decoded;
    }

    // Fallback: call API
    if (userName) {
      const res = await this.suraPost('/ohs-redcomercial/asesores/codigos', cookieString, { assessorId: userName });
      if (res.success && Array.isArray(res.data) && res.data[0]?.codigoAsesor) {
        return res.data[0].codigoAsesor;
      }
    }

    return '';
  }

  // ─── NORMALIZE HELPERS ──────────────────────────────────
  private parseSuraMoney(val: any): number | undefined {
    if (val === null || val === undefined || val === '') return undefined;
    const s = String(val).replace(/[$\s]/g, '').replace(/,/g, '');
    const n = parseFloat(s);
    return isNaN(n) ? undefined : n;
  }

  /**
   * Flatten nested detail responses (Vida Individual, Vida Grupo, Exequial, MasVida, Salud)
   * into a flat object compatible with our normalizer.
   * Nested format: { informacionBasicaPoliza{}, tomador[], asegurado[], primas{}, amparos[], asesores[] }
   * Flat format:   { plan, estado, fechaInicioVigencia, nombreTomador, dniTomador, prima, coberturas[], ... }
   */
  private flattenNestedDetail(d: any): any {
    if (!d.informacionBasicaPoliza && !d.tomador && !d.primas) return d; // already flat

    const info = d.informacionBasicaPoliza || {};
    const tom = Array.isArray(d.tomador) ? d.tomador[0] : d.tomador || {};
    const aseg = Array.isArray(d.asegurado) ? d.asegurado[0] : d.asegurado || {};
    const primas = d.primas || {};

    return {
      // Preserve original nested structure in _nested
      ...d,
      // Map flat fields from nested structure
      plan: info.plan,
      estado: info.estado,
      fechaExpedicion: info.fechaExpedicion || info.fechaNuevaExpedicion,
      fechaInicioVigencia: info.fechaInicioVigencia,
      fechaFinVigencia: info.fechaFinVigencia,
      fechaCancelacion: (info.fechaCancelacion && info.fechaCancelacion !== '-') ? info.fechaCancelacion : null,
      financiada: info.financiada,
      // Tomador
      nombreTomador: tom.nombreTomador,
      dniTomador: tom.nroIdentificacion,
      tipoDniTomador: tom.tipoIdentificacion,
      // Asegurado
      nombreAsegurado: aseg.nombreAsegurado,
      dniAsegurado: aseg.nroIdentificacion,
      // Prima — primas.total is the periodic premium
      prima: primas.total || primas.fraccionadaVida,
      primaTotal: primas.produccionAcumulada,
      // Coberturas = amparos + amparosAdicionales
      coberturas: [...(d.amparos || []), ...(d.amparosAdicionales || [])].map((a: any) => ({
        nombreCobertura: a.nombreAmparo,
        valorAsegurado: a.valorAseguradoAlcanzado || a.valorAseguradoInicial,
        prima: a.primaAnual,
        codigoCobertura: a.codigoCobertura,
      })),
    };
  }

  private normalizePolicy(raw: any, detail?: any): NormalizedPolicy {
    // Flatten nested detail formats (Vida Individual, Vida Grupo, etc.)
    const d = detail ? this.flattenNestedDetail(detail) : {};

    // Always prefer numeroContratoPrincipal (full number like 040006937364)
    const policyNum = raw.numeroContratoPrincipal || raw.numeroContrato || '';

    // Extract premium from detail — field name varies by ramo:
    //   Autos:         ptprimaformapago / ptPrimaFormaPagoIva
    //   Empresariales: primaFormaPago / formaPagoIva / primaPagoTotal
    //   Cumplimiento:  prima
    //   Juveniles:     prima
    //   Vida/Nested:   prima (flattened from primas.total)
    const rawPrima = d.ptprimaformapago || d.primaFormaPago || d.primaPagoTotal || d.prima;
    const premium = this.parseSuraMoney(rawPrima);
    const rawIva = d.ptPrimaFormaPagoIva || d.formaPagoIva;
    const iva = this.parseSuraMoney(rawIva);
    const totalAmount = (premium != null && iva != null) ? premium + iva : premium;

    // Extract holder — field names vary:
    //   Autos/Aseg:  dniTomador (prefix C/A), tipoDniTomador, nombreTomador
    //   Oracle:      tomador ("NIT 9008790799"), nombreTomador
    //   Juveniles:   tomadorDni, tomadorTipoDni, tomadorNombre
    //   Nested:      dniTomador, tipoDniTomador, nombreTomador (flattened)
    let holderName = (d.nombreTomador || d.tomadorNombre || raw.nombreTomador || '').trim();
    let holderDoc = d.dniTomador || d.tomadorDni || raw.dniTomador || '';
    let holderDocType = d.tipoDniTomador || d.tomadorTipoDni || raw.tipoDniTomador || '';
    // Oracle "tomador" field = "NIT 9008790799" — parse it
    if (!holderDoc && d.tomador && typeof d.tomador === 'string') {
      const parts = d.tomador.split(/\s+/);
      if (parts.length >= 2) {
        holderDocType = parts[0];
        holderDoc = parts.slice(1).join('');
      }
    }
    // Strip leading letter prefix (C, A, E, etc.) from document number
    holderDoc = String(holderDoc).replace(/^[A-Z]/, '');

    // Insured person
    const insuredName = (d.nombreAsegurado || '').trim() || undefined;
    const insuredDoc = d.dniAsegurado ? String(d.dniAsegurado).replace(/^[A-Z]/, '') : undefined;

    // Product name: varies by format
    const product = d.plan || d.producto || raw.nombreProducto;

    // Dates: aseg uses fechaInicioVigenciaRiesgo, oracle uses fechaInicioVigencia
    const startRaw = d.fechaInicioVigenciaRiesgo || d.fechaInicioVigencia || raw.fechaInicioVigencia;
    const endRaw = d.fechaFinVigenciaRiesgo || d.fechaFinVigencia || raw.fechaFinVigencia;
    const issueRaw = d.fechaExpedicion || raw.fechaExpedicion;

    // Commission from oracle detail
    const commPct = d.comision ? this.parseSuraMoney(d.comision) : undefined;

    return {
      policyNumber: policyNum,
      branch: raw.nombreRamo,
      branchCode: raw.codigoRamo,
      product,
      productCode: raw.codigoProducto,
      status: this.mapPolicyStatus(raw, d),
      holderName,
      holderDocument: holderDoc,
      holderDocumentType: this.mapDocType(holderDocType),
      insuredName,
      insuredDocument: insuredDoc,
      startDate: startRaw ? new Date(startRaw) : undefined,
      endDate: endRaw ? new Date(endRaw) : undefined,
      issueDate: issueRaw ? new Date(issueRaw) : undefined,
      cancellationDate: (d.fechaCancelacion || raw.fechaCancelacion) ? new Date(d.fechaCancelacion || raw.fechaCancelacion) : undefined,
      premium,
      iva,
      totalAmount,
      commissionPercentage: commPct,
      paymentFrequency: raw.formaPago,
      paymentMethod: d.formaPago || raw.formaPago,
      office: d.oficina || raw.nombreOficina,
      channel: raw.nombreCanal,
      certificateNumber: raw.numeroCertificado !== '%' ? raw.numeroCertificado : undefined,
      renewalNumber: raw.numeroRenovacion ? parseInt(raw.numeroRenovacion) : undefined,
      externalId: `sura_${policyNum}`,
      rawData: detail ? { ...raw, _detail: detail } : raw,
    };
  }

  private normalizeClient(raw: any): NormalizedClient {
    return {
      documentType: raw.tipoDocumento || 'CC',
      documentNumber: raw.numeroDocumento || '',
      fullName: (raw.nombre || `${raw.primerNombre || ''} ${raw.primerApellido || ''}`).trim(),
      firstName: raw.primerNombre,
      lastName: raw.primerApellido,
      email: raw.correoElectronico,
      phone: raw.telefonoFijo,
      cellphone: raw.telefonoCelular,
      address: raw.direccion,
      city: raw.ciudad,
      rawData: raw,
    };
  }

  private normalizePayment(raw: any, policyNumber: string, index: number): NormalizedPayment {
    return {
      policyNumber,
      paymentNumber: raw.numeroCuota || index + 1,
      amountDue: raw.valorRecibo || raw.valor || 0,
      amountPaid: 0,
      balance: raw.valorRecibo || raw.valor || 0,
      dueDate: raw.fechaVencimiento ? new Date(raw.fechaVencimiento) : undefined,
      status: 'PENDING',
      externalId: raw.numeroRecibo,
      rawData: raw,
    };
  }

  // ─── UTILITY HELPERS ────────────────────────────────────
  private mapPolicyStatus(raw: any, detail?: any): string {
    if (raw.fechaCancelacion) return 'CANCELLED';
    if (raw.estadoPoliza === 'CANCELADAS') return 'CANCELLED';
    // detail.estado may be 'VIGENTE', 'CANCELADA', etc — map to Prisma enum
    const dEstado = (detail?.estado || '').toUpperCase();
    if (dEstado.includes('CANCEL')) return 'CANCELLED';
    if (dEstado.includes('VIGENTE')) return 'ACTIVE';
    if (raw.fechaFinVigencia) {
      const endDate = new Date(raw.fechaFinVigencia);
      if (endDate < new Date()) return 'EXPIRED';
    }
    return 'ACTIVE';
  }

  private mapDocType(raw?: string): string {
    if (!raw) return 'CC';
    const u = raw.toUpperCase();
    if (u.includes('NIT')) return 'NIT';
    if (u.includes('CEDULA') || u === 'C') return 'CC';
    if (u.includes('PASAPORTE') || u === 'P') return 'PA';
    if (u.includes('EXTRANJERIA') || u === 'E') return 'CE';
    return raw;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
