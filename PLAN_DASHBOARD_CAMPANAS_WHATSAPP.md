# Plan de Reorganización: Dashboard de Campañas WhatsApp

## Análisis del Dashboard Actual

### Estructura Actual
El dashboard de [`ConfiguracionMasiva.tsx`](frontend/src/views/saas/configuracion-masiva/ConfiguracionMasiva.tsx:1) tiene:

**Métricas Actuales (15 KPIs en total):**
1. Líneas Conectadas (1 o 0)
2. Total Mensajes
3. Total Campañas
4. Estado Conexión
5. Total Campañas (duplicado)
6. Campañas Activas
7. Campañas Pausadas
8. Campañas Completadas
9. Tasa de Entrega Global
10. Mensajes Enviados (global)
11. Mensajes Entregados (global)
12. Enviados (del historial)
13. Entregados (del historial)
14. Leídos (del historial)
15. Fallidos (del historial)

**Problemas Identificados:**
- ❌ Demasiados KPIs (15) causan sobrecarga visual
- ❌ Métricas duplicadas (mensajes enviados/entregados aparecen 2 veces)
- ❌ No hay jerarquía clara de importancia
- ❌ Falta contexto temporal (hoy vs ayer, tendencias)
- ❌ Cards pequeños sin espacio para tendencias
- ❌ No se destacan métricas críticas (tasa de entrega, campañas activas)

## Diseño Propuesto: Dashboard Reorganizado

### Principios de Diseño
1. **Jerarquía Visual:** Métricas más importantes en cards grandes y destacados
2. **Agrupación Lógica:** Métricas relacionadas juntas
3. **Contexto Temporal:** Comparativas con periodo anterior
4. **Tendencias:** Indicadores de crecimiento/decrecimiento
5. **Accionabilidad:** Destacar métricas que requieren acción

### Nueva Estructura (3 Niveles)

#### Nivel 1: Métricas Hero (2-3 cards grandes)
**Objetivo:** Mostrar las métricas MÁS IMPORTANTES del negocio

```
┌─────────────────────────────────────────────────────────────────┐
│  TASA DE ENTREGA        │  MENSAJES HOY         │  CAMPAÑAS     │
│  ────────────────        │  ─────────────        │  ACTIVAS      │
│                          │                       │               │
│      87.5%              │       245             │      3        │
│   ↑ +2.3% vs ayer       │  ↑ +15% vs ayer      │  2 enviando   │
│                          │                       │               │
│  [Gráfico sparkline]    │  [Gráfico sparkline]  │  [Estado]     │
└─────────────────────────────────────────────────────────────────┘
```

**Métricas Hero:**
1. **Tasa de Entrega** (KPI crítico de calidad)
   - Valor actual en %
   - Comparativa vs ayer/semana
   - Sparkline de últimos 7 días
   - Color: Verde si >85%, Amarillo 70-85%, Rojo <70%

2. **Mensajes de Hoy** (KPI de volumen)
   - Total enviados hoy
   - Comparativa vs ayer
   - Sparkline de últimas 24 horas
   - Desglose: Enviados/Entregados/Leídos

3. **Campañas Activas** (KPI operacional)
   - Número de campañas en ejecución
   - Estado: Cuántas enviando ahora
   - Próxima programada
   - Botón rápido "Ver Campañas"

#### Nivel 2: Métricas Secundarias (4-5 cards medianos)
**Objetivo:** Contexto operacional y estado del sistema

```
┌──────────────────────────────────────────────────────────────────┐
│  INSTANCIAS    │  MENSAJES      │  CAMPAÑAS      │  TASA         │
│  CONECTADAS    │  PENDIENTES    │  COMPLETADAS   │  LECTURA      │
│                │                │                │               │
│      2/3       │      12        │      45        │    65%        │
│  1 QR pend.    │  En cola       │  Este mes      │  vs 58% ayer  │
└──────────────────────────────────────────────────────────────────┘
```

**Métricas Secundarias:**
1. **Instancias Conectadas** (X/Total)
   - Cuántas conectadas vs total
   - Alertas: QR pendientes, errores
   - Link rápido a tab "Conexión WhatsApp"

2. **Mensajes Pendientes**
   - En cola de envío
   - Tiempo estimado de envío
   - Alertas si hay retrasos

3. **Campañas Completadas**
   - Total del mes/semana
   - Comparativa vs mes anterior
   - Tasa de éxito promedio

