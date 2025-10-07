# Arquitectura del Sistema de Gestión de Cartera

## 1. Modelo de Datos

### 1.1 Tablas Principales

#### `pagos_polizas` - Recaudos de Clientes
```sql
- id (PK)
- broker_id (FK)
- poliza_id (FK)
- cliente_id (FK)
- monto_total (decimal)
- monto_pagado (decimal)
- monto_pendiente (decimal)
- tipo_recaudo (enum: 'oficina', 'aseguradora')
- metodo_pago (string)
- fecha_pago (date)
- referencia_pago (string)
- comprobante_url (string)
- estado (enum: 'pendiente', 'parcial', 'pagado')
- observaciones (text)
- created_at, updated_at
```

#### `cobros_comisiones` - Comisiones de Aseguradoras
```sql
- id (PK)
- broker_id (FK)
- poliza_id (FK)
- aseguradora_id (FK)
- pago_poliza_id (FK) - Referencia al recaudo que habilitó esta comisión
- monto_comision (decimal)
- monto_cobrado (decimal)
- monto_pendiente (decimal)
- fecha_cobro (date)
- referencia_cobro (string)
- comprobante_url (string)
- estado (enum: 'pendiente', 'parcial', 'cobrado')
- observaciones (text)
- created_at, updated_at
```

#### `liquidaciones_vendedores` - Pagos a Vendedores
```sql
- id (PK)
- broker_id (FK)
- vendedor_id (FK)
- poliza_id (FK)
- cobro_comision_id (FK) - Referencia al cobro que habilitó esta liquidación
- monto_comision (decimal)
- monto_pagado (decimal)
- monto_pendiente (decimal)
- fecha_pago (date)
- metodo_pago (string)
- referencia_pago (string)
- comprobante_url (string)
- estado (enum: 'pendiente', 'parcial', 'pagado')
- observaciones (text)
- created_at, updated_at
```

## 2. Flujo de Negocio

### 2.1 Flujo de Recaudo (Cartera de Clientes)

```
Cliente paga prima
    ↓
Registrar recaudo
    ↓
Seleccionar tipo: ¿Quién recauda?
    ├─→ Oficina: Se crea registro en pagos_polizas (tipo='oficina')
    │   └─→ Habilita comisión por cobrar a aseguradora
    │
    └─→ Aseguradora: Se crea registro en pagos_polizas (tipo='aseguradora')
        └─→ NO habilita comisión (ya la tiene la aseguradora)
```

### 2.2 Flujo de Comisiones

```
Recaudo tipo 'oficina' registrado
    ↓
Se crea automáticamente registro en cobros_comisiones
    ├─→ estado: 'pendiente'
    ├─→ monto_comision: calculado de póliza
    └─→ monto_pendiente: monto_comision
    ↓
Aseguradora paga comisión
    ↓
Registrar cobro de comisión
    ↓
Actualizar cobros_comisiones
    ├─→ monto_cobrado += monto
    ├─→ monto_pendiente -= monto
    └─→ estado: 'cobrado' si monto_pendiente = 0
    ↓
Si póliza tiene vendedor asignado
    └─→ Crear/actualizar liquidaciones_vendedores
```

### 2.3 Flujo de Liquidación de Vendedores

```
Comisión cobrada de aseguradora
    ↓
Si póliza.vendedor_id existe
    ↓
Se crea automáticamente registro en liquidaciones_vendedores
    ├─→ estado: 'pendiente'
    ├─→ monto_comision: % del vendedor sobre comisión
    └─→ monto_pendiente: monto_comision
    ↓
Liquidar vendedor
    ↓
Registrar pago a vendedor
    ↓
Actualizar liquidaciones_vendedores
    ├─→ monto_pagado += monto
    ├─→ monto_pendiente -= monto
    └─→ estado: 'pagado' si monto_pendiente = 0
```

## 3. Endpoints Backend

### 3.1 Cartera de Clientes

```
POST   /api/saas/cartera/recaudos
  - Registrar recaudo de cliente
  - Body: { poliza_id, monto, tipo_recaudo, metodo_pago, fecha_pago, referencia }
  - Crea registro en pagos_polizas
  - Si tipo='oficina', crea cobros_comisiones automáticamente

GET    /api/saas/cartera/recaudos
  - Listar recaudos con filtros
  - Params: poliza_id, cliente_id, estado, fecha_desde, fecha_hasta

PUT    /api/saas/cartera/recaudos/{id}
  - Actualizar recaudo (ajustes, correcciones)

GET    /api/saas/cartera/estadisticas
  - Estadísticas de cartera (por cobrar, recaudado, etc.)
```

### 3.2 Comisiones

