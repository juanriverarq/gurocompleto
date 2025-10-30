# 📊 Cómo se Obtienen los Datos del Cliente Durante la Llamada

## 🔄 Flujo Completo de Recolección de Datos

### 1️⃣ **Durante la Llamada** (ElevenLabs + Agente IA)

El agente de voz le pide al cliente que proporcione datos usando un formato específico:

```
Agente: "Antes de finalizar, necesito confirmar unos datos cortos"
Agente: "¿Cuál es tu email?"
Cliente: "Mi email es juan.perez@gmail.com"
Agente: "Perfecto, confirmo: email: juan.perez@gmail.com"
```

**Clave:** El agente pronuncia los datos usando el formato `"campo: valor"` para facilitar la extracción.

### 2️⃣ **ElevenLabs Genera la Transcripción**

Cuando la llamada termina, ElevenLabs envía un webhook con:

```json
{
  "type": "post_call_transcription",
  "data": {
    "conversation_id": "conv_abc123",
    "transcript": [
      {
        "role": "agent",
        "message": "¿Cuál es tu email?"
      },
      {
        "role": "user", 
        "message": "Mi email es juan.perez@gmail.com"
      },
      {
        "role": "agent",
        "message": "Perfecto, confirmo: email: juan.perez@gmail.com"
      }
    ],
    "analysis": {
      "call_successful": true
    }
  }
}
```

### 3️⃣ **Backend Recibe el Webhook** 

El método [`receiveElevenLabsWebhook`](backend/app/Http/Controllers/Api/VoiceCampaignController.php:229) procesa el webhook:

```php
// Línea 322-354: Extracción de datos
if ($isTerminal) {
    // Convertir transcript array a texto completo
    $fullTranscriptText = collect($transcript)
        ->map(function ($t) {
            return $t['message'] ?? $t['content'] ?? $t['text'] ?? '';
        })
        ->implode("\n");
    
    // Obtener configuración de campos a recolectar
    $allowed = $campaign->settings['post_call_tools']['collect'] ?? [];
    
    // Extraer datos usando patrones regex
    $collected = $this->extractCollectedData($fullTranscriptText, $allowed);
    
    // Guardar en call_metadata
    if (!empty($collected)) {
        $meta['collected_data'] = array_merge($prev, $collected);
        $call->update(['call_metadata' => $meta]);
    }
}
```

### 4️⃣ **Extracción con Patrones Regex**

El método [`extractCollectedData`](backend/app/Http/Controllers/Api/VoiceCampaignController.php:624) usa patrones para encontrar los datos:

```php
// Línea 624-654
private function extractCollectedData(string $text, array $allowedCollect = []): array
{
    $result = [];
    
    foreach ($allowedCollect as $fieldName => $config) {
        if (!is_array($config) || !($config['enabled'] ?? false)) {
            continue;
        }
        
        $fieldType = $config['type'] ?? $fieldName;
        $extracted = $this->extractFieldByType($text, $fieldType, ...);
        
        if ($extracted) {
            $result[$fieldName] = $extracted;
        }
    }
    
    return $result;
}
```

### 5️⃣ **Patrones de Extracción por Tipo**

El método [`extractFieldByType`](backend/app/Http/Controllers/Api/VoiceCampaignController.php:659) usa regex específicos:

#### Para Email (línea 676-680):
```php
case 'email':
    if (preg_match('/([a-zA-Z0-9_\.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9\.-]+)/', $text, $m)) {
        return ['value' => $m[1], 'confidence' => 0.8, 'source' => 'email_pattern'];
    }
```

#### Para Teléfono (línea 696-701):
```php
case 'phone':
    if (preg_match('/\b3\d{9}\b/', $text, $m)) {
        return ['value' => $m[0], 'confidence' => 0.7, 'source' => 'phone_pattern'];
    }
```

#### Para Calificación (Nuevo - en VoiceAgentDataExtractor):
```php
case 'satisfaction_rating':
    if (preg_match('/(\d{1,2})(?:\s*(?:de|sobre|\/)\s*10)?/i', $text, $m)) {
        $rating = (int)$m[1];
        if ($rating >= 1 && $rating <= 10) {
            return ['value' => $rating, 'confidence' => 0.9];
        }
    }
```

