# 📋 Sistema de Liquidación de Vendedores - Documentación Completa

## 🎯 Objetivo
Implementar un sistema robusto para liquidar comisiones de vendedores/asesores con:
- Filtros avanzados (periodos, ramos, aseguradoras)
- Generación de PDF tipo recibo de pago
- Múltiples comisiones por liquidación
- Registro histórico completo
- Capacidad de reversión

---

## 🏗️ Arquitectura de la Solución

### 1. **Estructura de Base de Datos**

#### Tabla Principal: `liquidaciones_vendedores`
```sql
- id
- codigo (único: LIQ-2025-001)
- broker_id
- vendedor_id
- periodo_inicio / periodo_fin
- fecha_generacion
- filtros_aplicados (JSON)
- prima_total
- monto_bruto_total
- monto_retencion_total
- monto_retencion_ica_total
- monto_iva_total
- monto_neto_total
- cantidad_polizas
- estado (generada, aprobada, pagada, revertida)
- fecha_pago / metodo_pago / referencia_pago
- pdf_url
- observaciones
- creado_por / aprobado_por / revertido_por
- timestamps de auditoría
```

#### Tabla Detalle: `liquidaciones_vendedores_detalle`
```sql
- id
- liquidacion_id (FK)
- poliza_id (FK)
- numero_poliza
- cliente_nombre
- aseguradora / ramo
- fecha_poliza
- prima_neta
- porcentaje_comision
- comision_bruta
- porcentaje_retencion / monto_retencion
- porcentaje_retencion_ica / monto_retencion_ica
- porcentaje_iva / monto_iva
- comision_neta
```

---

### 2. **Estados de Liquidación**

```
GENERADA → APROBADA → PAGADA
    ↓          ↓          ↓
    ← ← ← REVERTIDA ← ← ←
```

**Flujo de Estados:**
1. **GENERADA**: Liquidación creada, puede editarse o eliminarse
2. **APROBADA**: Revisada y aprobada, lista para pago
3. **PAGADA**: Comisión pagada al vendedor
4. **REVERTIDA**: Anulada por error (conserva registro histórico)

---

### 3. **Endpoints Backend** ✅ IMPLEMENTADO

#### Base URL: `/api/liquidaciones-vendedores`

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| GET | `/comisiones-disponibles` | Lista comisiones pendientes con filtros |
| POST | `/vista-previa` | Genera vista previa antes de crear |
| GET | `/` | Lista todas las liquidaciones |
| POST | `/` | Crea nueva liquidación |
| GET | `/{id}` | Detalle de liquidación específica |
| POST | `/{id}/aprobar` | Aprueba liquidación |
| POST | `/{id}/registrar-pago` | Registra pago de liquidación |
| POST | `/{id}/revertir` | Revierte liquidación |
| GET | `/{id}/pdf` | Genera y descarga PDF |

---

### 4. **Funcionalidades Implementadas (Backend)**

#### ✅ A. Filtros de Comisiones
```javascript
// Filtros disponibles:
- vendedor_id
- fecha_inicio / fecha_fin
- aseguradoras[] (array)
- ramos[] (array)
- Excluye pólizas ya liquidadas
```

#### ✅ B. Vista Previa
Antes de crear la liquidación, se puede ver:
- Resumen del vendedor
- Listado de pólizas incluidas
- Cálculo de totales
- Desglose de retenciones

#### ✅ C. Creación de Liquidación
- Genera código único automático (LIQ-2025-001)
- Calcula todos los montos
- Crea cabecera y detalles en transacción
- Auditoría completa

#### ✅ D. Gestión de Estados
- **Aprobar**: Solo desde estado "generada"
- **Registrar Pago**: Desde "generada" o "aprobada"
- **Revertir**: Desde cualquier estado excepto "revertida"

#### ✅ E. Historial y Auditoría
- Registro de quién creó, aprobó, pagó
- Fechas de cada acción
- Motivo de reversión obligatorio

---

### 5. **Interfaz de Usuario Propuesta**

#### 🎨 A. Modal de Liquidación (sobre tabla actual)

