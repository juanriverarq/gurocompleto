# Mapeo SoftSeguros → Guro: Análisis Completo

## Datos reales: 19,221 clientes | 34,874 pólizas | 80 siniestros

---

## 1. CLIENTES (SoftSeguros → Guro `clientes`)

| SoftSeguros Campo | Ejemplo | Guro Campo | Estado |
|---|---|---|---|
| `id` | 622525 | (ref interna) | ✅ Se guarda en `custom_fields.softseguros_id` |
| `nombres` | "ANA MILENA" | `first_name` | ✅ MAPEA |
| `apellidos` | "PEREZ VIANA" | `last_name` | ✅ MAPEA |
| `tipo_documento` | "01" | `document_type` | ✅ MAPEA (necesita traducir código → CC/CE/NIT) |
| `numero_documento` | "59816262" | `document_number` | ✅ MAPEA |
| `celular` | "+57 3176454319" | `mobile_phone` | ✅ MAPEA |
| `telefono` | "+57 176454319" | `phone` | ✅ MAPEA |
| `email` | "santamaria.anamilena@gmail.com" | `email` | ✅ MAPEA |
| `direccion` | "EDIFICIO HABITAR..." | `address` | ✅ MAPEA |
| `ciudad` | "PASTO" | `city` | ✅ MAPEA |
| `genero` | "FEMENINO" | `gender` | ✅ MAPEA (traducir FEMENINO→F, MASCULINO→M) |
| `fecha_nacimiento` | null | `birth_date` | ✅ MAPEA |
| `ocupacion` / `ocupacion_string` | "CONTRATISTA" | `occupation` | ✅ MAPEA |
| `tipo_cliente` | "Cliente" | `status` | ✅ MAPEA (Cliente→active, Prospecto→prospect) |
| `observaciones` | "" | `notes` | ✅ MAPEA |
| `fecha_expedicion_cedula` | null | `document_issue_date` | ✅ MAPEA |
| `categorias` | [{id,nombre,color}] | `tags` | ✅ MAPEA (como array de nombres) |
| `sedes` | [{id,nombre}] | `branch_name` | ✅ MAPEA (tomar primera sede) |
| `pais_phone_code` | "57" | — | Se usa para normalizar teléfono |
| `numero_cuenta_bancaria` | "" | — | ❌ **NO EXISTE EN GURO** |
| `enviar_correo_polizas_vencidas` | true | — | ❌ **NO EXISTE** (preferencias de notificación) |
| `enviar_sms_poliza_por_vencer` | false | — | ❌ **NO EXISTE** |
| `enviar_whatsapp_poliza_por_vencer` | true | — | ❌ **NO EXISTE** |
| `enviar_correo_cartera_por_vencer` | true | — | ❌ **NO EXISTE** |
| `enviar_sms_cartera_por_vencer` | false | — | ❌ **NO EXISTE** |
| `enviar_whatsapp_cartera_por_vencer` | true | — | ❌ **NO EXISTE** |
| `es_consorcio` | false | — | ❌ **NO EXISTE** |
| `clientevendedor_tipo` | "no_vendedor" | — | ❌ **NO EXISTE** |
| `alias` | null | — | ❌ **NO EXISTE** |
| `otra_ocupacion` | "CONTRATISTA" | — | Se puede meter en `occupation` |

### Veredicto Clientes:
- **16/19 campos mapean directamente** ✅
- **Campos faltantes en Guro**: Preferencias de notificación (6 campos), `numero_cuenta_bancaria`, `es_consorcio`, `clientevendedor_tipo`, `alias`
- **Recomendación**: Guardar los campos que no mapean en `custom_fields` JSON (ya existe el campo). No se necesitan migraciones para la importación básica.

---

## 2. PÓLIZAS (SoftSeguros → Guro `polizas`)

