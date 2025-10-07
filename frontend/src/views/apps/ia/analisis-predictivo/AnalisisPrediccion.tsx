import { useMemo } from 'react';
import { useLocation, useParams, useNavigate } from 'react-router-dom';
import { Card, Badge, Button, Progress, Alert } from 'flowbite-react';
import { Icon } from '@iconify/react';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import type { PrediccionType } from './Predicciones';
import { prediccionesData } from './Predicciones';

const BCrumb = [
  { to: '/', title: 'Dashboard' },
  { to: '/apps/ia', title: 'Inteligencia Artificial' },
  { to: '/apps/ia/analisis-predictivo', title: 'Análisis Predictivo' },
  { to: '/apps/ia/analisis-predictivo/predicciones', title: 'Predicciones' },
  { title: 'Análisis Completo' },
];

const getImpactoColor = (impacto: string) => {
  switch (impacto) {
    case 'alto':
      return 'failure';
    case 'medio':
      return 'warning';
    case 'bajo':
      return 'info';
    default:
      return 'gray';
  }
};

const getTendenciaIcon = (tendencia: string) => {
  switch (tendencia) {
    case 'positiva':
      return 'solar:arrow-up-bold';
    case 'negativa':
      return 'solar:arrow-down-bold';
    case 'estable':
      return 'solar:arrow-right-bold';
    default:
      return 'solar:minus-bold';
  }
};

const buildSeries = (tipo: PrediccionType['tipo']) => {
  // Datos de ejemplo por tipo para el gráfico principal
  const base = [
    { mes: 'Ene', real: 2.1, prediccion: 2.4 },
    { mes: 'Feb', real: 2.2, prediccion: 2.5 },
    { mes: 'Mar', real: 2.4, prediccion: 2.7 },
    { mes: 'Abr', real: 2.6, prediccion: 2.9 },
    { mes: 'May', real: 2.7, prediccion: 3.0 },
    { mes: 'Jun', real: 2.8, prediccion: 3.1 },
  ];
  switch (tipo) {
    case 'ventas':
      return base.map((d, i) => ({ ...d, real: d.real * (1.2 + i * 0.05), prediccion: d.prediccion * (1.25 + i * 0.05) }));
    case 'renovacion':
      return base.map((d, i) => ({ ...d, real: d.real * (1.0 + i * 0.03), prediccion: d.prediccion * (1.05 + i * 0.03) }));
    case 'abandono':
      return base.map((d, i) => ({ ...d, real: d.real * (1.1 - i * 0.02), prediccion: d.prediccion * (1.08 - i * 0.02) }));
    case 'fraude':
      return base.map((d, i) => ({ ...d, real: d.real * (0.9 + i * 0.01), prediccion: d.prediccion * (0.95 + i * 0.01) }));
    default:
      return base;
  }
};

export default function AnalisisPrediccion() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const prediccionFromState: PrediccionType | undefined = (location.state as any)?.prediccion;

  const prediccion = useMemo(() => {
    if (prediccionFromState) return prediccionFromState;
    return prediccionesData.find((p) => p.id === id) || null;
  }, [id, prediccionFromState]);

  if (!prediccion) {
    return (
      <div className="space-y-4">
        <BreadcrumbComp title="Análisis Completo" items={BCrumb} />
        <Alert color="failure">
          <div className="flex items-center gap-2">
            <Icon icon="solar:danger-triangle-bold" width={18} />
            <span>No se encontró la predicción solicitada.</span>
          </div>
        </Alert>
        <Button color="light" onClick={() => navigate(-1)}>Volver</Button>
      </div>
    );
  }

  const series = buildSeries(prediccion.tipo);

  return (
    <>
      <BreadcrumbComp title="Análisis Completo" items={BCrumb} />

      <div className="flex justify-between items-start mb-6">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <Icon icon="solar:chart-bold" className="text-primary" width={28} />
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-dark dark:text-white">{prediccion.titulo}</h2>
            <p className="text-sm text-gray-500">ID: {prediccion.id} · {prediccion.fecha}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge color={getImpactoColor(prediccion.impacto)} className="capitalize">
            {prediccion.impacto} impacto
          </Badge>
          <Icon
            icon={getTendenciaIcon(prediccion.tendencia)}
            className={prediccion.tendencia === 'positiva' ? 'text-success' : prediccion.tendencia === 'negativa' ? 'text-error' : 'text-gray-500'}
            width={18}
          />
        </div>
      </div>

      <Alert color="info" className="mb-6">
        <Icon icon="solar:cpu-bolt-bold" className="mr-2" width={16} />
        <span>
          Este análisis profundiza en los factores que influyen en la predicción seleccionada, incluyendo tendencias, métricas clave e impacto estimado.
        </span>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="p-5">
          <p className="text-xs text-gray-500 mb-2">Confianza del Modelo</p>
          <div className="flex items-center gap-2">
            <Progress progress={prediccion.confianza} color="blue" className="flex-1" />
            <span className="text-sm font-semibold">{prediccion.confianza}%</span>
          </div>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-gray-500 mb-1">Valor Predicho</p>
          <p className="text-xl font-semibold text-dark dark:text-white">{prediccion.valor}</p>
          <p className="text-xs text-gray-500">Cambio: {prediccion.cambio}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-gray-500 mb-1">Estado</p>
          <p className="text-sm font-semibold capitalize">{prediccion.estado}</p>
        </Card>
      </div>

      <Card className="p-6 mb-6">
        <h3 className="text-lg font-semibold text-dark dark:text-white mb-4">Tendencia Principal</h3>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={series}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="mes" />
            <YAxis />
            <Tooltip />
            <Line type="monotone" dataKey="real" stroke="#3B82F6" strokeWidth={2} name="Real" />
            <Line type="monotone" dataKey="prediccion" stroke="#10B981" strokeWidth={2} strokeDasharray="5 5" name="Predicción" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-6 mb-6">
        <h3 className="text-lg font-semibold text-dark dark:text-white mb-4">Impacto Estimado</h3>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={series.map((d) => ({ categoria: d.mes, impacto: (d.prediccion - (d.real || 0)) * 100000 }))}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="categoria" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="impacto" fill="#F59E0B" name="Impacto" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="flex justify-end gap-2">
        <Button color="light" onClick={() => navigate('/apps/ia/analisis-predictivo/predicciones')}>
          <Icon icon="solar:arrow-left-bold" className="mr-1" width={16} />
          Volver a Predicciones
        </Button>
        <Button color="primary">
          <Icon icon="solar:download-minimalistic-bold" className="mr-1" width={16} />
          Exportar Análisis
        </Button>
      </div>
    </>
  );
}
