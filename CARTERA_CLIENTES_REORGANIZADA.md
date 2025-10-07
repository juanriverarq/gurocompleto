# Reorganización de Cartera de Clientes - Gestión por Pólizas

## Resumen de Cambios

Se ha reorganizado completamente la página de **Cartera de Clientes** siguiendo las mejores prácticas de intermediación de seguros, enfocándose en la **gestión por pólizas** con secciones de **cuentas por cobrar** y **cuentas por pagar**.

## Cambios Principales

### 1. **Enfoque en Gestión por Pólizas**

**ANTES:**
- Vista centrada en clientes
- Datos agregados sin detalle
- No mostraba cuentas por cobrar/pagar

**AHORA:**
- Vista centrada en **pólizas individuales**
- Cada póliza muestra su estado financiero completo
- Secciones dedicadas para cuentas por cobrar y por pagar

### 2. **Estructura de Tabs Profesional**

#### **Tab 1: Cartera General**
Vista completa de todas las pólizas mostrando:
- Número de póliza
- Cliente y documento
- Aseguradora y ramo
- Estado de la póliza
- Prima neta y comisión
- Fecha de vencimiento y días restantes
- Estado de pago (Al día, Pendiente, Vencido, Parcial)

#### **Tab 2: Por Cobrar (Cuentas por Cobrar a Clientes)**
Gestión de cobros a clientes:
- **Estadísticas:**
  - Total por cobrar
  - Vencido (en mora)
  - Recaudado
  - Tasa de recaudo (%)
- **Tabla detallada:**
  - Total facturado
  - Valor recaudado
  - Valor pendiente
  - Días de mora
  - Botón "Registrar Pago"

#### **Tab 3: Por Pagar (Cuentas por Pagar a Aseguradoras)**
Gestión de pagos a aseguradoras:
- **Estadísticas:**
  - Total por pagar
  - Vencido
  - Pagado
  - Tasa de pago (%)
- **Tabla detallada:**
  - Prima neta a pagar
  - Valor pagado
  - Valor pendiente
  - Vencimiento
  - Botón "Registrar Pago"

#### **Tab 4: Por Clientes**
Vista consolidada por cliente:
- Cantidad de pólizas
- Prima total
- Comisiones generadas
- Total por cobrar
- Próximo vencimiento
- Acciones rápidas (editar, nueva póliza)

### 3. **Estadísticas Principales**

**Dashboard Superior:**
- **Pólizas en Cartera**: Total y activas
- **Por Cobrar**: Total y vencido (clientes)
- **Por Pagar**: Total y vencido (aseguradoras)
- **Comisiones**: Total y tasa de recaudo

### 4. **Filtros Avanzados**

- Búsqueda: póliza, cliente, aseguradora
- Estado de póliza: Activa, Vencida, Cancelada, Suspendida
- Estado de pago: Al día, Pendiente, Vencido, Parcial
- Aseguradora
- Ordenamiento: Vencimiento, Prima, Por Cobrar, Por Pagar, Cliente

### 5. **Indicadores de Estado**

**Estado de Póliza:**
- 🟢 **Activa**: Póliza vigente
- 🟡 **Vencida**: Póliza vencida
- 🔴 **Cancelada**: Póliza cancelada
- ⚫ **Suspendida**: Póliza suspendida

**Estado de Pago:**
- 🟢 **Al día**: Pagos al corriente
- 🟡 **Pendiente**: Pago pendiente sin vencer
- 🔴 **Vencido**: Pago vencido (en mora)
- 🔵 **Parcial**: Pago parcial realizado

### 6. **Cálculos Automáticos**

#### Valores Financieros
```typescript
primaNeta = valor base de la póliza
iva = primaNeta × (porcentaje_iva / 100)
total = primaNeta + iva
comision = primaNeta × (comision_agencia / 100)
```

#### Cuentas por Cobrar (Clientes)
```typescript
valorPendienteCliente = total - valorRecaudado
tasaRecaudo = (recaudadoTotal / totalFacturado) × 100
```

#### Cuentas por Pagar (Aseguradoras)
```typescript
valorPendienteAseguradora = primaNeta - valorPagadoAseguradora
tasaPago = (pagadoTotal / totalAPagar) × 100
```

