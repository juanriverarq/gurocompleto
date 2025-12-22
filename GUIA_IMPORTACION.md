# Guía de Importación de Datos - Guro

## Índice
1. [Orden de Importación](#orden-de-importación)
2. [Importación Masiva (Individual)](#importación-masiva-individual)
3. [Importación Múltiple (Encadenada)](#importación-múltiple-encadenada)
4. [Plantillas CSV](#plantillas-csv)
5. [Mapeo de Campos](#mapeo-de-campos)
6. [Valores ENUM](#valores-enum)
7. [Valores por Defecto](#valores-por-defecto)
8. [Solución de Problemas](#solución-de-problemas)

---

## Orden de Importación

Es **crucial** importar las entidades en el orden correcto para que las relaciones se establezcan correctamente:

| Orden | Entidad | Dependencias | Descripción |
|-------|---------|--------------|-------------|
| 1 | **Aseguradoras** | Ninguna | Compañías de seguros |
| 2 | **Ramos** | Ninguna | Tipos de seguros (Auto, Vida, Hogar) |
| 3 | **Vendedores** | Ninguna | Equipo de ventas y asesores |
| 4 | **Clientes** | Ninguna | Tomadores y asegurados |
| 5 | **Pólizas** | Clientes, Vendedores, Aseguradoras, Ramos | Contratos de seguros |

---

## Importación Masiva (Individual)

**URL:** `http://localhost:5174/apps/admin/importacion-masiva`

Permite importar una entidad a la vez con control total sobre el mapeo de campos.

### Pasos:
1. Seleccionar la entidad a importar
2. Subir el archivo CSV
3. Mapear las columnas del CSV a los campos del sistema
4. Seleccionar la clave de upsert (para actualizar registros existentes)
5. Ejecutar la importación

### Opciones:
- **Auto-crear entidades relacionadas**: Crea automáticamente clientes/vendedores si no existen
- **Límite de registros**: Importar solo N registros (útil para pruebas)

---

## Importación Múltiple (Encadenada)

**URL:** `http://localhost:5174/apps/admin/importacion-multiple`

Permite importar múltiples entidades en secuencia, manteniendo las relaciones entre ellas.

### Ventajas:
- Importa clientes, vendedores y pólizas en una sola operación
- Mantiene las relaciones usando columnas de identificación temporal
- Ideal para migraciones completas desde otros sistemas

### Configuración de Relaciones:
Para relacionar pólizas con clientes/vendedores, el CSV debe tener columnas con identificadores que coincidan:

```
tomador.id → Columna en CSV de clientes que identifica al cliente
Asesor.id → Columna en CSV de vendedores que identifica al vendedor
```

---

## Plantillas CSV

### Aseguradoras
```csv
nombre,nit,email,telefono,direccion,cuenta_bancaria,link_pago,codigo_intermediario
Seguros Sura,890903407,contacto@sura.com,6044445555,Calle 50 #50-50,1234567890,https://pago.sura.com,INT001
```

**Campos:**
| Campo | Descripción | Requerido |
|-------|-------------|-----------|
| nombre | Nombre de la aseguradora | ✅ |
| nit | NIT o identificación fiscal | ❌ |
| email | Correo electrónico | ❌ |
| telefono | Teléfono de contacto | ❌ |
| direccion | Dirección física | ❌ |
| cuenta_bancaria | Número de cuenta bancaria | ❌ |
| link_pago | URL para pagos | ❌ |
| codigo_intermediario | Código de intermediario | ❌ |

---

### Ramos
```csv
nombre,subramo
Automóviles,Autos Livianos
Vida,Vida Individual
Hogar,Hogar Básico
```

**Campos:**
| Campo | Descripción | Requerido |
|-------|-------------|-----------|
| nombre | Nombre del ramo | ✅ |
| subramo | Subramo o categoría | ❌ |

---

### Vendedores
```csv
nombres,tipo_documento,numero_documento,email,telefono,celular,tipo_persona,porcentaje_comision
Juan Pérez,CC,12345678,juan@email.com,6041234567,3001234567,natural,15
Empresa ABC,NIT,900123456,empresa@abc.com,6049876543,3009876543,juridica,20
```

**Campos principales:**
| Campo | Descripción | Requerido | Valores válidos |
|-------|-------------|-----------|-----------------|
| nombres | Nombre completo | ✅ | - |
| tipo_documento | Tipo de documento | ❌ | CC, NIT, CE, PA, TI |
| numero_documento | Número de documento | ❌ | - |
| email | Correo electrónico | ❌ | - |
| tipo_persona | Tipo de persona | ❌ | natural, juridica |
| porcentaje_comision | % de comisión | ❌ | 0-100 |
| tipo_retencion | Tipo de retención | ❌ | Texto libre |
| calcular_comision_sobre | Base de cálculo | ❌ | prima_neta, agencia |

---

### Clientes
```csv
tipo_cliente,nombre,apellidos,tipo_documento,documento,email,celular,fecha_nacimiento,ciudad
natural,Juan,Pérez García,CC,12345678,juan@email.com,3001234567,1985-06-15,Medellín
empresa,Empresa XYZ,,NIT,900123456,contacto@xyz.com,3009876543,,Bogotá
```

**Campos principales:**
| Campo | Descripción | Requerido | Valores válidos |
|-------|-------------|-----------|-----------------|
| tipo_cliente | Tipo de cliente | ❌ | natural, persona, juridica, empresa |
| nombre | Nombre o razón social | ✅ | - |
| apellidos | Apellidos | ❌ | - |
| tipo_documento | Tipo de documento | ❌ | CC, NIT, CE, PA, TI |
| documento | Número de documento | ❌ | - |
| email | Correo electrónico | ❌ | - |
| celular | Teléfono móvil | ❌ | - |
| fecha_nacimiento | Fecha de nacimiento | ❌ | YYYY-MM-DD |
| genero | Género | ❌ | M, F, O |
| estado_civil | Estado civil | ❌ | soltero, casado, divorciado, viudo, union_libre |
| ciudad | Ciudad | ❌ | - |

---

### Pólizas
```csv
numero_poliza,aseguradora,ramo,producto,cliente_documento,vendedor_email,fecha_inicio,fecha_fin,prima_neta,estado
POL-001,Seguros Sura,Automóviles,Auto Básico,12345678,juan@email.com,2024-01-01,2025-01-01,1500000,activa
```

**Campos principales:**
| Campo | Descripción | Requerido | Valores válidos |
|-------|-------------|-----------|-----------------|
| numero_poliza | Número de póliza | ✅ | - |
| aseguradora | Nombre de aseguradora | ❌ | - |
| ramo | Nombre del ramo | ❌ | - |
| producto | Nombre del producto | ❌ | - |
| cliente_documento | Documento del cliente | ❌ | - |
| cliente_nombre | Nombre del cliente | ❌ | - |
| vendedor_email | Email del vendedor | ❌ | - |
| vendedor_nombre | Nombre del vendedor | ❌ | - |
| fecha_inicio | Fecha de inicio | ❌ | YYYY-MM-DD |
| fecha_fin | Fecha de vencimiento | ❌ | YYYY-MM-DD |
| prima_neta | Prima neta | ❌ | Número |
| estado | Estado de la póliza | ❌ | Ver tabla de estados |
| enlace_externo | URL externa (Drive, etc) | ❌ | URL |

---

## Valores ENUM

### Estados de Póliza (estado)
| Valor en CSV | Valor en BD | Descripción |
|--------------|-------------|-------------|
| activa, vigente, active | active | Póliza vigente |
| vencida, expired, expirada | expired | Póliza vencida |
| cancelada, anulada, cancelled | cancelled | Póliza cancelada |
| pendiente, pending, nueva | pending | Pendiente de activación |
| cotizada, quoted | quoted | En cotización |
| emitida, issued | issued | Emitida |
| renovada, renewed | renewed | Renovada |
| no renovada, not_renewed | not_renewed | No renovada |
| suspendida, suspended | suspended | Suspendida |

### Estado de Pago (estado_pago)
| Valor en CSV | Valor en BD |
|--------------|-------------|
| pagado, paid, al dia | paid |
| pendiente, pending | pending |
| vencido, overdue, mora | overdue |
| cancelado, cancelled | cancelled |

### Frecuencia de Pago (frecuencia_pago)
| Valor en CSV | Valor en BD |
|--------------|-------------|
| mensual, monthly | monthly |
| trimestral, quarterly | quarterly |
| semestral, biannual | biannual |
| anual, annual | annual |

### Medio de Pago (medio_pago)
| Valor en CSV | Valor en BD |
|--------------|-------------|
| efectivo, cash | cash |
| transferencia, transfer | transfer |
| cheque, check | check |
| tarjeta, card, débito automático | card |
| financiamiento, financing | financing |

### Tipo de Persona (tipo_persona)
| Valor en CSV | Valor en BD |
|--------------|-------------|
| natural, persona natural, individual | natural |
| juridica, persona juridica, empresa | juridica |

### Tipo de Cliente (tipo_cliente)
| Valor en CSV | Valor en BD |
|--------------|-------------|
| natural, persona natural, persona | persona |
| juridica, persona juridica, empresa | empresa |

---

## Valores por Defecto

El sistema aplica valores por defecto para ciertos campos cuando no vienen en el CSV:

### Vendedores
| Campo | Valor por defecto |
|-------|-------------------|
| tipo_persona | natural |

### Pólizas
| Campo | Valor por defecto |
|-------|-------------------|
| estado | active |

### Aseguradoras
| Campo | Valor por defecto |
|-------|-------------------|
| retencion | 0 |
| iva | 0 |

> **Nota:** Los demás campos que no tengan valor en el CSV se guardarán como `null` en la base de datos.

---

## Solución de Problemas

### Error: "Field 'X' doesn't have a default value"
**Causa:** El campo es obligatorio en la base de datos pero no tiene valor en el CSV.
**Solución:** Asegúrate de que el campo esté mapeado correctamente o que tenga un valor en el CSV.

### Error: "Column 'status' cannot be null"
**Causa:** El estado de la póliza está vacío o tiene un valor no reconocido.
**Solución:** Usa uno de los valores válidos de estado (activa, vencida, cancelada, etc.)

### Los vendedores/aseguradoras no aparecen en el selector
**Causa:** La paginación limita los resultados.
**Solución:** El sistema ahora carga todos los registros automáticamente.

### Las relaciones no se establecen (cliente_id, seller_id vacíos)
**Causa:** No se encontró el cliente/vendedor por el campo de búsqueda.
**Solución:** 
1. Verifica que el documento/email del cliente exista en la BD
2. Usa la opción "Auto-crear entidades relacionadas"
3. En importación múltiple, asegúrate de que las columnas de relación coincidan

### Fechas no se importan correctamente
**Causa:** Formato de fecha incorrecto.
**Solución:** Usa el formato `YYYY-MM-DD` (ej: 2024-12-31)

### Números con formato incorrecto
**Causa:** Números con separadores de miles o símbolos de moneda.
**Solución:** Usa números sin formato (ej: 1500000 en lugar de $1,500,000)

---

## Ejemplo Completo de Importación Múltiple

### 1. Archivo: clientes.csv
```csv
id_temporal,tipo_cliente,nombre,apellidos,documento,email,celular
CLI001,natural,Juan,Pérez,12345678,juan@email.com,3001234567
CLI002,empresa,Empresa ABC,,900123456,contacto@abc.com,3009876543
```

### 2. Archivo: vendedores.csv
```csv
id_temporal,nombres,numero_documento,email,tipo_persona,porcentaje_comision
VEN001,María García,87654321,maria@email.com,natural,15
VEN002,Agencia XYZ,900987654,agencia@xyz.com,juridica,20
```

### 3. Archivo: polizas.csv
```csv
numero_poliza,aseguradora,ramo,producto,prima_neta,estado,tomador.id,Asesor.id
POL-001,Seguros Sura,Automóviles,Auto Básico,1500000,activa,CLI001,VEN001
POL-002,Allianz,Vida,Vida Individual,2000000,activa,CLI002,VEN002
```

### Configuración en Importación Múltiple:
1. **Clientes:** Columna identificadora = `id_temporal`
2. **Vendedores:** Columna identificadora = `id_temporal`
3. **Pólizas:** 
   - Relación cliente = `tomador.id`
   - Relación vendedor = `Asesor.id`

---

## Contacto y Soporte

Si tienes problemas con la importación, revisa:
1. Los logs del servidor (`storage/logs/laravel.log`)
2. La consola del navegador (F12 → Console)
3. Los errores mostrados en la interfaz de importación

