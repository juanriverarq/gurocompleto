// PDF processor: pdf.js text extraction → backend DeepSeek IA + catalog matching → regex fallback

import * as pdfjsLib from 'pdfjs-dist';
import { PDF_CONFIG } from '../config/pdfConfig';
import { setupPdfJs } from '../utils/pdfSetup';
import saasApi from './saasApi';

setupPdfJs();

export interface ProcessedPdfData {
  numeroPoliza: string;
  aseguradora: string;
  ramo: string;
  primaNeta: string;
  gastosExpedicion: string;
  gastosConIva: boolean;
  iva: string;
  total: string;
  fechaExpedicion: string;
  fechaRecepcion: string;
  fechaInicio: string;
  fechaFin: string;
  clienteNombre: string;
  clienteApellido: string;
  clienteCedula: string;
  clienteTelefono: string;
  clienteEmail: string;
  clienteDireccion: string;
  clienteCiudad: string;
  estado: string;
  riesgo: string;
  placas: string[];
  tomadorNombre: string;
  tomadorDocumento: string;
  tipoDocTomador: string;
  tomadorTelefono: string;
  tomadorEmail: string;
  tomadorDireccion: string;
  tomadorCiudad: string;
  aseguradoNombre: string;
  aseguradoDocumento: string;
  valorAsegurado: string;
  periodicidadPago: string;
  formaPago: string;
  medioPago: string;
  porcentajeComision: string;
  oficina: string;
  ciudad: string;
  vendedor: string;
  observaciones: string;
  renovable: string;
  aseguradora_id: number | null;
  aseguradora_nombre: string;
  ramo_id: number | null;
  ramo_nombre: string;
  vendedor_id: number | null;
  vendedor_nombre: string;
  clienteEncontrado?: { id: string; nombre: string; documento: string; telefono?: string; email?: string };
  confidence: ConfidenceMetrics;
  fieldConfidence?: Record<string, number>;
  method: string;
  errors: string[];
  metadata?: DocumentMetadata;
}

export interface ConfidenceMetrics {
  extraction: number; validation: number; consistency: number; historical: number; overall: number;
}

export interface DocumentMetadata {
  fileName: string; fileSize: number; pageCount: number; hasSelectableText: boolean;
  detectedInsurer: string; documentType: 'policy' | 'certificate' | 'endorsement' | 'unknown';
  quality: 'high' | 'medium' | 'low'; language: string; processingTime: number;
}

// Keep old exports for compatibility
export interface ExtractionResult {
  data: Partial<ProcessedPdfData>; confidence: number; method: string; processingTime: number; errors: string[];
}
export interface ValidationResult {
  field: string; isValid: boolean; confidence: number; errors: string[]; suggestions?: string[];
}

const EMPTY: ProcessedPdfData = {
  numeroPoliza: '', aseguradora: '', ramo: '', primaNeta: '', gastosExpedicion: '', gastosConIva: false, iva: '', total: '',
  fechaExpedicion: '', fechaRecepcion: '', fechaInicio: '', fechaFin: '',
  clienteNombre: '', clienteApellido: '', clienteCedula: '', clienteTelefono: '',
  clienteEmail: '', clienteDireccion: '', clienteCiudad: '',
  estado: 'ACTIVA', riesgo: '', placas: [],
  tomadorNombre: '', tomadorDocumento: '', tipoDocTomador: '',
  tomadorTelefono: '', tomadorEmail: '', tomadorDireccion: '', tomadorCiudad: '',
  aseguradoNombre: '', aseguradoDocumento: '', valorAsegurado: '',
  periodicidadPago: '', formaPago: '', medioPago: '', porcentajeComision: '',
  oficina: '', ciudad: '', vendedor: '', observaciones: '', renovable: '',
  aseguradora_id: null, aseguradora_nombre: '', ramo_id: null, ramo_nombre: '',
  vendedor_id: null, vendedor_nombre: '',
  confidence: { extraction: 0, validation: 0, consistency: 0, historical: 0, overall: 0 },
  method: 'error', errors: [], metadata: undefined,
};

