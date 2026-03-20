# Agente Motor - Ingeniería Inversa Completa

## Resumen Ejecutivo

Agente Motor (AGM) es un **cotizador multicompañía de seguros** basado en:
- **Backend**: Odoo 13 (Python) como CRM + gestión de datos
- **Frontend**: Múltiples SPAs React embebidas en iframes dentro de Odoo
- **Cotización**: AWS Lambda + Step Functions como orquestador
- **Infraestructura**: AWS (Lambda, API Gateway, Step Functions, S3, Cognito, EC2)

Las aseguradoras se conectan de **dos formas**:
1. **Web Service (API)**: Allianz WS, Bolívar WS, SURA WS, SBS WS, etc. — APIs oficiales con credenciales
2. **Ingeniería Inversa (scraping de portales)**: SURA Plus, Bolívar Bolnet, Allianz Plus, etc. — Replican las sesiones del portal web del asesor

---

## Arquitectura General

```
┌─────────────────────────────────────────────────────────────┐
│  FRONTEND (SPAs React embebidas en Odoo via iframe)         │
│  - home-console-new (Next.js dashboard)                     │
│  - agm-forms (formulario de cotización)                     │
│  - avs-config-agm (configuración de conexiones)             │
│  - avs-config-central (configuración central)               │
│  - kendo-offers-report (reportes de ofertas)                │
│  - agm-login-multiplatform (login con reCAPTCHA)            │
│  Host: clientes.co.agentemotor.com/public_apps/co/          │
└────────────────────────┬────────────────────────────────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
          ▼              ▼              ▼
┌─────────────┐ ┌──────────────┐ ┌────────────────────┐
│ Odoo 13     │ │ API Central  │ │ AWS API Gateway    │
│ Backend     │ │ (apipro)     │ │ (orquestador)      │
│             │ │              │ │                    │
│ Endpoints:  │ │ Endpoints:   │ │ Endpoints:         │
│ /insurers/  │ │ /seguros/co/ │ │ /prod/orquestator/ │
│ /connections│ │  vehiculos/  │ │  syncstart         │
│ /web/dataset│ │  consultar/  │ │                    │
│             │ │  v2          │ │ Step Functions ARN:│
│ DB: Postgres│ │              │ │ EventRequestPolicy │
│ Tenant:     │ │ Auth: JWT    │ │                    │
│ ch.co.agent │ │ (Cognito)    │ │ Account ID:        │
│ emotor.com  │ │              │ │ 907888255793       │
└─────────────┘ └──────┬───────┘ └────────┬───────────┘
                       │                  │
                       ▼                  ▼
              ┌──────────────────────────────────┐
              │  AWS Lambda Functions             │
              │                                  │
              │  - Test conexión (Lambda URL):    │
              │    ttweah75sqwywikts6svfg4vwa0    │
              │    dyrsy.lambda-url.us-east-2     │
              │                                  │
              │  - Cotización real:               │
              │    Step Functions orquesta        │
              │    múltiples Lambdas que          │
              │    hacen scraping/API calls       │
              │    a cada aseguradora             │
              └──────────────┬───────────────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
        ┌──────────┐ ┌──────────┐ ┌──────────────┐
        │SURA Plus │ │Bolívar   │ │Allianz Plus  │
        │(portal   │ │Bolnet    │ │(allia2net)   │
        │SURA)     │ │(portal   │ │              │
        │          │ │Bolívar)  │ │              │
        └──────────┘ └──────────┘ └──────────────┘
```

---

## Autenticación

### 1. Login del usuario (reCAPTCHA)
- **URL**: `POST https://apipro.agentemotor.com/app/co/central/login`
- **Body**: `{username, password, captcha_token}`
- **Retorna**: `access_token` (JWT)
- **reCAPTCHA sitekey**: `6LdJbMIqAAAAAF8OX8AxNy-TMJwPBwFL8Ty2ZEq6`
- **Redirige a**: `https://{tenant}.agentemotor.com/avs/multiversion/login?access_token={jwt}`

### 2. Auth pública (para SPAs embebidas — sin captcha)
- **URL**: `POST https://e0rx3hrb03.execute-api.us-east-2.amazonaws.com/default/authenticate`
- **Headers**: `Origin: https://{tenant}.agentemotor.com` (**obligatorio**)
- **Body**: `{tenant: "ch.co.agentemotor.com", username: "public", password: "public"}`
- **Retorna**: `{id_token: "eyJ..."}` (JWT de Cognito)
- **JWT Claims**:
  - `sub`: `10175749-a931-4c4a-a2fe-88fe731dcf22`
  - `iss`: `https://cognito-idp.us-east-2.amazonaws.com/us-east-2_S2zubSwhn`
  - `aud`: `g854ua0bl5cfja5jle7s0og6b` (Cognito client ID)
  - `custom:tenant`: `ch.co.agentemotor.com`
  - **Expira**: 1 hora

