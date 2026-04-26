# Mapeo de Campos de Detalle de Pólizas por Aseguradora

> Generado: 2026-04-02 | Fuente: APIs reales del microservicio

---

## 1. Resumen de Disponibilidad por Aseguradora

| Dato                        | SURA (detail)      | HDI (detail)       | Bolívar (listing)  | AXA (listing+detail) | Estado (listing) |
|-----------------------------|--------------------|--------------------|--------------------|--------------------|-----------------|
| **Coberturas**              | ✅ array           | ✅ array (25+)     | ❌                 | ❌ (HTML tables)   | ❌              |
| **Beneficiarios/Vinculados**| ✅ parcial (1)     | ✅ completo        | ❌                 | ❌                 | ❌              |
| **Asegurado**               | ✅                 | ✅                 | ❌                 | ❌                 | ❌              |
| **Conductores**             | ❌                 | ✅ (autos)         | ❌                 | ❌                 | ❌              |
| **Tomador detalle**         | ✅                 | ✅                 | ✅ (parcial)       | ✅ (nombre+doc)    | ❌              |
| **Prima total**             | ✅ `ptprimaformapago` | ❌ (no en detail) | ✅ `valorPrimaAnual` | ❌              | ❌              |
| **IVA**                     | ✅ `ptPrimaFormaPagoIva` | ❌            | ✅ `valorIVAPrimaAnual` | ❌            | ❌              |
| **Forma de pago**           | ✅ `formaPago`     | ❌                 | ✅ `formaCobro`    | ❌                 | ❌              |
| **Financiada**              | ✅ `snFinanciada`  | ❌                 | ❌                 | ❌                 | ❌              |
| **Bonificación %**          | ✅ `bonificacion`  | ❌                 | ✅ `porcentajeBonificacion` | ❌        | ❌              |
| **Comisión/Participación %**| ✅ `asesores[].porcentajeParticipacion` | ❌ | ❌            | ❌                 | ❌              |
| **Asesor código**           | ✅ `asesores[].codigo` | ❌             | ✅ `codigoAgente`  | ❌                 | ❌              |
| **Objeto asegurado (vehículo)** | ✅ (placa, marca, modelo, etc.) | ✅ (placa, marca, modelo, etc.) | ❌ | ❌    | ❌              |
| **Recibos pendientes**      | ✅ `_recibos_pendientes` | ❌           | ❌                 | ❌                 | ❌              |
| **Reclamaciones**           | ✅ `_reclamaciones` | ❌                | ❌                 | ❌                 | ❌              |
| **Valor asegurado**         | ✅ `valorVehiculo`  | ✅ `valorComercial`| ❌                 | ✅ `Monto`         | ❌              |
| **Período cobro**           | ❌                 | ❌                 | ✅ `formaCobro` / `desFormCobro` | ❌   | ❌              |

---

## 2. Detalle por Aseguradora

### 2.1 SURA — `GET /sura/polizas/{numero}/detail?ramo={XX}&fecha_fin={YYYY-MM-DD}`

**Ramos soportados (detail):**
- `01` → Automóviles (040, 041 SOAT)
- `02` → Empresariales / Incendio (030)
- `10` → Cumplimiento (012)
- `19` → HogarSURA (028)
- No soportados: Vida Individual (081), Vida Grupo (083), Salud Familiar (090), Exequial (086)

**Campos del detalle (ejemplo: Autos):**
```json
{
  "poliza": "900000011572",
  "tipoPoliza": "INDIVIDUAL",
  "plan": "PLAN AUTOS BÁSICO",
  "dniTomador": "A9003379251",
  "tipoDniTomador": "NIT",
  "nombreTomador": "MINCONSTRUCCIONES S.A",
  "numeroTelefono": "3137828828",
  "direccion": "CL 18 N # 35 69",
  "ciudad": "MEDELLÍN",
  "dniAsegurado": "A9003379251",
  "tipoDniAsegurado": "NIT",
  "nombreAsegurado": "MINCONSTRUCCIONES S.A",
  "correoAsegurado": "losangeles@une.net.co",
  "dniBenficiario": "A9003379251",
  "tipoDniBenficiario": "NIT",
  "nombreBeneficiario": "MINCONSTRUCCIONES S.A",
  "oficina": "4033 SUCURSAL SAN FERNANDO 5",
  "fechaExpedicion": "2017-10-02",
  "fechaInicioVigenciaRiesgo": "2025-10-02",
  "fechaFinVigenciaRiesgo": "2026-10-02",
  "estado": "VIGENTE",
  "formaPago": "",
  "ptprimaformapago": "1,181,370",
  "ptPrimaFormaPagoIva": "0",
  "snFinanciada": "N",
  "placa": "RBU806",
  "vehiculo": "AUTOMÓVILES",
  "marca": "BMW 320i E90 LCI EXECUTIVE - TP 2000CC CT",
  "zona": "AREA MET MEDELLIN",
  "modelo": "2011",
  "cdFaseColda": "00801269",
  "motor": "A7821678",
  "chasis": "WBAPG5109BA838558",
  "valorVehiculo": "$53,284,577",
  "valorRiesgo": "1",
  "bonificacion": "0.0",
  "coberturas": [
    {
      "tipoCobertura": "DAÑOS A TERCEROS",
      "nombreCobertura": "LIMITE",
      "porcentajeDeducibleMinimo": "$0",
      "ptaAsegurado": "$1,040,000,000"
    }
  ],
  "asesores": [
    {
      "codigo": "8670",
      "nombre": "CH SEGUROS.COM LTDA.",
      "telefono": "",
      "esLider": "S",
      "porcentajeParticipacion": 100.0
    }
  ],
  "_recibos_pendientes": [],
  "_reclamaciones": []
}
```