```
┌─────────────────────────────────────────────────┐
│ 🧾 Nueva Liquidación de Vendedor               │
├─────────────────────────────────────────────────┤
│                                                 │
│ 📋 PASO 1: Filtros                            │
│ ┌────────────────────────────────────────┐    │
│ │ Vendedor: [Dropdown]                   │    │
│ │ Período:  [Fecha Inicio] - [Fecha Fin] │    │
│ │ Aseguradoras: [Multi-select]           │    │
│ │ Ramos: [Multi-select]                  │    │
│ │                   [Buscar Comisiones]  │    │
│ └────────────────────────────────────────┘    │
│                                                 │
│ 📊 PASO 2: Vista Previa                       │
│ ┌────────────────────────────────────────┐    │
│ │ Vendedor: Juan Pérez                   │    │
│ │ Documento: CC 123456789                │    │
│ │ Cuenta: 1234567890                     │    │
│ │                                         │    │
│ │ ✓ 15 pólizas seleccionadas             │    │
│ │                                         │    │
│ │ Prima Total:      $50,000,000          │    │
│ │ Comisión Bruta:   $ 7,500,000          │    │
│ │ Retención (11%):  $  -825,000          │    │
│ │ Ret. ICA (0.5%):  $   -37,500          │    │
│ │ IVA (19%):        $ 1,425,000          │    │
│ │ ─────────────────────────────          │    │
│ │ Comisión Neta:    $ 8,062,500          │    │
│ │                                         │    │
│ │ [Ver Detalle Completo]                 │    │
│ └────────────────────────────────────────┘    │
│                                                 │
│ 📝 Observaciones:                              │
│ [Textarea]                                     │
│                                                 │
│        [Cancelar]  [Generar Liquidación]      │
└─────────────────────────────────────────────────┘
```

#### 🎨 B. Tab adicional "Histórico de Liquidaciones"

```
┌──────────────────────────────────────────────┐
│ Tabs: [Por Pagar] [Pagadas] [Por Vendedor] │
│       [Histórico Liquidaciones] 👈 NUEVO    │
├──────────────────────────────────────────────┤
│                                              │
│ Filtros: [Estado] [Vendedor] [Fecha]       │
│                                              │
│ ┌────────────────────────────────────────┐  │
│ │ Código    Vendedor  Período    Estado │  │
│ ├────────────────────────────────────────┤  │
│ │ LIQ-001   Juan P.   Ene 2025   Pagada │  │
│ │ LIQ-002   María G.  Ene 2025   Aprob. │  │
│ │ LIQ-003   Carlos R. Ene 2025   Gener. │  │
│ │ LIQ-004   Ana L.    Dic 2024  Revert. │  │
│ └────────────────────────────────────────┘  │
│                                              │
│ Acciones: [Ver] [PDF] [Aprobar] [Pagar]    │
│          [Revertir]                          │
└──────────────────────────────────────────────┘
```

---

### 6. **Formato del PDF Propuesto**

```
╔═══════════════════════════════════════════════╗
║         COMPROBANTE DE LIQUIDACIÓN            ║
║                                               ║
║  Código: LIQ-2025-001                        ║
║  Fecha: 22/01/2025                           ║
╠═══════════════════════════════════════════════╣
║                                               ║
║  DATOS DEL VENDEDOR/ASESOR                   ║
║  Nombre: Juan Pérez García                   ║
║  Documento: CC 1234567890                    ║
║  Cuenta Bancaria: 1234567890 - Bancolombia   ║
║  Período: 01/01/2025 - 31/01/2025           ║
║                                               ║
╠═══════════════════════════════════════════════╣
║                                               ║
║  DETALLE DE COMISIONES                       ║
║  ───────────────────────────────────────     ║
║                                               ║
║  Nº    Póliza    Cliente      Prima  Com.   ║
║  ──────────────────────────────────────────  ║
║  1   POL-123   María López   $5M   $750K    ║
║  2   POL-124   Pedro Gómez   $3M   $450K    ║
║  ...                                          ║
║  15  POL-137   Ana Ruiz      $2M   $300K    ║
║                                               ║
╠═══════════════════════════════════════════════╣
║                                               ║
║  RESUMEN FINANCIERO                          ║
║  ───────────────────────────────────────     ║
║                                               ║
║  Total Primas:             $ 50,000,000      ║
║  Comisión Bruta (15%):     $  7,500,000      ║
║                                               ║
║  DESCUENTOS:                                  ║
║  - Retención (11%):        $   -825,000      ║
║  - Retención ICA (0.5%):   $    -37,500      ║
║                                               ║
║  ADICIONES:                                   ║
║  + IVA (19%):              $  1,425,000      ║
║                                               ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    ║
║  COMISIÓN NETA A PAGAR:    $  8,062,500      ║
║  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    ║
║                                               ║
╠═══════════════════════════════════════════════╣
║                                               ║
║  INFORMACIÓN DE PAGO                          ║
║  Método: Transferencia Bancaria               ║
║  Referencia: TRF-20250122-001                ║
║  Fecha: 22/01/2025                           ║
║                                               ║
║  ─────────────────────────                   ║
║  Firma Autorizada                            ║
║                                               ║
╚═══════════════════════════════════════════════╝
```

