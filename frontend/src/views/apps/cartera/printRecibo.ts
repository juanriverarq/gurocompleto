/**
 * Print Recibo — Opens a new window with the recibo formatted for printing.
 * Supports two formats:
 *   - 'media_carta'  → half-letter with a copy below (2 per page)
 *   - 'carta'        → full letter, single copy
 */

export interface ReciboPrintData {
  numero_recibo: string | null;
  fecha: string | null;
  cliente_nombre: string | null;
  cliente_documento: string | null;
  cliente_direccion?: string | null;
  cliente_telefono?: string | null;
  poliza_numero: string | null;
  poliza_objeto_asegurado?: string | null;
  aseguradora_nombre: string | null;
  ramo_nombre: string | null;
  numero_pago?: string | null;
  pago_poliza_consecutivo?: string | null;
  forma_pago: string | null;
  medio_de_pago?: string | null;
  moneda: string;
  valor_recaudado_en_oficina: number;
  saldo_pendiente?: number | null;
  es_anticipo: boolean;
  recibo_anulado?: boolean;
  observaciones?: string | null;
  numero_anexo?: string | null;
}

export interface BrokerPrintData {
  nombre: string;
  legal_name?: string;
  nit: string;
  direccion?: string;
  ciudad?: string;
  telefono?: string;
  email?: string;
  logo_url?: string;
}

type PrintFormat = 'media_carta' | 'carta';

const fmtMoney = (v: number | null | undefined, moneda = 'COP') => {
  const val = v ?? 0;
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val) + ' ' + moneda;
};

const fmtDateLong = (d: string | null) => {
  if (!d) return '';
  try {
    const date = new Date(d);
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return `${date.getDate()} de ${months[date.getMonth()]} de ${date.getFullYear()}`;
  } catch { return d; }
};

export const fmtDateShort = (d: string | null) => {
  if (!d) return '';
  try {
    const date = new Date(d);
    const months = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return `${date.getDate()} ${months[date.getMonth()].substring(0,3)} ${date.getFullYear()}`;
  } catch { return d; }
};

