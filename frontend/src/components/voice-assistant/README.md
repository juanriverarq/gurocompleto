# Asistente de Voz Guro - OpenAI TTS Integration

## Descripción
Asistente de voz avanzado para el dashboard Guro que integra **OpenAI Text-to-Speech (TTS)** como tecnología principal de síntesis de voz, con **Web Speech API** como fallback robusto.

## Características Principales

### 🎙️ Síntesis de Voz Dual
- **OpenAI TTS**: Síntesis de voz de alta calidad con 6 voces disponibles
- **Web Speech API**: Fallback automático usando voces del navegador
- **Cambio transparente**: Si OpenAI falla, automáticamente usa Web Speech API

### 🎯 Voces Disponibles (OpenAI TTS)
- **alloy**: Voz equilibrada y versátil
- **echo**: Voz masculina profunda y resonante  
- **fable**: Voz narrativa y expresiva
- **onyx**: Voz masculina sólida y profesional (RECOMENDADA)
- **nova**: Voz femenina clara y moderna
- **shimmer**: Voz femenina suave y elegante

### ⚙️ Configuración Avanzada
- **Velocidad**: 0.25x - 2.0x (recomendado: 0.9x)
- **Modelo**: tts-1-hd (alta definición)
- **Formato**: MP3 optimizado
- **Idioma**: Optimizado para español

## Estructura de Archivos

```
src/components/voice-assistant/
├── VoiceAssistantModal.tsx     # Modal principal con UI
├── README.md                   # Esta documentación
└── ...

src/hooks/
└── useCoquiTTS.ts             # Hook principal (ahora usa OpenAI TTS)

src/config/
└── coquiConfig.ts             # Configuración (ahora OpenAI TTS)

src/utils/
└── voiceTest.ts               # Utilidades de prueba y debug
```

## Uso Básico

### 1. Importar el Hook
```typescript
import { useOpenAITTS } from '../../hooks/useCoquiTTS';
```

### 2. Inicializar el Hook
```typescript
const { 
  speak, 
  speakWithWebSpeech, 
  stop, 
  isSpeaking, 
  isLoading, 
  error,
  testVoice,
  debugVoices 
} = useOpenAITTS(apiKey); // apiKey es opcional
```

### 3. Síntesis de Voz
```typescript
// Con OpenAI TTS (si hay API key)
await speak("Hola, soy tu asistente de Guro", {
  voice: 'onyx',
  speed: 0.9
});

// Solo con Web Speech API
await speakWithWebSpeech("Texto a hablar", {
  rate: 0.9,
  pitch: 1.0,
  volume: 1.0,
  lang: 'es-ES'
});
```

## Configuración API

### OpenAI API Key
```typescript
// Obtener API key desde: https://platform.openai.com/api-keys
const apiKey = "sk-..."; // Tu API key de OpenAI
```

### Configuración por Defecto
```typescript
const DEFAULT_CONFIG = {
  model: 'tts-1-hd',        // Modelo de alta definición
  voice: 'onyx',            // Voz masculina profesional
  response_format: 'mp3',   // Formato de audio
  speed: 0.9                // Velocidad natural
};
```

## Estados del Componente

### Estados de Carga
- `isLoading`: Preparando síntesis de voz
- `isSpeaking`: Reproduciendo audio
- `error`: Error en la síntesis o reproducción

### Estados Visuales
- **Azul**: Estado inactivo/listo
- **Púrpura**: Hablando/activo
- **Amarillo**: Cargando
- **Rojo**: Error

## Funciones de Debug

### Listar Voces Disponibles
```typescript
debugVoices(); // Muestra todas las voces en consola
```

### Información Detallada
```typescript
import { logAvailableVoices, compareVoices } from '../../utils/voiceTest';

logAvailableVoices();           // Debug completo
compareVoices(apiKey, "texto"); // Comparar ambas tecnologías
```

## Manejo de Errores

### Estrategia de Fallback
1. **Intenta OpenAI TTS** (si hay API key)
2. **Si falla**, automáticamente usa **Web Speech API**
3. **Si ambos fallan**, muestra error específico

### Errores Comunes
- `API key de OpenAI no proporcionada`: Usar Web Speech API
- `Error de OpenAI TTS: 401`: API key inválida
- `Web Speech API no soportada`: Navegador incompatible

## Optimizaciones Implementadas

### Procesamiento de Texto
```typescript
// Añade pausas naturales para mayor realismo
text.replace(/\./g, '. ')
    .replace(/,/g, ', ')
    .replace(/;/g, '; ')
    // ... más optimizaciones
```

### Selección Inteligente de Voz
```typescript
// Busca automáticamente la mejor voz masculina en español
const bestVoice = getBestSpanishVoice();
```

### Gestión de Memoria
```typescript
// Limpia URLs de audio automáticamente
URL.revokeObjectURL(audioUrl);
```

## Animaciones Canvas

### Estados Visuales
- **Círculo pulsante**: Indica estado de actividad
- **Anillos externos**: Muestran intensidad de audio
- **Partículas flotantes**: Solo cuando está hablando
- **Colores dinámicos**: Azul (inactivo) / Púrpura (activo)

### Configuración de Animación
```typescript
const baseColor = isSpeaking ? '#8B5CF6' : '#3B82F6';
const pulseIntensity = isSpeaking ? 0.8 : 0.3;
```

## Mejores Prácticas

### 1. Gestión de API Keys
```typescript
// Nunca hardcodear API keys
const apiKey = process.env.REACT_APP_OPENAI_API_KEY;
```

### 2. Manejo de Estados
```typescript
// Siempre verificar estados antes de acciones
if (!isSpeaking && !isLoading) {
  await speak(text);
}
```

### 3. Limpieza de Recursos
```typescript
// Detener audio antes de cerrar componente
useEffect(() => {
  return () => {
    stop();
  };
}, [stop]);
```

## Pruebas y Debug

### Comandos de Debug
```javascript
// En la consola del navegador
debugVoices();                    // Ver todas las voces
logAvailableVoices();            // Debug completo
compareVoices(apiKey, "texto");  // Comparar tecnologías
```

### Pruebas Manuales
1. **Sin API key**: Debe usar Web Speech API
2. **Con API key válida**: Debe usar OpenAI TTS
3. **Con API key inválida**: Debe hacer fallback a Web Speech API
4. **Navegador sin Web Speech**: Debe mostrar error apropiado

## Próximas Mejoras

### Funcionalidades Planeadas
- [ ] Reconocimiento de voz (Speech-to-Text)
- [ ] Conversaciones interactivas
- [ ] Configuración persistente
- [ ] Más idiomas y voces
- [ ] Integración con IA conversacional

### Optimizaciones Técnicas
- [ ] Cache de audio generado
- [ ] Streaming de audio en tiempo real
- [ ] Compresión de audio mejorada
- [ ] Métricas de uso y calidad

## Soporte y Documentación

### Enlaces Útiles
- [OpenAI TTS Documentation](https://platform.openai.com/docs/guides/text-to-speech)
- [Web Speech API Reference](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
- [Flowbite React Components](https://flowbite-react.com/)

### Contacto
Para soporte técnico o mejoras, contactar al equipo de desarrollo de Guro.

---

**Versión**: 2.0.0 - OpenAI TTS Integration  
**Última actualización**: Diciembre 2024  
**Compatibilidad**: React 19, TypeScript, Vite 