---

### 2.2 HDI — `GET /hdi/polizas/{numero}/detail?sseguro={id}&product_code={code}`

**Requiere:** `_sseguro` y `_product_code` del listado de pólizas.

**Campos del detalle:**
```json
{
  "tomador": {
    "nombre": "Luis Castro Madrid",
    "documento": "1125288318",
    "tipo_documento": "C.C.",
    "direccion": "Calle 35 a sur 47 51",
    "telefono": "3009505486",
    "email": "luis.castro63@yahoo.com",
    "ciudad": "Envigado"
  },
  "_persons_raw": {
    "holders": {
      "natural": [{ "id_type", "id_number", "first_name", "second_name", "last_name", "last_second_name", "address", "email", "city", "department", "phone", "is_onerous", "beneficiary_type", "discount", "sperson" }]
    },
    "insured": { "natural": [...] },
    "beneficiaries": { "natural": [...] },
    "drivers": { "natural": [...] },
    "dental_beneficiaries": { "natural": [...] }
  },
  "objeto_asegurado": {
    "placa": "GEZ212",
    "marca": "FORD",
    "modelo": "Campero",
    "vehiculo": "Explorer [5] [fl]",
    "anio": "2019",
    "valor_comercial": "126700000"
  },
  "_risks_raw": [{
    "placa", "codigoFasecolda", "tipoPlaca", "marca", "modelo", "version",
    "tipoVehiculo", "anioVehiculo", "usoVehiculo", "colorVehiculo",
    "codigoMotor", "chasisVehiculo", "codigoVIN", "valorComercial",
    "descripcionVehiculo", "vehiculoNuevo", "tieneBlindaje",
    "transportaCombustible", "accesorios": [], "dispositivos": []
  }],
  "coberturas": [
    {
      "nombre": "Pérdida total por hurto",
      "valor_asegurado": "$ 126.900.000",
      "deducible": "0%"
    },
    {
      "nombre": "Responsabilidad civil general familiar",
      "valor_asegurado": "$ 44.000.000",
      "deducible": "1 SMLV"
    }
  ]
}
```

**Person categories disponibles:** holders, insured, beneficiaries, drivers, dental_beneficiaries  
**Per-person fields:** id_type, id_number, first_name, second_name, last_name, last_second_name, address, email, city, department, phone, is_onerous, beneficiary_type, discount

---

### 2.3 Bolívar — Solo datos del listado (`GET /bolivar/polizas`)

**No hay endpoint de detalle funcional** (consultaDetalleHistoricoPoliza retorna array vacío para pólizas vigentes).

**Campos disponibles del listado (ya muy ricos):**
```json
{
  "nombreRamo": "AUTOMOVILES",
  "codigoRamo": 1,
  "codigoProducto": 250,
  "nombreProducto": "NUEVO PRODUCTO AUTOMOVILES",
  "numeroPoliza": "1010501474701",
  "valorPrimaAnual": "3966081",
  "vigenciaInicio": 1758258000000,
  "vigenciaFinal": 1789794000000,
  "formaCobro": "ANUAL",
  "estadoProducto": ["Precancelación", "Riesgos"],
  "polizaColectiva": false,
  "porcentajeBonificacion": "12.5",
  "tipoPoliza": "INDIVIDUAL",
  "estadoPoliza": "VIGENTE",
  "codCompania": "3",
  "codigoAgente": 34325,
  "numeroConsecutivoPoliza": "29833288342",
  "numeroIdentificacion": "79784001",
  "tipoIdentificacion": 1,
  "descIdentificacion": "CC",
  "valorIVAPrimaAnual": "633240",
  "desFormCobro": "CAJA DE LA COMPANIA",
  "alertaSarlaf": 1,
  "_clienteNombre": "ANDRES MONTOYA HIDALGO",
  "_clienteDoc": "79784001",
  "_clienteTipoDoc": "CC"
}
```