### 3. Sesión Odoo
- **Cookie**: `session_id` (90 días)
- **DB name**: = subdomain completo del tenant (ej: `ch.co.agentemotor.com`)

---

## Endpoints Descubiertos

### API Central (apipro.agentemotor.com)
| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| POST | `/seguros/co/vehiculos/consultar/v2` | Bearer JWT | Consulta vehículos (marcas, FASECOLDA, referencias) |
| POST | `/seguros/utils/v1/captcha-verify` | - | Verificar captcha |
| POST | `/app/co/central/login` | Captcha | Login de usuario |

### AWS API Gateway
| Endpoint | Descripción |
|----------|-------------|
| `e0rx3hrb03.../default/authenticate` | Auth pública (Cognito) |
| `47kw7otdmc.../prod/orquestator/syncstart` | **Orquestador de cotización** (Step Functions) |
| `6c11c7i3cb.../v1/crm/v2` | CRM API |
| `6c11c7i3cb.../v1/crm/mapper` | Mapper CRM |
| `6c11c7i3cb.../v1/utils/v1/get-client-ip` | IP del cliente |
| `dkhfgqs3oa.../v1/crm/tenant/enabled` | Verificar tenant habilitado |
| `fumkejbv46.../default/connections-status` | Estado de conexiones por tenant |
| `ktzfxbhe4g.../dev/json/insurance/schema/brokerinsurersdata` | Schema de datos broker |

### AWS Lambda (URL directa)
| Lambda URL | Descripción |
|------------|-------------|
| `ttweah75sqwywikts6svfg4vwa0dyrsy.lambda-url.us-east-2.on.aws/` | **Test de conexión** con aseguradoras |

