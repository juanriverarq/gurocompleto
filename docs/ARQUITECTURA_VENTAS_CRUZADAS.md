# Arquitectura del Sistema de Ventas Cruzadas - Guro

## Resumen Ejecutivo

El sistema de ventas cruzadas de Guro utiliza un enfoque **híbrido IA + Scoring Multidimensional** para identificar oportunidades de venta con alta precisión y transparencia.

---

## 1. Arquitectura Actual

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (React)                          │
│  VentasCruzadas.tsx → Muestra oportunidades con scoring         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API (Laravel Controller)                      │
│  VentasCruzadasController.php                                   │
│  - Obtiene pólizas activas del broker                           │
│  - Filtra empresas (solo personas naturales)                    │
│  - Coordina análisis de IA y scoring                            │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┴───────────────┐
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   VentasCruzadasIA      │     │   ScoringVentasCruzadas │
│   Service.php           │     │   Service.php           │
│                         │     │                         │
│ - Catálogo del broker   │     │ - 5 Dimensiones         │
│ - Prompt personalizado  │     │ - Factores medibles     │
│ - DeepSeek API          │     │ - Transparencia total   │
│ - Fallback inteligente  │     │ - Recomendación acción  │
└─────────────────────────┘     └─────────────────────────┘
              │                               │
              ▼                               ▼
┌─────────────────────────┐     ┌─────────────────────────┐
│   Caché (30 días)       │     │   Base de Datos         │
│   ventas_cruzadas_      │     │   - Pólizas             │
│   analisis              │     │   - Clientes            │
│                         │     │   - Siniestros          │
│                         │     │   - Pagos               │
└─────────────────────────┘     └─────────────────────────┘
```

---

## 2. Sistema de Scoring Multidimensional

### 2.1 Las 5 Dimensiones

| Dimensión | Peso | Qué Evalúa |
|-----------|------|------------|
| **Perfil** | 20% | Antigüedad, tipo cliente, valor cartera, datos completos |
| **Comportamiento** | 30% | Renovaciones, siniestralidad, pagos, diversificación |
| **Engagement** | 15% | Último contacto, canales disponibles, seguimiento |
| **Oportunidad** | 25% | Complementariedad, timing, ciclo de vida |
| **Contexto** | 10% | Temporada, día de semana, eventos del mercado |

### 2.2 Factores Medibles por Dimensión

#### PERFIL (20%)
- ✓ Antigüedad como cliente (meses/años)
- ✓ Tipo de cliente (persona/empresa)
- ✓ Valor total de cartera (suma de primas)
- ✓ Completitud de datos de contacto

#### COMPORTAMIENTO (30%)
- ✓ Tasa de renovación histórica (%)
- ✓ Cantidad de siniestros (último año)
- ✓ Estado de pagos (al día/pendientes)
- ✓ Diversificación de productos (#tipos)

#### ENGAGEMENT (15%)
- ✓ Días desde último contacto
- ✓ Canales de contacto disponibles
- ✓ Seguimiento programado (sí/no)

#### OPORTUNIDAD (25%)
- ✓ Complementariedad lógica (matriz)
- ✓ Días para vencimiento de póliza
- ✓ Cantidad de pólizas activas
- ✓ Nivel de urgencia de la necesidad

#### CONTEXTO (10%)
- ✓ Temporada del producto
- ✓ Día de la semana óptimo
- ✓ Eventos del mercado

---

## 3. Recomendaciones para Mejora Continua

### 3.1 Corto Plazo (1-2 semanas)

#### A. Tracking de Conversiones
```php
// Crear tabla para trackear resultados reales
Schema::create('ventas_cruzadas_conversiones', function (Blueprint $table) {
    $table->id();
    $table->string('oportunidad_id');
    $table->integer('cliente_id');
    $table->string('producto_recomendado');
    $table->string('resultado'); // contactado, interesado, cotizado, vendido, rechazado
    $table->decimal('prima_vendida', 15, 2)->nullable();
    $table->text('notas')->nullable();
    $table->integer('vendedor_id');
    $table->timestamps();
});
```

**Beneficio**: Permite medir la efectividad real del scoring y ajustar pesos.

#### B. Feedback Loop
- Cuando un vendedor marca "Vendido" o "Rechazado", guardar el resultado
- Comparar score predicho vs resultado real
- Ajustar pesos de dimensiones automáticamente

### 3.2 Mediano Plazo (1-2 meses)

#### A. Machine Learning para Scoring
```python
# Modelo de regresión logística para predecir conversión
from sklearn.linear_model import LogisticRegression