**Ramos encontrados:** AUTOMOVILES (104), SOAT (115), MULTIRRIESGO INDUSTR (4), VIDA INDIVIDUAL (5)

---

### 2.4 AXA Colpatria — `GET /axa/polizas/detalle?id_contrato={}&id_sucursal={}&id_ramo={}`

**Campos del listado:**
```json
{
  "numero_poliza": "12345",
  "producto": "AUTO PLAN BÁSICO",
  "sub_producto": "...",
  "valor_asegurado": "50000000",
  "fecha_inicio": "01/01/2026",
  "fecha_fin": "01/01/2027",
  "nombre_tomador": "JUAN PEREZ",
  "documento_tomador": "12345678",
  "tipo_persona": "PN",
  "ramo": "AUTOMOVILES",
  "sucursal": "MEDELLIN",
  "encoded_info": "base64...",
  "_raw": { "IdContrato", "NombreProducto", "NombreSubProducto", "Monto", "FechaInicio", "FechaFinal", "businessBranch", "branchOffice", "encodedInfo" }
}
```

**Detail endpoint** devuelve HTML-parsed tables via Playwright (portal down al momento de test).

---

### 2.5 Seguros del Estado — `GET /estado/polizas`

**Solo listado via scraping.** Campos son headers de tabla HTML (variables).  
**No hay endpoint de detalle.**

---

## 3. Esquema Normalizado Propuesto

### 3.1 Tab "Financiero" (poliza_financials)

| Campo normalizado      | SURA detail              | HDI detail | Bolívar listing         | AXA listing      |
|------------------------|--------------------------|------------|-------------------------|------------------|
| `premium_total`        | `ptprimaformapago`       | —          | `valorPrimaAnual`       | —                |
| `premium_iva`          | `ptPrimaFormaPagoIva`    | —          | `valorIVAPrimaAnual`    | —                |
| `premium_net`          | (total - iva)            | —          | (total - iva)           | —                |
| `payment_method`       | `formaPago`              | —          | `formaCobro`            | —                |
| `payment_frequency`    | —                        | —          | `desFormCobro`          | —                |
| `is_financed`          | `snFinanciada` (S/N)     | —          | —                       | —                |
| `discount_pct`         | `bonificacion`           | —          | `porcentajeBonificacion`| —                |
| `insured_value`        | `valorVehiculo`          | `valorComercial` | —                | `Monto`          |
| `commission_pct`       | `asesores[0].porcentajeParticipacion` | — | —              | —                |
| `agent_code`           | `asesores[0].codigo`     | —          | `codigoAgente`          | —                |
| `agent_name`           | `asesores[0].nombre`     | —          | —                       | —                |

### 3.2 Tab "Coberturas" (poliza_coverages)

| Campo normalizado      | SURA detail                    | HDI detail          | Bolívar | AXA |
|------------------------|--------------------------------|---------------------|---------|-----|
| `coverage_type`        | `tipoCobertura`                | —                   | —       | —   |
| `coverage_name`        | `nombreCobertura`              | `nombre`            | —       | —   |
| `insured_value`        | `ptaAsegurado`                 | `valor_asegurado`   | —       | —   |
| `deductible`           | `porcentajeDeducibleMinimo`    | `deducible`         | —       | —   |

### 3.3 Tab "Personas Vinculadas" (poliza_persons)

| Campo normalizado    | SURA detail              | HDI detail (_persons_raw)          | Bolívar | AXA |
|----------------------|--------------------------|-------------------------------------|---------|-----|
| `role`               | (tomador/asegurado/beneficiario) | holders/insured/beneficiaries/drivers | —    | —   |
| `document_type`      | `tipoDniTomador`, etc.   | `id_type`                          | —       | —   |
| `document_number`    | `dniTomador`, etc.       | `id_number`                        | —       | —   |
| `full_name`          | `nombreTomador`, etc.    | `first_name + last_name`           | —       | —   |
| `first_name`         | —                        | `first_name`                       | —       | —   |
| `last_name`          | —                        | `last_name`                        | —       | —   |
| `address`            | `direccion`              | `address`                          | —       | —   |
| `phone`              | `numeroTelefono`         | `phone`                            | —       | —   |
| `email`              | `correoAsegurado`        | `email`                            | —       | —   |
| `city`               | `ciudad`                 | `city`                             | —       | —   |
| `department`         | —                        | `department`                       | —       | —   |
| `is_onerous`         | —                        | `is_onerous`                       | —       | —   |
| `beneficiary_type`   | —                        | `beneficiary_type`                 | —       | —   |

