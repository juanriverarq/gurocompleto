# 🎨 Guía Visual: Configurar Server Tool en ElevenLabs

## ⚠️ Nota sobre Errores en Consola

Los errores que ves (`ERR_BLOCKED_BY_CLIENT`, `px.ads.linkedin.com`) son de **LinkedIn Ads** bloqueados por tu ad-blocker. **NO son errores de ElevenLabs** y no afectan la funcionalidad. Puedes ignorarlos.

## 📝 Configuración del Server Tool

### Paso 1: Acceder a Tools

1. Ve a https://elevenlabs.io/app/agents
2. Haz clic en tu agente
3. Busca la pestaña o sección **"Tools"**
4. Haz clic en **"Add Tool"**

### Paso 2: Configuración Básica

En la interfaz de ElevenLabs, llena los siguientes campos:

#### Tab "Configuration"

| Campo | Valor |
|-------|-------|
| **Tool Type** | Webhook |
| **Name** | `collect_customer_data` |
| **Description** | `Recolecta datos del cliente durante la llamada. Usa este tool cuando el cliente proporcione información como email, teléfono, calificaciones o feedback. Puedes llamar este tool múltiples veces.` |
| **Method** | POST |
| **URL** | `https://tu-backend.com/api/saas/voice-campaigns/tools/collect-data/{conversation_id}` |

**Importante:** Reemplaza `tu-backend.com` con tu dominio real.

### Paso 3: Headers

#### Tab "Headers"

Agregar un header:

| Name | Value |
|------|-------|
| `Content-Type` | `application/json` |

### Paso 4: Path Parameters

#### Tab "Path Parameters"

Agregar un parámetro:

| Data Type | Identifier | Value Type | Description |
|-----------|------------|------------|-------------|
| string | `conversation_id` | LLM Prompt | ID de la conversación de ElevenLabs |

**Marcar como Required:** ✅

### Paso 5: Body Parameters

#### Tab "Body Parameters"

Agregar los siguientes parámetros (TODOS opcionales, NO marcar Required):

#### 1. email
- **Data Type:** string
- **Identifier:** `email`
- **Value Type:** LLM Prompt
- **Required:** ❌ NO
- **Description:** `Email del cliente. Formato: usuario@dominio.com`

#### 2. phone
- **Data Type:** string
- **Identifier:** `phone`
- **Value Type:** LLM Prompt
- **Required:** ❌ NO
- **Description:** `Número de teléfono del cliente. Formato: 3001234567`

#### 3. debt_amount
- **Data Type:** number
- **Identifier:** `debt_amount`
- **Value Type:** LLM Prompt
- **Required:** ❌ NO
- **Description:** `Monto de deuda en pesos (solo recordatorios de pago)`

#### 4. payment_commitment_date
- **Data Type:** string
- **Identifier:** `payment_commitment_date`
- **Value Type:** LLM Prompt
- **Required:** ❌ NO
- **Description:** `Fecha de compromiso de pago. Formato: YYYY-MM-DD`

#### 5. satisfaction_rating
- **Data Type:** integer
- **Identifier:** `satisfaction_rating`
- **Value Type:** LLM Prompt
- **Required:** ❌ NO
- **Description:** `Calificación de satisfacción del 1 al 10 (solo encuestas)`
- **Minimum:** 1
- **Maximum:** 10

#### 6. recommendation_score
- **Data Type:** integer
- **Identifier:** `recommendation_score`
- **Value Type:** LLM Prompt
- **Required:** ❌ NO
- **Description:** `Score de recomendación NPS del 1 al 10 (solo encuestas)`
- **Minimum:** 1
- **Maximum:** 10

#### 7. feedback
- **Data Type:** string
- **Identifier:** `feedback`
- **Value Type:** LLM Prompt
- **Required:** ❌ NO
- **Description:** `Comentarios o feedback del cliente`

#### 8. improvement_suggestions
- **Data Type:** string
- **Identifier:** `improvement_suggestions`
- **Value Type:** LLM Prompt
- **Required:** ❌ NO
- **Description:** `Sugerencias de mejora del cliente`

#### 9. positive_aspects
- **Data Type:** string
- **Identifier:** `positive_aspects`
- **Value Type:** LLM Prompt
- **Required:** ❌ NO
- **Description:** `Aspectos positivos mencionados`