export class AdvancedPdfProcessor {

  async processPdf(file: File): Promise<ProcessedPdfData> {
    const t0 = Date.now();
    try {
      // Step 1: Extract text AND render page images in parallel
      const ab = await file.arrayBuffer();
      // Keep raw PDF bytes for server-side pdftotext (more accurate than PDF.js text)
      // Chunked to avoid RangeError: Maximum call stack exceeded when spreading large Uint8Arrays
      {
        const bytes = new Uint8Array(ab.slice(0, 4 * 1024 * 1024));
        let bin = '';
        const chunk = 8192;
        for (let j = 0; j < bytes.length; j += chunk) {
          bin += String.fromCharCode(...bytes.subarray(j, j + chunk));
        }
        this.pdfBase64 = btoa(bin);
      }
      const pdf = await pdfjsLib.getDocument({ data: new Uint8Array(ab) }).promise;
      const pageCount = pdf.numPages;

      console.log(`[PDF] ${pageCount} pages, rendering images + extracting text...`);

      // Extract text
      let fullText = '';
      let hasText = false;
      try {
        for (let i = 1; i <= pageCount; i++) {
          const page = await pdf.getPage(i);
          const tc = await page.getTextContent();
          let pageText = '';
          let lastY: number | null = null;
          for (const item of tc.items as any[]) {
            if (!item.str) continue;
            const y = item.transform ? item.transform[5] : null;
            if (lastY !== null && y !== null && Math.abs(y - lastY) > 2) {
              pageText += '\n';
            } else if (pageText && !pageText.endsWith(' ') && !pageText.endsWith('\n')) {
              pageText += ' ';
            }
            pageText += item.str;
            if (y !== null) lastY = y;
          }
          fullText += `\n--- PAGE ${i} ---\n` + pageText;
        }
        hasText = fullText.trim().length > 20;
      } catch (e) { console.warn('[PDF] Text extraction error:', e); }

      // Render pages as PNG a alta resolución (scale 2.0 = ~200 DPI, sin pérdida de calidad).
      // Solo primeras 3 páginas: cubre carátula HDI (p1), Allianz (p2-3), Mundial (p1), Solidaria (p1).
      let pageImages: string[] = [];
      try {
        const maxPages = Math.min(pageCount, 3);
        const useOffscreen = typeof OffscreenCanvas !== 'undefined';
        let domCanvas: HTMLCanvasElement | null = null;
        if (!useOffscreen) {
          domCanvas = document.createElement('canvas');
          domCanvas.style.cssText = 'position:fixed;left:-99999px;top:-99999px;pointer-events:none;opacity:0';
          document.body.appendChild(domCanvas);
        }
        for (let i = 1; i <= maxPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2.0 });
          let canvas: HTMLCanvasElement | OffscreenCanvas;
          if (useOffscreen) {
            canvas = new OffscreenCanvas(viewport.width, viewport.height);
          } else {
            domCanvas!.width = viewport.width;
            domCanvas!.height = viewport.height;
            canvas = domCanvas!;
          }
          const ctx = canvas.getContext('2d') as any;
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, viewport.width, viewport.height);
          await page.render({ canvasContext: ctx, viewport }).promise;
          let dataUrl: string;
          if (useOffscreen) {
            // PNG lossless para máxima legibilidad de texto pequeño y tablas
            const blob = await (canvas as OffscreenCanvas).convertToBlob({ type: 'image/png' });
            dataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          } else {
            dataUrl = (canvas as HTMLCanvasElement).toDataURL('image/png');
          }
          pageImages.push(dataUrl);
          console.log(`[PDF] Page ${i} PNG: ${Math.round(dataUrl.length / 1024)}KB`);
        }
        if (domCanvas) { domCanvas.remove(); }
        console.log(`[PDF] Rendered ${pageImages.length} PNG pages, total: ${Math.round(pageImages.reduce((s, img) => s + img.length, 0) / 1024)}KB`);
      } catch (e) { console.warn('[PDF] Image rendering error:', e); }

      let backend: any = null;
      let usedMethod = 'regex-fallback';

      // Step 2: ADVANCED extraction — GPT-4o + Gemini consensus (máxima precisión)
      if (pageImages.length > 0) {
        try {
          console.log('[PDF] Trying ADVANCED extraction (GPT-4o + Gemini consensus)...');
          backend = await this.callBackendAdvanced(pageImages, fullText);
          usedMethod = backend?._method || 'advanced-consensus';
          console.log('[PDF] Advanced SUCCESS. Fields:', Object.keys(backend || {}).filter(k => backend[k] && String(backend[k]).trim() !== '' && !k.startsWith('_')));
        } catch (e: any) {
          console.warn('[PDF] Advanced FAIL, trying vision fallback:', e?.message || e);
        }
      }

      // Step 3: Fallback — GPT-4o-mini vision (solo si advanced falla)
      if (!backend && pageImages.length > 0) {
        try {
          console.log('[PDF] Fallback: VISION extraction (GPT-4o-mini)...');
          backend = await this.callBackendVision(pageImages, fullText);
          usedMethod = backend?._method || 'vision-gpt4o-mini';
          console.log('[PDF] Vision SUCCESS:', Object.keys(backend || {}).filter(k => backend[k] && String(backend[k]).trim() !== ''));
        } catch (e: any) {
          console.warn('[PDF] Vision FAIL:', e?.message || e);
        }
      }

      // Step 4: Fallback — texto con DeepSeek
      if (!backend && hasText) {
        try {
          console.log('[PDF] Fallback: TEXT extraction (DeepSeek)...');
          backend = await this.callBackend(fullText);
          usedMethod = 'deepseek-backend';
        } catch (e: any) {
          console.error('[PDF] Text backend FAIL:', e?.message || e);
        }
      }

      // Step 4: Regex as last resort
      let regex: any = {};
      if (hasText) {
        try { regex = this.regexExtract(fullText); } catch (e) { console.warn('[PDF] Regex fail:', e); }
      }

      // Step 5: Merge (backend/vision wins over regex)
      const m = { ...regex };
      if (backend) { for (const [k, v] of Object.entries(backend)) { if (v !== null && v !== undefined && v !== '' && !k.startsWith('_')) m[k] = v; } }

      // Step 5b: pdftotext (regex) es autoridad para financieros.
      // OCR visual puede leer "900" como "980" y ser internamente consistente
      // con el total equivocado — el check de suma no detectaría ese caso.
      // Si el regex da valores que cuadran → se usan siempre sobre el AI.
      const toNum = (v: any) => parseFloat(String(v ?? '0').replace(/[^\d]/g, '')) || 0;
      const mathOk = (p: number, g: number, i: number, t: number) =>
        p > 0 && i > 0 && t > 0 && Math.abs(p + g + i - t) <= 50;
      const rP = toNum(regex.primaNeta), rG = toNum(regex.gastosExpedicion), rI = toNum(regex.iva), rT = toNum(regex.total);
      if (mathOk(rP, rG, rI, rT)) {
        console.log('[PDF] Regex financials passed math check → overriding AI values:', { rP, rG, rI, rT });
        if (regex.primaNeta)        m.primaNeta        = regex.primaNeta;
        if (regex.gastosExpedicion) m.gastosExpedicion = regex.gastosExpedicion;
        if (regex.iva)              m.iva              = regex.iva;
        if (regex.total)            m.total            = regex.total;
      }

      console.log('[PDF] Final merged fields:', Object.keys(m).filter(k => m[k] && String(m[k]).trim() !== ''));

      const isVision = usedMethod.includes('vision');

      // Weighted confidence: reflects which *important* fields are actually filled.
      // Core (60%): sin estos la póliza es inútil.
      // Key (30%): datos del tomador/cliente y montos.
      // Support (10%): campos complementarios.
      const coreFields = ['numeroPoliza', 'aseguradora', 'ramo', 'fechaInicio', 'fechaFin'];
      const keyFields  = ['tomadorNombre', 'tomadorDocumento', 'clienteNombre', 'clienteCedula', 'total'];
      const suppFields = ['fechaExpedicion', 'clienteTelefono', 'clienteDireccion', 'primaNeta', 'clienteCiudad'];
      const nonEmpty = (f: string) => {
        const v = m[f];
        if (v === null || v === undefined) return false;
        const s = String(v).trim();
        return s !== '' && s !== '0';
      };
      const coreFilled = coreFields.filter(nonEmpty).length;
      const keyFilled  = keyFields.filter(nonEmpty).length;
      const suppFilled = suppFields.filter(nonEmpty).length;
      const extraction = Math.round(
        (coreFilled / coreFields.length) * 60 +
        (keyFilled  / keyFields.length)  * 30 +
        (suppFilled / suppFields.length) * 10
      );
      // Validation: measure how many core fields pass basic sanity checks
      const dateOk = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test((d||'').trim());
      let sanity = 0;
      if (nonEmpty('numeroPoliza')) sanity++;
      if (nonEmpty('aseguradora'))  sanity++;
      if (nonEmpty('ramo'))         sanity++;
      if (dateOk(m.fechaInicio))    sanity++;
      if (dateOk(m.fechaFin))       sanity++;
      const validation = Math.round((sanity / 5) * 100);
      const consistency = isVision ? 80 : (backend ? 70 : 45);
      const overall = Math.round(extraction * 0.65 + validation * 0.25 + consistency * 0.10);

      const result: ProcessedPdfData = {
        ...EMPTY,
        numeroPoliza: m.numeroPoliza || '', aseguradora: m.aseguradora || '', ramo: m.ramo || '',
        primaNeta: m.primaNeta || '',
        gastosExpedicion: m.gastosExpedicion || '',
        gastosConIva: m.gastosConIva ?? false,
        iva: m.iva || '', total: m.total || '',
        fechaExpedicion: m.fechaExpedicion || '', fechaRecepcion: m.fechaRecepcion || '',
        fechaInicio: m.fechaInicio || '', fechaFin: m.fechaFin || '',
        clienteNombre: m.clienteNombre || '', clienteApellido: m.clienteApellido || '',
        clienteCedula: m.clienteDocumento || m.clienteCedula || '',
        clienteTelefono: m.clienteTelefono || '', clienteEmail: m.clienteEmail || '',
        clienteDireccion: m.clienteDireccion || '', clienteCiudad: m.clienteCiudad || '',
        tomadorNombre: m.tomadorNombre || '', tomadorDocumento: m.tomadorDocumento || '',
        tipoDocTomador: m.tipoDocTomador || '', tomadorTelefono: m.tomadorTelefono || '',
        tomadorEmail: m.tomadorEmail || '', tomadorDireccion: m.tomadorDireccion || '',
        tomadorCiudad: m.tomadorCiudad || '',
        aseguradoNombre: m.aseguradoNombre || '', aseguradoDocumento: m.aseguradoDocumento || '',
        estado: m.estado || 'ACTIVA', riesgo: m.riesgo || '', placas: m.placas || [],
        valorAsegurado: m.valorAsegurado || '', periodicidadPago: m.periodicidadPago || '',
        formaPago: m.formaPago || '', medioPago: m.medioPago || '',
        porcentajeComision: m.porcentajeComision || '', oficina: m.oficina || '',
        ciudad: m.ciudad || '', vendedor: m.vendedor || '',
        observaciones: m.observaciones || '', renovable: m.renovable || '',
        aseguradora_id: m.aseguradora_id || null, aseguradora_nombre: m.aseguradora_nombre || m.aseguradora || '',
        ramo_id: m.ramo_id || null, ramo_nombre: m.ramo_nombre || m.ramo || '',
        vendedor_id: m.vendedor_id || null, vendedor_nombre: m.vendedor_nombre || m.vendedor || '',
        clienteEncontrado: m.cliente_id ? {
          id: String(m.cliente_id), nombre: m.cliente_nombre_display || m.clienteNombre || '',
          documento: m.cliente_documento_display || m.clienteDocumento || '',
          telefono: m.cliente_celular || m.clienteTelefono || '',
          email: m.cliente_email || m.clienteEmail || '',
        } : undefined,
        confidence: {
          extraction, validation, consistency, historical: 70, overall,
        },
        fieldConfidence: backend?._fieldConfidence || undefined,
        method: usedMethod,
        errors: [],
        metadata: {
          fileName: file.name, fileSize: file.size, pageCount, hasSelectableText: hasText,
          detectedInsurer: m.aseguradora || 'unknown', documentType: 'policy',
          quality: isVision ? 'high' : (fullText.length > 500 ? 'high' : fullText.length > 100 ? 'medium' : 'low'),
          language: 'es', processingTime: Date.now() - t0,
        },
      };
      return result;
    } catch (error) {
      console.error('[PDF] ❌ OUTER CATCH — esto causa 0% confianza:', error);
      return { ...EMPTY, errors: [(error as Error).message], metadata: {
        fileName: file.name, fileSize: file.size, pageCount: 0, hasSelectableText: false,
        detectedInsurer: 'unknown', documentType: 'unknown', quality: 'low',
        language: 'es', processingTime: Date.now() - t0,
      }};
    }
  }

  private async callBackend(text: string): Promise<any> {
    const headers = await saasApi.getAuthHeaders();
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001/api';
    const url = `${apiUrl}/saas/pdf-poliza-extract`;
    console.log(`[PDF] Calling backend: ${url} (text length: ${text.length})`);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: text.substring(0, 12000) }),
    });
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      console.error(`[PDF] Backend error ${resp.status}:`, errBody);
      throw new Error(`Backend ${resp.status}: ${errBody.substring(0, 200)}`);
    }
    const r = await resp.json();
    console.log('[PDF] Backend response:', r);
    if (!r.success || !r.data) throw new Error(r.message || 'No data');
    return r.data;
  }

  private async callBackendVision(images: string[], fallbackText: string): Promise<any> {
    const headers = await saasApi.getAuthHeaders();
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001/api';
    const url = `${apiUrl}/saas/pdf-poliza-extract-vision`;
    console.log(`[PDF] Calling backend vision: ${url} (${images.length} images)`);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: images.slice(0, 4),
        text: fallbackText ? fallbackText.substring(0, 12000) : '',
      }),
    });
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      console.error(`[PDF] Vision backend error ${resp.status}:`, errBody);
      throw new Error(`Vision backend ${resp.status}: ${errBody.substring(0, 200)}`);
    }
    const r = await resp.json();
    console.log('[PDF] Vision backend response:', r);
    if (!r.success || !r.data) throw new Error(r.message || 'No data from vision');
    return r.data;
  }

  private pdfBase64: string = '';

  private async callBackendAdvanced(images: string[], fallbackText: string): Promise<any> {
    const headers = await saasApi.getAuthHeaders();
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8001/api';
    const url = `${apiUrl}/saas/pdf-poliza-extract-advanced`;
    console.log(`[PDF] Calling ADVANCED backend: ${url} (${images.length} PNG pages)`);
    const resp = await fetch(url, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        images: images.slice(0, 3),
        text: fallbackText ? fallbackText.substring(0, 12000) : '',
        pdf_base64: this.pdfBase64 || undefined,
      }),
    });
    if (!resp.ok) {
      const errBody = await resp.text().catch(() => '');
      console.error(`[PDF] Advanced backend error ${resp.status}:`, errBody);
      throw new Error(`Advanced backend ${resp.status}: ${errBody.substring(0, 200)}`);
    }
    const r = await resp.json();
    console.log('[PDF] Advanced response:', r);
    if (!r.success || !r.data) throw new Error(r.message || 'No data from advanced');
    return r.data;
  }

  private regexExtract(text: string): Partial<any> {
    const d: any = {};
    const m = (p: RegExp) => text.match(p);
    // Strip trailing 2-digit decimal (.00 / ,00) BEFORE removing separators.
    // "1,685,274.00" → "1,685,274" → "1685274"  (not "168527400")
    // "804.405,00"   → "804.405"   → "804405"   (Allianz European format)
    // "5,877"        → "5,877"     → "5877"      (no decimal suffix → unchanged)
    const norm = (s: string): string => {
      s = s.trim().replace(/[,\.](\d{2})$/, '');
      return s.replace(/[^\d]/g, '');
    };

    // Número de póliza: intenta múltiples patrones para manejar los formatos reales de aseguradoras colombianas.
    // Orden de prioridad: más específico primero.
    const polizaPatterns = [
      // "PÓLIZA No: 510 -89 - 994000000151" (Solidaria)
      /p[oó]liza\s+no\s*:?\s*([\d][\d\s\-]{4,25}\d)/i,
      // "Póliza nº 023869855" / "No. PÓLIZA COA-400007704"
      /(?:no\.?\s+)?p[oó]liza(?:\s+n[oº°]\.?)?\s*:?\s*([A-Za-z0-9][A-Za-z0-9\-_\/]{3,20})/i,
      // tabla HDI: valor numérico aislado de 6-12 dígitos cerca de la palabra póliza
      /p[oó]liza[\s\S]{0,80}?(\b\d{6,12}\b)/i,
    ];
    for (const pat of polizaPatterns) {
      const mp = text.match(pat);
      if (mp) {
        const raw = (mp[1] || '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
        // Descartar si capturó una palabra genérica (SEGURO, DE, etc.)
        if (!/^(seguro|de|del|la|el|no|num|numero|número)$/i.test(raw)) {
          d.numeroPoliza = raw;
          break;
        }
      }
    }

    const a = m(PDF_CONFIG.patterns.aseguradora); if (a) d.aseguradora = a[0];
    const r = m(PDF_CONFIG.patterns.ramo); if (r) d.ramo = r[0];
    const pn = m(PDF_CONFIG.patterns.primaNeta); if (pn) d.primaNeta = norm(pn[1] || pn[0]);
    // Allianz: "PRIMA   2.622.835,00" — etiqueta sin "NETA"/"BRUTA", 1+ espacios antes del monto
    if (!d.primaNeta) {
      const pnBare = /(?:^|[ \t])prima[ \t]+([0-9][0-9,\.]+)/im.exec(text);
      if (pnBare) d.primaNeta = norm(pnBare[1]);
    }
    const ge = m((PDF_CONFIG.patterns as any).gastosExpedicion); if (ge) d.gastosExpedicion = norm(ge[1] || ge[0]);
    const iv = m(PDF_CONFIG.patterns.iva); if (iv) d.iva = norm(iv[1] || iv[0]);
    const to = m(PDF_CONFIG.patterns.total);
    if (to) {
      d.total = norm(to[1] || to[0]);
    } else {
      // Mundial: total value appears BEFORE "TOTAL A PAGAR" label in text stream
      const tor = m((PDF_CONFIG.patterns as any).totalReversed);
      if (tor) d.total = norm(tor[1] || tor[0]);
    }
    // If total still missing but prima+iva found → calculate to enable math-check override of AI values
    if (!d.total) {
      const numP2 = parseInt(d.primaNeta || '0', 10);
      const numG2 = parseInt(d.gastosExpedicion || '0', 10);
      const numI2 = parseInt(d.iva || '0', 10);
      if (numP2 > 0 && numI2 > 0) {
        d.total = String(numP2 + numG2 + numI2);
      }
    }

    // Normalizar fechas a YYYY-MM-DD desde múltiples formatos colombianos
    const spanishMonths: Record<string, string> = {
      ENE:'01',FEB:'02',MAR:'03',ABR:'04',MAY:'05',JUN:'06',
      JUL:'07',AGO:'08',SEP:'09',OCT:'10',NOV:'11',DIC:'12',
    };
    const spanishFullMonths: Record<string, string> = {
      ENERO:'01',FEBRERO:'02',MARZO:'03',ABRIL:'04',MAYO:'05',JUNIO:'06',
      JULIO:'07',AGOSTO:'08',SEPTIEMBRE:'09',OCTUBRE:'10',NOVIEMBRE:'11',DICIEMBRE:'12',
    };
    const normDate = (raw: string): string => {
      raw = raw.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
      // YYYY-ABR-DD (HDI: "2025-ABR-10")
      const m1 = raw.match(/^(\d{4})-([A-Z]{3})-(\d{1,2})$/i);
      if (m1) return `${m1[1]}-${spanishMonths[m1[2].toUpperCase()] || '00'}-${m1[3].padStart(2,'0')}`;
      // DD-ABR-YYYY (HDI Hogar: "26-AGO-2025")
      const m1b = raw.match(/^(\d{1,2})-([A-Z]{3})-(\d{4})$/i);
      if (m1b) return `${m1b[3]}-${spanishMonths[m1b[2].toUpperCase()] || '00'}-${m1b[1].padStart(2,'0')}`;
      // DD/FEBRERO/YYYY (SBS: "10/FEBRERO/2026")
      const m1c = raw.match(/^(\d{1,2})\/([A-ZÁÉÍÓÚ]+)\/(\d{4})$/i);
      if (m1c) return `${m1c[3]}-${spanishFullMonths[m1c[2].toUpperCase()] || '00'}-${m1c[1].padStart(2,'0')}`;
      // DD/MM/YYYY
      const m2 = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (m2) return `${m2[3]}-${m2[2].padStart(2,'0')}-${m2[1].padStart(2,'0')}`;
      // DD-MM-YYYY (MAPFRE: "21-03-2025")
      const m2b = raw.match(/^(\d{1,2})-(\d{2})-(\d{4})$/);
      if (m2b) return `${m2b[3]}-${m2b[2].padStart(2,'0')}-${m2b[1].padStart(2,'0')}`;
      // DD MM YYYY (Solidaria: "07 05 2026")
      const m3 = raw.match(/^(\d{1,2})\s+(\d{1,2})\s+(\d{4})$/);
      if (m3) return `${m3[3]}-${m3[2].padStart(2,'0')}-${m3[1].padStart(2,'0')}`;
      return raw;
    };

    const fe = m(PDF_CONFIG.patterns.fechaExpedicion); if (fe) d.fechaExpedicion = normDate(fe[1] || fe[0]);
    const fi = m(PDF_CONFIG.patterns.fechaInicio);     if (fi) d.fechaInicio     = normDate(fi[1] || fi[0]);
    const ff = m(PDF_CONFIG.patterns.fechaFin);        if (ff) d.fechaFin        = normDate(ff[1] || ff[0]);

    const cn = m(PDF_CONFIG.patterns.clienteNombre); if (cn) d.clienteNombre = cn[1] || cn[0];
    const cc = m(PDF_CONFIG.patterns.clienteCedula); if (cc) d.clienteCedula = (cc[1] || cc[0]).replace(/[\s\-\.]/g, '');
    const ct = m(PDF_CONFIG.patterns.clienteTelefono); if (ct) d.clienteTelefono = ct[1] || ct[0];
    const ce = m(PDF_CONFIG.patterns.clienteEmail); if (ce) d.clienteEmail = ce[1] || ce[0];
    d.estado = 'ACTIVA';

    // Placas
    const placas: string[] = [];
    let pm; const pr = /\b([A-Z]{3}\s*\d{3})\b/g;
    while ((pm = pr.exec(text)) !== null) {
      const pl = pm[1].replace(/\s/g, ''); if (pl.length === 6 && !placas.includes(pl)) placas.push(pl);
    }
    d.placas = placas;

    // Tomador
    const tm = text.match(/(?:tomador|contratante)\s*:?\s*([A-ZÁÉÍÓÚÑ\s]{5,60})/i);
    if (tm) d.tomadorNombre = tm[1].trim();

    // Valor asegurado
    const va = text.match(/(?:valor\s*asegurado|suma\s*asegurada)\s*:?\s*\$?\s*([\d,\.]+)/i);
    if (va) d.valorAsegurado = norm(va[1]);

    return d;
  }
}

// ===== EXPORTED FUNCTION =====
export async function processPdf(file: File): Promise<ProcessedPdfData> {
  return new AdvancedPdfProcessor().processPdf(file);
}