### Odoo Backend (ch.co.agentemotor.com)
| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/insurers/list?company_id=N` | GET | Lista de aseguradoras |
| `/insurers/write` | POST | Actualizar aseguradora |
| `/connections/list` | POST | Lista de conexiones |
| `/connections/write?company_id=N` | POST | Guardar conexión |
| `/connections/duplicate?company_id=N` | POST | Duplicar conexión |
| `/connections/delete?company_id=N` | POST | Eliminar conexión |
| `/business/list` | POST | Líneas de negocio |
| `/linesettings/get?company_id=N` | GET | Config de líneas |
| `/exclusions/get?company_id=N` | GET | Exclusiones |
| `/avs/multiversion/login?access_token=JWT` | GET | Login AVS con token |

---

## Flujo de Cotización de Vehículos

### Paso 1: Autenticación
```
POST https://e0rx3hrb03.execute-api.us-east-2.amazonaws.com/default/authenticate
Origin: https://ch.co.agentemotor.com
{
  "tenant": "ch.co.agentemotor.com",
  "username": "public",
  "password": "public"
}
→ {id_token: "eyJ..."}
```

### Paso 2: Obtener Marcas de Vehículos
```
POST https://apipro.agentemotor.com/seguros/co/vehiculos/consultar/v2
Authorization: Bearer {id_token}
{
  "name": "event-insurable-get-list-brands",
  "data": {},
  "timestamp": "30072020",
  "origin": "ch.co.agentemotor.com"
}
→ ["CHEVROLET", "RENAULT", "KIA", "HYUNDAI", ...]
```

### Paso 3: Buscar Vehículo por Referencia
```
POST https://apipro.agentemotor.com/seguros/co/vehiculos/consultar/v2
Authorization: Bearer {id_token}
{
  "name": "event-insurable-object-by-ref",
  "data": {
    "vehicle": {
      "line": "SPARK GT",
      "brand": "CHEVROLET",
      "model": 2024,
      "vehicle_risk": {"in_agency": false}
    }
  },
  "timestamp": "30072020",
  "origin": "ch.co.agentemotor.com"
}
→ [{code: "04411", brand: "CHEVROLET", line: "SPARK GT 1.2 MT", ...}]
```

### Paso 4: Buscar por Código FASECOLDA
```
POST https://apipro.agentemotor.com/seguros/co/vehiculos/consultar/v2
Authorization: Bearer {id_token}
{
  "name": "event-insurable-object-by-fasecolda",
  "data": {
    "vehicle": {
      "code": "04411",
      "model": 2024,
      "vehicle_risk": {"in_agency": false}
    }
  },
  "timestamp": "30072020",
  "origin": "ch.co.agentemotor.com"
}
```

### Paso 5: Crear Cotización (Orquestador Step Functions)
```
POST https://47kw7otdmc.execute-api.us-east-2.amazonaws.com/prod/orquestator/syncstart
Authorization: {id_token}
{
  "input": JSON.stringify({
    "risk_in": {
      "insurable_objects": [{
        "type": "all_risk_vehicle",
        "vehicle": {
          "plate": "",
          "brand": "CHEVROLET",
          "line": "SPARK GT",
          "model": 2024,
          "code": "04411",
          "type": "AUTOMOVIL",
          "cylinder": "1200"
        },
        "insurance_use": "PARTICULAR"
      }],
      "client": {
        "identification_type": "CC",
        "identification": "1234567890",
        "names": "PRUEBA",
        "last_names": "TEST",
        "city": "BOGOTA",
        "birthdate": "1990-01-01",
        "gender": "M"
      }
    }
  }),
  "name": "{identificador_unico_cotizacion}",
  "stateMachineArn": "arn:aws:states:us-east-2:907888255793:stateMachine:EventRequestPolicy"
}
```

**Flujo interno del orquestador:**
1. Recibe datos del vehículo + cliente
2. Consulta qué aseguradoras tiene el tenant activas
3. Ejecuta **múltiples Lambdas en paralelo** (una por cada aseguradora)
4. Cada Lambda:
   - **Tipo "Plus"/portal**: Hace login en el portal del asesor → navega formulario → extrae cotización
   - **Tipo "WS"**: Llama a la API oficial de la aseguradora
5. Consolida resultados y los retorna
6. Crea registro de oportunidad en Odoo CRM

---

## Conexiones con Aseguradoras

### Catálogo Completo (15 conexiones en este tenant)

| ID | Nombre Interno | Aseguradora | Tipo | NIT | Modo |
|----|----------------|-------------|------|-----|------|
| 1 | `allia2net-plus` | ALLIANZ | Scraping portal | 860026182 | dis |
| 2 | `bolnet` | BOLIVAR | Scraping portal | 860002180 | dis |
| 3 | `colpatria_sucursalenlinea` | COLPATRIA | Scraping portal | 860002184 | dis |
| 4 | `estado_portalestado` | ESTADO | Scraping portal | 860009578 | dis |
| 5 | `hdi_poliza_electronica` | HDI | Scraping portal | 860004875 | dis |
| 6 | `hdi_click` | HDI | Scraping portal | 860004875 | dis |
| 7 | `liberty_express` | LIBERTY | Scraping portal | 860039988 | dis |
| 8 | `liberty_iaxis` | LIBERTY | Scraping portal | 860039988 | dis |
| 9 | `mapfre_oficina_virtual` | MAPFRE | Scraping portal | 891700037 | dis |
| 10 | `mundial_simulator` | MUNDIAL | Scraping portal | 860037013 | dis |
| 11 | `soat_mundial` | MUNDIAL | Scraping portal (SOAT) | 860037013 | dis |
| 12/67 | `sura_plus` | SURA | Scraping portal | 890903407 | pro |
| 34 | `sbs_ws` | SBS | API/WS | 860037707 | pro |
| 100 | `sura_ws` | SURA | API/WS | 890903407 | pro |

### Estado de Conexiones en Producción

| Interfaz | Estado | Tipo |
|----------|--------|------|
| `sura_ws` | ✅ created | API |
| `sura_plus` | ✅ created (modo pro) | Scraping |
| `allia2net-plus` | ✅ created | Scraping |
| `allia2net-plus-otros` | ✅ created | Scraping |
| `bolivar_ws` | ✅ created | API |
| `bolnet` | ✅ created | Scraping |
| `colpatria_ws` | ✅ created | API |
| `colpatria_sucursalenlinea` | ✅ created | Scraping |
| `equidad_ws` | ✅ created | API |
| `estado_ws` | ✅ created | API |
| `liberty_express` | ✅ created | Scraping |
| `mundial_ws` | ✅ created | API |
| `previsora_ws` | ✅ created | API |
| `sbs_ws` | ✅ created | API |
| `solidaria_ws` | ✅ created | API |
| `zurich_ws` | ✅ created | API |
| `mapfre_oficina_virtual` | ❌ indefinido | Scraping |
| `estado_portalestado` | ❌ indefinido | Scraping |
| `hdi_poliza_electronica` | ❌ indefinido | Scraping |
| `cotizador_agm_v1` | 🔄 creando | Propio |

---

## Detalle: SURA Plus (Scraping)

### Credenciales almacenadas (connection_config)
```json
{
  "broker_identification_type": "NIT",
  "broker_insurer_user": "9007093091",
  "broker_insurer_pwd": "9007",
  "con_mode": "pro"
}
```

### Test de conexión (verificado ✅)
```
POST https://ttweah75sqwywikts6svfg4vwa0dyrsy.lambda-url.us-east-2.on.aws/
{
  "name": "event-test-connection",
  "tenant_data": {"name": "ch.co.agentemotor.com"},
  "broker": {"broker_insurers_data": [{
    "broker_identification_type": "NIT",
    "broker_insurer_user": "9007093091",
    "broker_insurer_pwd": "9007",
    "con_mode": "pro",
    "insurer_name": "SURA",
    "insurer_interface": "sura_plus"
  }]}
}
→ {"success": true, "message": "Credenciales validadas correctamente"}
```

### Cómo funciona internamente (probable):
1. Login al portal SURA Plus usando NIT como usuario
2. Navega al cotizador de vehículos dentro del portal
3. Completa formulario con datos del vehículo (marca, línea, modelo, FASECOLDA)
4. Completa datos del tomador (CC, nombre, ciudad, etc.)
5. Extrae planes disponibles con coberturas y precios
6. Retorna datos normalizados

---

## Detalle: SURA WS (API oficial)

### Credenciales
```json
{
  "con_mode": "pro",
  "broker_code": "8670",
  "id_office_related": "4037"
}
```
- Usa código de intermediario + código de oficina
- API oficial de SURA con autenticación por código de broker

---

## Detalle: SBS Web Services (API)

### Credenciales almacenadas
```json
{
  "con_mode": "pro",
  "broker_insurer_user": "luzroc@live.com",
  "broker_insurer_pwd": "Colombia2020+",
  "broker_commission": "15"
}
```

---

## Detalle: Bolívar Bolnet (Scraping)

### Campos requeridos (según Lambda)
- `broker_insurer_user` — Usuario del portal Bolnet
- `broker_insurer_pwd` — Contraseña del portal Bolnet

No configurado en este tenant (sin credenciales guardadas).

---

## Detalle: Allianz Plus (Scraping)

### Datos
- `connection_id`: 741
- NIT: 860026182
- Requiere certificado digital firmado
- Allianz somete solicitud de credenciales a estudio (~4 semanas)

---

## Modelos Odoo Relevantes

| Modelo | Descripción |
|--------|-------------|
| `connections` | Conexiones configuradas por tenant (15 registros) |
| `connections.settings` | Configuración global |
| `insurer.provider` | Catálogo de 18 aseguradoras |
| `insurer.config` | Config de aseguradoras por broker |
| `agm.callback.service` | Callbacks asincrónicos |
| `agm.create.offer` | Ofertas/cotizaciones |
| `agm.create.offer.pdf` | PDFs de ofertas |
| `product.alias` | Mapeo de ~100+ nombres de planes por aseguradora |
| `product.template` | ~30+ productos de seguro |
| `api.key.data` | API keys (sub + password para Cognito) |
| `insurance.insurance.policy` | Pólizas emitidas |
| `insurance.insurable.object` | Objetos asegurables (vehículos, inmuebles) |
| `crm.quotation.partner` | Relación cotización-cliente |
| `agm.automation` | Automatización envío datos externos |
| `agm.financing` | Reglas de financiación |
| `denied.connection` | Conexiones denegadas/bloqueadas |

---

## Stack Tecnológico

| Capa | Tecnología |
|------|-----------|
| **Frontend** | React SPAs (Next.js, Webpack), embebidas en Odoo via iframe |
| **Backend CRM** | Odoo 13 (Python), PostgreSQL |
| **API Central** | AWS API Gateway + Lambda (Node.js) — `apipro.agentemotor.com` |
| **Orquestador** | AWS Step Functions (StateMachine: `EventRequestPolicy`) |
| **Scraping** | AWS Lambda (Node.js, posiblemente Puppeteer/Playwright) |
| **Auth** | AWS Cognito (User Pool: `us-east-2_S2zubSwhn`, Client: `g854ua0bl5cfja5jle7s0og6b`) |
| **Storage** | AWS S3 (`fs.agentemotor.com`, bucket en us-east-2) |
| **DB** | PostgreSQL (RDS en `172.31.21.240:5432`) |
| **Load Balancer** | AWS ALB (cookies AWSALB/AWSALBTG) |
| **Cuenta AWS** | `907888255793` (us-east-2) |

---

## Conclusión

Agente Motor funciona como un **orquestador de cotizaciones** que:

1. **No tiene las APIs de las aseguradoras integradas directamente** — usa una capa intermedia de Lambdas que hacen el trabajo sucio
2. **Para conexiones "Plus"** (SURA Plus, Allianz Plus, Bolnet): Las Lambdas hacen **web scraping** de los portales de asesores de cada aseguradora, usando las credenciales del broker
3. **Para conexiones "WS"**: Las Lambdas llaman a las **APIs oficiales** de las aseguradoras (cuando existen)
4. **Step Functions** coordina la ejecución paralela de todas las cotizaciones
5. **El resultado** se normaliza y se presenta en un comparativo al usuario

Para replicar esto en Guro, necesitaríamos:
- Hacer ingeniería inversa de cada portal (SURA Plus, Bolnet, Allia2Net, etc.)
- Crear scrapers/bots para cada uno
- Un orquestador que ejecute todos en paralelo
- Normalizar las respuestas a un formato común
