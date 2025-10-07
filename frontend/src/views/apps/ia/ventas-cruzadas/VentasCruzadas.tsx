import { useState, useContext } from 'react';
import { useReactTable, createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, SortingState } from '@tanstack/react-table';
import { Badge, Button, Card, Progress } from 'flowbite-react';
import { Icon } from '@iconify/react';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { CustomizerContext } from 'src/context/CustomizerContext';

const BCrumb = [
  {
    to: "/",
    title: "Dashboard",
  },
  {
    to: "/apps/ia",
    title: "Inteligencia Artificial",
  },
  {
    title: "Ventas cruzadas",
  },
];

export interface OportunidadType {
  id: string;
  cliente: string;
  polizaActual: string;
  tipoActual: string;
  oportunidad: string;
  tipoOportunidad: string;
  scoring: number;
  probabilidad: number;
  valorEstimado: string;
  razonamiento: string;
  estado: string;
  estadoColor: string;
  fechaDeteccion: string;
  accionRecomendada: string;
}

const oportunidadesData: OportunidadType[] = [
  {
    id: "OPO-001",
    cliente: "María González Pérez",
    polizaActual: "POL-2024-001",
    tipoActual: "Automóvil",
    oportunidad: "Seguro de Vida",
    tipoOportunidad: "vida",
    scoring: 92,
    probabilidad: 87,
    valorEstimado: "$2,400,000",
    razonamiento: "Cliente con familia joven, ingresos estables y sin seguro de vida. Perfil ideal para protección familiar.",
    estado: "Alta Prioridad",
    estadoColor: "failure",
    fechaDeteccion: "10/12/2024",
    accionRecomendada: "Llamada personalizada"
  },
  {
    id: "OPO-002",
    cliente: "Carlos Mendoza Silva",
    polizaActual: "POL-2024-002",
    tipoActual: "Vida",
    oportunidad: "Seguro de Hogar",
    tipoOportunidad: "hogar",
    scoring: 85,
    probabilidad: 78,
    valorEstimado: "$1,800,000",
    razonamiento: "Recién adquirió vivienda propia según registros. Necesita proteger su patrimonio inmobiliario.",
    estado: "Media Prioridad",
    estadoColor: "warning",
    fechaDeteccion: "09/12/2024",
    accionRecomendada: "Email con cotización"
  },
  {
    id: "OPO-003",
    cliente: "Ana Rodríguez López",
    polizaActual: "POL-2024-003",
    tipoActual: "Hogar",
    oportunidad: "Seguro de Salud",
    tipoOportunidad: "salud",
    scoring: 88,
    probabilidad: 82,
    valorEstimado: "$3,200,000",
    razonamiento: "Edad 45 años, sin cobertura de salud privada. Historial de consultas médicas frecuentes.",
    estado: "Alta Prioridad",
    estadoColor: "failure",
    fechaDeteccion: "08/12/2024",
    accionRecomendada: "Reunión presencial"
  },
  {
    id: "OPO-004",
    cliente: "Roberto Vargas Morales",
    polizaActual: "POL-2024-006",
    tipoActual: "Empresarial",
    oportunidad: "Seguro de Automóvil",
    tipoOportunidad: "auto",
    scoring: 76,
    probabilidad: 65,
    valorEstimado: "$1,500,000",
    razonamiento: "Empresa en crecimiento, necesidad de flota vehicular para operaciones comerciales.",
    estado: "Baja Prioridad",
    estadoColor: "info",
    fechaDeteccion: "07/12/2024",
    accionRecomendada: "WhatsApp informativo"
  },
  {
    id: "OPO-005",
    cliente: "Patricia Jiménez Ruiz",
    polizaActual: "POL-2024-005",
    tipoActual: "Salud",
    oportunidad: "Seguro Empresarial",
    tipoOportunidad: "empresarial",
    scoring: 94,
    probabilidad: 91,
    valorEstimado: "$8,400,000",
    razonamiento: "CEO de empresa mediana sin cobertura empresarial. Alto potencial de ventas por volumen.",
    estado: "Crítica",
    estadoColor: "purple",
    fechaDeteccion: "06/12/2024",
    accionRecomendada: "Visita ejecutiva"
  }
];

const getTipoIcon = (tipo: string) => {
  switch (tipo) {
    case 'vida':
      return 'solar:heart-bold-duotone';
    case 'auto':
      return 'solar:car-bold-duotone';
    case 'hogar':
      return 'solar:home-bold-duotone';
    case 'salud':
      return 'solar:medical-kit-bold-duotone';
    case 'empresarial':
      return 'solar:buildings-bold-duotone';
    default:
      return 'solar:shield-check-bold-duotone';
  }
};

