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
  numeroPoliza: '', aseguradora: '', ramo: '', primaNeta: '', iva: '', total: '',
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

      // Render pages as images offscreen (max 4 pages, JPEG for smaller payload)
      let pageImages: string[] = [];
      try {
        const maxPages = Math.min(pageCount, 4);
        // Use OffscreenCanvas if available (truly off-DOM), otherwise use a positioned-off-screen canvas
        const useOffscreen = typeof OffscreenCanvas !== 'undefined';
        let domCanvas: HTMLCanvasElement | null = null;
        if (!useOffscreen) {
          domCanvas = document.createElement('canvas');
          domCanvas.style.position = 'fixed';
          domCanvas.style.left = '-99999px';
          domCanvas.style.top = '-99999px';
          domCanvas.style.pointerEvents = 'none';
          domCanvas.style.opacity = '0';
          document.body.appendChild(domCanvas);
        }
        for (let i = 1; i <= maxPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.3 });
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
            const blob = await (canvas as OffscreenCanvas).convertToBlob({ type: 'image/jpeg', quality: 0.75 });
            dataUrl = await new Promise<string>((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
          } else {
            dataUrl = (canvas as HTMLCanvasElement).toDataURL('image/jpeg', 0.75);
          }
          pageImages.push(dataUrl);
          console.log(`[PDF] Page ${i} image: ${Math.round(dataUrl.length / 1024)}KB`);
        }
        if (domCanvas) { domCanvas.remove(); }
        console.log(`[PDF] Rendered ${pageImages.length} page images, total: ${Math.round(pageImages.reduce((s, img) => s + img.length, 0) / 1024)}KB`);
      } catch (e) { console.warn('[PDF] Image rendering error:', e); }

      // Step 2: Try VISION extraction first (GPT-4o-mini reads the images like ChatGPT)
      let backend: any = null;
      let usedMethod = 'regex-fallback';

      if (pageImages.length > 0) {
        try {
          console.log('[PDF] Trying VISION extraction (GPT-4o-mini)...');
          backend = await this.callBackendVision(pageImages, fullText);
          usedMethod = backend?._method || 'vision-gpt4o-mini';
          console.log('[PDF] Vision SUCCESS:', Object.keys(backend || {}).filter(k => backend[k] && String(backend[k]).trim() !== ''));
        } catch (e: any) {
          console.warn('[PDF] Vision FAIL:', e?.message || e);
        }
      }

      // Step 3: Fallback to text-based extraction (DeepSeek)
      if (!backend && hasText) {
        try {
          console.log('[PDF] Falling back to TEXT extraction (DeepSeek)...');
          backend = await this.callBackend(fullText);
          usedMethod = 'deepseek-backend';
          console.log('[PDF] Text backend SUCCESS:', backend);
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
      console.log('[PDF] Final merged fields:', Object.keys(m).filter(k => m[k] && String(m[k]).trim() !== ''));

      const filled = Object.values(m).filter(v => v && String(v).trim() !== '' && v !== '0').length;
      const conf = Math.round((filled / 30) * 100);
      const isVision = usedMethod.includes('vision');

      const result: ProcessedPdfData = {
        ...EMPTY,
        numeroPoliza: m.numeroPoliza || '', aseguradora: m.aseguradora || '', ramo: m.ramo || '',
        primaNeta: m.primaNeta || '', iva: m.iva || '', total: m.total || '',
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
          extraction: conf, validation: isVision ? 95 : (backend ? 90 : 50),
          consistency: isVision ? 95 : (backend ? 85 : 60), historical: 70,
          overall: isVision ? Math.min(conf + 20, 100) : (backend ? Math.min(conf + 15, 100) : conf),
        },
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

  private regexExtract(text: string): Partial<any> {
    const d: any = {};
    const m = (p: RegExp) => text.match(p);
    const norm = (s: string) => s.replace(/[^\d]/g, '');

    const p = m(PDF_CONFIG.patterns.numeroPoliza); if (p) d.numeroPoliza = p[1] || p[0];
    const a = m(PDF_CONFIG.patterns.aseguradora); if (a) d.aseguradora = a[0];
    const r = m(PDF_CONFIG.patterns.ramo); if (r) d.ramo = r[0];
    const pn = m(PDF_CONFIG.patterns.primaNeta); if (pn) d.primaNeta = norm(pn[1] || pn[0]);
    const iv = m(PDF_CONFIG.patterns.iva); if (iv) d.iva = norm(iv[1] || iv[0]);
    const to = m(PDF_CONFIG.patterns.total); if (to) d.total = norm(to[1] || to[0]);
    const fe = m(PDF_CONFIG.patterns.fechaExpedicion); if (fe) d.fechaExpedicion = fe[1] || fe[0];
    const fi = m(PDF_CONFIG.patterns.fechaInicio); if (fi) d.fechaInicio = fi[1] || fi[0];
    const ff = m(PDF_CONFIG.patterns.fechaFin); if (ff) d.fechaFin = ff[1] || ff[0];
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