function buildReciboHTML(recibo: ReciboPrintData, broker: BrokerPrintData): string {
  const concepto = recibo.es_anticipo ? 'ANTICIPO' : 'RECAUDO';
  const medioPago = recibo.medio_de_pago || recibo.forma_pago || '';
  const moneda = recibo.moneda || 'COP';
  const ciudad = broker.ciudad || '';
  const fechaLarga = fmtDateLong(recibo.fecha);
  const headerFecha = ciudad ? `${ciudad}, ${fechaLarga}` : fechaLarga;

  const logoHTML = broker.logo_url
    ? `<img src="${broker.logo_url}" alt="Logo" class="logo-img" />`
    : '';

  const clienteInfo = [
    recibo.cliente_nombre || '',
    recibo.cliente_direccion || '',
    recibo.cliente_telefono ? `TEL: ${recibo.cliente_telefono}` : '',
    recibo.cliente_documento ? `DOC: ${recibo.cliente_documento}` : '',
  ].filter(Boolean).join('<br/>');

  const brokerInfo = [
    broker.nombre || '',
    broker.direccion || '',
    broker.telefono || '',
    ciudad ? `${ciudad} - Colombia` : '',
    broker.nit ? `NIT: ${broker.nit}` : '',
  ].filter(Boolean).join('<br/>');

  const totalValor = recibo.valor_recaudado_en_oficina || 0;

  // ── Build detail table based on type ──
  let detailTable = '';

  if (recibo.es_anticipo) {
    // ═══ ANTICIPO layout ═══
    // Columns: Remisión | Póliza | Cliente | Ramo | Aseguradora | Valor | Moneda
    const clienteCell = [recibo.cliente_nombre || '', recibo.cliente_documento || ''].filter(Boolean).join(',<br/>');
    const poliza = recibo.poliza_numero || '';
    const anexo = recibo.numero_anexo ? `Anexo: ${recibo.numero_anexo}` : '';
    const polizaCell = anexo ? `${poliza}<br/><span class="small">${anexo}</span>` : poliza;
    const remision = recibo.numero_pago || '';

    let rows = '';
    // Póliza row (if has poliza)
    if (recibo.poliza_numero) {
      rows += `
        <tr>
          <td>${remision}</td>
          <td>${polizaCell}</td>
          <td>${clienteCell}</td>
          <td>${recibo.ramo_nombre || ''}</td>
          <td>${recibo.aseguradora_nombre || ''}</td>
          <td class="money">${fmtMoney(totalValor, moneda)}</td>
          <td>${moneda}</td>
        </tr>`;
    }
    // Anticipo row
    rows += `
      <tr>
        <td></td>
        <td><strong>Anticipo</strong></td>
        <td>${clienteCell}</td>
        <td></td>
        <td></td>
        <td class="money">${recibo.poliza_numero ? fmtMoney(0, moneda) : fmtMoney(totalValor, moneda)}</td>
        <td>${moneda}</td>
      </tr>`;

    detailTable = `
      <table class="detail-table">
        <thead>
          <tr>
            <th>Remisión</th>
            <th>Póliza</th>
            <th>Cliente</th>
            <th>Ramo</th>
            <th>Aseguradora</th>
            <th>Valor</th>
            <th>Moneda</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr class="total-row">
            <td colspan="5" class="total-label"><strong>Total Recibido:</strong></td>
            <td class="money"><strong>${fmtMoney(totalValor, moneda)}</strong></td>
            <td><strong>${moneda}</strong></td>
          </tr>
        </tbody>
      </table>`;

  } else {
    // ═══ RECIBO layout ═══
    // Columns: Póliza | Ramo | Aseguradora | Valor recibido
    const poliza = recibo.poliza_numero || '';
    const riesgo = recibo.poliza_objeto_asegurado ? `, <strong>Riesgo:</strong>${recibo.poliza_objeto_asegurado}` : '';
    const polizaCell = `${poliza}${riesgo}`;

    detailTable = `
      <table class="detail-table">
        <thead>
          <tr>
            <th>Póliza</th>
            <th>Ramo</th>
            <th>Aseguradora</th>
            <th class="money">Valor recibido</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${polizaCell}</td>
            <td>${recibo.ramo_nombre || ''}</td>
            <td>${recibo.aseguradora_nombre || ''}</td>
            <td class="money">${fmtMoney(totalValor)} &nbsp;${moneda}</td>
          </tr>
          <tr class="total-row">
            <td colspan="3" class="total-label"><strong>Total Recibido:</strong></td>
            <td class="money"><strong>${fmtMoney(totalValor)} &nbsp;${moneda}</strong></td>
          </tr>
        </tbody>
      </table>`;
  }

  // NULADO watermark for anulados
  const nuladoOverlay = recibo.recibo_anulado
    ? `<div class="nulado-overlay"><span>NULADO</span></div>`
    : '';

  return `
    <div class="recibo-block">
      ${nuladoOverlay}
      <!-- Header -->
      <div class="header-row">
        <div class="header-left">
          <div class="client-box">
            ${headerFecha}<br/>
            ${clienteInfo}
          </div>
        </div>
        <div class="header-center">
          <div class="broker-info">
            ${brokerInfo}
          </div>
        </div>
        <div class="header-right">
          ${logoHTML}
          <div class="broker-name">${broker.nombre}</div>
        </div>
      </div>

      <!-- Concepto + Recibo # -->
      <div class="concepto-row">
        <div><strong>CONCEPTO:</strong> ${concepto}</div>
        <div><strong>RECIBO #:</strong> ${recibo.numero_recibo || ''}</div>
      </div>

      <!-- Detail table (flex-grows to fill space) -->
      <div class="table-wrapper">
        ${detailTable}
      </div>

      ${recibo.observaciones ? `<div class="obs-row"><strong>Obs:</strong> ${recibo.observaciones}</div>` : ''}

      <!-- Footer: Medio de pago + Firma -->
      <div class="footer-row">
        <div class="medio-pago-box">
          <div class="medio-pago-value">${medioPago} ${fmtMoney(totalValor, moneda)}</div>
          <div class="medio-pago-label"><strong>Medio de pago</strong></div>
        </div>
        <div class="firma-box">
          <div class="firma-line"></div>
          <div class="firma-label"><strong>Firma recibido</strong></div>
        </div>
      </div>
    </div>
  `;
}

