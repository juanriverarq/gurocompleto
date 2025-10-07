# 🤖 Guía de Testing - Gestión de Agentes

## 📋 Resumen

La sección de **Gestión de Agentes** ha sido completamente reorganizada para facilitar el testing y manejo de agentes conversacionales de ElevenLabs. Esta guía te mostrará cómo testear todas las funcionalidades disponibles.

## 🚀 Funcionalidades Principales

### 1. **Vista General de Agentes**
- **Estadísticas rápidas**: Contador de agentes activos/inactivos, con KB, con herramientas
- **Filtros inteligentes**: Buscar por nombre/descripción, filtrar por estado
- **Grid responsivo**: Cards optimizados con información esencial

### 2. **Testing de Voz**
- **Prueba individual**: Botón "Probar Voz" en cada tarjeta
- **Selección automática de voz**: Busca voces en español automáticamente
- **Reproducción en tiempo real**: Audio generado por ElevenLabs

### 3. **Testing de Llamadas**
- **Llamadas reales**: Integración Twilio + ElevenLabs
- **Diagnóstico automático**: Verificación de configuración al cargar
- **Prueba rápida global**: Campo de teléfono en el header
- **Prueba individual**: Sección expandible en cada agente

### 4. **Gestión de Estados**
- **Indicadores visuales**: Loading states, success/error feedback
- **Estado de Twilio**: Card informativo con configuración
- **Testing concurrent**: Solo un test activo por vez

## 🧪 Cómo Testear

### **Paso 1: Verificar Estado Inicial**
1. Navega a la sección de Gestión de Agentes
2. Observa la carga automática de agentes y estado de Twilio
3. Verifica las estadísticas en el header (activos, inactivos, etc.)

### **Paso 2: Testing de Búsqueda y Filtros**
1. **Buscar agente**: Escribe en el campo "Buscar agentes..."
2. **Filtros de estado**: Prueba "Todos", "Activos", "Inactivos"
3. **Limpiar filtros**: Usa el botón si no hay resultados

### **Paso 3: Testing de Voz**
1. **Selecciona un agente** con configuración de voz
2. **Haz clic en "Probar Voz"** en la tarjeta del agente
3. **Observa el loading state** (botón con spinner)
4. **Escucha el audio** generado (mensaje de saludo del agente)

### **Paso 4: Testing de Llamadas** (Requiere Twilio configurado)
1. **Verifica el estado**: Card verde = Twilio configurado
2. **Opción A - Llamada Rápida Global**:
   - Ingresa número en el header (+57 300 123 4567)
   - Haz clic en "Llamada rápida"
   - Se usará el primer agente disponible

3. **Opción B - Llamada Individual**:
   - En la tarjeta del agente, click "Mostrar prueba de llamada"
   - Ingresa número de teléfono
   - Haz clic en el botón de teléfono
   - Observa el estado "Iniciando llamada..."

### **Paso 5: Ver Detalles Completos**
1. **Haz clic en "Detalles"** en cualquier tarjeta
2. **Navega entre tabs**:
   - **General**: Información básica y capacidades
   - **Configuración**: Configuración de voz con barras visuales
   - **Prompts**: Prompt del sistema y mensajes
   - **Técnico**: Información técnica y JSON completo

### **Paso 6: Diagnóstico de Twilio**
1. **Haz clic en "Diagnosticar"** en el header
2. **Revisa el mensaje emergente** con estado detallado
3. **Interpreta los resultados**:
   - ✅ Verde = Configurado correctamente
   - ⚠️ Amarillo = Configuración parcial
   - ❌ Rojo = No configurado

### **Paso 7: Crear Nuevo Agente**
1. **Haz clic en "Crear Agente"** en el header
2. **Observa el loading state** durante la creación
3. **Verifica la recarga automática** de la lista

## 🎯 Casos de Testing Específicos

