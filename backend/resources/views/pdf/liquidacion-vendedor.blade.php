<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
    <title>Liquidacion {{ $liquidacion->codigo }}</title>
    @php
        $primaryColor = '#3b82f6';
        if (is_array($broker->branding) && isset($broker->branding['primary_color'])) {
            $primaryColor = $broker->branding['primary_color'];
        } elseif (is_array($broker->brand_colors) && isset($broker->brand_colors['primary'])) {
            $primaryColor = $broker->brand_colors['primary'];
        }
        $logoPath = $broker->logo ? public_path('storage/' . $broker->logo) : null;
    @endphp
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: DejaVu Sans, Arial, sans-serif; font-size: 9px; line-height: 1.3; color: #333; }
        .container { padding: 15px 20px; }
        .header { display: table; width: 100%; margin-bottom: 12px; border-bottom: 3px solid {{ $primaryColor }}; padding-bottom: 10px; }
        .header-left { display: table-cell; width: 25%; vertical-align: middle; }
        .header-center { display: table-cell; width: 50%; text-align: center; vertical-align: middle; }
        .header-right { display: table-cell; width: 25%; text-align: right; vertical-align: middle; }
        .logo { max-width: 120px; max-height: 50px; }
        .titulo { font-size: 14px; font-weight: bold; color: {{ $primaryColor }}; margin-bottom: 2px; }
        .codigo { font-size: 11px; color: #64748b; font-weight: bold; }
        .fecha { font-size: 8px; color: #64748b; }
        .estado-badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 8px; font-weight: bold; }
        .estado-generada { background: #fef3c7; color: #92400e; }
        .estado-aprobada { background: #dbeafe; color: #1e40af; }
        .estado-pagada { background: #dcfce7; color: #166534; }
        .info-row { display: table; width: 100%; margin-bottom: 10px; }
        .info-box { display: table-cell; width: 50%; vertical-align: top; padding-right: 10px; }
        .info-box-title { font-size: 9px; font-weight: bold; color: #333; border-bottom: 1px solid #e2e8f0; padding-bottom: 3px; margin-bottom: 5px; }
        .info-item { margin-bottom: 2px; }
        .info-label { color: #64748b; }
        .info-value { font-weight: bold; }
        .porcentajes { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 6px 10px; margin-bottom: 10px; }
        .porcentajes-title { font-weight: bold; color: #333; margin-bottom: 4px; font-size: 8px; }
        .porcentajes-grid { display: table; width: 100%; }
        .porcentaje-item { display: table-cell; text-align: center; }
        .porcentaje-label { font-size: 7px; color: #64748b; }
        .porcentaje-value { font-size: 10px; font-weight: bold; }
        table.detalles { width: 100%; border-collapse: collapse; font-size: 8px; }
        table.detalles th { background-color: {{ $primaryColor }}; color: white; padding: 5px 4px; text-align: left; font-weight: bold; font-size: 7px; }
        table.detalles th.right { text-align: right; }
        table.detalles td { padding: 4px; border-bottom: 1px solid #e2e8f0; }
        table.detalles td.right { text-align: right; }
        .totales-section { margin-top: 10px; display: table; width: 100%; }
        .totales-left { display: table-cell; width: 60%; vertical-align: top; }
        .totales-right { display: table-cell; width: 40%; vertical-align: top; }
        .totales-box { border: 2px solid {{ $primaryColor }}; border-radius: 6px; padding: 8px; }
        .totales-row { display: table; width: 100%; margin-bottom: 3px; }
        .totales-label { display: table-cell; text-align: left; color: #333; font-size: 9px; }
        .totales-value { display: table-cell; text-align: right; font-weight: bold; font-size: 9px; }
        .totales-total { border-top: 2px solid {{ $primaryColor }}; padding-top: 5px; margin-top: 5px; }
        .totales-total .totales-label { font-size: 10px; font-weight: bold; color: #333; }
        .totales-total .totales-value { font-size: 12px; }
        .red { color: #dc2626; }
        .green { color: #16a34a; }
        .observaciones { background-color: #fffbeb; border: 1px solid #fcd34d; padding: 6px 10px; border-radius: 4px; margin-top: 10px; font-size: 8px; }
        .footer { position: fixed; bottom: 10px; left: 20px; right: 20px; text-align: center; font-size: 7px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 5px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-left">
                @if($broker->logo && file_exists(public_path('storage/' . $broker->logo)))
                    <img src="{{ public_path('storage/' . $broker->logo) }}" class="logo" alt="">
                @else
                    <strong style="font-size: 12px; color: {{ $primaryColor }};">{{ $broker->name }}</strong>
                @endif
            </div>
            <div class="header-center">
                <div class="titulo">LIQUIDACION DE COMISIONES</div>
                <div class="codigo">{{ $liquidacion->codigo }}</div>
            </div>
            <div class="header-right">
                <div class="fecha">{{ $liquidacion->fecha_generacion->format('d/m/Y') }}</div>
                <div style="margin-top: 3px;">
                    <span class="estado-badge estado-{{ $liquidacion->estado }}">{{ strtoupper($liquidacion->estado) }}</span>
                </div>
            </div>
        </div>

        <div class="info-row">
            <div class="info-box">
                <div class="info-box-title">AGENCIA</div>
                <div class="info-item"><span class="info-value">{{ $broker->name }}</span></div>
                <div class="info-item"><span class="info-label">NIT:</span> {{ $broker->document_number ?? 'N/A' }}</div>
                <div class="info-item"><span class="info-label">Dir:</span> {{ $broker->address ?? 'N/A' }}, {{ $broker->city ?? '' }}</div>
                <div class="info-item"><span class="info-label">Tel:</span> {{ $broker->phone ?? 'N/A' }}</div>
            </div>
            <div class="info-box">
                <div class="info-box-title">{{ strtoupper($terminoVendedor ?? 'VENDEDOR') }}</div>
                <div class="info-item"><span class="info-value">{{ $vendedor->nombres }}</span></div>
                <div class="info-item"><span class="info-label">{{ $vendedor->tipo_documento }}:</span> {{ $vendedor->numero_documento }}</div>
                <div class="info-item"><span class="info-label">Periodo:</span> {{ \Carbon\Carbon::parse($liquidacion->periodo_inicio)->format('d/m/Y') }} - {{ \Carbon\Carbon::parse($liquidacion->periodo_fin)->format('d/m/Y') }}</div>
                <div class="info-item"><span class="info-label">Cuenta:</span> {{ $vendedor->cuenta_bancaria ?? 'No registrada' }}</div>
            </div>
        </div>

        <div class="porcentajes">
            <div class="porcentajes-title">PORCENTAJES APLICADOS</div>
            <div class="porcentajes-grid">
                <div class="porcentaje-item"><div class="porcentaje-label">Comision</div><div class="porcentaje-value green">{{ number_format($vendedor->porcentaje_comision, 1) }}%</div></div>
                <div class="porcentaje-item"><div class="porcentaje-label">Ret. Fuente</div><div class="porcentaje-value red">{{ number_format($vendedor->porcentaje_retencion, 1) }}%</div></div>
                <div class="porcentaje-item"><div class="porcentaje-label">Ret. ICA</div><div class="porcentaje-value red">{{ number_format($vendedor->porcentaje_retencion_ica, 1) }}%</div></div>
                <div class="porcentaje-item"><div class="porcentaje-label">IVA</div><div class="porcentaje-value">{{ number_format($vendedor->porcentaje_iva, 1) }}%</div></div>
                <div class="porcentaje-item"><div class="porcentaje-label">Ret. IVA</div><div class="porcentaje-value red">{{ number_format($vendedor->porcentaje_retencion_iva ?? 0, 1) }}%</div></div>
            </div>
        </div>

        <table class="detalles">
            <thead>
                <tr>
                    <th>Poliza</th>
                    <th>Cliente</th>
                    <th>Aseguradora</th>
                    <th>Ramo</th>
                    <th class="right">Prima</th>
                    <th class="right">Com. Bruta</th>
                    <th class="right">Ret.</th>
                    <th class="right">ICA</th>
                    <th class="right">IVA</th>
                    <th class="right">Neto</th>
                </tr>
            </thead>
            <tbody>
                @foreach($detalles as $detalle)
                <tr>
                    <td>{{ $detalle->numero_poliza }}</td>
                    <td>{{ $detalle->cliente_nombre }}</td>
                    <td>{{ $detalle->aseguradora }}</td>
                    <td>{{ $detalle->ramo }}</td>
                    <td class="right">${{ number_format($detalle->prima_neta, 0, ',', '.') }}</td>
                    <td class="right green">${{ number_format($detalle->comision_bruta, 0, ',', '.') }}</td>
                    <td class="right red">${{ number_format($detalle->monto_retencion, 0, ',', '.') }}</td>
                    <td class="right red">${{ number_format($detalle->monto_retencion_ica, 0, ',', '.') }}</td>
                    <td class="right">${{ number_format($detalle->monto_iva, 0, ',', '.') }}</td>
                    <td class="right green" style="font-weight: bold;">${{ number_format($detalle->comision_neta, 0, ',', '.') }}</td>
                </tr>
                @endforeach
            </tbody>
        </table>

        <div class="totales-section">
            <div class="totales-left">
                @if($liquidacion->observaciones)
                <div class="observaciones"><strong>OBSERVACIONES:</strong> {{ $liquidacion->observaciones }}</div>
                @endif
            </div>
            <div class="totales-right">
                <div class="totales-box">
                    <div class="totales-row"><span class="totales-label">Prima Total:</span><span class="totales-value">${{ number_format($liquidacion->prima_total, 0, ',', '.') }}</span></div>
                    <div class="totales-row"><span class="totales-label">Comision Bruta:</span><span class="totales-value green">${{ number_format($liquidacion->monto_bruto_total, 0, ',', '.') }}</span></div>
                    <div class="totales-row"><span class="totales-label">(-) Ret. Fuente:</span><span class="totales-value red">${{ number_format($liquidacion->monto_retencion_total, 0, ',', '.') }}</span></div>
                    <div class="totales-row"><span class="totales-label">(-) Ret. ICA:</span><span class="totales-value red">${{ number_format($liquidacion->monto_retencion_ica_total, 0, ',', '.') }}</span></div>
                    <div class="totales-row"><span class="totales-label">(+) IVA:</span><span class="totales-value">${{ number_format($liquidacion->monto_iva_total, 0, ',', '.') }}</span></div>
                    <div class="totales-row totales-total"><span class="totales-label">NETO A PAGAR:</span><span class="totales-value green">${{ number_format($liquidacion->monto_neto_total, 0, ',', '.') }}</span></div>
                </div>
            </div>
        </div>

        <div class="footer">{{ $broker->name }} | {{ $broker->phone ?? '' }} | {{ $broker->email ?? '' }} | Generado: {{ now()->format('d/m/Y H:i') }}</div>
    </div>
</body>
</html>