---

### 7. **Casos de Uso**

#### 📝 Caso 1: Liquidación Mensual Completa
```
1. Usuario va a "Liquidar Vendedores"
2. Click en "Nueva Liquidación"
3. Selecciona vendedor: Juan Pérez
4. Período: 01/01/2025 - 31/01/2025
5. Sistema muestra 15 pólizas disponibles
6. Revisa totales: $8,062,500
7. Click "Generar Liquidación"
8. Sistema crea LIQ-2025-001
9. Se puede descargar PDF
```

#### 📝 Caso 2: Liquidación con Filtros
```
1. Nueva liquidación
2. Selecciona vendedor: María González
3. Período: Todo enero
4. Filtro Aseguradora: Solo "Seguros Bolívar"
5. Filtro Ramo: Solo "Vida"
6. Sistema muestra 3 pólizas
7. Genera liquidación específica
```

#### 📝 Caso 3: Aprobar y Pagar
```
1. Ve liquidación LIQ-2025-002
2. Revisa detalle
3. Click "Aprobar" (cambia a estado Aprobada)
4. Click "Registrar Pago"
5. Ingresa:
   - Método: Transferencia
   - Referencia: TRF-001
   - Fecha: 22/01/2025
6. Sistema marca como Pagada
7. Descarga PDF con info de pago
```

#### 📝 Caso 4: Revertir por Error
```
1. Ve liquidación LIQ-2025-003
2. Detecta error (póliza mal incluida)
3. Click "Revertir"
4. Ingresa motivo: "Póliza POL-150 no corresponde"
5. Sistema marca como Revertida
6. Puede crear nueva liquidación correcta
```

---

### 8. **Ventajas de esta Arquitectura**

✅ **Trazabilidad Completa**
- Registro de todas las acciones
- Auditoría de quién hizo qué y cuándo

✅ **Flexibilidad**
- Filtros configurables
- Múltiples criterios de selección

✅ **Seguridad**
- Estados bien definidos
- No se pueden modificar liquidaciones pagadas
- Reversión con motivo obligatorio

✅ **Escalabilidad**
- Estructura preparada para muchos registros
- Índices en campos clave

✅ **Integridad**
- Una póliza no puede estar 2 veces en la misma liquidación
- Cálculos automáticos sin errores manuales

---

### 9. **Próximos Pasos de Implementación**

#### ✅ YA COMPLETADO (Backend)
- [x] Migración de base de datos
- [x] Modelos con relaciones
- [x] Controlador con todos los endpoints
- [x] Rutas API registradas
- [x] Lógica de negocio (aprobar, pagar, revertir)

#### 🔄 POR HACER (Frontend)
- [ ] Modal de Nueva Liquidación
- [ ] Filtros y selección de pólizas
- [ ] Vista previa con cálculos
- [ ] Tab "Histórico de Liquidaciones"
- [ ] Acciones: Aprobar, Pagar, Revertir
- [ ] Integración con API

#### 🔄 POR HACER (PDF)
- [ ] Template de PDF con librería
- [ ] Generación automática
- [ ] Almacenamiento en servidor
- [ ] Descarga desde frontend

---

### 10. **Consideraciones Técnicas**

#### Generación de PDF
Opciones recomendadas:
- **DomPDF** (PHP): Fácil, convierte HTML a PDF
- **Snappy/Wkhtmltopdf**: Más potente, mejor calidad
- **TCPDF**: Control fino sobre el diseño

#### Almacenamiento de PDFs
- Carpeta: `storage/app/liquidaciones/`
- Estructura: `YYYY/MM/LIQ-YYYY-XXX.pdf`
- URL pública para descarga

#### Permisos y Seguridad
- Solo usuarios autorizados pueden crear liquidaciones
- Solo admins pueden aprobar
- Auditoría completa de acciones
- Validación en backend y frontend

---

## 📊 Resumen Ejecutivo

Este sistema permite **liquidar comisiones de vendedores de forma profesional**, con:

✅ **Filtros avanzados** para seleccionar exactamente qué comisiones pagar  
✅ **Cálculos automáticos** de retenciones, ICA e IVA  
✅ **PDF profesional** tipo recibo de pago  
✅ **Control de estados** desde generación hasta pago  
✅ **Reversión segura** cuando hay errores  
✅ **Auditoría completa** de todas las operaciones  
✅ **Histórico** de todas las liquidaciones  

El backend está **100% implementado y listo para usar**. Solo falta construir la interfaz de usuario en React/TypeScript y configurar la generación de PDFs.