```
GET    /api/saas/comisiones/por-cobrar
  - Listar comisiones pendientes de cobrar
  - Filtros: aseguradora, estado, fecha

POST   /api/saas/comisiones/registrar-cobro
  - Registrar cobro de comisión de aseguradora
  - Body: { cobro_comision_id, monto, fecha_cobro, referencia }
  - Actualiza cobros_comisiones
  - Si póliza tiene vendedor, crea/actualiza liquidaciones_vendedores

GET    /api/saas/comisiones/cobradas
  - Listar comisiones ya cobradas
  - Filtros: aseguradora, fecha_desde, fecha_hasta

GET    /api/saas/comisiones/estadisticas
  - Estadísticas de comisiones (pendiente, cobrado, tasa)
```

### 3.3 Liquidaciones de Vendedores

```
GET    /api/saas/liquidaciones/por-pagar
  - Listar comisiones pendientes de pagar a vendedores
  - Filtros: vendedor_id, estado, periodo

POST   /api/saas/liquidaciones/pagar
  - Registrar pago a vendedor
  - Body: { liquidacion_id, monto, metodo_pago, fecha_pago, referencia }
  - Actualiza liquidaciones_vendedores

GET    /api/saas/liquidaciones/pagadas
  - Listar liquidaciones ya pagadas
  - Filtros: vendedor_id, fecha_desde, fecha_hasta

GET    /api/saas/liquidaciones/por-vendedor
  - Consolidado por vendedor
  - Agrupa: total, pagado, pendiente, % pago

GET    /api/saas/liquidaciones/estadisticas
  - Estadísticas de liquidaciones
```

## 4. Reglas de Negocio

### 4.1 Recaudos
- Solo se pueden registrar recaudos para pólizas ACTIVAS
- El monto no puede exceder el total de la póliza
- Si tipo='oficina', se habilita automáticamente comisión por cobrar
- Si tipo='aseguradora', NO se crea comisión por cobrar

### 4.2 Comisiones
- Solo aparecen en "Por Cobrar" si el recaudo fue tipo='oficina'
- El monto de comisión se calcula de: poliza.comision O (prima_neta × comision_agencia/100)
- Al cobrar, si hay vendedor asignado, se crea liquidación automáticamente

### 4.3 Liquidaciones
- Solo aparecen si la póliza tiene vendedor_id asignado
- El monto se calcula según: vendedor.porcentaje_comision sobre la comisión cobrada
- Solo se pueden liquidar comisiones que ya fueron cobradas

## 5. Estados y Transiciones

### Estado de Pagos/Cobros/Liquidaciones:
- **Pendiente**: 0% pagado
- **Parcial**: >0% y <100% pagado
- **Pagado/Cobrado**: 100% pagado

### Transiciones Permitidas:
```
Pendiente → Parcial → Pagado
Pendiente → Pagado (pago completo directo)
```

## 6. Cálculos Automáticos

### Comisión de Póliza:
```javascript
comision = poliza.comision || (poliza.prima_neta × poliza.comision_agencia / 100)
```

### Comisión de Vendedor:
```javascript
comisionVendedor = comisionPoliza × (vendedor.porcentaje_comision / 100)
```

### Tasas:
```javascript
tasaRecaudo = (totalRecaudado / totalFacturado) × 100
tasaCobroComisiones = (comisionesCobradas / totalComisiones) × 100
tasaPagoVendedores = (comisionesPagadas / totalComisionesVendedores) × 100
```

## 7. Integraciones Frontend-Backend

### Servicios a Crear:
- `carteraService.ts`: Gestión de recaudos
- `comisionesService.ts`: Gestión de comisiones (actualizar existente)
- `liquidacionesService.ts`: Gestión de liquidaciones

### Componentes a Actualizar:
- CarteraClientes: Conectar con carteraService
- ComisionesPorPoliza: Conectar con comisionesService
- LiquidarVendedores: Conectar con liquidacionesService

## 8. Validaciones

### Frontend:
- Monto > 0
- Fecha válida
- Referencia única
- Archivo de comprobante (opcional)

### Backend:
- Verificar pertenencia al broker
- Validar estado de póliza
- Validar montos no excedan totales
- Prevenir duplicados por referencia
- Validar secuencia de flujo (no liquidar antes de cobrar)

## 9. Próxima Implementación

1. Crear migraciones de BD
2. Crear modelos Eloquent
3. Crear controladores backend
4. Crear servicios frontend
5. Implementar modales de registro
6. Conectar acciones con backend
7. Agregar validaciones
8. Probar flujo completo

---

**Estado Actual:** Estructura UI completa, lista para integración backend.
**Siguiente Paso:** Crear migraciones de base de datos.