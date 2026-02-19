# Plan SEO 2025 — GURO (Software de Seguros con IA)

> **Documento de estrategia SEO basado en documentación oficial de Google Search Central (actualizada dic. 2025), estudio Princeton GEO, y análisis de 7,000+ citaciones en LLMs.**
>
> Dominio: `guro.co` | Nicho: Software de seguros / InsurTech / IA para agencias de seguros | Mercado: Colombia + LATAM

---

## TABLA DE CONTENIDOS

1. [Parte 1: Sistemas de Ranking de Google (Fuente Oficial)](#parte-1)
2. [Parte 2: E-E-A-T — El Marco Fundamental](#parte-2)
3. [Parte 3: Page Experience y Core Web Vitals](#parte-3)
4. [Parte 4: AI Overviews, AI Mode y LLMs](#parte-4)
5. [Parte 5: GEO — Generative Engine Optimization](#parte-5)
6. [Parte 6: SEO Técnico Profundo para GURO](#parte-6)
7. [Parte 7: Estrategia de Contenido + LLMs para GURO](#parte-7)
8. [Parte 8: Plan de Trabajo Acelerado (12 semanas)](#parte-8)
9. [Parte 9: Auditoría SEO Actual de GURO](#parte-9)
10. [Parte 10: Implementaciones Técnicas Prioritarias](#parte-10)

---

<a id="parte-1"></a>
## PARTE 1: LOS SISTEMAS DE RANKING DE GOOGLE

**Fuente**: https://developers.google.com/search/docs/appearance/ranking-systems-guide (actualizado dic. 2025)

Google usa sistemas automatizados de ranking que evalúan cientos de factores sobre miles de millones de páginas. Los sistemas operan **a nivel de página** pero también usan **señales a nivel de sitio**.

### 1.1 Sistemas Core Activos

| Sistema | Qué Hace | Implicación para GURO |
|---------|----------|-----------------------|
| **BERT** | Entiende combinaciones de palabras y significado contextual | Escribe naturalmente, no fuerces keywords |
| **RankBrain** | Relaciona palabras con conceptos (no necesita palabras exactas) | Cubre conceptos, no solo keywords exactas |
| **Neural Matching** | Conecta representaciones de conceptos entre queries y páginas | Responde la intención, no solo la keyword |
| **MUM** | Modelo multilingüe/multimodal (aplicaciones específicas) | Contenido en español bien estructurado |
| **Passage Ranking** | Identifica secciones individuales como relevantes | Cada sección de tu contenido debe ser auto-contenida |
| **PageRank + Link Analysis** | Analiza enlaces entre páginas | Los enlaces siguen importando |
| **Freshness Systems** | Prioriza contenido fresco cuando la query lo amerita | Actualiza contenido regularmente |
| **Reliable Information Systems** | Eleva fuentes autoritativas | Construye autoridad en tu nicho |
| **Reviews System** | Recompensa reseñas con análisis original | Crea comparativas genuinas de software |
| **Site Diversity** | Máximo ~2 resultados del mismo sitio en top | Diversifica tus páginas target |
| **SpamBrain** | Detecta spam | No hagas black hat SEO |
| **Original Content Systems** | Prioriza contenido original | Nunca copies, siempre agrega valor original |
| **Exact Match Domain** | Evita ventaja artificial por keywords en dominio | "guro.co" es un buen dominio de marca |

### 1.2 Sistemas Retirados (integrados al core)

- **Helpful Content System** → Integrado al core en **marzo 2024** (la actualización más importante reciente)
- **Panda** → Core desde 2015 (calidad de contenido)
- **Penguin** → Core desde 2016 (link spam)

> **Implicación clave**: El "Helpful Content System" ahora es PARTE del core de Google. No es un filtro separado — es la base de cómo Google evalúa TODO el contenido. Contenido creado para manipular rankings será penalizado a nivel fundamental.

---

<a id="parte-2"></a>
## PARTE 2: E-E-A-T — EL MARCO FUNDAMENTAL DE CALIDAD

**Fuente**: https://developers.google.com/search/docs/fundamentals/creating-helpful-content

Google evalúa contenido con **Experience, Expertise, Authoritativeness, Trustworthiness**. **Trust es el más importante** — los demás contribuyen a él.

### 2.1 Preguntas de Auto-evaluación (Directo de Google)

#### Calidad del Contenido
- ¿Provee información **original**, investigación o análisis?
- ¿Es **sustancial, completo y comprehensivo**?
- ¿Ofrece análisis perspicaz **más allá de lo obvio**?
- Si usa otras fuentes, ¿agrega **valor sustancial y originalidad**?
- ¿El título es **descriptivo y útil** (no clickbait)?
- ¿Es el tipo de página que querrías **guardar, compartir o recomendar**?
- ¿Provee **valor sustancial** vs. otras páginas en los resultados?

#### Expertise
- ¿La información genera **confianza**? (fuentes claras, evidencia de expertise, background del autor)
- ¿El sitio es **reconocido como autoridad** en su tema?
- ¿El contenido está escrito por un **experto que demuestra conocer el tema**?
- ¿Tiene **errores factuales verificables**?

#### El Test "Quién, Cómo, Por Qué"
- **Quién**: ¿Es evidente quién creó el contenido? ¿Hay byline con bio del autor?
- **Cómo**: ¿Se explica cómo se creó? (Si usas IA, divúlgalo transparentemente)
- **Por qué**: ¿Se creó para **ayudar personas** o para **manipular rankings**?

### 2.2 Contenido People-First vs Search-Engine-First

**Google dice SÍ:**
- Crear contenido para tu audiencia existente
- Demostrar **experiencia de primera mano** (usar el producto, mostrar resultados reales)
- Tener un **propósito/enfoque claro** en tu sitio
- Que el lector se vaya sintiendo que **aprendió lo suficiente**

**Google dice NO:**
- Producir contenido masivo en muchos temas esperando que algo funcione
- Usar automatización extensiva para generar contenido en muchos temas
- Resumir lo que otros dicen sin agregar valor
- Escribir sobre temas trending solo por tráfico
- Escribir para un "word count ideal" (**Google confirma: NO tienen uno**)
- Cambiar fechas para parecer fresco sin cambiar contenido
- Entrar en nichos sin expertise real solo por tráfico

### 2.3 Sobre Contenido Generado con IA

Google NO penaliza contenido generado con IA per se. Lo que penaliza es:
- Contenido generado con IA **con el propósito primario de manipular rankings** → Violación de políticas de spam
- Contenido sin valor agregado humano
- Contenido sin supervisión editorial

**Recomendación**: Si usas IA para asistir la creación de contenido, divúlgalo y asegúrate de que un experto humano lo revise, enriquezca con experiencia real, y agregue valor original.

### 2.4 YMYL (Your Money or Your Life)

Google aplica **estándares más estrictos** de E-E-A-T para temas que impactan:
- Salud
- **Estabilidad financiera** ← GURO está aquí (seguros = finanzas)
- Seguridad
- Bienestar de la sociedad

> **Para GURO esto es CRÍTICO**: Al estar en el sector de seguros (YMYL), Google exige niveles más altos de E-E-A-T. Necesitas demostrar expertise real en seguros, tener autores con credenciales verificables, y ser una fuente confiable.

---

<a id="parte-3"></a>
## PARTE 3: PAGE EXPERIENCE Y CORE WEB VITALS

**Fuente**: https://developers.google.com/search/docs/appearance/core-web-vitals + https://developers.google.com/search/docs/appearance/page-experience

### 3.1 Core Web Vitals (Factor de Ranking Confirmado)

| Métrica | Qué Mide | Objetivo | Herramienta |
|---------|----------|----------|-------------|
| **LCP** (Largest Contentful Paint) | Velocidad de carga del elemento más grande | < **2.5 segundos** | PageSpeed Insights |
| **INP** (Interaction to Next Paint) | Responsividad al interactuar | < **200 milisegundos** | Chrome DevTools |
| **CLS** (Cumulative Layout Shift) | Estabilidad visual (nada se mueve inesperadamente) | < **0.1** | Lighthouse |

> **INP reemplazó a FID** en marzo 2024 como métrica oficial.

### 3.2 Checklist Completo de Page Experience

- ✅ Buenos Core Web Vitals (LCP, INP, CLS)
- ✅ HTTPS en todo el sitio
- ✅ Mobile-first responsive
- ✅ Sin exceso de ads que distraigan del contenido principal
- ✅ Sin interstitials intrusivos (popups molestos)
- ✅ Contenido principal fácilmente distinguible

### 3.3 Importancia Real de Page Experience

Directo del FAQ oficial de Google:

> *"Para muchas queries, hay mucho contenido útil disponible. Tener una gran page experience puede contribuir al éxito en Search en esos casos."*

**Traducción**: Page experience es un **tiebreaker**. Si tu contenido y el de un competidor son igualmente relevantes, gana el que tenga mejor experiencia de página. No es el factor #1, pero en nichos competitivos como InsurTech, cada ventaja cuenta.

### 3.4 SEO Técnico Profundo — Lo Que Realmente Importa

#### A. Velocidad de Carga (LCP)

**Optimizaciones críticas para una SPA React (como GURO):**

1. **Server-Side Rendering (SSR) o Pre-rendering**: Las SPAs tienen un problema fundamental para SEO — el contenido se renderiza en el cliente. Google puede renderizar JavaScript, pero:
   - Tarda más en indexar
   - Puede no renderizar correctamente todo
   - Las meta tags dinámicas (react-helmet) pueden no ser leídas por todos los crawlers

   **Soluciones por prioridad:**
   - **Opción A (Ideal)**: Migrar landing page y blog a **Next.js** con SSR/SSG
   - **Opción B (Pragmática)**: Usar **prerender.io** o similar para servir HTML estático a bots
   - **Opción C (Mínima)**: Asegurar que `react-helmet-async` funcione correctamente y que el HTML base tenga buenos meta tags

2. **Optimización de imágenes**:
   - Formato WebP/AVIF (ya tienes `.webp` en el preload, bien)
   - Lazy loading para imágenes below the fold
   - Dimensiones explícitas (width/height) para evitar CLS
   - CDN para servir imágenes

3. **Code splitting y lazy loading**:
   - Ya usas `React.lazy()` y `Loadable` — esto es correcto
   - Asegurar que el bundle de la landing page sea lo más pequeño posible
   - Analizar con `webpack-bundle-analyzer` o `vite-plugin-visualizer`

4. **Preconnect y preload**:
   - Ya tienes preconnects a Google Fonts y Firebase — bien
   - Preload de la imagen LCP — ya lo tienes
   - Considerar preload de la fuente General Sans

#### B. Interactividad (INP)

- Minimizar JavaScript bloqueante en el main thread
- Usar `requestIdleCallback` para tareas no críticas
- Debounce en inputs de búsqueda y filtros
- Evitar re-renders innecesarios con `React.memo`, `useMemo`, `useCallback`

#### C. Estabilidad Visual (CLS)

- Dimensiones explícitas en todas las imágenes y videos
- Reservar espacio para contenido dinámico (skeleton screens)
- Evitar insertar contenido dinámico arriba del viewport
- Fuentes: usar `font-display: swap` con fallback de tamaño similar

#### D. Crawlability y Indexación

1. **robots.txt** (ya tienes uno bueno):
   - ✅ Permite crawling general
   - ✅ Bloquea `/apps/`, `/dashboard/`, `/admin/`
   - ⚠️ **Falta**: Permitir explícitamente crawlers de IA (ver sección LLMs)
   - ⚠️ **Falta**: El blog no está listado explícitamente

2. **sitemap.xml** (necesita mejoras):
   - ⚠️ No incluye URLs del blog
   - ⚠️ No incluye la landing page principal (FramerLandingPage)
   - ⚠️ Incluye páginas de auth que no necesitan estar (login/register)
   - ⚠️ Falta el blog index y artículos individuales

3. **Canonical URLs**:
   - ✅ Tienes canonical en index.html
   - ⚠️ Inconsistencia: `guro.co` vs `www.guro.com.co` en diferentes archivos
   - **CRÍTICO**: Debes elegir UN dominio canónico y redirigir el otro con 301

4. **Internal linking**:
   - Cada página del blog debe enlazar a otras páginas relevantes
   - La landing page debe enlazar al blog
   - Crear una estructura de "hub and spoke" (pillar + cluster)

#### E. Structured Data (Schema.org)

**Estado actual de GURO:**
- ✅ Tienes `SoftwareApplication` schema en index.html
- ✅ Tienes `BlogPosting` + `BreadcrumbList` + `FAQPage` en BlogSegurosSEO
- ⚠️ Falta `Organization` schema completo
- ⚠️ Falta `Person` schema para autores
- ⚠️ Falta `WebSite` schema con SearchAction
- ⚠️ Falta `HowTo` schema para contenido procedimental
- ⚠️ El `SoftwareApplication` schema necesita más propiedades

**Schemas prioritarios a implementar (Tier 1 para AI Visibility):**

```json
// 1. Organization (CRÍTICO para E-E-A-T y LLMs)
{
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "Guro",
  "url": "https://guro.co",
  "logo": "https://guro.co/logo.png",
  "description": "Software de seguros con inteligencia artificial para agencias de seguros en Colombia y Latinoamérica",
  "foundingDate": "2024",
  "founders": [{
    "@type": "Person",
    "name": "[Nombre del Fundador]"
  }],
  "address": {
    "@type": "PostalAddress",
    "addressCountry": "CO"
  },
  "sameAs": [
    "https://www.linkedin.com/company/guro",
    "https://twitter.com/GuroSeguros",
    "https://www.wikidata.org/wiki/Q[ID]"
  ],
  "contactPoint": {
    "@type": "ContactPoint",
    "contactType": "customer service",
    "availableLanguage": "Spanish"
  }
}

// 2. WebSite con SearchAction
{
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Guro",
  "url": "https://guro.co",
  "potentialAction": {
    "@type": "SearchAction",
    "target": "https://guro.co/blog?q={search_term_string}",
    "query-input": "required name=search_term_string"
  }
}

// 3. SoftwareApplication (mejorado)
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "Guro",
  "description": "Software de seguros con inteligencia artificial...",
  "url": "https://guro.co",
  "applicationCategory": "BusinessApplication",
  "applicationSubCategory": "Insurance Management Software",
  "operatingSystem": "Web",
  "offers": {
    "@type": "AggregateOffer",
    "lowPrice": "0",
    "highPrice": "299000",
    "priceCurrency": "COP",
    "offerCount": "3"
  },
  "aggregateRating": {
    "@type": "AggregateRating",
    "ratingValue": "4.8",
    "reviewCount": "50"
  },
  "provider": {
    "@type": "Organization",
    "name": "Guro",
    "url": "https://guro.co"
  }
}
```

#### F. Rendimiento SPA y SEO — El Problema Fundamental

GURO es una SPA (Single Page Application) con React + Vite. Esto presenta un desafío SEO fundamental:

**El problema**: Googlebot puede renderizar JavaScript, pero:
1. Tiene una "cola de renderizado" — puede tardar días/semanas en renderizar tu JS
2. Otros bots (Bing, Perplexity, ChatGPT) pueden NO renderizar JS
3. Las meta tags inyectadas por `react-helmet` pueden no ser leídas por todos los crawlers
4. El contenido dinámico puede no ser indexado correctamente

**Soluciones recomendadas para GURO:**

1. **Para la landing page y blog (páginas públicas SEO-critical)**:
   - Implementar **pre-rendering** con un servicio como Prerender.io
   - O migrar estas páginas específicas a **Next.js** (SSR/SSG)
   - O usar **Vite SSG** plugin para generar HTML estático del blog

2. **Para la app interna (dashboard, pólizas, etc.)**:
   - No necesita SEO — está detrás de auth
   - Mantener como SPA normal

3. **Solución inmediata (sin migración)**:
   - Asegurar que `index.html` tenga meta tags robustos (ya lo tienes ✅)
   - Usar `react-helmet-async` correctamente en cada página pública
   - Verificar renderizado con Google Search Console → URL Inspection → "Test Live URL"
   - Configurar prerender middleware en el servidor

---

<a id="parte-4"></a>
## PARTE 4: AI OVERVIEWS, AI MODE Y LLMs

**Fuente**: https://developers.google.com/search/docs/appearance/ai-features

### 4.1 Lo Que Dice Google Oficialmente

1. **No hay requisitos técnicos adicionales** para AI Overviews/AI Mode — solo estar indexado y elegible para snippets
2. **Las mismas best practices de SEO aplican**
3. Los clics desde AI Overviews son de **mayor calidad** (más tiempo en sitio)
4. AI Overviews muestran **mayor diversidad de sitios** que búsqueda clásica
5. Usan técnica de **"query fan-out"** — múltiples búsquedas relacionadas para construir respuesta

### 4.2 Best Practices Oficiales para AI Features

- ✅ Permitir crawling en robots.txt
- ✅ Contenido encontrable vía **enlaces internos**
- ✅ Gran **page experience**
- ✅ Contenido importante en **formato textual**
- ✅ Apoyar con **imágenes y videos de calidad**
- ✅ **Structured data** que coincida con texto visible
- ✅ Business Profile actualizado

### 4.3 Cómo Controlar tu Contenido en AI Features

- `nosnippet` → Excluye de AI Overviews
- `data-nosnippet` → Excluye secciones específicas
- `max-snippet` → Limita longitud del snippet
- `Google-Extended` en robots.txt → Limita entrenamiento de IA (pero NO afecta AI Overviews en Search)

---

<a id="parte-5"></a>
## PARTE 5: GEO — GENERATIVE ENGINE OPTIMIZATION

**Fuentes**: Estudio Princeton GEO (KDD 2024, 10,000 queries), 2025 AI Visibility Report (7,000+ citaciones)

### 5.1 Los Datos Duros

| Factor | Impacto | Fuente |
|--------|---------|--------|
| **Brand search volume** | Predictor #1 de citaciones LLM (correlación 0.334) | 7,000-citation analysis |
| **Presencia en 4+ plataformas** | 2.8x más probabilidad de aparecer en ChatGPT | Cross-platform study |
| **Agregar estadísticas** | +22% visibilidad en IA | Princeton GEO |
| **Agregar citas/quotes de expertos** | +37% visibilidad en IA | Princeton GEO |
| **Listicles comparativos** | 32.5% de todas las citaciones de IA | 30M+ citation analysis |
| **Contenido < 1 año** | 65% de los hits de bots de IA | 300K keyword study |
| **Ranking Page 1 Google** | Correlación ~0.65 con menciones en LLMs | Cross-platform study |
| **Contenido 10,000+ palabras, Flesch 55** | 187 citaciones totales vs 3 para contenido corto | 7,000-citation analysis |
| **Optimización GEO** | Hasta +40% visibilidad (especialmente para sitios no-top) | Princeton GEO |

### 5.2 Lo Que NO Funciona para LLMs

- ❌ **Cantidad de backlinks** — correlación débil/neutral
- ❌ **Keyword stuffing** — rinde PEOR en motores generativos
- ❌ **Contenido multimedia solo** — imágenes/videos no mueven la aguja para citaciones
- ❌ **Ser #1 en Google** — solo 4.5% de URLs en AI Overviews son el #1 orgánico
- ❌ **Contenido corto/delgado** — IA prefiere contenido comprehensivo y sintetizable

### 5.3 Cómo Funcionan los LLMs al Elegir Fuentes

**Dos vías de conocimiento:**

1. **Conocimiento Paramétrico** (datos de entrenamiento):
   - Estático, fijado al corte de entrenamiento
   - 60% de queries de ChatGPT se responden solo con esto
   - 22% de datos de entrenamiento viene de Wikipedia
   - Entidades mencionadas frecuentemente en fuentes autoritativas tienen representaciones neurales más fuertes

2. **Conocimiento Recuperado** (RAG — Retrieval Augmented Generation):
   - Pipeline: Query → Embeddings → Búsqueda híbrida (semántica + BM25) → Reranking → Generación
   - Top 5-10 chunks recuperados se inyectan como contexto
   - La búsqueda híbrida mejora 48% vs método único
   - **Chunking a nivel de página** logra 0.648 de accuracy (el mejor)

### 5.4 Diferencias por Plataforma

| Plataforma | Fuentes Preferidas | Estrategia |
|------------|-------------------|------------|
| **ChatGPT** | Wikipedia, conocimiento paramétrico, Bing index | Presencia en Wikipedia, contenido comprehensivo |
| **Perplexity** | Tiempo real, Reddit, diversidad de fuentes | Presencia en Reddit, contenido actualizado |
| **Google AI Overviews** | Señales tradicionales + diversificación | SEO clásico + cross-platform |
| **Claude** | Datos de entrenamiento, fuentes académicas | Contenido profundo y bien citado |

### 5.5 Arquitectura de Contenido para Máximas Citaciones

1. **Lidera con la respuesta**: "El mejor software de seguros en Colombia es..." NO "Podría ser que..."
2. **Párrafos de 40-60 palabras** para extracción óptima
3. **Jerarquía clara de headings** (H2/H3 que reflejen queries de búsqueda)
4. **Secciones auto-contenidas** que funcionen como chunks independientes
5. **Datos verificables** con citaciones propias
6. **Tablas comparativas** con HTML semántico (`<thead>`, columnas descriptivas) → +47% citaciones
7. **Formato de listicle comparativo** → 32.5% de todas las citaciones IA

### 5.6 Schema Markup para AI Visibility

**Tier 1 — Esencial:**
- `HowTo` → Extracción de pasos para queries procedimentales
- `Article/BlogPosting` → Tipo de contenido y frescura
- `Organization` → Reconocimiento de marca y autoridad
- `Person` → Señales E-E-A-T y autoridad del autor

**Tier 2 — Alto Valor:**
- `Product/Offer` → Pricing para queries de compra IA
- `LocalBusiness` → NAP para queries de ubicación
- `Review/AggregateRating` → Señales de confianza
- `Speakable` → Optimización para asistentes de voz
- `FAQPage` → Alimenta directamente extracción de Q&A por IA

---

<a id="parte-6"></a>
## PARTE 6: SEO TÉCNICO PROFUNDO — APLICADO A GURO

### 6.1 Auditoría del Estado Actual

#### ✅ Lo que GURO ya tiene bien:
- Meta tags completos en `index.html` (title, description, OG, Twitter)
- Canonical URL definida
- robots.txt con Allow/Disallow apropiados
- sitemap.xml básico
- Schema `SoftwareApplication` en index.html
- Schema `BlogPosting` + `BreadcrumbList` + `FAQPage` en blog
- Preconnect a orígenes externos
- Preload de imagen LCP
- Code splitting con React.lazy
- Hook `usePageMeta` para meta tags dinámicos
- react-helmet en artículos del blog
- Imágenes en WebP

#### ⚠️ Problemas Identificados:

1. **Inconsistencia de dominio canónico**:
   - `index.html` usa `https://guro.co`
   - `BlogSegurosSEO.tsx` usa `https://www.guro.com.co/`
   - `BlogArticle.tsx` usa `https://www.guro.com.co`
   - **ACCIÓN**: Unificar TODO a `https://guro.co`

2. **sitemap.xml incompleto**:
   - No incluye URLs del blog (`/blog`, `/blog/[slug]`)
   - No incluye la landing page de blog SEO (`/blog-seguros-seo` o similar)
   - Incluye páginas de auth innecesarias
   - **ACCIÓN**: Regenerar sitemap con todas las URLs públicas

3. **robots.txt falta crawlers de IA**:
   - No menciona `GPTBot`, `ChatGPT-User`, `PerplexityBot`, `ClaudeBot`
   - **ACCIÓN**: Agregar reglas explícitas para crawlers de IA

4. **SPA sin pre-rendering**:
   - Las páginas públicas (landing, blog) dependen de JS para renderizar
   - Crawlers que no ejecutan JS no verán el contenido
   - **ACCIÓN**: Implementar pre-rendering o SSR para páginas públicas

5. **Schema incompleto**:
   - Falta `Organization` completo con `sameAs` (redes sociales, Wikidata)
   - Falta `WebSite` con `SearchAction`
   - Falta `Person` para autores
   - El `SoftwareApplication` no tiene `aggregateRating`
   - **ACCIÓN**: Implementar schemas completos

6. **OG Image es favicon.png**:
   - Las imágenes de Open Graph deben ser de al menos 1200x630px
   - Un favicon no se ve bien cuando se comparte en redes sociales
   - **ACCIÓN**: Crear imagen OG dedicada de alta calidad

7. **Blog articles con fecha hardcodeada**:
   - `datePublished: "2026-01-01"` en BlogArticle — debe ser dinámica
   - `datePublished: "2024-01-01"` en BlogSegurosSEO — fecha incorrecta
   - **ACCIÓN**: Usar fechas reales y dinámicas

### 6.2 robots.txt Optimizado para GURO

```
User-agent: *
Allow: /
Disallow: /apps/
Disallow: /dashboard/
Disallow: /admin/
Disallow: /empleados/

# Permitir crawlers de IA explícitamente
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: Applebot-Extended
Allow: /

User-agent: Google-Extended
Allow: /

# Sitemap
Sitemap: https://guro.co/sitemap.xml

# Archivos estáticos
Allow: /assets/
Allow: /images/
Allow: /favicon.png
Allow: /sitemap.xml
Allow: /robots.txt
```

### 6.3 sitemap.xml Optimizado

Debe incluir:
- `/` (landing page) — priority 1.0
- `/comenzar` — priority 0.9
- `/precios` — priority 0.9
- `/blog` (índice del blog) — priority 0.8
- `/blog/[cada-articulo]` — priority 0.7
- `/blog-seguros-seo` — priority 0.7
- `/terminos-condiciones` — priority 0.3
- `/politica-privacidad` — priority 0.3

**NO incluir**: páginas de auth, dashboard, admin, empleados.

### 6.4 Configuración de Hreflang (si expandes a otros países)

```html
<link rel="alternate" hreflang="es-CO" href="https://guro.co/" />
<link rel="alternate" hreflang="es" href="https://guro.co/" />
<link rel="alternate" hreflang="x-default" href="https://guro.co/" />
```

---

<a id="parte-7"></a>
## PARTE 7: ESTRATEGIA DE CONTENIDO + LLMs PARA GURO

### 7.1 Análisis de Nicho y Oportunidad

**Nicho**: Software de seguros / InsurTech en Colombia y LATAM
**Ventaja competitiva**: Mercado relativamente poco competido en SEO en español para InsurTech
**YMYL**: Sí — seguros es sector financiero, requiere E-E-A-T alto

### 7.2 Keyword Research Estratégico

#### Tier 1 — Keywords Transaccionales (Alta intención de compra)
- "software de seguros"
- "software para agencias de seguros"
- "software gestión pólizas"
- "CRM para seguros"
- "software correduría de seguros"
- "plataforma digital seguros"
- "software siniestros"
- "cotizador de seguros automático"

#### Tier 2 — Keywords Informacionales (Construir autoridad)
- "cómo gestionar una agencia de seguros"
- "digitalización agencias de seguros"
- "inteligencia artificial en seguros"
- "automatización procesos seguros"
- "tendencias insurtech 2025"
- "cómo mejorar la gestión de pólizas"
- "mejores prácticas gestión siniestros"

#### Tier 3 — Keywords de Cola Larga (Menor competencia, mayor conversión)
- "software de seguros con inteligencia artificial colombia"
- "cómo automatizar cotizaciones de seguros"
- "mejor software para corredores de seguros en latinoamérica"
- "gestión de pólizas de seguros online"
- "software para agentes de seguros independientes"
- "comparativa software de seguros 2025"

### 7.3 Estrategia de Pillar Pages + Clusters

#### Pillar Page 1: "Guía Completa de Software de Seguros [2025]"
**Target**: "software de seguros" + variantes
**Formato**: Guía comprehensiva de 5,000-10,000 palabras
**Estructura optimizada para LLMs**:
- H1: Guía Completa de Software de Seguros: Todo lo que Necesitas Saber [2025]
- H2: ¿Qué es un Software de Seguros? (respuesta directa en primer párrafo)
- H2: Los 10 Mejores Software de Seguros en 2025 (listicle comparativo → 32.5% citaciones IA)
- H2: Funcionalidades Esenciales de un Software de Seguros
- H2: Cómo Elegir el Software de Seguros Correcto para tu Agencia
- H2: Precios y Modelos de Suscripción
- H2: Implementación y Migración
- H2: Preguntas Frecuentes (FAQPage schema)

**Clusters que enlazan a esta pillar:**
- "Cómo automatizar cotizaciones de seguros"
- "CRM para seguros: guía completa"
- "Gestión de siniestros digital"
- "Software de seguros vs Excel: comparativa"
- "ROI de digitalizar tu agencia de seguros"

#### Pillar Page 2: "Inteligencia Artificial en Seguros: Guía Definitiva"
**Target**: "inteligencia artificial seguros" + variantes
**Clusters**:
- "Cómo la IA está transformando las agencias de seguros"
- "Análisis predictivo en seguros: casos de uso"
- "Chatbots para seguros: beneficios y limitaciones"
- "Automatización de underwriting con IA"

#### Pillar Page 3: "Cómo Digitalizar tu Agencia de Seguros"
**Target**: "digitalización agencia seguros"
**Clusters**:
- "Paso a paso para migrar de Excel a software de seguros"
- "Herramientas digitales esenciales para agentes de seguros"
- "Casos de éxito: agencias que se digitalizaron"

### 7.4 Formato de Contenido Optimizado para LLMs

Cada artículo debe seguir esta estructura:

```
# [Título que refleje la query principal]

[Párrafo de 40-60 palabras que RESPONDA DIRECTAMENTE la pregunta principal]

## [H2 que refleje sub-query 1]
[Párrafo directo de 40-60 palabras]
[Datos verificables con fuente]
[Tabla comparativa si aplica]

## [H2 que refleje sub-query 2]
...

## Preguntas Frecuentes
[FAQ con schema markup]

## Sobre el Autor
[Byline con credenciales verificables — señal E-E-A-T]
```

**Reglas de contenido para maximizar citaciones IA:**
1. Primer párrafo = respuesta directa y concisa
2. Párrafos de 40-60 palabras (óptimo para chunking)
3. Incluir estadísticas verificables (+22% visibilidad)
4. Incluir citas de expertos del sector (+37% visibilidad)
5. Tablas comparativas con HTML semántico (+47% citaciones)
6. Cada sección debe funcionar como chunk independiente
7. Headings que reflejen queries reales de búsqueda
8. Datos propios y originales (experiencia de primera mano)

### 7.5 Estrategia de Construcción de Entidad (Entity Building)

Para que los LLMs reconozcan a GURO como entidad:

1. **Wikidata**: Crear entrada con Label, Description, Aliases, Industry, Founded, HQ, Website, sameAs
2. **Wikipedia**: Si cumples criterios de notabilidad (cobertura en prensa, premios, etc.)
3. **LinkedIn Company Page**: Completa con descripción, empleados, publicaciones regulares
4. **Reddit**: Participar auténticamente en r/seguros, r/insurtech, r/colombia, r/startups
5. **YouTube**: Canal con tutoriales, demos, webinars del sector
6. **Medium/Dev.to**: Artículos técnicos sobre InsurTech
7. **Product Hunt**: Lanzamiento del producto
8. **G2/Capterra**: Listado con reseñas reales
9. **Crunchbase**: Perfil de startup

> **Meta**: Presencia en 4+ plataformas = 2.8x más probabilidad de citación en ChatGPT

### 7.6 Estrategia de Link Building Orgánico

**Para un nuevo emprendimiento, los enlaces más valiosos vienen de:**

1. **Contenido linkeable** (link magnets):
   - Estudios originales con datos del sector seguros en Colombia
   - Herramientas gratuitas (calculadora de seguros, comparador)
   - Infografías con estadísticas del mercado
   - Templates descargables (plantillas de gestión de pólizas)

2. **Digital PR**:
   - Comunicados sobre lanzamiento, funding, hitos
   - Datos exclusivos del mercado InsurTech colombiano
   - Opiniones de expertos para medios del sector

3. **Guest posting estratégico**:
   - Publicaciones de la industria de seguros
   - Blogs de tecnología/startups en LATAM
   - Medios de negocios colombianos

4. **Partnerships**:
   - Aseguradoras que usen tu software
   - Asociaciones del sector seguros
   - Universidades con programas de seguros/finanzas

---

<a id="parte-8"></a>
## PARTE 8: PLAN DE TRABAJO ACELERADO (12 SEMANAS)

### FASE 1: Fundación Técnica (Semanas 1-4)

#### Semana 1: Setup y Auditoría
- [ ] Verificar sitio en **Google Search Console**
- [ ] Configurar **GA4** con atribución de tráfico IA
- [ ] Auditar Core Web Vitals con PageSpeed Insights
- [ ] Corregir inconsistencia de dominio canónico (todo a `guro.co`)
- [ ] Actualizar robots.txt con crawlers de IA
- [ ] Regenerar sitemap.xml completo

#### Semana 2: Structured Data
- [ ] Implementar schema `Organization` completo con `sameAs`
- [ ] Implementar schema `WebSite` con `SearchAction`
- [ ] Mejorar schema `SoftwareApplication` (aggregateRating, offers)
- [ ] Implementar schema `Person` para autores
- [ ] Validar todos los schemas con Rich Results Test

#### Semana 3: Rendimiento y Pre-rendering
- [ ] Analizar bundle size con visualizer
- [ ] Optimizar LCP (imágenes, fonts, critical CSS)
- [ ] Implementar pre-rendering para páginas públicas (o evaluar Next.js)
- [ ] Verificar renderizado de JS en Search Console (URL Inspection)
- [ ] Crear imagen OG dedicada (1200x630px)

#### Semana 4: Entidad y Presencia
- [ ] Crear entrada en Wikidata
- [ ] Completar LinkedIn Company Page
- [ ] Crear perfil en Crunchbase
- [ ] Listar en G2/Capterra
- [ ] Configurar Google Business Profile

### FASE 2: Contenido Estratégico (Semanas 5-12)

#### Semana 5-6: Pillar Page 1
- [ ] Investigar keywords para "software de seguros"
- [ ] Escribir Pillar Page 1: "Guía Completa de Software de Seguros [2025]"
- [ ] Formato optimizado para LLMs (respuestas directas, párrafos 40-60 palabras)
- [ ] Incluir tabla comparativa con HTML semántico
- [ ] Implementar FAQPage schema
- [ ] Incluir estadísticas verificables y citas de expertos

#### Semana 7-8: Cluster Content (4-6 artículos)
- [ ] "Cómo automatizar cotizaciones de seguros con IA"
- [ ] "Software de seguros vs Excel: por qué migrar en 2025"
- [ ] "CRM para seguros: guía completa para agencias"
- [ ] "ROI de digitalizar tu agencia de seguros [con datos]"
- [ ] Enlazar todos los clusters a Pillar Page 1
- [ ] Cada artículo con schema BlogPosting + BreadcrumbList

#### Semana 9-10: Pillar Page 2 + Clusters
- [ ] Escribir Pillar Page 2: "IA en Seguros: Guía Definitiva"
- [ ] 3-4 artículos cluster sobre IA en seguros
- [ ] Cross-linking entre pillar pages

#### Semana 11-12: Contenido de Conversión + Optimización
- [ ] Crear página de comparativa "Guro vs [Competidores]"
- [ ] Crear casos de éxito / testimonios detallados
- [ ] Optimizar contenido existente basado en datos de Search Console
- [ ] Actualizar sitemap con todo el contenido nuevo
- [ ] Primer reporte de rendimiento SEO

### FASE 3: Escala y Autoridad (Mes 4 en adelante)

#### Mensual:
- [ ] 4-6 piezas de contenido de alta calidad
- [ ] Actualizar contenido existente (frescura)
- [ ] Monitorear citaciones en IA
- [ ] Analizar Search Console y ajustar estrategia
- [ ] 1-2 acciones de link building
- [ ] Participación en Reddit y comunidades

#### Trimestral:
- [ ] Estudio original con datos del sector (link magnet)
- [ ] Actualizar pillar pages con datos nuevos
- [ ] Evaluar nuevas oportunidades de keywords
- [ ] Revisar y actualizar structured data
- [ ] Auditoría técnica completa

---

<a id="parte-9"></a>
## PARTE 9: MÉTRICAS Y KPIs

### SEO Tradicional
- **Impresiones** en Search Console (crecimiento mensual)
- **Clics orgánicos** (crecimiento mensual)
- **Posición promedio** por keyword target
- **Páginas indexadas** (crecimiento)
- **Core Web Vitals** (mantener en verde)
- **Backlinks** (crecimiento orgánico)

### AI/LLM Visibility
- **Citaciones en ChatGPT** para queries del nicho
- **Citaciones en Perplexity** para queries del nicho
- **Apariciones en Google AI Overviews**
- **Brand search volume** (Google Trends)
- **Menciones de marca** en plataformas externas

### Negocio
- **Tráfico orgánico → Registros** (conversión)
- **Tráfico orgánico → Trials** (conversión)
- **Costo por adquisición orgánico** vs paid
- **Tiempo en sitio** desde tráfico orgánico
- **Páginas por sesión** desde tráfico orgánico

---

<a id="parte-10"></a>
## PARTE 10: IMPLEMENTACIONES TÉCNICAS PRIORITARIAS

### Prioridad 1 (Esta semana)
1. Unificar dominio canónico a `guro.co` en todo el código
2. Actualizar robots.txt con crawlers de IA
3. Actualizar sitemap.xml con URLs del blog
4. Implementar schema Organization completo

### Prioridad 2 (Próximas 2 semanas)
5. Crear imagen OG dedicada (1200x630px)
6. Implementar schemas WebSite y Person
7. Mejorar schema SoftwareApplication
8. Corregir fechas hardcodeadas en blog

### Prioridad 3 (Próximo mes)
9. Evaluar e implementar pre-rendering para páginas públicas
10. Crear entrada en Wikidata
11. Escribir primera Pillar Page
12. Configurar GA4 con tracking de IA

---

## FUENTES OFICIALES

| Fuente | URL |
|--------|-----|
| Google Search Ranking Systems Guide | https://developers.google.com/search/docs/appearance/ranking-systems-guide |
| Creating Helpful Content | https://developers.google.com/search/docs/fundamentals/creating-helpful-content |
| AI Features and Your Website | https://developers.google.com/search/docs/appearance/ai-features |
| Core Web Vitals | https://developers.google.com/search/docs/appearance/core-web-vitals |
| Page Experience | https://developers.google.com/search/docs/appearance/page-experience |
| SEO Starter Guide | https://developers.google.com/search/docs/fundamentals/seo-starter-guide |
| Structured Data Gallery | https://developers.google.com/search/docs/appearance/structured-data/search-gallery |
| Princeton GEO Study | KDD 2024 — "GEO: Generative Engine Optimization" |
| 2025 AI Visibility Report | https://thedigitalbloom.com/learn/2025-ai-citation-llm-visibility-report/ |

---

> **Última actualización**: Febrero 2026
> **Próxima revisión**: Cada 3 meses o tras actualizaciones mayores de Google
