# 📞 Guía Completa - Historial de Llamadas

## 📋 Resumen

El **Historial de Llamadas** ha sido completamente reorganizado para integrar directamente con la API de ElevenLabs, proporcionando gestión real de conversaciones, filtros avanzados, análisis detallado y una experiencia de usuario optimizada.

## 🚀 Nuevas Funcionalidades

### 1. **Integración Real con ElevenLabs**
- **API Nativa**: Conexión directa con `/v1/convai/conversations`
- **Datos en Tiempo Real**: Información actualizada desde ElevenLabs
- **Paginación Inteligente**: Carga incremental con cursor de navegación
- **Filtros Avanzados**: Filtrado por agente, estado, resultado y fechas

### 2. **Dashboard de Estadísticas**
- **7 Métricas Principales**: Total, completadas, tasa de éxito, duración promedio, mensajes promedio, costo total, fallidas
- **Indicadores Visuales**: Cards con iconos y colores intuitivos
- **Estadísticas en Tiempo Real**: Cálculos automáticos basados en filtros aplicados

### 3. **Sistema de Filtros Potente**
- **Búsqueda Global**: Por teléfono, cliente, agente o contenido de transcripción
- **Filtros por Agente**: Lista dinámica de agentes disponibles
- **Estados de Llamada**: Iniciado, en progreso, procesando, completado, fallido
- **Resultados**: Exitoso, fallido, desconocido
- **Rangos de Fecha**: Hoy, semana, mes, personalizado

### 4. **Análisis Inteligente**
- **Sentimiento Automático**: Análisis de transcripciones (positivo, neutral, negativo)
- **Etiquetas Dinámicas**: Generación automática basada en duración y contenido
- **Análisis por Agente**: Rendimiento individual y tasas de éxito
- **Distribución de Estados**: Visualización de patrones de llamadas

### 5. **Vista de Detalles Mejorada**
- **Modal con Pestañas**: General, transcripción, análisis, técnico
- **Información Completa**: Todos los datos de la conversación
- **Reproducción de Audio**: Integración con archivos de audio (cuando disponible)
- **Datos Técnicos**: IDs, metadatos y configuraciones

## 🔧 Integración con ElevenLabs API

### **Endpoint Principal**
```
GET /v1/convai/conversations
```

### **Parámetros Soportados**
- `cursor`: Para paginación
- `agent_id`: Filtrar por agente específico
- `call_successful`: success, failure, unknown
- `call_start_after_unix`: Filtro de fecha inicio
- `call_start_before_unix`: Filtro de fecha fin
- `page_size`: Tamaño de página (máx 100)

### **Mapeo de Datos**
```typescript
// ElevenLabs → Formato Interno
{
  id: conversation.conversation_id,
  agentId: conversation.agent_id,
  agentName: conversation.agent_name,
  phoneNumber: conversation.phone_number,
  status: conversation.status, // initiated, in-progress, processing, done, failed
  duration: conversation.call_duration_secs,
  messageCount: conversation.message_count,
  startTime: new Date(conversation.start_time_unix_secs * 1000),
  outcome: conversation.call_successful,
  transcript: conversation.transcript
}
```

## 🧪 Cómo Usar el Historial

### **Paso 1: Acceso Inicial**
1. Navega a la pestaña "Historial de Llamadas" en el dashboard
2. Observa la carga automática de conversaciones reales de ElevenLabs
3. Revisa las estadísticas principales en la parte superior

### **Paso 2: Filtrado y Búsqueda**
1. **Búsqueda Global**:
   - Escribe en el campo de búsqueda
   - Busca por número de teléfono: `+57 300 123 4567`
   - Busca por cliente: `María González`
   - Busca por agente: `Sofia`
   - Busca por contenido: `renovación seguro`

2. **Filtros Específicos**:
   - **Por Agente**: Selecciona un agente específico del dropdown
   - **Por Estado**: done, failed, in-progress, processing, initiated
   - **Por Resultado**: success, failure, unknown

3. **Aplicar Filtros**: Clic en "Buscar" para aplicar todos los filtros

### **Paso 3: Visualización de Resultados**
1. **Vista de Lista**: Tarjetas detalladas con información principal
2. **Vista de Análisis**: Gráficos y estadísticas avanzadas
3. **Paginación**: Botón "Cargar más llamadas" para conversaciones adicionales

### **Paso 4: Análisis Detallado**
1. **Clic en "Detalles"** en cualquier tarjeta de llamada
2. **Navega entre pestañas**:
   - **General**: Información básica, estados y fechas
   - **Transcripción**: Texto completo de la conversación
   - **Análisis**: Sentimiento, etiquetas y notas
   - **Técnico**: IDs, duración exacta y metadatos

### **Paso 5: Reproducción de Audio** (Si disponible)
1. Clic en "Reproducir Audio" en los detalles
2. El sistema intentará reproducir el archivo de audio asociado
3. Actualmente simulado - se integrará con URLs reales de ElevenLabs

## 📊 Métricas y Estadísticas

### **Dashboard Principal**
- **Total**: Número total de conversaciones cargadas
- **Completadas**: Conversaciones con estado "done"
- **Tasa de Éxito**: Porcentaje de conversaciones exitosas
- **Duración Promedio**: Tiempo promedio en formato MM:SS
- **Mensajes Promedio**: Número promedio de intercambios
- **Costo Total**: Suma total en USD
- **Fallidas**: Número de conversaciones fallidas

