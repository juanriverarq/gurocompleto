<?php

namespace App\Services;

/**
 * Contexto del esquema de base de datos para la IA
 * Proporciona información estructurada sobre tablas, columnas y relaciones
 */
class DatabaseSchemaContext
{
    /**
     * Obtener el esquema completo de la BD para contexto de IA
     */
    public static function getSchemaForAI(): string
    {
        return <<<SCHEMA
# ESQUEMA DE BASE DE DATOS - SISTEMA GURO (Gestión de Seguros)

## TABLAS PRINCIPALES Y SUS COLUMNAS

### 1. POLIZAS (polizas) - Pólizas de seguros
Columnas principales:
- id: INT (PK)
- broker_id: INT (FK → brokers.id) - SIEMPRE filtrar por este campo
- policy_number: VARCHAR - Número de póliza
- internal_number: VARCHAR - Número interno
- type: VARCHAR - Tipo de seguro (vida, autos, hogar, salud, empresarial, accidentes)
- product_name: VARCHAR - Nombre del producto
- insurance_company: VARCHAR - Nombre de la aseguradora
- aseguradora_id: INT (FK → aseguradoras.id)
- ramo_id: INT (FK → ramos.id)
- client_id: INT (FK → clientes.id)
- client_name: VARCHAR - Nombre del cliente (denormalizado)
- client_document: VARCHAR - Documento del cliente
- issue_date: DATE - Fecha de emisión
- start_date: DATE - Fecha de inicio de vigencia
- end_date: DATE - Fecha de fin de vigencia
- renewal_date: DATE - Fecha de renovación
- premium_amount: DECIMAL - Prima total
- insured_amount: DECIMAL - Suma asegurada
- deductible: DECIMAL - Deducible
- commission_percentage: DECIMAL - Porcentaje de comisión
- commission_amount: DECIMAL - Monto de comisión
- vat_amount: DECIMAL - IVA
- total_amount: DECIMAL - Total
- status: ENUM('active','inactive','expired','cancelled','suspended','pending')
- payment_status: ENUM('paid','pending','overdue','cancelled')
- payment_frequency: ENUM('monthly','quarterly','biannual','annual')
- seller_id: INT (FK → vendedores.id) - Vendedor principal
- seller_name: VARCHAR
- created_at, updated_at: TIMESTAMP
- deleted_at: TIMESTAMP (soft delete)

### 2. CLIENTES (clientes) - Clientes/Asegurados
Columnas principales:
- id: INT (PK)
- broker_id: INT (FK) - SIEMPRE filtrar por este campo
- client_type: ENUM('natural','juridica') - Persona natural o jurídica
- first_name: VARCHAR - Nombre
- last_name: VARCHAR - Apellido
- document_type: ENUM('CC','CE','NIT','TI','PA')
- document_number: VARCHAR - Número de documento
- email: VARCHAR
- phone: VARCHAR
- mobile_phone: VARCHAR
- birth_date: DATE
- gender: ENUM('M','F','O')
- address: VARCHAR
- city: VARCHAR
- department: VARCHAR
- status: ENUM('active','inactive','prospect','blocked')
- total_policies_count: INT
- total_policies_value: DECIMAL
- created_at, updated_at: TIMESTAMP

### 3. SINIESTROS (siniestros) - Reclamaciones/Siniestros
Columnas principales:
- id: INT (PK)
- broker_id: INT (FK) - SIEMPRE filtrar por este campo
- poliza_id: INT (FK → polizas.id)
- cliente_id: INT (FK → clientes.id)
- numero_siniestro: VARCHAR
- numero_siniestro_compania: VARCHAR
- tipo_seguro: VARCHAR
- tipo_siniestro: VARCHAR
- fecha_ocurrencia: DATE
- fecha_aviso: DATE
- fecha_reporte: DATETIME
- estado: ENUM('reportado','en_revision','asignado','investigacion','peritaje','aprobado','rechazado','pagado','cerrado')
- monto_reclamado: DECIMAL
- monto_aprobado: DECIMAL
- monto_pagado: DECIMAL
- descripcion_evento: TEXT
- causa_siniestro: VARCHAR
- lugar_ocurrencia: VARCHAR
- created_at, updated_at: TIMESTAMP

### 4. SALES_FUNNEL (sales_funnel) - Embudo de ventas/Negocios
Columnas principales:
- id: INT (PK)
- broker_id: INT (FK) - SIEMPRE filtrar por este campo
- client_id: INT (FK → clientes.id)
- assigned_agent_id: INT (FK)
- first_name, last_name: VARCHAR
- email, phone: VARCHAR
- stage: ENUM('lead','contacted','qualified','presentation','proposal','negotiation','closed_won','closed_lost')
- business_state: VARCHAR
- lead_source: VARCHAR
- insurance_type: VARCHAR
- potential_value: DECIMAL
- close_probability: INT (0-100)
- expected_close_date: DATE
- created_at, updated_at: TIMESTAMP

### 5. VENDEDORES (vendedores) - Agentes/Vendedores (SIN soft delete)
Columnas principales:
- id: INT (PK)
- broker_id: INT (FK) - SIEMPRE filtrar por este campo
- nombres: VARCHAR - Nombre del vendedor (USAR ESTE CAMPO, NO 'nombre')
- email: VARCHAR
- telefono: VARCHAR
- celular: VARCHAR
- tipo_documento: VARCHAR
- numero_documento: VARCHAR
- tipo_persona: VARCHAR
- porcentaje_comision: DECIMAL
- fecha_vinculacion: DATE
- created_at, updated_at: TIMESTAMP
- NOTA: El campo del nombre es 'nombres' NO 'nombre'

### 6. AUTOMOVILES (automoviles) - Vehículos asegurados (SIN soft delete)
Columnas principales:
- id: INT (PK)
- broker_id: INT (FK) - SIEMPRE filtrar por este campo
- poliza_id: INT (FK → polizas.id)
- client_id: INT (FK → clientes.id)
- placa: VARCHAR - Placa del vehículo
- marca: VARCHAR - Marca del vehículo
- linea: VARCHAR - Línea/modelo específico
- modelo: VARCHAR - Modelo del vehículo
- anio: INT - Año del vehículo
- vin: VARCHAR - Número VIN
- color: VARCHAR
- tipo_servicio: VARCHAR
- clase: VARCHAR
- referencia1, referencia2, referencia3: VARCHAR
- tipo_carroceria: VARCHAR
- numero_motor: VARCHAR
- numero_chasis: VARCHAR
- numero_serie: VARCHAR
- cilindraje: INT
- combustible: VARCHAR
- capacidad_pasajeros: INT
- capacidad_carga_kg: DECIMAL
- tipo_transmision: VARCHAR
- traccion: VARCHAR
- pais_origen: VARCHAR
- created_at, updated_at: TIMESTAMP
- NOTA: Esta tabla NO tiene deleted_at

### 7. PAGOS_POLIZAS (pagos_polizas) - Pagos de primas (SIN soft delete)
Columnas principales:
- id: INT (PK)
- broker_id: INT (FK) - SIEMPRE filtrar por este campo
- poliza_id: INT (FK → polizas.id)
- cliente_id: INT (FK → clientes.id)
- monto_total: DECIMAL - Monto total del pago
- monto_pagado: DECIMAL - Monto efectivamente pagado
- monto_pendiente: DECIMAL - Monto pendiente
- tipo_recaudo: ENUM('aseguradora','cliente') - Quién recauda
- metodo_pago: VARCHAR - Método de pago usado
- fecha_pago: DATE - Fecha del pago
- referencia_pago: VARCHAR - Referencia del pago
- comprobante_url: VARCHAR - URL del comprobante
- estado: ENUM('pendiente','pagado','vencido','parcial')
- observaciones: TEXT
- created_at, updated_at: TIMESTAMP
- NOTA: Esta tabla NO tiene deleted_at

### 8. COBROS_COMISIONES (cobros_comisiones) - Cobros de comisiones (SIN soft delete)
Columnas principales:
- id: INT (PK)
- broker_id: INT (FK) - SIEMPRE filtrar por este campo
- poliza_id: INT (FK → polizas.id)
- aseguradora_id: INT (FK → aseguradoras.id)
- pago_poliza_id: INT (FK → pagos_polizas.id)
- monto_comision: DECIMAL - Monto de comisión esperado
- monto_cobrado: DECIMAL - Monto efectivamente cobrado
- monto_pendiente: DECIMAL - Monto pendiente por cobrar
- fecha_cobro: DATE - Fecha del cobro
- referencia_cobro: VARCHAR - Referencia del cobro
- comprobante_url: VARCHAR - URL del comprobante
- estado: ENUM('pendiente','cobrado','parcial')
- observaciones: TEXT
- created_at, updated_at: TIMESTAMP
- NOTA: Esta tabla NO tiene deleted_at

### 9. ASEGURADORAS (aseguradoras) - Catálogo de aseguradoras (SIN soft delete)
Columnas principales:
- id: INT (PK)
- broker_id: INT (FK) - SIEMPRE filtrar por este campo
- nombre: VARCHAR - Nombre de la aseguradora
- cuit: VARCHAR - NIT/CUIT de la aseguradora
- email: VARCHAR
- direccion: VARCHAR
- telefono: VARCHAR
- cuenta_bancaria: VARCHAR
- link_pago: VARCHAR - Link para pagos
- codigo_intermediario: VARCHAR - Código del intermediario
- retencion: DECIMAL - Porcentaje de retención
- iva: DECIMAL - Porcentaje de IVA
- retencion_iva: DECIMAL
- created_at, updated_at: TIMESTAMP
- NOTA: Esta tabla NO tiene deleted_at

### 10. RAMOS (ramos) - Catálogo de ramos/tipos de seguro (SIN soft delete)
Columnas principales:
- id: INT (PK)
- broker_id: INT (FK) - SIEMPRE filtrar por este campo
- nombre: VARCHAR - Nombre del ramo (Autos, Vida, Hogar, etc.)
- subramo: VARCHAR - Subramo específico
- calcular_iva_pri_a_pre: BOOLEAN
- vista_mapa_oportunidad: VARCHAR
- created_at, updated_at: TIMESTAMP
- NOTA: Esta tabla NO tiene deleted_at

### 11. TASKS (tasks) - Tareas/Recordatorios (SIN soft delete)
Columnas principales:
- id: INT (PK)
- usuario_id: INT (FK) - Usuario asignado
- titulo: VARCHAR - Título de la tarea
- descripcion: TEXT - Descripción detallada
- tipo: VARCHAR - Tipo de tarea (llamada, reunion, seguimiento, etc.)
- prioridad: ENUM('alta','media','baja')
- estado: ENUM('pendiente','en_progreso','completada','cancelada')
- fecha_vencimiento: DATE - Fecha límite
- asignado_a: VARCHAR - Nombre del asignado
- cliente: VARCHAR - Cliente relacionado
- numero_poliza: VARCHAR - Póliza relacionada
- progreso: INT - Porcentaje de progreso (0-100)
- observaciones: TEXT
- created_at, updated_at: TIMESTAMP
- NOTA: Esta tabla NO tiene deleted_at, filtrar por usuario_id

### 12. CALENDAR_EVENTS (calendar_events) - Eventos de calendario
Columnas principales:
- id: INT (PK)
- broker_id: INT (FK) - SIEMPRE filtrar por este campo
- created_by: INT (FK → users.id)
- title: VARCHAR - Título del evento
- description: TEXT
- start_date: DATETIME - Fecha/hora inicio
- end_date: DATETIME - Fecha/hora fin
- all_day: BOOLEAN - Si es todo el día
- color: VARCHAR - Color del evento
- event_type: VARCHAR - Tipo de evento
- created_at, updated_at: TIMESTAMP
- deleted_at: TIMESTAMP (soft delete)

### 13. ANEXOS (anexos) - Anexos/Modificaciones de pólizas
Columnas principales:
- id: INT (PK)
- broker_id: INT (FK) - SIEMPRE filtrar por este campo
- poliza_id: INT (FK → polizas.id)
- anexo_number: VARCHAR - Número del anexo
- insurance_company: VARCHAR - Aseguradora
- branch: VARCHAR - Ramo
- issue_date: DATE - Fecha emisión
- reception_date: DATE - Fecha recepción
- risk: VARCHAR - Riesgo
- start_date: DATE - Fecha inicio vigencia
- end_date: DATE - Fecha fin vigencia
- prima_neta: DECIMAL - Prima neta
- vat_percentage: DECIMAL - % IVA
- pri_a_pre: DECIMAL - Prima a pagar
- commission_percentage: DECIMAL - % Comisión
- commission_amount: DECIMAL - Monto comisión
- total_amount: DECIMAL - Total
- payment_frequency: VARCHAR - Frecuencia de pago
- motivo: VARCHAR - Motivo del anexo
- status: VARCHAR - Estado
- created_at, updated_at: TIMESTAMP
- deleted_at: TIMESTAMP (soft delete)

### 14. VOICE_CAMPAIGNS (voice_campaigns) - Campañas de voz/llamadas
Columnas principales:
- id: INT (PK)
- broker_id: INT (FK) - SIEMPRE filtrar por este campo
- name: VARCHAR - Nombre de la campaña
- description: TEXT
- campaign_type: VARCHAR - Tipo de campaña
- voice_message_template: TEXT - Plantilla del mensaje
- status: ENUM('draft','scheduled','running','paused','completed','cancelled')
- is_active: BOOLEAN
- scheduled_date: DATETIME - Fecha programada
- next_execution: DATETIME
- last_execution: DATETIME
- total_targets: INT - Total de destinatarios
- calls_made: INT - Llamadas realizadas
- calls_successful: INT - Llamadas exitosas
- calls_failed: INT - Llamadas fallidas
- total_duration_seconds: INT - Duración total
- average_duration_seconds: INT - Duración promedio
- created_at, updated_at: TIMESTAMP
- deleted_at: TIMESTAMP (soft delete)

### 15. VOICE_CAMPAIGN_CALLS (voice_campaign_calls) - Llamadas individuales (SIN soft delete)
Columnas principales:
- id: INT (PK)
- voice_campaign_id: INT (FK → voice_campaigns.id)
- voice_campaign_execution_id: INT
- broker_id: INT (FK) - SIEMPRE filtrar por este campo
- recipient_phone: VARCHAR - Teléfono del destinatario
- recipient_name: VARCHAR - Nombre del destinatario
- voice_message_content: TEXT - Contenido del mensaje
- status: ENUM('pending','initiated','answered','completed','failed','no_answer','busy')
- call_initiated_at: DATETIME
- call_answered_at: DATETIME
- call_ended_at: DATETIME
- duration_seconds: INT - Duración en segundos
- call_result: VARCHAR - Resultado de la llamada
- call_transcript: TEXT - Transcripción de la llamada
- error_message: VARCHAR
- retry_count: INT - Intentos
- total_cost_cop: DECIMAL - Costo en COP
- created_at, updated_at: TIMESTAMP
- NOTA: Esta tabla NO tiene deleted_at

### 16. LIQUIDACIONES_VENDEDORES (liquidaciones_vendedores) - Liquidaciones a vendedores
Columnas principales:
- id: INT (PK)
- broker_id: INT (FK) - SIEMPRE filtrar por este campo
- vendedor_id: INT (FK → vendedores.id)
- periodo: VARCHAR - Período de liquidación
- total_primas: DECIMAL
- total_comisiones: DECIMAL
- total_pagado: DECIMAL
- estado: VARCHAR
- created_at, updated_at: TIMESTAMP

## RELACIONES IMPORTANTES (USAR PARA JOINs)
Las tablas están relacionadas por claves foráneas. SIEMPRE usar JOINs para obtener información completa:

### Relaciones de POLIZAS
- polizas.client_id → clientes.id (para obtener datos del cliente)
- polizas.seller_id → vendedores.id (para obtener datos del vendedor)
- polizas.aseguradora_id → aseguradoras.id (para obtener nombre de aseguradora)
- polizas.ramo_id → ramos.id (para obtener nombre del ramo)

### Relaciones de AUTOMOVILES
- automoviles.poliza_id → polizas.id (para obtener datos de la póliza: valor asegurado, prima, vigencia)
- automoviles.client_id → clientes.id (para obtener datos del cliente: nombre, documento, teléfono)

### Relaciones de SINIESTROS
- siniestros.poliza_id → polizas.id
- siniestros.cliente_id → clientes.id

### Relaciones de PAGOS Y COMISIONES
- pagos_polizas.poliza_id → polizas.id
- pagos_polizas.cliente_id → clientes.id
- cobros_comisiones.poliza_id → polizas.id
- cobros_comisiones.aseguradora_id → aseguradoras.id

### Otras relaciones
- anexos.poliza_id → polizas.id
- voice_campaign_calls.voice_campaign_id → voice_campaigns.id
- liquidaciones_vendedores.vendedor_id → vendedores.id

## IMPORTANTE: SIEMPRE USAR JOINs PARA INFORMACIÓN COMPLETA
- Para automóviles: JOIN con clientes (nombre) y polizas (valor asegurado, aseguradora)
- Para pólizas: JOIN con clientes, vendedores, aseguradoras, ramos
- Para siniestros: JOIN con polizas y clientes
- Para pagos: JOIN con polizas y clientes

## TABLAS CON SOFT DELETE (usar deleted_at IS NULL)
- polizas
- clientes
- siniestros
- calendar_events
- anexos
- voice_campaigns

## TABLAS SIN SOFT DELETE (NO usar deleted_at)
- automoviles
- pagos_polizas
- cobros_comisiones
- aseguradoras
- ramos
- tasks
- voice_campaign_calls
- vendedores
- sales_funnel
- liquidaciones_vendedores

## REGLAS CRÍTICAS PARA GENERAR SQL
1. SIEMPRE incluir WHERE broker_id = ? como primer filtro
2. Usar soft deletes: WHERE deleted_at IS NULL
3. Para fechas usar formato 'YYYY-MM-DD'
4. Para montos usar funciones SUM(), AVG(), etc.
5. Usar COALESCE para valores nulos
6. Limitar resultados con LIMIT para evitar sobrecarga
7. NUNCA usar DELETE, UPDATE, INSERT, DROP, ALTER, TRUNCATE
8. Solo SELECT está permitido
SCHEMA;
    }