function getCSS(format: PrintFormat): string {
  // Letter: 216mm x 279mm. Half = 139.5mm height.
  // We use fixed heights so the recibo always fills the exact space.
  const isMedia = format === 'media_carta';
  // media_carta: print on letter paper, content fills top half only (~130mm)
  // carta: two copies (original+copy) on full letter, each ~127mm
  const blockHeight = isMedia ? '122mm' : '127mm';
  const fontSize = isMedia ? '11px' : '9.5px';
  const fontSizeSm = isMedia ? '10px' : '8.5px';
  const fontSizeXs = isMedia ? '9px' : '8px';
  const fontSizeLg = isMedia ? '14px' : '11px';
  const pad = isMedia ? '10mm 12mm' : '5mm 8mm';
  const logoH = isMedia ? '50px' : '35px';
  const gapMm = isMedia ? '5mm' : '3mm';
  const cellPad = isMedia ? '3px 5px' : '2px 4px';
  const firmaH = isMedia ? '40px' : '25px';
  const medioPagoH = isMedia ? '40px' : '25px';

  return `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      font-size: ${fontSize};
      color: #1a1a1a;
      background: white;
    }

    /* ── Recibo block: fixed height to guarantee paper fit ── */
    .recibo-block {
      width: 100%;
      height: ${blockHeight};
      padding: ${pad};
      display: flex;
      flex-direction: column;
      overflow: hidden;
      page-break-inside: avoid;
    }
    .recibo-content {
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    .separator {
      border: none;
      border-top: 1px dashed #999;
      margin: 0;
      flex-shrink: 0;
    }

    .copy-label {
      text-align: center;
      font-size: 8px;
      color: #999;
      padding: 1mm 0;
      text-transform: uppercase;
      letter-spacing: 1px;
      flex-shrink: 0;
    }

    /* ── Header ── */
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: ${gapMm};
      gap: 8px;
      flex-shrink: 0;
    }
    .header-left { flex: 1; }
    .header-center { flex: 1; text-align: center; }
    .header-right { flex: 1; text-align: right; display: flex; flex-direction: column; align-items: flex-end; }
    .client-box {
      border: 1px solid #ccc;
      padding: 4px 6px;
      font-size: ${fontSizeSm};
      line-height: 1.4;
    }
    .broker-info {
      font-size: ${fontSizeSm};
      line-height: 1.4;
    }
    .broker-name {
      font-size: ${fontSizeLg};
      font-weight: bold;
      margin-top: 3px;
    }
    .logo-img {
      max-height: ${logoH};
      max-width: 160px;
      object-fit: contain;
    }

    /* ── Concepto row ── */
    .concepto-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: ${gapMm};
      font-size: ${fontSize};
      flex-shrink: 0;
    }

    /* ── Detail table: flex-grow to fill remaining space ── */
    .table-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }
    .detail-table {
      width: 100%;
      border-collapse: collapse;
      font-size: ${fontSizeSm};
    }
    .detail-table th,
    .detail-table td {
      border: 1px solid #333;
      padding: ${cellPad};
      text-align: left;
      vertical-align: top;
    }
    .detail-table th {
      background: #f5f5f5;
      font-weight: bold;
    }
    .detail-table .money { text-align: right; white-space: nowrap; }
    .detail-table .total-row td { border-top: 2px solid #333; }
    .detail-table .total-label { text-align: right; }
    .detail-table .small { font-size: ${fontSizeXs}; color: #555; }

    /* ── Footer: Medio de pago + Firma ── */
    .footer-row {
      display: flex;
      gap: 8mm;
      margin-top: auto;
      padding-top: ${gapMm};
      flex-shrink: 0;
    }
    .medio-pago-box, .firma-box {
      flex: 1;
      border: 1px solid #ccc;
      padding: 4px 6px;
      height: ${medioPagoH};
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .medio-pago-value { font-size: ${fontSizeSm}; }
    .medio-pago-label, .firma-label {
      font-size: ${fontSizeXs};
      margin-top: auto;
      padding-top: 2px;
      border-top: 1px solid #eee;
    }
    .firma-box { text-align: center; }
    .firma-line {
      flex: 1;
      min-height: ${firmaH};
    }

    .obs-row {
      margin-top: 2mm;
      font-size: ${fontSizeXs};
      color: #555;
      flex-shrink: 0;
    }

    /* ── NULADO watermark ── */
    .recibo-block { position: relative; }
    .nulado-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
      z-index: 10;
      overflow: hidden;
    }
    .nulado-overlay span {
      font-size: ${isMedia ? '120px' : '80px'};
      font-weight: 900;
      color: rgba(220, 38, 38, 0.25);
      text-transform: uppercase;
      transform: rotate(-35deg);
      letter-spacing: 15px;
      white-space: nowrap;
      user-select: none;
    }

    /* ── Print rules ── */
    @media print {
      @page {
        size: letter;
        margin: ${isMedia ? '0' : '5mm'};
      }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .print-toolbar { display: none !important; }
    }

    /* ── Screen preview ── */
    @media screen {
      body { padding: 20px; background: #e5e7eb; }
      .page-container {
        background: white;
        width: 216mm;
        ${isMedia ? 'max-height: 140mm;' : 'min-height: 279mm;'}
        margin: 0 auto;
        box-shadow: 0 2px 12px rgba(0,0,0,0.15);
        border-radius: 2px;
      }
      .print-toolbar {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        background: #1e293b;
        color: white;
        padding: 10px 20px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        z-index: 100;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      }
      .print-toolbar button {
        background: #3b82f6;
        color: white;
        border: none;
        padding: 8px 24px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
      }
      .print-toolbar button:hover { background: #2563eb; }
      .print-toolbar .close-btn { background: #64748b; }
      .print-toolbar .close-btn:hover { background: #475569; }
      .page-container { margin-top: 60px; }
    }
  `;
}