### 6️⃣ **Datos se Guardan en la Base de Datos**

Los datos extraídos se guardan en la tabla `voice_campaign_calls`:

```sql
-- Columna: call_metadata (JSON)
{
  "collected_data": {
    "email": {
      "value": "juan.perez@gmail.com",
      "confidence": 0.8,
      "source": "email_pattern"
    },
    "phone": {
      "value": "3001234567",
      "confidence": 0.7,
      "source": "phone_pattern"
    },
    "satisfaction_rating": {
      "value": 9,
      "confidence": 0.9,
      "source": "rating_pattern"
    }
  }
}
```

### 7️⃣ **Frontend Obtiene los Datos**

Cuando consultas el historial de llamadas, los datos vienen incluidos:

```typescript
// Llamar al servicio
const history = await voiceCampaignService.getCallHistory({
  campaign_id: 123
});

// Los datos están en cada llamada
history.calls.forEach(call => {
  console.log('Datos recolectados:', call.collected_data);
  
  // Ejemplo de salida:
  // {
  //   email: { value: "juan@gmail.com", confidence: 0.8 },
  //   phone: { value: "3001234567", confidence: 0.7 },
  //   satisfaction_rating: { value: 9, confidence: 0.9 }
  // }
});
```

## 📋 Ejemplo Completo: Encuesta de Satisfacción

### Paso 1: Crear Campaña con Campos a Recolectar

```typescript
const surveyCampaign = createSatisfactionSurveyCampaign({
  campaignName: 'Encuesta Post-Servicio',
  contacts: [{
    name: 'Carlos Rodríguez',
    phone: '+573005551234',
    policy_number: 'POL-2024-003',
    last_service_date: '2024-01-10',
    interaction_type: 'Renovación de póliza'
  }],
  agentId: 'agent-satisfaction-survey'
});

// Esto automáticamente configura:
// settings.post_call_tools.collect = {
//   satisfaction_rating: { enabled: true, type: 'satisfaction_rating' },
//   recommendation_score: { enabled: true, type: 'recommendation_score' },
//   feedback: { enabled: true, type: 'feedback' }
// }
```

### Paso 2: Durante la Llamada

```
Agente: "Del 1 al 10, ¿qué tan satisfecho estás con nuestro servicio?"
Cliente: "Le doy un 9"
Agente: "Excelente, confirmo: calificación: 9"

Agente: "¿Recomendarías GURO a un amigo? Del 1 al 10"
Cliente: "Sí, un 10"
Agente: "Perfecto, confirmo: recomendación: 10"

Agente: "¿Qué es lo que más valoras?"
Cliente: "La atención rápida y el buen servicio"
Agente: "Gracias, confirmo: feedback: La atención rápida y el buen servicio"
```

### Paso 3: Webhook Procesa la Transcripción

```php
// El texto completo de la transcripción:
$fullTranscriptText = "
¿Qué tan satisfecho estás con nuestro servicio?
Le doy un 9
Confirmo: calificación: 9
¿Recomendarías GURO a un amigo?
Sí, un 10
Confirmo: recomendación: 10
¿Qué es lo que más valoras?
La atención rápida y el buen servicio
Confirmo: feedback: La atención rápida y el buen servicio
";

// Se extraen los datos:
$collected = [
    'satisfaction_rating' => [
        'value' => 9,
        'confidence' => 0.9,
        'source' => 'rating_pattern'
    ],
    'recommendation_score' => [
        'value' => 10,
        'confidence' => 0.9,
        'source' => 'nps_pattern'
    ],
    'feedback' => [
        'value' => 'La atención rápida y el buen servicio',
        'confidence' => 0.6,
        'source' => 'feedback_pattern'
    ]
];

// Se guardan en la BD
$call->update(['call_metadata' => ['collected_data' => $collected]]);
```

### Paso 4: Consultar los Datos

