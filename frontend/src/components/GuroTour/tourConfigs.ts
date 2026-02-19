import type { TourConfig } from './GuroTour';

export const TOUR_RAMOS: TourConfig = {
  id: 'ramos',
  steps: [
    {
      target: 'ramos-page-title',
      title: 'Gestión de Ramos',
      content: 'Aquí administras los ramos de seguros que maneja tu agencia. Los ramos son las categorías de seguros como Auto, Vida, Hogar, etc.',
      placement: 'bottom',
      icon: 'solar:shield-bold-duotone',
    },
    {
      target: 'ramos-create-btn',
      title: 'Crear un nuevo ramo',
      content: 'Haz clic en este botón para crear tu primer ramo. Puedes crearlo desde cero o usar una plantilla predefinida.',
      placement: 'bottom',
      icon: 'solar:add-circle-bold-duotone',
      advanceOnClick: true,
    },
    {
      target: 'ramos-modal-template',
      title: 'Elige cómo crear el ramo',
      content: 'Puedes usar una plantilla con ramos predefinidos de Colombia o crear uno en blanco con nombre personalizado.',
      placement: 'right',
      icon: 'solar:document-add-bold',
    },
  ],
};

export const TOUR_ASEGURADORAS: TourConfig = {
  id: 'aseguradoras',
  steps: [
    {
      target: 'aseguradoras-page-title',
      title: 'Gestión de Aseguradoras',
      content: 'Aquí registras las compañías aseguradoras con las que trabajas. Cada aseguradora tendrá su información de contacto y comisiones.',
      placement: 'bottom',
      icon: 'solar:buildings-bold-duotone',
    },
    {
      target: 'aseguradoras-create-btn',
      title: 'Agregar una aseguradora',
      content: 'Haz clic aquí para agregar una nueva aseguradora. Puedes usar las plantillas con aseguradoras de Colombia o crear una manualmente.',
      placement: 'bottom',
      icon: 'solar:add-circle-bold-duotone',
      advanceOnClick: true,
    },
    {
      target: 'aseguradoras-modal-template',
      title: 'Elige cómo agregar',
      content: 'Selecciona "Usar plantilla" para elegir entre aseguradoras colombianas predefinidas, o "Crear en blanco" para ingresar los datos manualmente.',
      placement: 'right',
      icon: 'solar:shield-plus-bold',
    },
  ],
};

export const TOUR_CLIENTES: TourConfig = {
  id: 'clientes',
  steps: [
    {
      target: 'clientes-page-title',
      title: 'Tu cartera de clientes',
      content: 'Aquí gestionas todos tus clientes. Puedes ver estadísticas, filtrar por estado y acceder rápidamente a la información de cada uno.',
      placement: 'bottom',
      icon: 'solar:users-group-two-rounded-bold-duotone',
    },
    {
      target: 'clientes-stats',
      title: 'Estadísticas rápidas',
      content: 'Estas tarjetas te muestran un resumen: total de clientes, activos, prospectos y pólizas activas.',
      placement: 'bottom',
      icon: 'solar:chart-2-bold-duotone',
    },
    {
      target: 'clientes-create-btn',
      title: 'Crear un nuevo cliente',
      content: 'Haz clic aquí para registrar tu primer cliente. Ingresa sus datos personales, contacto y tipo de cliente.',
      placement: 'bottom',
      icon: 'solar:add-circle-bold-duotone',
    },
    {
      target: 'clientes-table',
      title: 'Tabla de clientes',
      content: 'Aquí verás todos tus clientes listados. Puedes buscar, filtrar y hacer clic en cada uno para ver sus detalles y pólizas.',
      placement: 'top',
      icon: 'solar:list-bold-duotone',
    },
  ],
};

export const TOUR_POLIZAS: TourConfig = {
  id: 'polizas',
  steps: [
    {
      target: 'polizas-page-title',
      title: 'Gestión de Pólizas',
      content: 'Aquí administras todas las pólizas de tu agencia. Puedes ver estadísticas, filtrar por estado y gestionar renovaciones.',
      placement: 'bottom',
      icon: 'solar:document-bold-duotone',
    },
    {
      target: 'polizas-stats',
      title: 'Panel de estadísticas',
      content: 'Visualiza rápidamente el total de pólizas, activas, por vencer y vencidas. Esto te ayuda a priorizar tu trabajo.',
      placement: 'bottom',
      icon: 'solar:chart-2-bold-duotone',
    },
    {
      target: 'polizas-create-btn',
      title: 'Crear una nueva póliza',
      content: 'Haz clic aquí para crear tu primera póliza. Necesitarás seleccionar un cliente, aseguradora y ramo que ya hayas creado.',
      placement: 'bottom',
      icon: 'solar:add-circle-bold-duotone',
    },
    {
      target: 'polizas-table',
      title: 'Tabla de pólizas',
      content: 'Aquí verás todas tus pólizas con su estado, fechas de vencimiento, primas y más. Puedes personalizar las columnas visibles.',
      placement: 'top',
      icon: 'solar:list-bold-duotone',
    },
  ],
};