    /**
     * Obtener ejemplos de queries para la IA
     */
    public static function getQueryExamples(): string
    {
        return <<<EXAMPLES
## EJEMPLOS DE QUERIES VÁLIDOS

### Contar pólizas activas
SELECT COUNT(*) as total FROM polizas WHERE broker_id = ? AND status = 'active' AND deleted_at IS NULL

### Pólizas próximas a vencer (30 días)
SELECT id, policy_number, client_name, end_date, premium_amount 
FROM polizas 
WHERE broker_id = ? AND status = 'active' AND deleted_at IS NULL 
AND end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 30 DAY)
ORDER BY end_date ASC LIMIT 20

### Total de primas por aseguradora
SELECT insurance_company, COUNT(*) as cantidad, SUM(premium_amount) as prima_total
FROM polizas 
WHERE broker_id = ? AND status = 'active' AND deleted_at IS NULL
GROUP BY insurance_company ORDER BY prima_total DESC

### Clientes con más pólizas
SELECT c.id, CONCAT(c.first_name, ' ', c.last_name) as nombre, c.document_number,
       COUNT(p.id) as total_polizas, SUM(p.premium_amount) as prima_total
FROM clientes c
LEFT JOIN polizas p ON c.id = p.client_id AND p.deleted_at IS NULL
WHERE c.broker_id = ? AND c.deleted_at IS NULL
GROUP BY c.id ORDER BY total_polizas DESC LIMIT 10

### Siniestros pendientes con montos
SELECT s.numero_siniestro, s.estado, s.monto_reclamado, s.fecha_ocurrencia,
       p.policy_number, c.first_name, c.last_name
FROM siniestros s
JOIN polizas p ON s.poliza_id = p.id
JOIN clientes c ON s.cliente_id = c.id
WHERE s.broker_id = ? AND s.estado IN ('reportado','en_revision','asignado')
AND s.deleted_at IS NULL ORDER BY s.fecha_ocurrencia DESC

### Ventas del mes actual
SELECT COUNT(*) as cantidad, SUM(premium_amount) as total_primas
FROM polizas 
WHERE broker_id = ? AND deleted_at IS NULL
AND MONTH(created_at) = MONTH(CURDATE()) AND YEAR(created_at) = YEAR(CURDATE())

### Rendimiento de vendedores
SELECT v.nombre, COUNT(p.id) as polizas, SUM(p.premium_amount) as primas,
       SUM(p.commission_amount) as comisiones
FROM vendedores v
LEFT JOIN polizas p ON v.id = p.seller_id AND p.status = 'active' AND p.deleted_at IS NULL
WHERE v.broker_id = ? AND v.deleted_at IS NULL
GROUP BY v.id ORDER BY primas DESC

### Estado de cartera (pagos)
SELECT 
  SUM(CASE WHEN pp.estado = 'pagado' THEN pp.monto_pagado ELSE 0 END) as cobrado,
  SUM(CASE WHEN pp.estado = 'pendiente' THEN pp.monto_pendiente ELSE 0 END) as pendiente
FROM pagos_polizas pp WHERE pp.broker_id = ?

### Buscar vehículo por placa (información completa con relaciones)
SELECT a.placa, a.marca, a.linea, a.modelo, a.anio as año, a.color, 
       a.clase, a.referencia1 as referencia, a.cilindraje, 
       a.numero_motor, a.numero_chasis, a.vin, a.tipo_servicio,
       a.combustible, a.capacidad_pasajeros, a.tipo_carroceria,
       CONCAT(c.first_name, ' ', c.last_name) as cliente,
       c.document_number as documento_cliente, c.phone as telefono_cliente,
       p.policy_number as numero_poliza, p.insurance_company as aseguradora,
       p.insured_amount as valor_asegurado, p.premium_amount as prima,
       p.start_date as inicio_vigencia, p.end_date as fin_vigencia, p.status as estado_poliza
FROM automoviles a
LEFT JOIN clientes c ON a.client_id = c.id AND c.deleted_at IS NULL
LEFT JOIN polizas p ON a.poliza_id = p.id AND p.deleted_at IS NULL
WHERE a.broker_id = ? AND a.placa = '356ADN'
LIMIT 1

### Listar todos los vehículos con información de cliente y póliza
SELECT a.placa, a.marca, a.linea, a.modelo, a.anio as año, a.color, a.clase,
       CONCAT(c.first_name, ' ', c.last_name) as cliente,
       p.policy_number as numero_poliza, p.insured_amount as valor_asegurado,
       p.insurance_company as aseguradora, p.status as estado_poliza
FROM automoviles a
LEFT JOIN clientes c ON a.client_id = c.id AND c.deleted_at IS NULL
LEFT JOIN polizas p ON a.poliza_id = p.id AND p.deleted_at IS NULL
WHERE a.broker_id = ?
ORDER BY a.marca, a.linea LIMIT 500

### Comisiones pendientes por cobrar
SELECT cc.id, cc.monto_comision, cc.monto_cobrado, cc.monto_pendiente, 
       p.policy_number, a.nombre as aseguradora
FROM cobros_comisiones cc
JOIN polizas p ON cc.poliza_id = p.id
JOIN aseguradoras a ON cc.aseguradora_id = a.id
WHERE cc.broker_id = ? AND cc.estado = 'pendiente'
ORDER BY cc.monto_pendiente DESC LIMIT 20

### Anexos de una póliza
SELECT an.anexo_number, an.motivo, an.prima_neta, an.commission_amount, 
       an.start_date, an.end_date, an.status
FROM anexos an
WHERE an.broker_id = ? AND an.poliza_id = 123 AND an.deleted_at IS NULL
ORDER BY an.issue_date DESC

### Campañas de voz activas
SELECT vc.name, vc.status, vc.total_targets, vc.calls_made, 
       vc.calls_successful, vc.calls_failed, vc.scheduled_date
FROM voice_campaigns vc
WHERE vc.broker_id = ? AND vc.deleted_at IS NULL AND vc.is_active = 1
ORDER BY vc.scheduled_date DESC

### Llamadas de una campaña
SELECT vcc.recipient_name, vcc.recipient_phone, vcc.status, 
       vcc.duration_seconds, vcc.call_result, vcc.call_initiated_at
FROM voice_campaign_calls vcc
WHERE vcc.broker_id = ? AND vcc.voice_campaign_id = 123
ORDER BY vcc.call_initiated_at DESC LIMIT 50

### Tareas pendientes
SELECT t.titulo, t.descripcion, t.tipo, t.prioridad, t.estado, 
       t.fecha_vencimiento, t.cliente, t.numero_poliza
FROM tasks t
WHERE t.usuario_id = ? AND t.estado IN ('pendiente','en_progreso')
ORDER BY t.fecha_vencimiento ASC

### Eventos del calendario
SELECT ce.title, ce.description, ce.start_date, ce.end_date, 
       ce.event_type, ce.all_day
FROM calendar_events ce
WHERE ce.broker_id = ? AND ce.deleted_at IS NULL
AND ce.start_date >= CURDATE()
ORDER BY ce.start_date ASC LIMIT 20

### Lista de aseguradoras
SELECT a.id, a.nombre, a.cuit, a.email, a.telefono
FROM aseguradoras a
WHERE a.broker_id = ?
ORDER BY a.nombre ASC

### Lista de ramos
SELECT r.id, r.nombre, r.subramo
FROM ramos r
WHERE r.broker_id = ?
ORDER BY r.nombre ASC

### Pólizas por ramo
SELECT r.nombre as ramo, COUNT(p.id) as cantidad, SUM(p.premium_amount) as prima_total
FROM polizas p
JOIN ramos r ON p.ramo_id = r.id
WHERE p.broker_id = ? AND p.deleted_at IS NULL AND p.status = 'active'
GROUP BY r.id ORDER BY cantidad DESC

## CONSULTAS DE ANÁLISIS DE NEGOCIO AVANZADAS

### Pólizas con mayor riesgo de NO renovación (próximas a vencer sin actividad reciente)
SELECT p.id, p.policy_number, p.client_name, p.insurance_company, p.end_date, 
       p.premium_amount, DATEDIFF(p.end_date, CURDATE()) as dias_para_vencer
FROM polizas p
WHERE p.broker_id = ? AND p.deleted_at IS NULL AND p.status = 'active'
AND p.end_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 60 DAY)
ORDER BY p.end_date ASC LIMIT 50