export function printRecibo(
  recibo: ReciboPrintData,
  broker: BrokerPrintData,
  format: PrintFormat = 'media_carta',
) {
  const reciboHTML = buildReciboHTML(recibo, broker);

  let bodyContent = '';

  if (format === 'media_carta') {
    // Half page, single copy (no duplicate)
    bodyContent = `
      <div class="page-container">
        ${reciboHTML}
      </div>
    `;
  } else {
    // Full page with original + copy
    bodyContent = `
      <div class="page-container">
        <div class="copy-label">ORIGINAL</div>
        ${reciboHTML}
        <hr class="separator" />
        <div class="copy-label">COPIA</div>
        ${reciboHTML}
      </div>
    `;
  }

  const formatLabel = format === 'media_carta' ? 'Media Carta' : 'Carta Completa (con copia)';

  const fullHTML = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Recibo #${recibo.numero_recibo || ''} — ${broker.nombre}</title>
  <style>${getCSS(format)}</style>
</head>
<body>
  <div class="print-toolbar">
    <div>
      <strong>Recibo #${recibo.numero_recibo || ''}</strong>
      <span style="opacity:0.7; margin-left:12px;">${formatLabel}</span>
    </div>
    <div style="display:flex; gap:8px;">
      <button onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
      <button class="close-btn" onclick="window.close()">Cerrar</button>
    </div>
  </div>
  ${bodyContent}
</body>
</html>`;

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('No se pudo abrir la ventana de impresión. Verifica que los popups estén habilitados.');
    return;
  }
  printWindow.document.write(fullHTML);
  printWindow.document.close();
}