### **Testing de Estados de Carga**
- ✅ Loading inicial de agentes
- ✅ Loading en prueba de voz
- ✅ Loading en llamadas telefónicas
- ✅ Loading en creación de agente
- ✅ Loading en diagnóstico de Twilio

### **Testing de Errores**
- ❌ Agente sin voz configurada
- ❌ Número de teléfono inválido
- ❌ Error de conexión con ElevenLabs
- ❌ Error de configuración de Twilio

### **Testing de UI Responsiva**
- 📱 Vista móvil (1 columna)
- 💻 Vista tablet (2 columnas)
- 🖥️ Vista desktop (3 columnas)

### **Testing de Filtros**
- 🔍 Búsqueda por nombre exacto
- 🔍 Búsqueda por descripción parcial
- 🔍 Filtro de agentes activos
- 🔍 Filtro de agentes inactivos
- 🔍 Combinación búsqueda + filtro

## 📊 Indicadores de Éxito

### **✅ Funcionamiento Correcto**
- Agentes se cargan automáticamente
- Pruebas de voz reproducen audio
- Llamadas telefónicas se inician
- Estado de Twilio se muestra correctamente
- Filtros funcionan en tiempo real
- Modal de detalles muestra información completa

### **⚠️ Problemas Conocidos**
- **Voz no disponible**: Se selecciona automáticamente una alternativa
- **Twilio no configurado**: Se muestra mensaje informativo
- **Sin agentes**: Se muestra mensaje de estado vacío

## 🛠️ Resolución de Problemas

### **No se cargan los agentes**
1. Verificar conexión a ElevenLabs API
2. Revisar console.log para errores
3. Hacer clic en "Actualizar" para recargar

### **Prueba de voz no funciona**
1. Verificar que el agente tiene voiceId
2. Revisar permisos de audio del navegador
3. Comprobar configuración de ElevenLabs

### **Llamadas no funcionan**
1. Hacer clic en "Diagnosticar" para verificar Twilio
2. Verificar número de teléfono (+57 formato)
3. Comprobar configuración de ElevenLabs Business

### **Filtros no responden**
1. Refrescar la página
2. Limpiar filtros con el botón
3. Verificar que hay agentes cargados

## 🔧 Configuración Técnica

### **Requisitos**
- ✅ Cuenta ElevenLabs con agentes conversacionales
- ✅ API Key de ElevenLabs configurada
- ✅ (Opcional) Twilio configurado para llamadas

### **Variables de Entorno**
```env
ELEVENLABS_API_KEY=tu_api_key_aqui
```

### **Dependencias del Componente**
- `src/services/elevenLabsService.ts` - Servicios de API
- `src/components/shadcn-ui/` - Componentes UI
- `lucide-react` - Iconos

## 📝 Notas de Desarrollo

### **Estados del Testing**
- `testingState.voice` - Testing de voz activo
- `testingState.call` - Testing de llamada activo
- `testingState.agentId` - ID del agente siendo testado

### **Funciones Principales**
- `handleTestVoice(agent)` - Prueba de voz individual
- `handleTestCall(agent, phoneNumber)` - Prueba de llamada
- `handleCheckTwilio()` - Diagnóstico de Twilio
- `loadData()` - Recarga de agentes

### **Filtros y Búsqueda**
- `searchTerm` - Término de búsqueda actual
- `filterStatus` - Estado del filtro (all/active/inactive)
- `filteredAgents` - Agentes después de aplicar filtros

---

## ✨ Funcionalidades Destacadas

1. **🎨 UI Moderna**: Cards responsive con estados visuales claros
2. **⚡ Testing Rápido**: Acciones de testing accesibles y eficientes
3. **📊 Información Rica**: Visualización completa de configuraciones
4. **🔄 Estados en Tiempo Real**: Feedback inmediato de acciones
5. **🎯 Diagnóstico Inteligente**: Verificación automática de capacidades
6. **📱 Totalmente Responsive**: Funciona perfectamente en todos los dispositivos

**¡Ahora puedes testear cualquier agente de forma fácil e intuitiva!** 🚀 