#### Días de Mora
```typescript
diasMora = días desde vencimiento (si estadoPago === 'Vencido')
```

### 7. **Flujo de Trabajo de Intermediación**

1. **Emisión de Póliza**
   - Se crea la póliza
   - Se genera cuenta por cobrar al cliente
   - Se genera cuenta por pagar a la aseguradora

2. **Cobro al Cliente**
   - Se registra el pago del cliente
   - Se actualiza `valorRecaudado`
   - Se reduce `valorPendienteCliente`
   - Se calcula comisión

3. **Pago a Aseguradora**
   - Se registra el pago a la aseguradora
   - Se actualiza `valorPagadoAseguradora`
   - Se reduce `valorPendienteAseguradora`

4. **Seguimiento de Mora**
   - Alertas automáticas de pagos vencidos
   - Cálculo de días de mora
   - Identificación de clientes morosos

## Ventajas de la Nueva Estructura

1. **Gestión por Pólizas**: Vista detallada de cada póliza individual
2. **Control Financiero**: Seguimiento de cobros y pagos
3. **Alertas de Mora**: Identificación de pagos vencidos
4. **Trazabilidad**: Historial completo de cada póliza
5. **Indicadores de Gestión**: Tasas de recaudo y pago
6. **Flujo de Caja**: Visión clara de entradas y salidas
7. **Comisiones**: Cálculo automático por póliza

## Secciones Implementadas

### ✅ Cartera General
- Listado completo de todas las pólizas
- Información financiera y de vencimiento
- Estados de póliza y pago

### ✅ Por Cobrar (Clientes)
- Pólizas con saldo pendiente de clientes
- Valores recaudados vs pendientes
- Identificación de mora
- Acción: Registrar pago de cliente

### ✅ Por Pagar (Aseguradoras)
- Pólizas con saldo pendiente a aseguradoras
- Valores pagados vs pendientes
- Control de vencimientos
- Acción: Registrar pago a aseguradora

### ✅ Por Clientes
- Vista consolidada por cliente
- Totales de pólizas, primas y comisiones
- Saldos por cobrar por cliente
- Acceso rápido a gestión de cliente

## Próximos Pasos Recomendados

1. **Backend - Campos de Pago**
   - Agregar campos `valor_recaudado`, `valor_pagado_aseguradora` a tabla `polizas`
   - Crear tabla `pagos_clientes` para historial de cobros
   - Crear tabla `pagos_aseguradoras` para historial de pagos

2. **Funcionalidad de Registro de Pagos**
   - Modal para registrar pago de cliente
   - Modal para registrar pago a aseguradora
   - Actualización automática de saldos

3. **Reportes**
   - Reporte de antigüedad de saldos
   - Reporte de flujo de caja
   - Reporte de comisiones por cobrar

4. **Alertas Automáticas**
   - Notificaciones de pagos vencidos
   - Recordatorios de vencimientos próximos
   - Alertas de mora

5. **Integración Bancaria**
   - Conciliación automática de pagos
   - Importación de extractos bancarios
   - Matching automático de pagos

## Archivos Modificados

- [`frontend/src/views/apps/cartera/CarteraClientes.tsx`](frontend/src/views/apps/cartera/CarteraClientes.tsx) - Completamente reorganizado

## Archivos Relacionados

- [`frontend/src/services/polizaService.ts`](frontend/src/services/polizaService.ts) - Servicio de pólizas
- [`frontend/src/views/apps/seguros/polizas/Polizas.tsx`](frontend/src/views/apps/seguros/polizas/Polizas.tsx) - Módulo de pólizas
- [`frontend/src/views/apps/seguros/clientes/Clientes.tsx`](frontend/src/views/apps/seguros/clientes/Clientes.tsx) - Módulo de clientes

## Nota Importante

Actualmente los valores de **por cobrar** y **por pagar** están simulados con lógica del frontend. Para producción, estos valores deben venir del backend con:
- Registro real de pagos recibidos
- Registro real de pagos realizados
- Cálculo de mora basado en fechas de vencimiento
- Historial de transacciones