### Clientes activos para ofrecer pólizas de vida (no tienen póliza de vida activa)
SELECT c.id, CONCAT(c.first_name, ' ', c.last_name) as nombre_cliente, 
       c.document_number, c.email, c.phone, c.city,
       COUNT(p.id) as polizas_actuales
FROM clientes c
LEFT JOIN polizas p ON c.id = p.client_id AND p.deleted_at IS NULL AND p.status = 'active'
WHERE c.broker_id = ? AND c.deleted_at IS NULL AND c.status = 'active'
GROUP BY c.id
HAVING polizas_actuales > 0 
AND NOT EXISTS (
    SELECT 1 FROM polizas pv 
    WHERE pv.client_id = c.id AND pv.type = 'vida' 
    AND pv.status = 'active' AND pv.deleted_at IS NULL
)
ORDER BY polizas_actuales DESC LIMIT 50

### Clientes para venta cruzada de autos (tienen otras pólizas pero no de autos)
SELECT c.id, CONCAT(c.first_name, ' ', c.last_name) as nombre_cliente,
       c.document_number, c.email, c.phone,
       GROUP_CONCAT(DISTINCT p.type) as tipos_poliza_actuales
FROM clientes c
JOIN polizas p ON c.id = p.client_id AND p.deleted_at IS NULL AND p.status = 'active'
WHERE c.broker_id = ? AND c.deleted_at IS NULL AND c.status = 'active'
GROUP BY c.id
HAVING tipos_poliza_actuales NOT LIKE '%auto%'
ORDER BY c.last_name LIMIT 50

