# Guro Cartera Analyzer

Microservicio Python independiente para análisis de cruces de datos entre la base de datos de Guro y los archivos Excel exportados de SoftSeguros.

## Estructura

```
cartera_analyzer/
├── run_analysis.py          # Script principal (CLI)
├── config.py                # Configuración DB local/remota + rutas Excel
├── db_connector.py          # Conexión MySQL (SQLAlchemy) + queries
├── excel_loader.py          # Carga y normaliza archivos Excel SoftSeguros
├── report_generator.py      # Genera reportes HTML + CSV
├── analyzers/               # Módulos de análisis
│   ├── poliza_cross.py      # Cruce pólizas DB vs SoftSeguros
│   ├── renovaciones.py      # Coherencia de renovaciones
│   ├── cartera_integrity.py # Integridad saldos, pagos, cuotas
│   ├── aseguradoras.py      # FKs y nombres de aseguradoras
│   ├── recibos_cross.py     # Cruce recibos entre sistemas
│   └── comisiones.py        # Análisis de comisiones
├── output/                  # Reportes generados (HTML + CSV)
└── requirements.txt
```

## Instalación

```bash
pip3 install -r requirements.txt
```

## Uso

```bash
# Análisis completo (DB local + Excel)
python3 run_analysis.py

# Solo un módulo específico
python3 run_analysis.py --only=renovaciones

# Cambiar broker
python3 run_analysis.py --broker=54

# Solo análisis de Excel (sin DB)
python3 run_analysis.py --skip-db

# Usar DB de producción (cambiar MODE en config.py a "remote")
```

## Módulos de análisis

| Módulo | Detecta |
|--------|---------|
| **poliza_cross** | Pólizas que no existen en uno de los dos sistemas, diferencias de prima, renovaciones |
| **renovaciones** | Pólizas con R>0 sin cartera en esa renovación, múltiples renovaciones, pagos cruzados |
| **cartera_integrity** | Items huérfanos, saldos negativos, cuotas duplicadas, saldos descuadrados vs pagos |
| **aseguradoras** | IDs de aseguradora inválidos, nombres sin match entre sistemas |
| **recibos_cross** | Recibos no migrados, anulados en Soft pero activos en Guro, resumen financiero |
| **comisiones** | Cobros excedidos, saldos negativos, comisiones no rastreadas, cruce con SoftSeguros |

## Reportes

- **HTML**: Reporte interactivo con tablas expandibles, KPIs y hallazgos por severidad
- **CSV**: Un archivo por cada detalle encontrado para análisis en Excel
- Ubicación: `output/reporte_cartera_latest.html`

## Configuración

Editar `config.py`:
- `MODE = "local"` para XAMPP local
- `MODE = "remote"` para producción vía SSH tunnel
- `BROKER_ID = 54` para cambiar broker por defecto
