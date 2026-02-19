# Guía: Crear Entrada de Guro en Wikidata

> **Por qué importa**: Wikidata es la fuente #1 del Knowledge Graph de Google (500B facts, 5B entities). Tener una entrada en Wikidata aumenta el reconocimiento de entidad por LLMs y mejora la visibilidad en AI Overviews. Marcas presentes en 4+ plataformas tienen 2.8x más probabilidad de ser citadas por ChatGPT.

---

## Paso 1: Crear cuenta en Wikidata

1. Ir a https://www.wikidata.org
2. Click en **"Create account"** (esquina superior derecha)
3. Registrarse con email y contraseña
4. Confirmar email

---

## Paso 2: Crear el Item (Entidad)

1. Ir a https://www.wikidata.org/wiki/Special:NewItem
2. Completar los campos iniciales:

| Campo | Valor |
|-------|-------|
| **Language** | `es` (español) |
| **Label** | `Guro` |
| **Description** | `Software de seguros con inteligencia artificial para agencias de seguros en Colombia` |
| **Aliases** | `Guro Software`, `Guro Seguros`, `Guro InsurTech`, `guro.co` |

3. Click **"Create"**
4. Anotar el **QID** asignado (ej: `Q123456789`) — lo necesitarás para el schema `sameAs`

---

## Paso 3: Agregar Propiedades (Statements)

Después de crear el item, agregar las siguientes propiedades haciendo click en **"+ add statement"**:

### Propiedades Esenciales

| Propiedad | ID | Valor |
|-----------|-----|-------|
| **instance of** | P31 | `software` (Q7397) o `software company` (Q4830453) |
| **country** | P17 | `Colombia` (Q739) |
| **official website** | P856 | `https://guro.co` |
| **inception** | P571 | `2024` |
| **industry** | P452 | `insurance` (Q43183) |
| **programming language** | P277 | `JavaScript` (Q2005), `PHP` (Q59) |
| **operating system** | P306 | `web application` (Q189210) |
| **developer** | P178 | (crear item para la empresa si no existe) |

### Propiedades Recomendadas

| Propiedad | ID | Valor |
|-----------|-----|-------|
| **described at URL** | P973 | `https://guro.co` |
| **language of work** | P407 | `Spanish` (Q1321) |
| **main subject** | P921 | `insurance` (Q43183) |
| **uses** | P2283 | `artificial intelligence` (Q11660) |
| **distribution format** | P437 | `software as a service` (Q1254596) |
| **platform** | P400 | `World Wide Web` (Q466) |

### Propiedades de Redes Sociales

| Propiedad | ID | Valor |
|-----------|-----|-------|
| **X (Twitter) username** | P2002 | `GuroSeguros` |
| **LinkedIn company ID** | P4264 | `guro` (el slug de la URL de LinkedIn) |

---

## Paso 4: Agregar Descripciones en Otros Idiomas

Click en **"All entered languages"** y agregar:

| Idioma | Label | Description |
|--------|-------|-------------|
| `en` (English) | `Guro` | `AI-powered insurance management software for insurance agencies in Colombia` |
| `pt` (Português) | `Guro` | `Software de seguros com inteligência artificial para agências de seguros na Colômbia` |

---

## Paso 5: Actualizar Schema en el Sitio Web

Una vez creado el item con su QID, actualizar el schema `Organization` en `frontend/index.html`:

```json
"sameAs": [
  "https://www.linkedin.com/company/guro",
  "https://twitter.com/GuroSeguros",
  "https://www.wikidata.org/wiki/Q[TU_QID_AQUI]"
]
```

---

## Paso 6: Verificación

1. Buscar "Guro" en https://www.wikidata.org/wiki/Special:Search
2. Verificar que todas las propiedades estén correctas
3. Esperar 24-48 horas para que Google indexe la entrada
4. Verificar en Google Knowledge Panel buscando "Guro software seguros"

---

## Criterios de Notabilidad para Wikipedia (Futuro)

Wikidata NO requiere notabilidad, pero si en el futuro quieres crear un artículo en **Wikipedia**, necesitas:

- [ ] Cobertura en **prensa independiente** (mínimo 2-3 fuentes)
- [ ] Premios o reconocimientos del sector
- [ ] Menciones en publicaciones de industria
- [ ] Datos verificables de usuarios/clientes
- [ ] Financiamiento documentado (si aplica)

**Recomendación**: Primero consolida la entrada en Wikidata. Cuando tengas cobertura de prensa suficiente, crea el artículo de Wikipedia.

---

## Checklist Final

- [ ] Cuenta creada en Wikidata
- [ ] Item creado con Label, Description, Aliases en español
- [ ] Descripciones en inglés y portugués agregadas
- [ ] Propiedades esenciales agregadas (instance of, country, website, inception, industry)
- [ ] Propiedades de redes sociales agregadas
- [ ] QID anotado: `Q__________`
- [ ] Schema `sameAs` actualizado en `index.html` con URL de Wikidata
- [ ] Verificado que el item aparece en búsqueda de Wikidata