features = [
    'antiguedad_meses',
    'valor_cartera',
    'tasa_renovacion',
    'siniestros_ultimo_anio',
    'dias_ultimo_contacto',
    'complementariedad_score',
    'dias_para_vencimiento'
]

# Entrenar con conversiones históricas
model = LogisticRegression()
model.fit(X_train, y_train)  # y = 1 si convirtió, 0 si no
```

**Beneficio**: El modelo aprende de datos reales, no de reglas fijas.

#### B. Segmentación de Clientes
```
┌─────────────────────────────────────────────────────────┐
│                  SEGMENTOS DE CLIENTES                   │
├─────────────────────────────────────────────────────────┤
│ PREMIUM (>$10M cartera)  → Atención personalizada       │
│ GROWTH (2-3 pólizas)     → Alto potencial expansión     │
│ STARTER (1 póliza)       → Nurturing + educación        │
│ AT-RISK (pagos atrasados)→ Retención primero            │
└─────────────────────────────────────────────────────────┘
```

#### C. Análisis de Cohortes
- Agrupar clientes por fecha de adquisición
- Medir tasa de cross-sell por cohorte
- Identificar patrones de éxito

### 3.3 Largo Plazo (3-6 meses)

#### A. Modelo Predictivo Avanzado
```
┌─────────────────────────────────────────────────────────┐
│              PIPELINE DE ML COMPLETO                     │
├─────────────────────────────────────────────────────────┤
│ 1. Feature Engineering                                   │
│    - RFM (Recency, Frequency, Monetary)                 │
│    - Lifetime Value predicho                            │
│    - Propensión por tipo de producto                    │
│                                                         │
│ 2. Modelo Ensemble                                       │
│    - Random Forest (robustez)                           │
│    - XGBoost (precisión)                                │
│    - Neural Network (patrones complejos)                │
│                                                         │
│ 3. Calibración de Probabilidades                        │
│    - Platt Scaling                                      │
│    - Isotonic Regression                                │
│                                                         │
│ 4. A/B Testing Continuo                                 │
│    - Comparar modelo vs reglas                          │
│    - Medir lift en conversión                           │
└─────────────────────────────────────────────────────────┘
```

#### B. Personalización de Mensajes con IA
- Generar mensajes únicos por cliente
- Considerar historial de interacciones
- Optimizar timing de envío (hora/día)

#### C. Integración con CRM
- Sincronizar oportunidades con pipeline de ventas
- Automatizar tareas de seguimiento
- Dashboards de rendimiento por vendedor

---

## 4. Métricas de Éxito (KPIs)

### 4.1 Métricas de Precisión
| Métrica | Fórmula | Meta |
|---------|---------|------|
| **Tasa de Conversión** | Vendidos / Contactados | >15% |
| **Precisión del Score** | Correlación score vs conversión | >0.7 |
| **Lift** | Conversión con modelo / sin modelo | >2x |

### 4.2 Métricas de Negocio
| Métrica | Descripción | Meta |
|---------|-------------|------|
| **Prima Incremental** | $ vendido por cross-sell | +20% MoM |
| **Pólizas por Cliente** | Promedio de pólizas | >1.5 |
| **Tiempo de Cierre** | Días desde oportunidad hasta venta | <30 días |

### 4.3 Métricas de Calidad
| Métrica | Descripción | Meta |
|---------|-------------|------|
| **Tasa de Rechazo** | Clientes que dicen "no interesado" | <40% |
| **NPS Post-Contacto** | Satisfacción del cliente | >50 |
| **Churn Rate** | Clientes que cancelan después de cross-sell | <5% |

---

## 5. Datos Adicionales a Capturar

Para mejorar significativamente el scoring, se recomienda capturar:

### 5.1 Datos de Interacción
```sql
-- Tabla de interacciones
CREATE TABLE cliente_interacciones (
    id INT PRIMARY KEY,
    cliente_id INT,
    tipo ENUM('email_abierto', 'email_click', 'whatsapp_respondido', 'llamada_contestada', 'cita_agendada'),
    fecha DATETIME,
    campana_id INT,
    resultado VARCHAR(50)
);
```

### 5.2 Datos de Comportamiento Web
- Páginas visitadas en el portal
- Cotizaciones iniciadas (aunque no completadas)
- Documentos descargados

### 5.3 Datos Externos (Enriquecimiento)
- Información de buró de crédito (capacidad de pago)
- Datos demográficos por zona (DANE)
- Eventos de vida (matrimonio, hijos, casa nueva)

---

## 6. Arquitectura Futura Recomendada

```
┌─────────────────────────────────────────────────────────────────┐
│                         CAPA DE DATOS                            │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐            │
│  │ Pólizas │  │Clientes │  │Interacc.│  │Externos │            │
│  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘            │
│       └────────────┴────────────┴────────────┘                  │
│                         │                                        │
│                         ▼                                        │
│              ┌─────────────────────┐                            │
│              │   Data Warehouse    │                            │
│              │   (Feature Store)   │                            │
│              └──────────┬──────────┘                            │
└─────────────────────────┼───────────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────────┐
│                    CAPA DE ML                                    │
│                          ▼                                       │
│              ┌─────────────────────┐                            │
│              │   Model Training    │                            │
│              │   (Python/MLflow)   │                            │
│              └──────────┬──────────┘                            │
│                         │                                        │
│              ┌──────────┴──────────┐                            │
│              ▼                     ▼                            │
│     ┌─────────────────┐   ┌─────────────────┐                  │
│     │ Scoring Model   │   │ Recommendation  │                  │
│     │ (Probabilidad)  │   │ Model (Producto)│                  │
│     └────────┬────────┘   └────────┬────────┘                  │
│              └──────────┬──────────┘                            │
└─────────────────────────┼───────────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────────┐
│                   CAPA DE APLICACIÓN                             │
│                          ▼                                       │
│              ┌─────────────────────┐                            │
│              │   API de Scoring    │                            │
│              │   (Laravel/FastAPI) │                            │
│              └──────────┬──────────┘                            │
│                         │                                        │
│     ┌───────────────────┼───────────────────┐                   │
│     ▼                   ▼                   ▼                   │
│ ┌────────┐        ┌──────────┐        ┌──────────┐             │
│ │Frontend│        │ WhatsApp │        │  Email   │             │
│ │ (React)│        │   Bot    │        │ Campaign │             │
│ └────────┘        └──────────┘        └──────────┘             │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Próximos Pasos Inmediatos

1. **Hoy**: El sistema de scoring multidimensional ya está activo
2. **Esta semana**: Monitorear resultados y ajustar pesos si es necesario
3. **Próxima semana**: Implementar tracking de conversiones
4. **Mes 1**: Analizar datos y crear primer modelo de ML básico
5. **Mes 2-3**: Iterar y mejorar basado en datos reales

---

## 8. Contacto y Soporte

Para dudas sobre la arquitectura o implementación:
- Email: info@gurocontable.com
- Documentación técnica: `/docs/`

---

*Documento generado: Enero 2026*
*Versión: 2.0 - Sistema de Scoring Multidimensional*