```typescript
// Obtener historial
const history = await voiceCampaignService.getCallHistory({
  campaign_id: 123
});

// Acceder a los datos
const call = history.calls[0];
console.log('Calificación:', call.collected_data.satisfaction_rating.value); // 9
console.log('NPS:', call.collected_data.recommendation_score.value); // 10
console.log('Feedback:', call.collected_data.feedback.value); // "La atención..."
```

## 🎯 Datos Recolectados por Tipo de Campaña

### Recordatorio de Pago
```json
{
  "collected_data": {
    "phone": { "value": "3001234567", "confidence": 0.7 },
    "email": { "value": "cliente@example.com", "confidence": 0.8 },
    "debt_amount": { "value": "125000", "confidence": 0.7 }
  }
}
```

### Bienvenida al Cliente
```json
{
  "collected_data": {
    "email": { "value": "nuevo@example.com", "confidence": 0.8 },
    "phone": { "value": "3009876543", "confidence": 0.7 },
    "preferred_contact_method": { "value": "whatsapp", "confidence": 0.8 }
  }
}
```

### Encuesta de Satisfacción
```json
{
  "collected_data": {
    "satisfaction_rating": { "value": 9, "confidence": 0.9 },
    "recommendation_score": { "value": 10, "confidence": 0.9 },
    "feedback": { "value": "Excelente servicio", "confidence": 0.6 },
    "improvement_suggestions": { "value": "Más horarios de atención", "confidence": 0.7 }
  }
}
```

## 📍 Dónde se Almacenan los Datos

### Base de Datos
```
Tabla: voice_campaign_calls
Columna: call_metadata (JSON)
Estructura: {
  "collected_data": { ... },
  "payment_link_sent_at": "2024-01-20 10:30:00",
  "whatsapp_sent_at": "2024-01-20 10:30:05"
}
```

### API Response
```json
GET /api/saas/voice-campaigns/call-history

{
  "success": true,
  "data": [
    {
      "id": 123,
      "recipient_name": "Carlos Rodríguez",
      "recipient_phone": "+573005551234",
      "status": "completed",
      "duration_seconds": 180,
      "collected_data": {
        "satisfaction_rating": { "value": 9, "confidence": 0.9 },
        "recommendation_score": { "value": 10, "confidence": 0.9 },
        "feedback": { "value": "Excelente servicio", "confidence": 0.6 }
      }
    }
  ]
}
```

## 🔍 Cómo Acceder a los Datos

### Desde el Frontend

```typescript
// 1. Obtener historial de llamadas
const history = await voiceCampaignService.getCallHistory({
  campaign_id: 123,
  limit: 50
});

// 2. Filtrar llamadas completadas con datos
const callsWithData = history.calls.filter(call => 
  call.collected_data && Object.keys(call.collected_data).length > 0
);

// 3. Procesar datos recolectados
callsWithData.forEach(call => {
  const data = call.collected_data;
  
  // Para Encuesta de Satisfacción
  if (data.satisfaction_rating) {
    console.log(`Cliente ${call.recipient_name}:`);
    console.log(`  - Satisfacción: ${data.satisfaction_rating.value}/10`);
    console.log(`  - NPS: ${data.recommendation_score?.value}/10`);
    console.log(`  - Feedback: ${data.feedback?.value}`);
  }
  
  // Para Bienvenida
  if (data.preferred_contact_method) {
    console.log(`Método preferido: ${data.preferred_contact_method.value}`);
  }
  
  // Para Recordatorio de Pago
  if (data.debt_amount) {
    console.log(`Monto confirmado: $${data.debt_amount.value}`);
  }
});
```

### Desde el Backend (PHP)

```php
// Obtener una llamada específica
$call = VoiceCampaignCall::find($callId);

// Acceder a datos recolectados
$collectedData = $call->call_metadata['collected_data'] ?? [];

// Para Encuesta de Satisfacción
$rating = $collectedData['satisfaction_rating']['value'] ?? null;
$nps = $collectedData['recommendation_score']['value'] ?? null;
$feedback = $collectedData['feedback']['value'] ?? null;

if ($rating !== null) {
    echo "Calificación: {$rating}/10\n";
    
    // Alerta si calificación baja
    if ($rating < 7) {
        // Crear ticket de seguimiento
        // Notificar al supervisor
        Log::warning("⚠️ Calificación baja detectada", [
            'call_id' => $call->id,
            'rating' => $rating,
            'customer' => $call->recipient_name
        ]);
    }
}
```