| SoftSeguros Campo | Ejemplo | Guro Campo | Estado |
|---|---|---|---|
| `id` | 997353 | `custom_fields.softseguros_id` | ✅ Referencia |
| `numero_poliza` | "1408004114680000" | `policy_number` | ✅ MAPEA |
| `cliente` (FK id) | 631246 | `client_id` | ✅ MAPEA (buscar por softseguros_id) |
| `cliente_numero_documento` | "98384758" | `client_document` | ✅ MAPEA |
| `cliente_nombres` + `cliente_apellidos` | "JAIRO..." | `client_name` | ✅ MAPEA |
| `ramo_aseguradora_nombre` | "PREVISORA" | `insurance_company` | ✅ MAPEA |
| `ramo_nombre` | "Motos" | `product_name` | ✅ MAPEA |
| `ramo_global_nombre` | "SOAT" | `type` | ✅ MAPEA (mapear a categoría) |
| `ramo` (FK id) | 374666 | `ramo_id` | ✅ MAPEA (buscar ramo en Guro) |
| `aseguradora` (implícito via ramo) | — | `aseguradora_id` | ✅ MAPEA |
| `fecha_expedicion` | "2019-01-02" | `issue_date` | ✅ MAPEA |
| `fecha_inicio` | "2019-03-08" | `start_date` | ✅ MAPEA |
| `fecha_fin` | "2020-03-07" | `end_date` | ✅ MAPEA |
| `estado_poliza_nombre` | "No renovada" | `status` | ✅ MAPEA (traducir código) |
| `prima` | "237300.00" | `premium_amount` | ✅ MAPEA |
| `total` | "357850.00" | `total_amount` | ✅ MAPEA |
| `iva` | "0.00" | `vat_amount` | ✅ MAPEA |
| `porcentaje_iva_prima` | "0.00" | `vat_percentage` | ✅ MAPEA |
| `gastos_expedicion` | "120550.00" | `gastos_adicionales` | ✅ MAPEA |
| `porcentje_comicion` | "7.00" | `commission_percentage` | ✅ MAPEA |
| `comicion` | "12790.00" | `commission_amount` | ✅ MAPEA |
| `medio_pago` | "Efectivo" | `payment_method` | ✅ MAPEA |
| `forma_pago` | "Contado" | `payment_frequency` | ✅ MAPEA (traducir) |
| `numero_de_cuotas` | 0 | `installments_count` | ✅ MAPEA |
| `observaciones` | "" | `notes` | ✅ MAPEA |
| `codio_objeto_asegurado` | "DGO 31B" | `vehicle_plates` | ✅ MAPEA (para autos) |
| `nombre_tomador` | "JAIRO..." | `policy_holder_name` | ✅ MAPEA |
| `cedula_tomador` | "98384758" | `policy_holder_document` | ✅ MAPEA |
| `nombre_asegurado` | "JAIRO..." | `insured_name` | ✅ MAPEA |
| `cedula_asegurado` | "98384758" | `insured_document` | ✅ MAPEA |
| `nombre_beneficiario` | null | `beneficiary_name` | ✅ MAPEA |
| `cedula_beneficiario` | null | `beneficiary_document` | ✅ MAPEA |
| `vendedores_nombre` | "AGENCIA..." | `seller_name` | ✅ MAPEA |
| `vendedor` (FK) | null | `seller_id` | ✅ MAPEA |
| `sede_nombre` | "principal" | — | En `custom_fields` |
| `fecha_recepcion` | "2019-01-08" | `reception_date` | ✅ MAPEA |
| `participacion` | "77.00" | `participation` | ✅ MAPEA |
| `valor_asegurado_riesgo` | null | `insured_amount` | ✅ MAPEA |
| `renovable` | true | `auto_renewal` | ✅ MAPEA |
| `numero_renovacion` | 0 | — | En `custom_fields` |
| `tipo_poliza` | "individual" | `type` / `custom_fields.policy_category` | ✅ MAPEA |
| `colectiva` | false | `custom_fields.policy_category` | ✅ |
| `fecha_cancelacion` | null | `cancelled_at` | ✅ MAPEA |
| `fecha_creacion` | "2019-03-13..." | `created_at` | ✅ |
| `clasificacion_poliza` | "Nuevos" | — | ❌ En `custom_fields` |
| **Comisiones detalladas**: | | | |
| `comision_total` | "12790.00" | `agency_commission` | ✅ MAPEA |
| `iva_de_comision` | "2046.00" | — | ❌ **NO EXISTE** |
| `porcentaje_comision_vendedor` | "100.00" | — | ❌ **NO EXISTE** (se maneja en Vendedor) |
| `comision_vendedor` | "12790.00" | — | ❌ **NO EXISTE** |
| `porcentaje_sobrecomision` | null | — | ❌ **NO EXISTE** |
| `sobrecomision` | null | — | ❌ **NO EXISTE** |
| **Financiación**: | | | |
| `porcentaje_financiacion` | "0.00" | — | ❌ **NO EXISTE** |
| `valor_financiacion` | "0.00" | — | ❌ **NO EXISTE** |
| `total_poliza_financiada` | "0.00" | — | ❌ **NO EXISTE** |
| `financiacion_incluye_comision` | false | — | ❌ **NO EXISTE** |
| **SOAT específicos**: | | | |
| `soat` | false | — | ❌ (En `custom_fields`) |
| `soat_tipo_vehiculo` | null | — | ❌ |
| `arl` | false | — | ❌ (En `custom_fields`) |
| **Recaudo/Cartera**: | | | |
| `comicionada` | false | — | Parcial via `payment_status` |
| `recaudado_en_oficina` | false | — | ❌ **NO EXISTE** |
| `fecha_recaudo` | null | — | ❌ **NO EXISTE** |
| `recaudado` | false | — | ❌ **NO EXISTE** |
| `estado_cartera` | "Comisionada" | — | ❌ **NO EXISTE** |
| **Notificaciones**: | | | |
| `enviar_correo_polizas_vencidas` | false | — | ❌ (6+ campos de notificación) |

