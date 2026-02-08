import { useState, useContext, useEffect } from 'react';
import { useReactTable, createColumnHelper, flexRender, getCoreRowModel, getSortedRowModel, SortingState } from '@tanstack/react-table';
import { Badge, Button, Progress, Card, Spinner } from 'flowbite-react';
import { Icon } from '@iconify/react';
import HeroButton from 'src/components/HeroButton';
import { Link } from 'react-router';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { CustomizerContext } from 'src/context/CustomizerContext';
import { siniestroService, Siniestro, TIPOS_SINIESTRO, ESTADOS, PRIORIDADES } from '../../../../services/siniestroService';

const BCrumb = [
  {
    to: "/",
    title: "Dashboard",
  },
  {
    to: "/apps/seguros",
    title: "Seguros",
  },
  {
    title: "Siniestros Activos",
  },
];

const columnHelper = createColumnHelper<Siniestro>();

const columns = [
  columnHelper.accessor('numero_siniestro', {
    cell: info => (
      <div className="font-medium text-dark dark:text-white">
        {info.getValue()}
      </div>
    ),
    header: () => <span>Número</span>,
    meta: {
      sortType: 'alphanumeric',
    }
  }),
  columnHelper.accessor('cliente', {
    cell: info => (
      <div>
        <h6 className="text-base font-semibold text-dark dark:text-white">
          {info.getValue()?.nombre || 'N/A'}
        </h6>
        <p className="text-sm text-darklink dark:text-bodytext">
          {info.row.original.numero_poliza}
        </p>
      </div>
    ),
    header: () => <span>Cliente</span>,
    meta: {
      sortType: 'alphanumeric',
    }
  }),
  columnHelper.accessor('tipo_siniestro', {
    cell: info => (
      <span className="text-sm text-darklink dark:text-bodytext">
        {(TIPOS_SINIESTRO as any)[info.getValue()] || info.getValue()}
      </span>
    ),
    header: () => <span>Tipo de Siniestro</span>,
    meta: {
      sortType: 'alphanumeric',
    }
  }),
  columnHelper.accessor('fecha_ocurrencia', {
    cell: info => (
      <span className="text-sm text-darklink dark:text-bodytext">
        {new Date(info.getValue()).toLocaleDateString('es-CO')}
      </span>
    ),
    header: () => <span>Fecha</span>,
  }),
  columnHelper.accessor('monto_reclamado', {
    cell: info => (
      <span className="text-sm font-semibold text-dark dark:text-white">
        {new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: 'COP',
          minimumFractionDigits: 0
        }).format(info.getValue())}
      </span>
    ),
    header: () => <span>Monto</span>,
  }),
  columnHelper.accessor('prioridad', {
    cell: info => {
      const colorMap: Record<string, string> = {
        'baja': 'gray',
        'media': 'warning',
        'alta': 'failure',
        'critica': 'purple'
      };
      return (
        <Badge color={colorMap[info.getValue()] || 'gray'} className="capitalize">
          {(PRIORIDADES as any)[info.getValue()] || info.getValue()}
        </Badge>
      );
    },
    header: () => <span>Prioridad</span>,
    meta: {
      sortType: 'alphanumeric',
    }
  }),
  columnHelper.accessor('estado', {
    cell: info => {
      const colorMap: Record<string, string> = {
        'reportado': 'info',
        'en_revision': 'warning',
        'investigacion': 'purple',
        'aprobado': 'success',
        'rechazado': 'failure',
        'pagado': 'success'
      };
      
      const getProgressPercentage = (estado: string) => {
        const estados = ['reportado', 'en_revision', 'investigacion', 'aprobado', 'pagado'];
        const index = estados.indexOf(estado);
        return estado === 'rechazado' ? 100 : ((index + 1) / estados.length) * 100;
      };

      return (
        <div className="space-y-2">
          <Badge color={colorMap[info.getValue()] || 'gray'} className="capitalize">
            {(ESTADOS as any)[info.getValue()] || info.getValue().replace('_', ' ')}
          </Badge>
          <div className="w-full">
            <Progress 
              progress={getProgressPercentage(info.getValue())} 
              size="sm"
              color={info.getValue() === 'rechazado' ? 'red' : 'blue'}
            />
          </div>
        </div>
      );
    },
    header: () => <span>Estado</span>,
    meta: {
      sortType: 'alphanumeric',
    }
  }),
  columnHelper.display({
    id: 'actions',
    cell: info => (
      <div className="flex items-center gap-2">
        <Button size="xs" color="blue" as={Link} to={`/apps/seguros/siniestros/${info.row.original.id}`}>
          <Icon icon="solar:eye-bold" width={12} />
        </Button>
        <Button size="xs" color="green" as={Link} to={`/apps/seguros/siniestros/editar/${info.row.original.id}`}>
          <Icon icon="solar:pen-bold" width={12} />
        </Button>
      </div>
    ),
    header: () => <span>Acciones</span>,
  }),
];