## 📈 Reportes y Análisis

### Generar Reporte de Satisfacción

```php
// Obtener todas las encuestas completadas
$surveyCalls = VoiceCampaignCall::whereHas('voiceCampaign', function($q) {
    $q->where('settings->campaign_type', 'satisfaction_survey');
})
->where('status', 'completed')
->get();

// Calcular promedios
$ratings = [];
$npsScores = [];

foreach ($surveyCalls as $call) {
    $data = $call->call_metadata['collected_data'] ?? [];
    
    if (isset($data['satisfaction_rating']['value'])) {
        $ratings[] = $data['satisfaction_rating']['value'];
    }
    
    if (isset($data['recommendation_score']['value'])) {
        $npsScores[] = $data['recommendation_score']['value'];
    }
}

$avgRating = count($ratings) > 0 ? array_sum($ratings) / count($ratings) : 0;
$avgNPS = count($npsScores) > 0 ? array_sum($npsScores) / count($npsScores) : 0;

echo "Satisfacción promedio: " . round($avgRating, 2) . "/10\n";
echo "NPS promedio: " . round($avgNPS, 2) . "/10\n";
```

### Dashboard de Métricas

```typescript
// Obtener todas las llamadas de encuestas
const surveys = await voiceCampaignService.getCallHistory({
  campaign_id: surveyC ampaignId,
  status: 'completed',
  limit: 1000
});

// Calcular métricas
const metrics = {
  totalResponses: 0,
  avgSatisfaction: 0,
  avgNPS: 0,
  promoters: 0,  // NPS 9-10
  passives: 0,   // NPS 7-8
  detractors: 0, // NPS 0-6
  commonFeedback: []
};

surveys.calls.forEach(call => {
  const data = call.collected_data;
  
  if (data?.satisfaction_rating) {
    metrics.totalResponses++;
    metrics.avgSatisfaction += data.satisfaction_rating.value;
  }
  
  if (data?.recommendation_score) {
    const score = data.recommendation_score.value;
    metrics.avgNPS += score;
    
    if (score >= 9) metrics.promoters++;
    else if (score >= 7) metrics.passives++;
    else metrics.detractors++;
  }
  
  if (data?.feedback) {
    metrics.commonFeedback.push(data.feedback.value);
  }
});

// Calcular promedios
if (metrics.totalResponses > 0) {
  metrics.avgSatisfaction /= metrics.totalResponses;
  metrics.avgNPS /= metrics.totalResponses;
}

console.log('📊 Métricas de Satisfacción:', metrics);
```

## 🔑 Puntos Clave

1. **Los datos se extraen automáticamente** del transcript usando patrones regex
2. **Se guardan en `call_metadata.collected_data`** de cada llamada
3. **Están disponibles inmediatamente** después de que termina la llamada
4. **Se pueden consultar** vía API `/api/saas/voice-campaigns/call-history`
5. **Incluyen nivel de confianza** para validar la precisión de la extracción

## ✅ Ventajas del Sistema

- ✅ **Automático:** No requiere intervención manual
- ✅ **Estructurado:** Datos en formato JSON consistente
- ✅ **Confiable:** Incluye score de confianza por cada dato
- ✅ **Trazable:** Se registra la fuente y patrón usado
- ✅ **Extensible:** Fácil agregar nuevos tipos de datos

## 🎯 Próximos Pasos

1. Los datos ya se están recolectando con el sistema actual
2. Para los nuevos agentes, solo necesitas:
   - Configurar los campos en `settings.post_call_tools.collect`
   - El sistema automáticamente los extraerá del transcript
   - Estarán disponibles en `call_metadata.collected_data`

¡El sistema ya funciona! Solo necesitas crear las campañas con la configuración correcta.