### Análisis de retención - Pólizas canceladas o no renovadas último trimestre
SELECT p.id, p.policy_number, p.client_name, p.insurance_company, p.type,
       p.premium_amount, p.end_date, p.status
FROM polizas p
WHERE p.broker_id = ? AND p.deleted_at IS NULL
AND (p.status = 'cancelled' OR p.status = 'expired')
AND p.end_date >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
ORDER BY p.end_date DESC LIMIT 50

### Top clientes por valor de prima (mejores clientes)
SELECT c.id, CONCAT(c.first_name, ' ', c.last_name) as nombre_cliente,
       c.document_number, c.email, c.phone,
       COUNT(p.id) as total_polizas, SUM(p.premium_amount) as prima_total
FROM clientes c
JOIN polizas p ON c.id = p.client_id AND p.deleted_at IS NULL AND p.status = 'active'
WHERE c.broker_id = ? AND c.deleted_at IS NULL
GROUP BY c.id
ORDER BY prima_total DESC LIMIT 20

### Oportunidades de upselling - Clientes con pólizas de bajo valor
SELECT c.id, CONCAT(c.first_name, ' ', c.last_name) as nombre_cliente,
       c.email, c.phone, p.type, p.premium_amount, p.insurance_company
FROM clientes c
JOIN polizas p ON c.id = p.client_id AND p.deleted_at IS NULL AND p.status = 'active'
WHERE c.broker_id = ? AND c.deleted_at IS NULL
AND p.premium_amount < 500000
ORDER BY p.premium_amount ASC LIMIT 50