### Veredicto Pólizas:
- **~35/60+ campos mapean directamente** ✅
- **Campos faltantes significativos**: 
  - Comisiones detalladas por vendedor (`iva_de_comision`, `comision_vendedor`, `sobrecomision`)
  - Financiación (4 campos)
  - Estado de cartera/recaudo (5 campos)
  - Preferencias de notificación por póliza (6+ campos)
- **Recomendación**: Usar `custom_fields` JSON para almacenar lo que no tiene campo propio. La info crítica (comisiones, cartera) se importa bien.

---

## 3. SINIESTROS (SoftSeguros → Guro `siniestros`)

| SoftSeguros Campo | Guro Campo | Estado |
|---|---|---|
| `numero_siniestro` | `numero_siniestro` | ✅ |
| `numero_siniestro_compania` | `numero_siniestro_compania` | ✅ |
| `poliza` (FK) | `poliza_id` | ✅ |
| `descripcion` | `descripcion_evento` | ✅ |
| `valor_indemnizacion` | `valor_indemnizacion` | ✅ |
| `deducible` | `deducible` | ✅ |
| `coaseguros` | `coaseguros` | ✅ |
| `monto_reclamo` | `monto_reclamo` | ✅ |
| `fecha_creacion` | `fecha_aviso` | ✅ |
| `fecha_finalizacion` | `fecha_cierre` | ✅ |
| `fecha_notificacion_aseguradora` | `fecha_notificacion_aseguradora` | ✅ |
| `fecha_aviso` | `fecha_aviso` | ✅ |
| `finalizado` | `finalizado` | ✅ |
| `estado_nombre` | `estado` | ✅ (traducir: Pagado→pagado) |
| `observacion` | `observaciones` | ✅ |
| `nombre_asegurado` | → buscar `cliente_id` | ✅ |
| `ramo_nombre` | `tipo_seguro` | ✅ |
| `taller_asignado` | `proveedor_asignado` | ✅ |
| `nombre` (tipo siniestro) | `tipo_siniestro` | ✅ |
| `porcentaje_siniestralidad` | — | ❌ **NO EXISTE** |
| `resolucion` | `resolucion` | ✅ |
| `amparo_afectado` (FK) | `amparos_afectados` | ✅ (como JSON) |
| `dias_ejecucion` | `dias_tramite` (calculado) | ✅ |

### Veredicto Siniestros:
- **Mapeo casi perfecto** ✅ (~20/22 campos)
- Solo falta `porcentaje_siniestralidad` (se puede calcular)

---

## 4. CATÁLOGOS

### Aseguradoras (SoftSeguros → Guro `aseguradoras`)
| SoftSeguros | Guro | Estado |
|---|---|---|
| `nombre` | `nombre` | ✅ |
| `nit` | `cuit` | ✅ |
| `email` | `email` | ✅ |
| `direccion` | `direccion` | ✅ |
| `telefono` | `telefono` | ✅ |
**Veredicto**: ✅ Mapeo completo

### Ramos (SoftSeguros → Guro `ramos`)
| SoftSeguros | Guro | Estado |
|---|---|---|
| `nombre_ramo_global` | `nombre` | ✅ |
| `nombre` (subramo) | `subramo` | ✅ |
| `calcular_iva_a_gastos_expedicion` | `calcular_iva_pri_a_pre` | ✅ |
| `en_mapa_oportunidad` | `vista_mapa_oportunidad` | ✅ |
**Veredicto**: ✅ Mapeo completo