const getTipoColor = (tipo: string) => {
  switch (tipo) {
    case 'vida':
      return 'text-error';
    case 'auto':
      return 'text-primary';
    case 'hogar':
      return 'text-success';
    case 'salud':
      return 'text-info';
    case 'empresarial':
      return 'text-warning';
    default:
      return 'text-gray-500';
  }
};

const columnHelper = createColumnHelper<OportunidadType>();

const columns = [
  columnHelper.accessor('cliente', {
    cell: info => (
      <div>
        <h6 className="text-base font-semibold text-dark dark:text-white">
          {info.getValue()}
        </h6>
        <p className="text-sm text-darklink dark:text-bodytext">
          {info.row.original.tipoActual} • {info.row.original.polizaActual}
        </p>
      </div>
    ),
    header: () => <span>Cliente</span>,
    meta: {
      sortType: 'alphanumeric',
    }
  }),
  columnHelper.accessor('oportunidad', {
    cell: info => (
      <div className="flex items-center gap-2">
        <Icon 
          icon={getTipoIcon(info.row.original.tipoOportunidad)} 
          className={getTipoColor(info.row.original.tipoOportunidad)}
          width={20} 
        />
        <div>
          <span className="font-medium text-dark dark:text-white">
            {info.getValue()}
          </span>
          <div className="text-xs text-gray-500">
            {info.row.original.valorEstimado}
          </div>
        </div>
      </div>
    ),
    header: () => <span>Oportunidad</span>,
    meta: {
      sortType: 'alphanumeric',
    }
  }),
  columnHelper.accessor('scoring', {
    cell: info => (
      <div className="w-full">
        <div className="flex justify-between items-center mb-1">
          <span className="text-sm font-medium text-dark dark:text-white">
            {info.getValue()}%
          </span>
          <span className="text-xs text-gray-500">
            {info.row.original.probabilidad}% prob.
          </span>
        </div>
        <Progress 
          progress={info.getValue()} 
          color={info.getValue() >= 90 ? "red" : info.getValue() >= 80 ? "yellow" : "blue"}
          size="sm"
        />
      </div>
    ),
    header: () => <span>Scoring IA</span>,
    meta: {
      sortType: 'numeric',
    }
  }),
  columnHelper.accessor('estado', {
    cell: info => (
      <Badge color={info.row.original.estadoColor} className="capitalize">
        {info.getValue()}
      </Badge>
    ),
    header: () => <span>Prioridad</span>,
    meta: {
      sortType: 'alphanumeric',
    }
  }),
  columnHelper.accessor('fechaDeteccion', {
    cell: info => (
      <div>
        <span className="text-sm text-darklink dark:text-bodytext">
          {info.getValue()}
        </span>
        <div className="text-xs text-gray-500">
          {info.row.original.accionRecomendada}
        </div>
      </div>
    ),
    header: () => <span>Detección</span>,
  }),
  columnHelper.accessor('id', {
    id: 'actions',
    cell: (info) => (
      <div className="flex gap-2">
        <Button size="xs" color="primary" title="Ver análisis completo">
          <Icon icon="solar:eye-bold" width={16} />
        </Button>
        <Button size="xs" color="success" title="Iniciar contacto">
          <Icon icon="solar:phone-bold" width={16} />
        </Button>
        <Button size="xs" color="info" title="Generar propuesta">
          <Icon icon="solar:document-text-bold" width={16} />
        </Button>
        <Button size="xs" color="light" className="!text-gray-500" title="Descartar">
          <Icon icon="solar:close-circle-bold" width={16} />
        </Button>
      </div>
    ),
    header: () => <span>Acciones</span>,
  }),
];

