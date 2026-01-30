//  Mini Sidebar Icons - 8 secciones principales
interface MiniiconsType {
  id: number;
  icon: string;
  tooltip: string;
}

const Miniicons: MiniiconsType[] = [
  {
    id: 1,
    icon: 'solar:widget-2-bold-duotone',
    tooltip: 'Inicio',
  },
  {
    id: 2,
    icon: 'solar:shield-check-bold-duotone',
    tooltip: 'Seguros',
  },
  {
    id: 3,
    icon: 'solar:chart-2-bold-duotone',
    tooltip: 'Comercial',
  },
  {
    id: 4,
    icon: 'solar:wallet-bold-duotone',
    tooltip: 'Finanzas',
  },
  {
    id: 5,
    icon: 'solar:chat-round-dots-bold-duotone',
    tooltip: 'Comunicaciones',
  },
  {
    id: 6,
    icon: 'solar:cpu-bolt-bold-duotone',
    tooltip: 'Inteligencia Artificial',
  },
  {
    id: 7,
    icon: 'solar:folder-with-files-bold-duotone',
    tooltip: 'Documentos',
  },
  {
    id: 8,
    icon: 'solar:settings-bold-duotone',
    tooltip: 'Configuración',
  },
];

export default Miniicons;
