<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>Factura {{ $invoice['id'] }}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 10px; line-height: 1.5; color: #000; background: #fff; }
        .container { padding: 40px 50px; }
        
        /* Header */
        .header { display: table; width: 100%; margin-bottom: 40px; }
        .header-left { display: table-cell; width: 50%; vertical-align: top; }
        .header-right { display: table-cell; width: 50%; text-align: right; vertical-align: top; }
        .logo { max-height: 45px; }
        .invoice-title { font-size: 28px; font-weight: bold; letter-spacing: 2px; }
        .invoice-meta { margin-top: 10px; font-size: 10px; }
        .invoice-meta div { margin-bottom: 3px; }
        
        /* Divider */
        .divider { border-bottom: 1px solid #000; margin: 25px 0; }
        
        /* Info Sections */
        .info-section { display: table; width: 100%; margin-bottom: 30px; }
        .info-box { display: table-cell; width: 50%; vertical-align: top; }
        .info-title { font-size: 9px; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; border-bottom: 1px solid #000; padding-bottom: 5px; }
        .info-row { margin-bottom: 4px; font-size: 10px; }
        .info-label { font-weight: normal; }
        .info-value { font-weight: bold; }
        
        /* Plan Summary */
        .plan-summary { border: 1px solid #000; padding: 15px; margin-bottom: 25px; }
        .plan-summary-title { font-size: 10px; font-weight: bold; text-transform: uppercase; margin-bottom: 10px; }
        .plan-grid { display: table; width: 100%; }
        .plan-item { display: table-cell; text-align: center; }
        .plan-item-label { font-size: 8px; text-transform: uppercase; }
        .plan-item-value { font-size: 12px; font-weight: bold; margin-top: 3px; }
        
        /* Items Table */
        .items-table { width: 100%; border-collapse: collapse; margin-bottom: 25px; }
        .items-table th { background: #000; color: #fff; padding: 10px 8px; text-align: left; font-size: 9px; font-weight: bold; text-transform: uppercase; }
        .items-table th.right { text-align: right; }
        .items-table td { padding: 10px 8px; border-bottom: 1px solid #ddd; font-size: 10px; }
        .items-table td.right { text-align: right; }
        .items-table tbody tr:last-child td { border-bottom: 1px solid #000; }
        
        /* Totals */
        .totals-section { display: table; width: 100%; }
        .totals-left { display: table-cell; width: 55%; vertical-align: top; padding-right: 30px; }
        .totals-right { display: table-cell; width: 45%; vertical-align: top; }
        .totals-box { border: 1px solid #000; padding: 15px; }
        .totals-row { display: table; width: 100%; margin-bottom: 6px; font-size: 10px; }
        .totals-label { display: table-cell; text-align: left; }
        .totals-value { display: table-cell; text-align: right; }
        .totals-total { margin-top: 10px; padding-top: 10px; border-top: 2px solid #000; }
        .totals-total .totals-label { font-size: 12px; font-weight: bold; }
        .totals-total .totals-value { font-size: 14px; font-weight: bold; }
        
        /* Modules */
        .modules-title { font-size: 9px; font-weight: bold; text-transform: uppercase; margin-bottom: 8px; }
        .modules-list { font-size: 9px; line-height: 1.6; }
        
        /* Payment Status */
        .payment-status { margin-top: 25px; padding: 12px 15px; border: 1px solid #000; }
        .payment-status-title { font-weight: bold; font-size: 10px; }
        .payment-status-text { font-size: 9px; margin-top: 5px; }
        
        /* Notes */
        .notes { margin-top: 25px; font-size: 8px; line-height: 1.6; }
        .notes-title { font-weight: bold; font-size: 9px; margin-bottom: 5px; }
        
        /* Footer */
        .footer { margin-top: 40px; padding-top: 15px; border-top: 1px solid #000; text-align: center; font-size: 8px; }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="header-left">
                <svg width="120" height="45" viewBox="0 0 400 120" xmlns="http://www.w3.org/2000/svg">
                    <path d="M60 10C32.4 10 10 32.4 10 60s22.4 50 50 50c13.8 0 26.4-5.6 35.5-14.6l-14.1-14.1C75.3 87.4 68 90 60 90c-16.5 0-30-13.5-30-30s13.5-30 30-30c8 0 15.3 3.2 20.6 8.4L60 60h50c0-27.6-22.4-50-50-50z" fill="#6366f1"/>
                    <circle cx="60" cy="60" r="8" fill="#fbbf24"/>
                    <path d="M140 35h20v30c0 11 9 20 20 20s20-9 20-20V35h20v30c0 22-18 40-40 40s-40-18-40-40V35z" fill="#6366f1"/>
                    <path d="M240 35h40c16.5 0 30 13.5 30 30 0 10-5 19-12.5 24.5L320 105h-24l-20-13H260v13h-20V35zm20 37h20c5.5 0 10-4.5 10-10s-4.5-10-10-10h-20v20z" fill="#6366f1"/>
                    <circle cx="370" cy="60" r="35" fill="none" stroke="#6366f1" stroke-width="20"/>
                </svg>
            </div>
            <div class="header-right">
                <div class="invoice-title">FACTURA</div>
                <div class="invoice-meta">
                    <div><strong>No:</strong> {{ $invoice['id'] }}</div>
                    <div><strong>Fecha:</strong> {{ $invoice['date_formatted'] }}</div>
                    <div><strong>Estado:</strong> {{ $invoice['status'] === 'paid' ? 'PAGADO' : 'PENDIENTE' }}</div>
                </div>
            </div>
        </div>
        
        <div class="divider"></div>
        
        <!-- Client & Company Info -->
        <div class="info-section">
            <div class="info-box">
                <div class="info-title">Facturado a</div>
                <div class="info-row"><span class="info-value">{{ $broker['name'] }}</span></div>
                @if($broker['document_number'])
                <div class="info-row">NIT/CC: {{ $broker['document_number'] }}</div>
                @endif
                @if($broker['email'])
                <div class="info-row">{{ $broker['email'] }}</div>
                @endif
                @if($broker['phone'])
                <div class="info-row">Tel: {{ $broker['phone'] }}</div>
                @endif
                @if($broker['address'])
                <div class="info-row">{{ $broker['address'] }}</div>
                @endif
            </div>
            <div class="info-box" style="padding-left: 30px;">
                <div class="info-title">Emitido por</div>
                <div class="info-row"><span class="info-value">GURO S.A.S.</span></div>
                <div class="info-row">NIT: 901.XXX.XXX-X</div>
                <div class="info-row">facturacion@guro.co</div>
                <div class="info-row">www.guro.co</div>
            </div>
        </div>
        
        <!-- Plan Summary -->
        <div class="plan-summary">
            <div class="plan-summary-title">Resumen del Plan</div>
            <div class="plan-grid">
                <div class="plan-item">
                    <div class="plan-item-label">Periodo</div>
                    <div class="plan-item-value">{{ $invoice['period'] === 'annual' ? 'Anual' : 'Mensual' }}</div>
                </div>
                <div class="plan-item">
                    <div class="plan-item-label">Usuarios</div>
                    <div class="plan-item-value">{{ $invoice['users_count'] }}</div>
                </div>
                <div class="plan-item">
                    <div class="plan-item-label">Almacenamiento</div>
                    <div class="plan-item-value">{{ $invoice['storage_gb'] }} GB</div>
                </div>
                <div class="plan-item">
                    <div class="plan-item-label">Vigencia</div>
                    <div class="plan-item-value">{{ $invoice['period_start'] }} - {{ $invoice['period_end'] }}</div>
                </div>
            </div>
        </div>
        
        <!-- Items Table -->
        <table class="items-table">
            <thead>
                <tr>
                    <th style="width: 50%;">Descripción</th>
                    <th class="right">Cant.</th>
                    <th class="right">Precio Unit.</th>
                    <th class="right">Total</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td>Suscripción GURO - Plan {{ $invoice['period'] === 'annual' ? 'Anual' : 'Mensual' }}</td>
                    <td class="right">1</td>
                    <td class="right">${{ number_format($invoice['totals']['baseMonthly'] ?? 83500, 0, ',', '.') }}</td>
                    <td class="right">${{ number_format($invoice['totals']['baseMonthly'] ?? 83500, 0, ',', '.') }}</td>
                </tr>
                @if(($invoice['totals']['users']['billableUsers'] ?? 0) > 0)
                <tr>
                    <td>Usuarios adicionales</td>
                    <td class="right">{{ $invoice['totals']['users']['billableUsers'] ?? 0 }}</td>
                    <td class="right">${{ number_format($invoice['totals']['users']['perUserMonthly'] ?? 23000, 0, ',', '.') }}</td>
                    <td class="right">${{ number_format($invoice['totals']['users']['usersMonthly'] ?? 0, 0, ',', '.') }}</td>
                </tr>
                @endif
                @if(($invoice['totals']['modulesMonthly'] ?? 0) > 0)
                <tr>
                    <td>Módulos adicionales</td>
                    <td class="right">{{ count($invoice['modules'] ?? []) }}</td>
                    <td class="right">-</td>
                    <td class="right">${{ number_format($invoice['totals']['modulesMonthly'] ?? 0, 0, ',', '.') }}</td>
                </tr>
                @endif
            </tbody>
        </table>
        
        <!-- Totals -->
        <div class="totals-section">
            <div class="totals-left">
                @if(!empty($invoice['modules']))
                <div class="modules-title">Módulos incluidos:</div>
                <div class="modules-list">
                    {{ implode(' • ', array_map('ucfirst', $invoice['modules'])) }}
                </div>
                @endif
            </div>
            <div class="totals-right">
                <div class="totals-box">
                    <div class="totals-row">
                        <span class="totals-label">Subtotal:</span>
                        <span class="totals-value">${{ number_format($invoice['subtotal'], 0, ',', '.') }}</span>
                    </div>
                    @if($invoice['discount'] > 0)
                    <div class="totals-row">
                        <span class="totals-label">Descuento:</span>
                        <span class="totals-value">-${{ number_format($invoice['discount'], 0, ',', '.') }}</span>
                    </div>
                    @endif
                    @if($invoice['tax'] > 0)
                    <div class="totals-row">
                        <span class="totals-label">IVA (19%):</span>
                        <span class="totals-value">${{ number_format($invoice['tax'], 0, ',', '.') }}</span>
                    </div>
                    @endif
                    <div class="totals-row totals-total">
                        <span class="totals-label">TOTAL:</span>
                        <span class="totals-value">${{ number_format($invoice['total'], 0, ',', '.') }} COP</span>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Payment Status -->
        @if($invoice['status'] === 'paid')
        <div class="payment-status">
            <div class="payment-status-title">✓ PAGO CONFIRMADO</div>
            <div class="payment-status-text">Este pago ha sido procesado exitosamente. Gracias por confiar en GURO.</div>
        </div>
        @endif
        
        <!-- Notes -->
        <div class="notes">
            <div class="notes-title">Notas:</div>
            • Esta factura es un comprobante de pago por servicios de software.<br>
            • La suscripción se renueva automáticamente al final del periodo.<br>
            • Para cancelar o modificar su plan, visite la sección de Facturación en su cuenta.
        </div>
        
        <!-- Footer -->
        <div class="footer">
            GURO S.A.S. | www.guro.co | soporte@guro.co<br>
            Documento generado el {{ now()->format('d/m/Y H:i') }}
        </div>
    </div>
</body>
</html>