### Vendedores (SoftSeguros → Guro `vendedores`)
| SoftSeguros | Guro | Estado |
|---|---|---|
| `nombre` | `nombres` | ✅ |
| `cedula` | `numero_documento` | ✅ |
| `telefono` | `telefono` | ✅ |
| `celular` | `celular` | ✅ |
| `email` | `email` | ✅ |
| `numero_cuenta_bancaria` | `cuenta_bancaria` | ✅ |
| `tipo_persona` | `tipo_persona` | ✅ |
| `es_agencia` | `es_agencia` | ✅ |
| `participacion` | `porcentaje_comision` | ✅ |
| `retencion` | `porcentaje_retencion` | ✅ |
| `iva_porcentaje` | `porcentaje_iva` | ✅ |
| `retencion_ica_porcentaje` | `porcentaje_retencion_ica` | ✅ |
| `retencion_iva_porcentaje` | `porcentaje_retencion_iva` | ✅ |
| `tipo_documento` | `tipo_documento` | ✅ |
| `comision_prima` | `calcular_comision_sobre` | ✅ |
**Veredicto**: ✅ Mapeo completo

---

## 5. ENTIDADES SIN EQUIVALENTE DIRECTO EN GURO

| SoftSeguros | Descripción | Recomendación |
|---|---|---|
| **Contactos** (`contacto/`) | Personas vinculadas a un cliente (nombre, doc, parentesco, teléfono) | → Guardar en `custom_fields` del cliente o crear tabla `contactos_cliente` |
| **Datos Extra CRM** (`datosextrascliente/`) | Datos dinámicos: direcciones, vehículos (placa), teléfonos extra | → Guardar en `custom_fields` del cliente |
| **Negocios** (`negocio/`) | Pipeline de oportunidades (asesor, etapa, ramo, cliente) | → No existe pipeline en Guro aún. Guardar como JSON para futuro |
| **Categorías** (`categoria/`) | Tags con color para clientes/pólizas/CRM | → Mapear a `tags` del cliente/póliza |
| **Anexos de póliza** | Sub-registros de pólizas colectivas (asegurado, prima, comisión) | → Mapear a `poliza_vinculados` |
| **Beneficiarios** | Lista de beneficiarios por póliza | → Mapear a campo `beneficiaries` (JSON) en póliza |
| **Vinculados/Riesgos Asegurados** | Asegurados en pólizas colectivas | → Mapear a `poliza_vinculados` |

---

## 6. RESUMEN DE CAMPOS QUE FALTAN EN GURO

### Prioridad ALTA (útiles para negocio diario):
1. **`clientes.notification_preferences`** (JSON) — Preferencias de notificación (correo/SMS/WhatsApp para pólizas vencidas y cartera)
2. **Pagos por póliza de SoftSeguros** — Ya existe `pagos_polizas` pero los pagos de SoftSeguros tienen campos como `numero_pago`, `comision_a_recibir`

### Prioridad MEDIA (nice to have):
3. **`polizas.iva_comision`** — IVA sobre la comisión 
4. **`polizas.porcentaje_financiacion`** + `valor_financiacion` + `total_poliza_financiada` — Datos de financiación
5. **`polizas.estado_cartera`** — Estado de cartera (Pendiente/Comisionada/Recaudada)
6. **`polizas.recaudado_en_oficina`** + `fecha_recaudo` — Control de recaudo

### Prioridad BAJA (se pueden importar en `custom_fields`):
7. `clientes.numero_cuenta_bancaria`
8. `clientes.es_consorcio`  
9. `polizas.clasificacion_poliza`
10. `polizas.sobrecomision`
11. Contactos del cliente (tabla nueva)
12. Negocios/Pipeline (módulo futuro)

---

## 7. PLAN DE IMPORTACIÓN RECOMENDADO

### Orden de importación (respetando dependencias):
1. **Aseguradoras** → tabla `aseguradoras`
2. **Ramos** → tabla `ramos` (requiere aseguradoras)
3. **Vendedores** → tabla `vendedores`
4. **Clientes** → tabla `clientes` (con datos extra en `custom_fields`)
5. **Pólizas** → tabla `polizas` (requiere clientes, aseguradoras, ramos, vendedores)
6. **Beneficiarios** → campo JSON `beneficiaries` en póliza
7. **Vinculados** → tabla `poliza_vinculados`
8. **Siniestros** → tabla `siniestros` (requiere pólizas, clientes)
9. **Pagos** → tabla `pagos_polizas` (requiere pólizas)

### Estrategia para campos faltantes:
- Todo lo que no tenga campo propio → `custom_fields` JSON (ya existe en clientes y pólizas)
- Los datos extra CRM → `custom_fields` del cliente
- Contactos → `custom_fields.contactos` como array en el cliente
- Negocios → archivo JSON aparte para futuro módulo