const VentasCruzadas = () => {
  const [data] = useState<OportunidadType[]>(oportunidadesData);
  const [sorting, setSorting] = useState<SortingState>([]);
  const { isBorderRadius } = useContext(CustomizerContext);

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    state: {
      sorting
    },
    onSortingChange: setSorting,
  });

  const handleDownload = () => {
    const headers = ["Cliente", "Póliza Actual", "Oportunidad", "Scoring", "Probabilidad", "Valor", "Estado"];
    const rows = data.map(item => [
      item.cliente,
      item.polizaActual,
      item.oportunidad,
      item.scoring,
      item.probabilidad,
      item.valorEstimado,
      item.estado
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(e => e.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "oportunidades-ventas-cruzadas.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Estadísticas
  const totalOportunidades = data.length;
  const altaPrioridad = data.filter(o => o.estado === 'Alta Prioridad' || o.estado === 'Crítica').length;
  const valorTotal = data.reduce((acc, o) => acc + parseFloat(o.valorEstimado.replace(/[$,]/g, '')), 0);
  const scoringPromedio = data.reduce((acc, o) => acc + o.scoring, 0) / data.length;

  return (
    <>
      <BreadcrumbComp title="Ventas cruzadas" items={BCrumb} />
      
      {/* Estadísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-primary/10 rounded-lg">
              <Icon icon="solar:target-bold" className="text-primary" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{totalOportunidades}</h3>
              <p className="text-sm text-gray-500">Oportunidades Detectadas</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-failure/10 rounded-lg">
              <Icon icon="solar:fire-bold" className="text-failure" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{altaPrioridad}</h3>
              <p className="text-sm text-gray-500">Alta Prioridad</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-success/10 rounded-lg">
              <Icon icon="solar:dollar-bold" className="text-success" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">
                ${(valorTotal / 1000000).toFixed(1)}M
              </h3>
              <p className="text-sm text-gray-500">Valor Potencial</p>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-info/10 rounded-lg">
              <Icon icon="solar:chart-bold" className="text-info" width={24} />
            </div>
            <div>
              <h3 className="text-2xl font-bold text-dark dark:text-white">{scoringPromedio.toFixed(1)}%</h3>
              <p className="text-sm text-gray-500">Scoring Promedio</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Header con botones */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-dark dark:text-white">Oportunidades de Ventas Cruzadas</h2>
        <div className="flex gap-3">
          <Button
            color="light"
            size="sm"
            onClick={handleDownload}
          >
            <Icon icon="solar:download-minimalistic-bold-duotone" className="mr-2" width={16} />
            Exportar
          </Button>
          <Button
            color="info"
            size="sm"
          >
            <Icon icon="solar:refresh-bold" className="mr-2" width={16} />
            Actualizar IA
          </Button>
          <Button
            color="success"
            size="sm"
          >
            <Icon icon="solar:phone-calling-bold" className="mr-2" width={16} />
            Campaña Masiva
          </Button>
        </div>
      </div>

      {/* Información de IA */}
      <Card className="mb-6 p-4">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-primary/10 rounded-lg">
            <Icon icon="solar:cpu-bolt-bold" className="text-primary" width={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-dark dark:text-white mb-2">
              Análisis Inteligente de Oportunidades
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-3">
              Nuestro algoritmo de IA analiza el perfil completo de cada cliente, incluyendo datos demográficos, 
              historial de pólizas, comportamiento de pago y patrones de consumo para identificar las mejores 
              oportunidades de ventas cruzadas.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Icon icon="solar:check-circle-bold" className="text-success" width={16} />
                <span>Análisis de 150+ variables</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon icon="solar:check-circle-bold" className="text-success" width={16} />
                <span>Actualización en tiempo real</span>
              </div>
              <div className="flex items-center gap-2">
                <Icon icon="solar:check-circle-bold" className="text-success" width={16} />
                <span>Precisión del 89%</span>
              </div>
            </div>
          </div>
        </div>
      </Card>
      
      <Card 
        className="p-0"
        style={{
          borderRadius: `${isBorderRadius}px`,
        }}
      >
        <div 
          className="overflow-hidden"
          style={{
            borderRadius: `${isBorderRadius}px`,
          }}
        >
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id} className="bg-gray-50 dark:bg-darkgray">
                    {headerGroup.headers.map(header => (
                      <th
                        key={header.id}
                        className="px-6 py-4 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-2">
                          {header.isPlaceholder ? null : (
                            <>
                              {flexRender(header.column.columnDef.header, header.getContext())}
                              {{
                                asc: <Icon icon="solar:alt-arrow-up-linear" width={16} />,
                                desc: <Icon icon="solar:alt-arrow-down-linear" width={16} />,
                              }[header.column.getIsSorted() as string] ?? (
                                header.column.getCanSort() ? (
                                  <Icon icon="solar:sort-vertical-linear" width={16} className="opacity-50" />
                                ) : null
                              )}
                            </>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="bg-white dark:bg-dark divide-y divide-gray-200 dark:divide-gray-700">
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="hover:bg-gray-50 dark:hover:bg-darkgray transition-colors">
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-6 py-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
    </>
  );
};

export default VentasCruzadas;
