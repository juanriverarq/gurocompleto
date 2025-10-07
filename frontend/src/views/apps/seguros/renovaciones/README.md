# Página de Renovaciones de Pólizas

## Descripción General

La página de renovaciones permite gestionar las pólizas que están próximas a vencer o que ya han vencido, proporcionando herramientas para realizar seguimiento comercial y procesar renovaciones de manera eficiente.

## Funcionalidades Implementadas

### 1. Dashboard de Estadísticas
- **Total de Renovaciones**: Muestra el número total de pólizas en proceso de renovación
- **Renovaciones Críticas**: Pólizas que vencen en 7 días o menos
- **Renovaciones Pendientes**: Pólizas que vencen en 8-30 días
- **Renovaciones Completadas**: Pólizas ya renovadas exitosamente
- **Valor Total de Primas**: Suma del valor de todas las primas en renovación

### 2. Filtros Avanzados
- **Búsqueda por texto**: Número de póliza, cliente, aseguradora
- **Estado de renovación**: Pendiente, En Proceso, Crítico, Renovado, Vencido
- **Prioridad**: Baja, Media, Alta, Crítica
- **Días de vencimiento**: Todos, Crítico (≤7 días), Próximo (≤30 días)
- **Elementos por página**: 10, 15, 25, 50

### 3. Gestión de Contactos
- **Registrar contacto**: Permite registrar intentos de contacto con clientes
- **Tipos de contacto**: Llamada telefónica, correo electrónico, WhatsApp, visita presencial, SMS
- **Resultados**: Exitoso, no disponible, no contesta, etc.
- **Próximo contacto**: Programar recordatorio para futuro seguimiento

### 4. Procesamiento de Renovaciones
- **Renovar póliza**: Procesar la renovación con nueva fecha de vencimiento
- **Actualizar valor**: Modificar el valor de la prima para el nuevo período
- **Observaciones**: Agregar notas sobre el proceso de renovación

### 5. Acciones Disponibles
- **Ver detalles**: Información completa de la renovación
- **Ver póliza**: Navegar a la póliza original
- **Registrar contacto**: Registrar seguimiento comercial
- **Renovar**: Procesar la renovación de la póliza
- **Exportar**: Descargar listado en formato CSV

## Conexión con el Backend

### Endpoints Utilizados
- `GET /api/saas/renovaciones` - Obtener lista de renovaciones con filtros
- `GET /api/saas/renovaciones/estadisticas` - Obtener estadísticas del dashboard
- `POST /api/saas/renovaciones/{id}/contacto` - Registrar contacto (planeado)
- `POST /api/saas/renovaciones/{id}/procesar` - Procesar renovación (planeado)
- `GET /api/saas/renovaciones/export` - Exportar renovaciones (planeado)

### Datos de Prueba
El componente incluye datos de prueba (fallback) que se utilizan cuando el backend no está disponible:
- 4 renovaciones de ejemplo con diferentes estados y prioridades
- Estadísticas calculadas dinámicamente
- Exportación CSV con datos de ejemplo

## Cálculo de Estados y Prioridades

### Estados de Renovación
- **PENDIENTE**: 8-30 días para vencer
- **CRITICO**: 7 días o menos para vencer
- **VENCIDO**: Ya pasó la fecha de vencimiento
- **EN_PROCESO**: En trámite de renovación
- **RENOVADO**: Renovación completada exitosamente

### Prioridades
- **CRITICA**: Vence en ≤7 días o prima >$2,000,000
- **ALTA**: Vence en ≤15 días o prima >$1,000,000
- **MEDIA**: Vence en 16-30 días
- **BAJA**: Vence en >30 días

## Integración con el Sistema

### Navegación
- Accesible desde el menú lateral: Gestión de Seguros → Pólizas → Renovaciones
- Ruta: `/apps/seguros/renovaciones`

### Conexión con Pólizas
- Botón "Ver Póliza" navega a `/apps/seguros/polizas/{id}`
- Botón "Nueva Póliza" navega a `/apps/seguros/polizas/create`

### Temas y Estilos
- Soporte completo para modo claro y oscuro
- Estilos consistentes con el resto de la aplicación
- Responsive design para dispositivos móviles

## Características Técnicas

### Componentes Utilizados
- **Flowbite React**: Componentes de UI (Table, Button, Modal, etc.)
- **Tabler Icons**: Iconos del sistema
- **Iconify**: Iconos adicionales
- **React Router**: Navegación entre páginas
- **Custom Hooks**: useToast para notificaciones

### Gestión de Estado
- `useState` para estado local del componente
- Manejo de filtros con debounce para búsqueda
- Paginación automática
- Actualización automática de estadísticas

### Rendimiento
- Carga lazy del componente principal
- Filtros con debounce (500ms) para búsqueda
- Paginación eficiente
- Fallback automático a datos de prueba

## Próximas Mejoras

### Funcionalidades Pendientes
1. **Notificaciones automáticas**: Recordatorios por email/SMS
2. **Reportes avanzados**: Análisis de conversión de renovaciones
3. **Integración con WhatsApp**: Envío automático de recordatorios
4. **Workflow de aprobación**: Proceso de aprobación para renovaciones
5. **Auditoría**: Registro de todas las acciones realizadas

### Mejoras Técnicas
1. **Caché inteligente**: Almacenamiento en caché de filtros
2. **Optimización de queries**: Reducir llamadas al backend
3. **Validación avanzada**: Validación de formularios más robusta
4. **Testing**: Pruebas unitarias y de integración
5. **Documentación**: Documentación técnica completa

## Uso Recomendado

### Flujo de Trabajo Típico
1. **Revisar estadísticas**: Verificar renovaciones críticas
2. **Filtrar por prioridad**: Enfocar en renovaciones críticas/altas
3. **Contactar clientes**: Registrar intentos de contacto
4. **Procesar renovaciones**: Completar renovaciones exitosas
5. **Exportar reportes**: Generar reportes para análisis

### Mejores Prácticas
- Revisar renovaciones críticas diariamente
- Mantener registro actualizado de contactos
- Procesar renovaciones tan pronto como sea posible
- Utilizar filtros para priorizar trabajo
- Exportar datos regularmente para análisis