### Clientes sin contacto reciente (para seguimiento)
SELECT c.id, CONCAT(c.first_name, ' ', c.last_name) as nombre_cliente,
       c.email, c.phone, c.updated_at as ultimo_contacto,
       COUNT(p.id) as polizas_activas
FROM clientes c
LEFT JOIN polizas p ON c.id = p.client_id AND p.deleted_at IS NULL AND p.status = 'active'
WHERE c.broker_id = ? AND c.deleted_at IS NULL AND c.status = 'active'
AND c.updated_at < DATE_SUB(CURDATE(), INTERVAL 6 MONTH)
GROUP BY c.id
ORDER BY c.updated_at ASC LIMIT 50

## EJEMPLOS CON CAMPOS ESPECÍFICOS SOLICITADOS

### Clientes más antiguos CON FECHA de registro
SELECT c.id, CONCAT(c.first_name, ' ', c.last_name) as nombre_cliente,
       c.document_number, c.email, c.phone,
       c.created_at as fecha_registro,
       DATEDIFF(CURDATE(), c.created_at) as dias_antiguedad
FROM clientes c
WHERE c.broker_id = ? AND c.deleted_at IS NULL
ORDER BY c.created_at ASC LIMIT 100

### Placas de vehículos de un cliente específico
SELECT a.placa, a.marca, a.linea, a.modelo, a.color,
       p.policy_number, p.insurance_company
