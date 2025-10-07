# ⏱️ Tiempos de Ejecución - Campañas de Llamadas Automatizadas

## 📊 Estimaciones de Tiempo por Escenario

### **Campaña Pequeña (5-10 clientes)**
```
🎯 5 clientes con 2 llamadas simultáneas:
   ├── Tiempo total: 8-15 minutos
   ├── Llamadas por lote: 2-3 minutos cada una
   └── Procesamiento total: ~10 minutos promedio

🎯 10 clientes con 3 llamadas simultáneas:
   ├── Tiempo total: 12-20 minutos
   ├── Llamadas en 4 lotes: 3-4 minutos c/u
   └── Procesamiento total: ~15 minutos promedio
```

### **Campaña Mediana (25-50 clientes)**
```
🎯 25 clientes con 5 llamadas simultáneas:
   ├── Tiempo total: 25-40 minutos
   ├── Llamadas en 5 lotes: 5-8 minutos c/u
   └── Procesamiento total: ~30 minutos promedio

🎯 50 clientes con 5 llamadas simultáneas:
   ├── Tiempo total: 50-80 minutos
   ├── Llamadas en 10 lotes: 5-8 minutos c/u
   └── Procesamiento total: ~60 minutos promedio
```

### **Campaña Grande (100+ clientes)**
```
🎯 100 clientes con 10 llamadas simultáneas:
   ├── Tiempo total: 60-120 minutos
   ├── Llamadas en 10 lotes: 6-12 minutos c/u
   └── Procesamiento total: ~90 minutos promedio

🎯 200 clientes con 15 llamadas simultáneas:
   ├── Tiempo total: 120-200 minutos
   ├── Llamadas en 14 lotes: 8-14 minutos c/u
   └── Procesamiento total: ~160 minutos promedio
```

## ⚡ Factores que Afectan los Tiempos

### **Factores Técnicos**
- **Latencia API ElevenLabs**: 2-5 segundos por inicialización
- **Conexión Twilio**: 1-3 segundos por establecimiento
- **Procesamiento de voz**: Tiempo real + 20-30% overhead
- **Red e infraestructura**: Variable según ubicación

### **Factores de Configuración**
- **Llamadas simultáneas**: Más paralelas = más rápido
- **Timeout por llamada**: 30-300 segundos configurables
- **Reintentos**: +30-60 segundos por reintento
- **Horarios de trabajo**: Pausas automáticas fuera de horario

### **Factores de Respuesta del Cliente**
- **Contesta inmediato**: Duración normal (60-180 seg)
- **No contesta**: Timeout después de 30-45 segundos
- **Ocupado**: Reintento automático (+60 segundos)
- **Conversación larga**: Hasta timeout máximo (300 seg)

## 📈 Optimización de Rendimiento

### **Configuración Recomendada por Tamaño**

```javascript
// Campaña Pequeña (< 20 clientes)
const smallCampaignConfig = {
  simultaneousCalls: 3,
  callTimeout: 180,  // 3 minutos
  maxRetries: 2,
  retryDelay: 60     // 1 minuto
};

// Campaña Mediana (20-100 clientes)  
const mediumCampaignConfig = {
  simultaneousCalls: 5,
  callTimeout: 240,  // 4 minutos
  maxRetries: 1,
  retryDelay: 120    // 2 minutos
};

// Campaña Grande (100+ clientes)
const largeCampaignConfig = {
  simultaneousCalls: 10,
  callTimeout: 300,  // 5 minutos
  maxRetries: 1,
  retryDelay: 180    // 3 minutos
};
```

## 🎯 Ejemplo Real de Ejecución

### **Campaña de Seguimiento de Pólizas (50 clientes)**

```
⏰ Timeline Esperado:

00:00 - Inicio de campaña
00:01 - Primeras 5 llamadas iniciadas
00:03 - Primeras respuestas/timeouts
00:05 - Segundo lote de 5 llamadas
00:08 - Procesamiento de resultados del primer lote
00:10 - Tercer lote de 5 llamadas
...
00:45 - Campaña completada
00:50 - Reportes y análisis generados

📊 Resultados típicos:
   ├── Llamadas exitosas: 60-70%
   ├── No contestan: 20-25%  
   ├── Ocupados/errores: 5-10%
   └── Tiempo promedio: 45-60 minutos
```

## 🚨 Consideraciones Importantes

### **Límites de ElevenLabs**
- **Llamadas concurrentes**: Límite por plan (5-20)
- **Cuota mensual**: Verificar antes de campañas grandes
- **Rate limiting**: Posibles retrasos con volumen alto

### **Límites de Twilio**
- **Números de destino**: Algunos pueden estar bloqueados
- **Restricciones geográficas**: Verificar cobertura
- **Costos**: $0.01-0.05 por minuto aproximadamente

### **Mejores Prácticas**
- ✅ Empezar con campañas pequeñas para pruebas
- ✅ Monitorear en tiempo real durante ejecución
- ✅ Configurar horarios de trabajo apropiados
- ✅ Tener números de prueba antes de producción

## 🔍 Monitoreo en Tiempo Real

El dashboard muestra:
- ⏱️ **Tiempo transcurrido** desde inicio
- 📞 **Llamadas en progreso** en tiempo real  
- ✅ **Llamadas completadas** con duración
- ❌ **Llamadas fallidas** con razón
- 📊 **Progreso general** de la campaña
- 💰 **Costos acumulados** en tiempo real

## 🎯 Recomendación Final

**Para tu primera campaña:**
- 👥 Empezar con 5-10 clientes conocidos
- ⚙️ Configurar 2-3 llamadas simultáneas
- ⏱️ Timeout de 180 segundos (3 minutos)
- 🔄 Máximo 2 reintentos
- 📱 Usar números de prueba primero

**Tiempo esperado:** 10-15 minutos total
