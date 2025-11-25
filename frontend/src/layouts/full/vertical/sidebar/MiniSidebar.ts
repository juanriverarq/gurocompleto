//  Profile Data
interface MiniiconsType {
  id: number;
  icon: string;
  tooltip: string;
}

const Miniicons: MiniiconsType[] = [
  {
    id: 1,
    icon: 'solar:widget-2-bold-duotone',
    tooltip: 'Panel de Control',
  },
  {
    id: 2,
    icon: 'solar:shield-check-bold-duotone',
    tooltip: 'Operaciones de Seguros',
  },
  {
    id: 3,
    icon: 'solar:chart-2-bold-duotone',
    tooltip: 'Gestión Comercial',
  },
  {
    id: 4,
    icon: 'solar:letter-bold-duotone',
    tooltip: 'Marketing Digital',
  },

  {
    id: 5,
    icon: 'solar:cpu-bolt-bold-duotone',
    tooltip: 'Inteligencia Artificial',
  },
  {
    id: 6,
    icon: 'solar:wallet-bold-duotone',
    tooltip: 'Gestión Financiera',
  },
  {
    id: 7,
    icon: 'solar:document-bold-duotone',
    tooltip: 'Gestión Documental',
  },
  {
    id: 10,
    icon: 'solar:settings-bold-duotone',
    tooltip: 'Administración',
  },
];

export default Miniicons;