FROM automoviles a
JOIN polizas p ON a.poliza_id = p.id AND p.deleted_at IS NULL
WHERE a.broker_id = ? AND p.client_name LIKE '%nombre_cliente%'
ORDER BY a.placa

### Teléfonos de clientes con pólizas de autos
SELECT c.id, CONCAT(c.first_name, ' ', c.last_name) as nombre_cliente,
       c.phone as telefono, c.mobile_phone as celular, c.email
FROM clientes c
JOIN polizas p ON c.id = p.client_id AND p.deleted_at IS NULL AND p.status = 'active'
WHERE c.broker_id = ? AND c.deleted_at IS NULL
AND p.type LIKE '%auto%'
GROUP BY c.id
ORDER BY c.last_name LIMIT 500

### Teléfonos de clientes con pólizas de vida
SELECT c.id, CONCAT(c.first_name, ' ', c.last_name) as nombre_cliente,
       c.phone as telefono, c.mobile_phone as celular, c.email
FROM clientes c
JOIN polizas p ON c.id = p.client_id AND p.deleted_at IS NULL AND p.status = 'active'
WHERE c.broker_id = ? AND c.deleted_at IS NULL
AND p.type LIKE '%vida%'
GROUP BY c.id
ORDER BY c.last_name LIMIT 500