#### 10. preferred_contact_method
- **Data Type:** string
- **Identifier:** `preferred_contact_method`
- **Value Type:** LLM Prompt
- **Required:** ❌ NO
- **Description:** `Método de contacto preferido: whatsapp, email o phone`

### Paso 6: Configuración Avanzada (Opcional)

En la parte inferior del formulario:

| Campo | Valor |
|-------|-------|
| **Response Timeout** | 20 segundos |
| **Disable Interruptions** | ❌ NO (dejar sin marcar) |
| **Force Pre-Tool Speech** | auto |

### Paso 7: Guardar

1. Haz clic en **"Save"** o **"Create Tool"**
2. El tool aparecerá en la lista de tools de tu agente

## ✅ Verificar que se Guardó Correctamente

Después de guardar, deberías ver el tool en la lista con:
- ✅ Nombre: `collect_customer_data`
- ✅ Type: Webhook
- ✅ URL: Tu backend URL
- ✅ 10 parámetros configurados

## 🧪 Probar el Tool

### Opción 1: Test en ElevenLabs

Si ElevenLabs tiene una opción de "Test" o "Try it":

1. Inicia una conversación de prueba
2. Di: "Mi email es test@example.com"
3. El agente debería responder y llamar al tool

### Opción 2: Llamada Real desde tu Sistema

```typescript
import voiceCampaignExamples from './voiceCampaignExamples';

// Ejecutar ejemplo de encuesta
await voiceCampaignExamples.exampleSatisfactionSurvey();
```

Luego revisa los logs:

```bash
tail -f storage/logs/laravel.log | grep "VOICE TOOLS"
```

Deberías ver:
```
🔧 [VOICE TOOLS] Recibiendo datos de Custom Tool
✅ [VOICE TOOLS] Datos guardados exitosamente
```

## 🎯 Cómo Funciona con Prompts Dinámicos

Tu sistema actual ya hace override del prompt en cada llamada (líneas 1052-1118). El prompt personalizado incluye instrucciones específicas:

**Para Recordatorio de Pago:**
```
# Tools
Durante la llamada, solicita: email, phone, debt_amount
Usa collect_customer_data para guardar cada dato que obtengas.
```

**Para Bienvenida:**
```
# Tools
Durante la llamada, solicita: email, phone, preferred_contact_method
Usa collect_customer_data para guardar cada dato que obtengas.
```

**Para Encuesta:**
```
# Tools
Durante la encuesta, solicita: satisfaction_rating, recommendation_score, feedback
Usa collect_customer_data para guardar cada respuesta.
```

## ✅ Resultado Esperado

Después de configurar el tool:

1. ✅ El agente puede llamar a `collect_customer_data` durante cualquier llamada
2. ✅ Los datos se envían a tu backend vía webhook
3. ✅ Se guardan en `call_metadata.collected_data`
4. ✅ Están disponibles vía API

## 🔍 Troubleshooting

### "No puedo guardar el tool"

**Solución:**
- Verifica que la URL sea válida y accesible públicamente
- Asegúrate de que todos los campos requeridos estén llenos
- Intenta con una URL de prueba primero: `https://webhook.site/unique-id`

### "El tool no aparece en la lista"

**Solución:**
- Refresca la página
- Verifica que hayas hecho clic en "Save"
- Revisa que el tipo sea "Webhook" no "Client"

### "Errores en consola del navegador"

**Solución:**
- Los errores de `px.ads.linkedin.com` son normales (ads bloqueados)
- Los errores de React minificado son de ElevenLabs, no tuyos
- Si el tool se guardó, ignora estos errores

## 📞 Soporte

Si tienes problemas configurando el tool:
1. Toma captura de pantalla de la interfaz
2. Revisa que la URL sea accesible: `curl -X POST https://tu-backend.com/api/saas/voice-campaigns/tools/collect-data/test123`
3. Contacta a soporte de ElevenLabs si persiste el problema

---

**Tiempo estimado:** 10-15 minutos

**Archivos de referencia:**
- JSON config: [`ELEVENLABS_TOOL_JSON_CONFIG.json`](backend/app/Services/ELEVENLABS_TOOL_JSON_CONFIG.json:1)
- Guía técnica: [`ELEVENLABS_SERVER_TOOLS_SETUP.md`](backend/app/Services/ELEVENLABS_SERVER_TOOLS_SETUP.md:1)