4. **Tasa de Lectura**
   - % de mensajes leídos
   - Comparativa temporal
   - Indicador de engagement

#### Nivel 3: Visualizaciones y Detalles
**Objetivo:** Análisis profundo y tendencias

```
┌─────────────────────────────────────────────────────────────────┐
│  EVOLUCIÓN DE ENVÍOS (Últimos 30 días)                          │
│  ────────────────────────────────────────────────────────────── │
│                                                                  │
│  [Gráfico de líneas con 3 series: Enviados, Entregados, Leídos]│
│                                                                  │
│  Filtros: [Desde] [Hasta] [Tipo Campaña] [Estado]              │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  HISTORIAL DE ENVÍOS                                            │
│  ────────────────────────────────────────────────────────────── │
│                                                                  │
│  [Tabla con: Fecha, Campaña, Teléfono, Mensaje, Estado]        │
│  [Paginación y búsqueda]                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Mejoras Adicionales Propuestas

1. **Alertas Inteligentes** (nuevo componente)
   - ⚠️ Instancias desconectadas que tienen campañas asignadas
   - ⚠️ Campañas con tasa de entrega <70%
   - ⚠️ Mensajes fallidos >10% en última hora
   - ℹ️ Campañas programadas para hoy

2. **Acciones Rápidas** (nuevo componente)
   - 🚀 Crear Campaña Rápida
   - 📊 Ver Reporte Completo
   - 🔄 Sincronizar Todas las Instancias
   - 📱 Conectar Nueva Instancia

3. **Comparativas Temporales**
   - Hoy vs Ayer
   - Esta Semana vs Semana Anterior
   - Este Mes vs Mes Anterior

4. **Indicadores de Tendencia**
   - Flechas ↑↓ con % de cambio
   - Colores: Verde (mejora), Rojo (empeora), Gris (sin cambio)
   - Sparklines (mini gráficos) en cada card

## Implementación Propuesta

### Fase 1: Reorganización de KPIs (Prioridad Alta)
- [ ] Reducir de 15 a 7-8 KPIs principales
- [ ] Agrupar métricas relacionadas
- [ ] Implementar cards Hero (grandes) para top 3 métricas
- [ ] Agregar comparativas temporales

### Fase 2: Mejoras Visuales (Prioridad Media)
- [ ] Cards con gradientes y sombras
- [ ] Iconos más grandes y coloridos
- [ ] Animaciones sutiles en hover
- [ ] Sparklines en cards Hero

### Fase 3: Funcionalidad Avanzada (Prioridad Baja)
- [ ] Alertas inteligentes
- [ ] Acciones rápidas contextuales
- [ ] Filtros avanzados en gráficos
- [ ] Export de reportes

## Métricas Finales Propuestas (7 KPIs)

### Hero Cards (3)
1. **Tasa de Entrega** - 87.5% ↑ +2.3%
2. **Mensajes Hoy** - 245 ↑ +15%
3. **Campañas Activas** - 3 (2 enviando)

### Secondary Cards (4)
4. **Instancias** - 2/3 conectadas
5. **Mensajes Pendientes** - 12 en cola
6. **Completadas (mes)** - 45 campañas
7. **Tasa de Lectura** - 65% ↑ +7%

## Cambios en Backend Necesarios

Para soportar las nuevas métricas, necesitamos agregar a [`CampaignController::getStats()`](backend/app/Http/Controllers/Api/CampaignController.php:2079):

```php
// Métricas temporales (hoy, ayer, esta semana, mes)
'messages_today' => CampaignMessage::where('broker_id', $brokerId)
    ->whereDate('created_at', today())
    ->count(),
'messages_yesterday' => CampaignMessage::where('broker_id', $brokerId)
    ->whereDate('created_at', today()->subDay())
    ->count(),
'delivery_rate_today' => // cálculo de tasa de entrega de hoy
'delivery_rate_yesterday' => // cálculo de tasa de entrega de ayer
'pending_messages' => CampaignMessage::where('broker_id', $brokerId)
    ->where('status', 'pending')
    ->count(),
'read_rate' => // % de mensajes leídos
```

## Próximos Pasos

1. ¿Apruebas este diseño propuesto?
2. ¿Quieres agregar/quitar alguna métrica específica?
3. ¿Prefieres implementar por fases o todo de una vez?