### Direcciones de clientes
SELECT c.id, CONCAT(c.first_name, ' ', c.last_name) as nombre_cliente,
       c.address as direccion, c.city as ciudad, c.department as departamento,
       c.phone, c.email
FROM clientes c
WHERE c.broker_id = ? AND c.deleted_at IS NULL
ORDER BY c.city, c.last_name LIMIT 500

### Fechas de vencimiento de pólizas de un cliente
SELECT p.id, p.policy_number, p.product_name, p.insurance_company,
       p.start_date as fecha_inicio, p.end_date as fecha_vencimiento,
       DATEDIFF(p.end_date, CURDATE()) as dias_para_vencer
FROM polizas p
WHERE p.broker_id = ? AND p.deleted_at IS NULL AND p.status = 'active'
AND p.client_name LIKE '%nombre_cliente%'
ORDER BY p.end_date ASC
EXAMPLES;
    }

    /**
     * Obtener prompt del sistema para generación de SQL
     */
    public static function getSQLGeneratorPrompt(): string
    {
        $schema = self::getSchemaForAI();
        $examples = self::getQueryExamples();
        
        return <<<PROMPT
Eres un experto en SQL que genera consultas para un sistema de gestión de seguros.

{$schema}

{$examples}

## INSTRUCCIONES CRÍTICAS
1. Genera SOLO el query SQL, sin explicaciones
2. El query debe ser SELECT únicamente
3. SIEMPRE usa ALIAS para las tablas (ej: FROM polizas p, FROM clientes c)
4. SIEMPRE incluye el alias de la tabla principal con broker_id en WHERE (ej: WHERE a.broker_id = ?)
5. Usa ? como placeholder para el broker_id
6. SOLO incluye "deleted_at IS NULL" para tablas CON soft delete: polizas, clientes, siniestros, calendar_events, anexos, voice_campaigns
7. NO uses deleted_at en tablas SIN soft delete: automoviles, vendedores, pagos_polizas, sales_funnel, cobros_comisiones, aseguradoras, ramos, tasks, voice_campaign_calls
8. SIEMPRE usa LIMIT 100 por defecto para listados. Solo usa LIMIT 1 si el usuario pide UN registro específico (ej: "una póliza", "un cliente"). Para listados usa mínimo LIMIT 50
9. Responde en formato JSON: {"sql": "SELECT ...", "description": "Descripción breve en español"}
10. Si la consulta no es posible, responde: {"error": "Razón"}
11. La descripción debe ser en español y descriptiva
12. Para búsquedas de texto usa LIKE con % (ej: a.placa LIKE '%ABC%')
13. En JOINs, SIEMPRE usa el alias de tabla (ej: c.id, p.client_id, NO solo id o client_id)

## CAMPOS A EXCLUIR DEL SELECT (NUNCA incluir estos)
- NUNCA incluir: id, broker_id, deleted_at, created_at (a menos que se pida), updated_at
- NUNCA usar SELECT * - siempre especificar los campos útiles para el usuario
- Los IDs internos y broker_id son campos técnicos que NO interesan al usuario

## REGLA IMPORTANTE: INCLUIR CAMPOS COMPLETOS Y RELEVANTES
- Para AUTOMÓVILES incluir: placa, marca, linea, modelo, anio, color, cilindraje, numero_motor, numero_chasis, vin, tipo_servicio, clase
- Para CLIENTES incluir: nombre completo (CONCAT), documento, email, telefono, celular, ciudad
- Para PÓLIZAS incluir: numero_poliza, cliente, aseguradora, tipo, prima, fechas de vigencia, estado
- Si el usuario pide "información completa" → incluir TODOS los campos relevantes de la entidad
- Si el usuario pide "fecha", "antigüedad" → INCLUIR created_at como fecha_registro
- Si el usuario pide "teléfono", "contacto" → INCLUIR phone, mobile_phone
- Ejemplo: "información del automóvil" → incluir placa, marca, linea, modelo, anio, color, cilindraje, motor, chasis, etc.

## ANÁLISIS DE NEGOCIO
- "riesgo de renovación" = pólizas próximas a vencer
- "venta cruzada" = clientes sin cierto tipo de póliza
- "ofrecer vida/autos/hogar" = clientes que no tienen ese tipo de póliza
- "mejores clientes" = ordenar por prima total o cantidad de pólizas
- "clientes para contactar" = clientes sin actividad reciente
- "más antiguos" = ORDER BY created_at ASC
- "más recientes" = ORDER BY created_at DESC
PROMPT;
    }
}