### **Análisis por Agente**
- Rendimiento individual de cada agente
- Tasas de éxito comparativas
- Distribución de llamadas por agente

### **Distribución de Estados**
- Porcentajes de cada estado de llamada
- Visualización de patrones de éxito/fallo
- Identificación de problemas comunes

## 🎯 Casos de Uso Específicos

### **Gestión de Rendimiento**
1. **Identificar Mejores Agentes**:
   - Ve a la pestaña "Análisis"
   - Revisa "Rendimiento por Agente"
   - Identifica agentes con mayor tasa de éxito

2. **Detectar Problemas Técnicos**:
   - Filtra por estado "failed"
   - Revisa patrones en horarios específicos
   - Analiza transcripciones para identificar causas

### **Análisis de Calidad**
1. **Revisar Sentimiento de Clientes**:
   - Busca conversaciones con sentimiento "negative"
   - Analiza transcripciones completas
   - Identifica temas comunes de insatisfacción

2. **Optimizar Scripts**:
   - Compara conversaciones exitosas vs fallidas
   - Identifica frases y enfoques efectivos
   - Mejora prompts de agentes basado en datos reales

### **Monitoreo Operacional**
1. **Seguimiento en Tiempo Real**:
   - Usa filtros de fecha "Hoy"
   - Monitorea conversaciones en progreso
   - Identifica llamadas que requieren seguimiento

2. **Análisis de Costos**:
   - Revisa costo total por período
   - Analiza duración promedio vs costo
   - Optimiza configuraciones para eficiencia

## 🔧 Configuración Técnica

### **Variables de Entorno Requeridas**
```env
ELEVENLABS_API_KEY=tu_api_key_aqui
```

### **Dependencias del Componente**
- `getConversationsList()`: Función principal de API
- `getConversationalAgents()`: Lista de agentes para filtros
- `getPhoneCallDetails()`: Detalles específicos de llamada
- `getPhoneCallTranscript()`: Transcripción completa

### **Estados del Componente**
- `calls`: Array de conversaciones cargadas
- `agents`: Lista de agentes disponibles
- `filters`: Configuración actual de filtros
- `pagination`: Estado de paginación y cursor
- `isLoading`: Estado de carga inicial
- `isLoadingMore`: Estado de carga incremental

## 🚀 Funcionalidades Avanzadas

### **Paginación Inteligente**
- Carga inicial de 20 conversaciones
- Botón "Cargar más" para navegación incremental
- Cursor de ElevenLabs para navegación eficiente
- Indicador de progreso durante la carga

### **Búsqueda en Tiempo Real**
- Filtrado local instantáneo en conversaciones cargadas
- Búsqueda en múltiples campos simultáneamente
- Mantenimiento de filtros durante navegación

### **Análisis Automático**
- Generación automática de etiquetas basada en:
  - Duración de llamada (larga/corta)
  - Número de mensajes (extensa/breve)
  - Resultado de llamada (exitoso/fallido)
  - Estado de procesamiento

### **Exportación de Datos** (Preparado)
- Botón "Exportar" para descarga de datos
- Formato CSV con todas las conversaciones filtradas
- Incluye metadatos y análisis generado

## 📱 Experiencia de Usuario

### **Diseño Responsivo**
- **Móvil**: 1 columna de estadísticas, filtros apilados
- **Tablet**: 2-4 columnas de estadísticas, filtros en línea
- **Desktop**: 7 columnas de estadísticas, layout completo

### **Estados Visuales**
- **Loading States**: Spinners durante cargas
- **Empty States**: Mensajes informativos cuando no hay datos
- **Error States**: Notificaciones claras de errores

### **Interacciones Intuitivas**
- **Hover Effects**: Resaltado visual en tarjetas
- **Loading Indicators**: Feedback inmediato en acciones
- **Keyboard Navigation**: Soporte completo de teclado

## 🛠️ Resolución de Problemas

### **No se cargan conversaciones**
1. Verificar API key de ElevenLabs en variables de entorno
2. Revisar console del navegador para errores de API
3. Confirmar que la cuenta tiene conversaciones disponibles

### **Filtros no funcionan**
1. Hacer clic en "Buscar" después de cambiar filtros
2. Usar "Limpiar" para resetear todos los filtros
3. Verificar que hay datos que coincidan con los criterios

### **Paginación no responde**
1. Verificar conexión a internet
2. Revisar si hay más conversaciones disponibles
3. Refrescar la página si persiste el problema

### **Modal de detalles no abre**
1. Hacer clic directamente en "Detalles"
2. Verificar que la conversación tiene datos completos
3. Refrescar si el modal no responde

## ✨ Beneficios Clave

1. **🔄 Datos Reales**: Información directa de ElevenLabs sin simulaciones
2. **📊 Análisis Profundo**: Insights automáticos de rendimiento y calidad
3. **🎯 Filtrado Preciso**: Encontrar conversaciones específicas rápidamente
4. **📱 Interfaz Moderna**: Diseño intuitivo y responsive
5. **⚡ Rendimiento Optimizado**: Carga incremental y búsqueda eficiente
6. **🔍 Transparencia Total**: Acceso completo a metadatos y configuraciones

**¡El historial de llamadas ahora proporciona una visión completa y real de todas las conversaciones de ElevenLabs!** 🎉 