### 3.4 Tab "Objeto Asegurado" (poliza_insured_objects) — Solo Autos

| Campo normalizado    | SURA detail          | HDI detail (_risks_raw)    | Bolívar | AXA |
|----------------------|---------------------|---------------------------|---------|-----|
| `license_plate`      | `placa`             | `placa`                   | —       | —   |
| `brand`              | `marca`             | `marca`                   | —       | —   |
| `model`              | `modelo`            | `modelo`                  | —       | —   |
| `year`               | `modelo` (year)     | `anioVehiculo`            | —       | —   |
| `vehicle_type`       | `vehiculo`          | `tipoVehiculo`            | —       | —   |
| `vehicle_use`        | —                   | `usoVehiculo`             | —       | —   |
| `color`              | —                   | `colorVehiculo`           | —       | —   |
| `engine_number`      | `motor`             | `codigoMotor`             | —       | —   |
| `chassis_number`     | `chasis`            | `chasisVehiculo`          | —       | —   |
| `vin`                | —                   | `codigoVIN`               | —       | —   |
| `fasecolda_code`     | `cdFaseColda`       | `codigoFasecolda`         | —       | —   |
| `commercial_value`   | `valorVehiculo`     | `valorComercial`          | —       | —   |
| `is_armored`         | —                   | `tieneBlindaje`           | —       | —   |
| `is_new`             | —                   | `vehiculoNuevo`           | —       | —   |
| `accessories`        | —                   | `accesorios[]`            | —       | —   |

### 3.5 Tab "Recibos y Reclamaciones" (solo SURA)

| Campo normalizado    | SURA detail                |
|----------------------|---------------------------|
| `pending_receipts`   | `_recibos_pendientes[]`   |
| `claims`             | `_reclamaciones[]`        |

---

## 4. Campos del Listado que ya se pueden guardar (sin detail call)

Estos campos vienen del listado y se pueden almacenar directamente en la póliza:

### Bolívar (los más ricos sin necesitar detail):
- `valorPrimaAnual` → `premium_total`
- `valorIVAPrimaAnual` → `premium_iva`
- `formaCobro` / `desFormCobro` → `payment_method` / `payment_frequency`
- `porcentajeBonificacion` → `discount_pct`
- `tipoPoliza` → `policy_type` (INDIVIDUAL/COLECTIVA)
- `polizaColectiva` → `is_collective`
- `estadoPoliza` → `status`
- `codigoAgente` → `agent_code`

### SURA listing (ya guardados parcialmente):
- `ramo_codigo`, `ramo_nombre`, `producto`, `forma_pago`, `financiada`

### HDI listing:
- `ramo`, `grupo`, `estado`, `riesgos` (count)
- `_sseguro`, `_product_code` (necesarios para hacer el detail call)

---

## 5. Estrategia de Implementación Recomendada

### Fase 1: Guardar campos extra del listado (sin detail call)
- Actualizar `syncPolizas()` para guardar campos financieros de Bolívar que ya vienen en el listado
- Guardar `_sseguro`/`_product_code` de HDI para poder hacer detail calls después
- Guardar `ramo_codigo` de SURA para poder hacer detail calls después

### Fase 2: Detail sync (segundo paso, bajo demanda o batch)
- Para cada póliza guardada, si tiene los IDs necesarios, hacer el detail call
- Guardar coberturas, personas vinculadas, objeto asegurado, financiero
- Esto es costoso (1 API call per póliza) — hacerlo on-demand o en background

### Fase 3: Frontend tabs
- Tab "Financiero": prima, IVA, forma de pago, comisión, bonificación
- Tab "Coberturas": tabla con nombre, valor asegurado, deducible
- Tab "Personas": tomador, asegurado, beneficiarios, conductores
- Tab "Objeto Asegurado": datos del vehículo (solo ramo autos)
- Tab "Recibos/Reclamaciones": solo SURA

### Prioridad de detail calls:
1. **SURA** — más datos (coberturas + asesores con comisión + recibos + reclamaciones), ~48% de pólizas tienen detail
2. **HDI** — coberturas + personas completas + objeto asegurado
3. **Bolívar** — detail endpoint no funcional para vigentes, pero listing ya es rico
4. **AXA** — detail via Playwright (lento, portal inestable)
5. **Estado** — sin detail endpoint