const SiniestrosActivos = () => {
  const { setIsCollapse } = useContext(CustomizerContext);
  const [siniestros, setSiniestros] = useState<Siniestro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sorting, setSorting] = useState<SortingState>([]);

  useEffect(() => {
    setIsCollapse(false);
    loadSiniestros();
  }, [setIsCollapse]);

  const loadSiniestros = async () => {
    try {
      setLoading(true);
      setError(null);
      // Filtrar solo siniestros activos (no pagados ni cerrados)
      const response = await siniestroService.getSiniestros({
        estado: ['reportado', 'en_revision', 'investigacion', 'aprobado'].join(',')
      });
      setSiniestros(response.data);
    } catch (err) {
      setError('Error al cargar los siniestros activos');
    } finally {
      setLoading(false);
    }
  };

  const table = useReactTable({
    data: siniestros,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  const handleDownload = () => {
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <div className="text-center">
          <Spinner size="xl" />
          <p className="mt-4 text-gray-600">Cargando siniestros activos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <BreadcrumbComp title="Siniestros Activos" items={BCrumb} />
        <Card>
          <div className="p-6 text-center">
            <Icon icon="solar:danger-triangle-bold-duotone" className="text-red-500 mx-auto mb-4" width={64} />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Error al cargar siniestros</h3>
            <p className="text-gray-600 mb-4">{error}</p>
            <Button onClick={loadSiniestros} color="blue">
              Reintentar
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <>
      <BreadcrumbComp title="Siniestros Activos" items={BCrumb} />
      
      <Card className="w-full p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h2 className="text-2xl font-bold text-dark dark:text-white">
              Siniestros Activos
            </h2>
            <p className="text-sm text-darklink dark:text-bodytext mt-1">
              {siniestros.length} siniestros en proceso
            </p>
          </div>
          <div className="flex gap-3">
            <Button color="light" onClick={handleDownload}>
              <Icon icon="solar:download-bold" className="mr-2" width={16} />
              Descargar
            </Button>
            <Link to="/apps/seguros/siniestros/nuevo">
              <HeroButton icon="solar:add-circle-bold">Nuevo Siniestro</HeroButton>
            </Link>
          </div>
        </div>

        {siniestros.length === 0 ? (
          <div className="text-center py-8">
            <Icon icon="solar:file-smile-bold-duotone" className="text-gray-400 mx-auto mb-4" width={64} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay siniestros activos</h3>
            <p className="text-gray-500">Todos los siniestros han sido procesados.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-darklink dark:text-white">
              <thead className="bg-gray-50 dark:bg-darkgray text-xs uppercase text-gray-700 dark:text-gray-400">
                {table.getHeaderGroups().map(headerGroup => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map(header => (
                      <th
                        key={header.id}
                        scope="col"
                        className="px-6 py-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-dark"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        <div className="flex items-center gap-2">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getIsSorted() && (
                            <Icon 
                              icon={header.column.getIsSorted() === 'asc' ? 'solar:sort-vertical-bold' : 'solar:sort-vertical-bold'} 
                              width={14} 
                              className={header.column.getIsSorted() === 'desc' ? 'rotate-180' : ''}
                            />
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {table.getRowModel().rows.map(row => (
                  <tr key={row.id} className="border-b bg-white hover:bg-gray-50 dark:border-strokedark dark:bg-boxdark dark:hover:bg-darkgray">
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
        )}
      </Card>
    </>
  );
};

export default SiniestrosActivos; 