<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Tu selección de plan</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #111827; }
        .container { max-width: 640px; margin: 0 auto; padding: 24px; }
        .card { border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; }
        .muted { color: #6b7280; }
        .h1 { font-size: 20px; font-weight: 700; margin: 0 0 8px; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
        .code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; background: #f9fafb; padding: 12px; border-radius: 8px; font-size: 12px; }
        .li { padding: 2px 0; }
        .mt { margin-top: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <h1 class="h1">¡Gracias por tu interés en Guro!</h1>
        <p>Hemos recibido tu selección de plan. Aquí tienes un resumen:</p>
        <div class="card mt">
            <div class="grid">
                <div class="muted">Periodo</div>
                <div><strong>{{ $intent->period === 'annual' ? 'Anual' : 'Mensual' }}</strong></div>
                <div class="muted">Usuarios</div>
                <div><strong>{{ $intent->users_count }}</strong></div>
                <div class="muted">Almacenamiento</div>
                <div><strong>{{ $intent->storage_gb }} GB</strong></div>
                <div class="muted">Estado</div>
                <div><strong>{{ ucfirst($intent->status) }}</strong></div>
            </div>
            <div class="mt">
                <div class="muted">Módulos seleccionados</div>
                @php $mods = is_array($intent->modules) ? $intent->modules : []; @endphp
                @if(count($mods))
                    <ul>
                        @foreach($mods as $m)
                            <li class="li">{{ is_array($m) ? ($m['name'] ?? json_encode($m)) : $m }}</li>
                        @endforeach
                    </ul>
                @else
                    <p class="muted">Sin módulos adicionales seleccionados.</p>
                @endif
            </div>
            <div class="mt">
                <div class="muted">Totales (detalle técnico)</div>
                <pre class="code">{{ json_encode($intent->totals, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) }}</pre>
            </div>
        </div>
        <p class="muted mt">Pronto nos pondremos en contacto para completar tu proceso de compra.</p>
        <p class="muted">Equipo Guro</p>
    </div>
</body>
</html>


