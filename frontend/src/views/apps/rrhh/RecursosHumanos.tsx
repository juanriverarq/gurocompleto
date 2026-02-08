import { Card, Badge, Button, Progress, Alert, Table, Tabs } from 'flowbite-react';
import { Icon } from '@iconify/react';
import HeroButton from 'src/components/HeroButton';
import BreadcrumbComp from 'src/layouts/full/shared/breadcrumb/BreadcrumbComp';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell } from 'recharts';
import { useNavigate } from 'react-router-dom';

const BCrumb = [
  { to: '/', title: 'Dashboard' },
  { to: '/apps', title: 'Apps' },
  { title: 'Recursos Humanos' },
];

const kpis = [
  { icon: 'solar:users-group-two-rounded-bold-duotone', label: 'Colaboradores', value: 124, color: 'primary' },
  { icon: 'solar:bag-smile-bold-duotone', label: 'Vacantes Activas', value: 8, color: 'info' },
  { icon: 'solar:chart-2-bold-duotone', label: 'NPS Interno', value: '74', color: 'success' },
  { icon: 'solar:clock-circle-bold-duotone', label: 'Time-to-Hire', value: '18 días', color: 'warning' },
];

const rotacionSeries = [
  { mes: 'Ene', tasa: 2.4 },
  { mes: 'Feb', tasa: 2.1 },
  { mes: 'Mar', tasa: 2.0 },
  { mes: 'Abr', tasa: 1.8 },
  { mes: 'May', tasa: 2.2 },
  { mes: 'Jun', tasa: 1.9 },
];

const headcountSeries = [
  { mes: 'Ene', total: 118 },
  { mes: 'Feb', total: 120 },
  { mes: 'Mar', total: 121 },
  { mes: 'Abr', total: 122 },
  { mes: 'May', total: 124 },
  { mes: 'Jun', total: 124 },
];

const engagementData = [
  { name: 'Compromiso', value: 72, color: '#3B82F6' },
  { name: 'Satisfacción', value: 63, color: '#10B981' },
  { name: 'Clima', value: 81, color: '#F59E0B' },
];

const vacantes = [
  { id: 'VAC-001', cargo: 'Frontend Developer', area: 'Tecnología', modalidad: 'Remoto', ubicacion: 'LatAm', estado: 'Activa' },
  { id: 'VAC-002', cargo: 'HR Business Partner', area: 'RR.HH.', modalidad: 'Híbrido', ubicacion: 'Bogotá', estado: 'Activa' },
  { id: 'VAC-003', cargo: 'Sales Executive', area: 'Ventas', modalidad: 'Presencial', ubicacion: 'CDMX', estado: 'Entrevistas' },
];

const planes = [
  { id: 'plan-1', nombre: 'Onboarding', progreso: 78 },
  { id: 'plan-2', nombre: 'Formación Liderazgo', progreso: 42 },
  { id: 'plan-3', nombre: 'HS & Bienestar', progreso: 66 },
];

export default function RecursosHumanos() {
  const navigate = useNavigate();
  return (
    <>
      <BreadcrumbComp title="Recursos Humanos" items={BCrumb} />

      {/* Hero / Header */}
      <Card className="p-6 mb-6 bg-gradient-to-r from-primary/10 to-info/10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-dark dark:text-white mb-2">Gestiona el ciclo de vida del talento</h1>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl">Atracción, onboarding, desarrollo, desempeño y bienestar en un solo lugar. KPIs accionables y procesos inteligentes.</p>
          </div>
          <div className="flex gap-2">
            <Button color="primary" onClick={() => navigate('/apps/recursos-humanos/nueva')}>
              <Icon icon="solar:add-square-bold" className="mr-2" width={18} />
              Nueva Vacante
            </Button>
            <Button color="light">
              <Icon icon="solar:import-bold" className="mr-2" width={18} />
              Importar CSV
            </Button>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
        {kpis.map((kpi) => (
          <Card key={kpi.label} className="p-5">
            <div className="flex items-center gap-3">
              <div className={`p-3 rounded-lg bg-${kpi.color}/10`}>
                <Icon icon={kpi.icon} className={`text-${kpi.color}`} width={22} />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-dark dark:text-white">{kpi.value}</h3>
                <p className="text-xs text-gray-500">{kpi.label}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-dark dark:text-white mb-4">Rotación Trimestral (%)</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={rotacionSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="tasa" stroke="#EF4444" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-dark dark:text-white mb-4">Headcount</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={headcountSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="mes" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="total" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Engagement */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-dark dark:text-white mb-4">Engagement</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={engagementData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={5} dataKey="value">
                {engagementData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 mt-3">
            {engagementData.map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: e.color }} />
                <span className="text-xs text-gray-600">{e.name}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card className="p-6 lg:col-span-2">
          <h3 className="text-lg font-semibold text-dark dark:text-white mb-4">Programas y Planes</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {planes.map((p) => (
              <Card key={p.id} className="p-4">
                <p className="text-xs text-gray-500 mb-1">{p.nombre}</p>
                <div className="flex items-center gap-2">
                  <Progress progress={p.progreso} color={p.progreso > 70 ? 'success' : p.progreso > 40 ? 'warning' : 'blue'} className="flex-1" />
                  <span className="text-sm font-semibold">{p.progreso}%</span>
                </div>
              </Card>
            ))}
          </div>
        </Card>
      </div>

      {/* Vacantes */}
      <Card className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-dark dark:text-white">Vacantes Activas</h3>
          <Button color="light"><Icon icon="solar:download-minimalistic-bold" className="mr-2" width={16} />Exportar</Button>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <Table.Head>
              <Table.HeadCell>ID</Table.HeadCell>
              <Table.HeadCell>Cargo</Table.HeadCell>
              <Table.HeadCell>Área</Table.HeadCell>
              <Table.HeadCell>Modalidad</Table.HeadCell>
              <Table.HeadCell>Ubicación</Table.HeadCell>
              <Table.HeadCell>Estado</Table.HeadCell>
              <Table.HeadCell>
                <span className="sr-only">Acciones</span>
              </Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {vacantes.map((v) => (
                <Table.Row key={v.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                  <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">{v.id}</Table.Cell>
                  <Table.Cell>{v.cargo}</Table.Cell>
                  <Table.Cell>{v.area}</Table.Cell>
                  <Table.Cell>{v.modalidad}</Table.Cell>
                  <Table.Cell>{v.ubicacion}</Table.Cell>
                  <Table.Cell>
                    <Badge color={v.estado === 'Activa' ? 'success' : 'warning'} className="capitalize">{v.estado}</Badge>
                  </Table.Cell>
                  <Table.Cell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button size="xs" color="light" onClick={() => navigate(`/apps/recursos-humanos/${v.id}/editar`)}><Icon icon="solar:eye-bold" width={14} className="mr-1"/>Ver</Button>
                      <Button size="xs" color="primary" onClick={() => navigate(`/apps/recursos-humanos/${v.id}/editar`)}><Icon icon="solar:pen-bold" width={14} className="mr-1"/>Editar</Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      </Card>

      {/* Tabs de RRHH */}
      <Card className="p-6 mb-6">
        <Tabs aria-label="RRHH Tabs">
          <Tabs.Item active title="Onboarding" icon={undefined}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="p-4">
                <h4 className="font-semibold mb-2">Tareas Semana 1</h4>
                <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
                  <li>Documentación y contratos</li>
                  <li>Asignación de equipo</li>
                  <li>Inducción de cultura y valores</li>
                </ul>
              </Card>
              <Card className="p-4">
                <h4 className="font-semibold mb-2">Checklist IT</h4>
                <ul className="text-sm text-gray-600 list-disc pl-5 space-y-1">
                  <li>Accesos a sistemas</li>
                  <li>Correo y MFA</li>
                  <li>Configuración de laptop</li>
                </ul>
              </Card>
            </div>
          </Tabs.Item>
          <Tabs.Item title="Desempeño" icon={undefined}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <p className="text-xs text-gray-500 mb-1">Ciclos cerrados</p>
                <h4 className="text-xl font-semibold">3</h4>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-gray-500 mb-1">Pendientes</p>
                <h4 className="text-xl font-semibold">12</h4>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-gray-500 mb-1">Promedio metas</p>
                <h4 className="text-xl font-semibold">86%</h4>
              </Card>
            </div>
          </Tabs.Item>
          <Tabs.Item title="Capacitación" icon={undefined}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4">
                <p className="text-xs text-gray-500 mb-1">Horas promedio</p>
                <h4 className="text-xl font-semibold">6.2 h/mes</h4>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-gray-500 mb-1">Cursos activos</p>
                <h4 className="text-xl font-semibold">14</h4>
              </Card>
              <Card className="p-4">
                <p className="text-xs text-gray-500 mb-1">Completion rate</p>
                <h4 className="text-xl font-semibold">71%</h4>
              </Card>
            </div>
          </Tabs.Item>
        </Tabs>
      </Card>

      {/* Módulos detallados */}
      <div className="grid grid-cols-1 gap-6 mb-6">
        {/* Gestión de Personas */
        }
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-dark dark:text-white">Gestión de Personas</h3>
            <div className="flex gap-2">
              <Button color="light" onClick={() => navigate('/apps/recursos-humanos/personas')}>
                <Icon icon="solar:widget-2-bold" className="mr-2" width={16} />Panel
              </Button>
              <HeroButton icon="solar:add-square-bold" onClick={() => navigate('/apps/recursos-humanos/personas')}>Nueva Tarea</HeroButton>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><Icon icon="solar:login-3-bold" width={18} /><h4 className="font-semibold">Onboarding/Offboarding</h4></div>
              <p className="text-sm text-gray-600">Gestiona el ingreso y salida de colaboradores de forma eficiente.</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><Icon icon="solar:calendar-bold" width={18} /><h4 className="font-semibold">Faltas, incapacidades y vacaciones</h4></div>
              <p className="text-sm text-gray-600">Administra ausencias, licencias y permisos con claridad.</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><Icon icon="solar:folder-with-files-bold" width={18} /><h4 className="font-semibold">Administrador de documentos</h4></div>
              <p className="text-sm text-gray-600">Centraliza y gestiona los documentos laborales importantes.</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><Icon icon="solar:arrow-right-up-square-bold" width={18} /><h4 className="font-semibold">Flujos de tareas</h4></div>
              <p className="text-sm text-gray-600">Automatiza y asigna tareas dentro de los procesos de RRHH.</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><Icon icon="solar:signature-bold" width={18} /><h4 className="font-semibold">Firma digital</h4></div>
              <p className="text-sm text-gray-600">Firma documentos oficiales de forma segura y legal.</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><Icon icon="solar:structure-bold" width={18} /><h4 className="font-semibold">Organigrama y directorio</h4></div>
              <p className="text-sm text-gray-600">Visualiza la estructura organizacional y contactos internos.</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><Icon icon="solar:megaphone-bold" width={18} /><h4 className="font-semibold">Comunicación interna</h4></div>
              <p className="text-sm text-gray-600">Conecta a toda la organización con publicaciones y anuncios.</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><Icon icon="solar:gift-bold" width={18} /><h4 className="font-semibold">Beneficios</h4></div>
              <p className="text-sm text-gray-600">Administra beneficios laborales de forma centralizada.</p>
            </Card>
          </div>
        </Card>

        {/* Gestión de Reclutamiento */
        }
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-dark dark:text-white">Gestión de Reclutamiento</h3>
            <div className="flex gap-2">
              <Button color="light" onClick={() => navigate('/apps/recursos-humanos/reclutamiento')}>
                <Icon icon="solar:bag-smile-bold" className="mr-2" width={16} />Panel
              </Button>
              <Button color="primary" onClick={() => navigate('/apps/recursos-humanos/nueva')}>
                <Icon icon="solar:add-square-bold" className="mr-2" width={16} />Nueva Vacante
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><Icon icon="solar:clipboard-list-bold" width={18} /><h4 className="font-semibold">Sistema de seguimiento</h4></div>
              <p className="text-sm text-gray-600">Control organizado del proceso de selección (ATS).</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><Icon icon="solar:ranking-bold" width={18} /><h4 className="font-semibold">Scorecards</h4></div>
              <p className="text-sm text-gray-600">Evalúa de forma estandarizada a los postulantes.</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><Icon icon="solar:user-rounded-bold" width={18} /><h4 className="font-semibold">Perfil del candidato</h4></div>
              <p className="text-sm text-gray-600">Visualiza la información clave de cada postulante.</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><Icon icon="solar:magic-stick-3-bold" width={18} /><h4 className="font-semibold">Matching inteligente</h4></div>
              <p className="text-sm text-gray-600">Conecta candidatos con vacantes compatibles automáticamente.</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><Icon icon="solar:chart-square-bold" width={18} /><h4 className="font-semibold">Pipeline de selección</h4></div>
              <p className="text-sm text-gray-600">Gestiona visualmente el avance del proceso.</p>
            </Card>
          </div>
        </Card>

        {/* Gestión de Desempeño */
        }
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-dark dark:text-white">Gestión de Desempeño</h3>
            <div className="flex gap-2">
              <Button color="light" onClick={() => navigate('/apps/recursos-humanos/desempeno')}>
                <Icon icon="solar:chart-2-bold" className="mr-2" width={16} />Panel
              </Button>
              <Button color="primary" onClick={() => navigate('/apps/recursos-humanos/desempeno')}>
                <Icon icon="solar:document-add-bold" className="mr-2" width={16} />Nueva Evaluación
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><Icon icon="solar:tick-square-bold" width={18} /><h4 className="font-semibold">Evaluación de desempeño</h4></div>
              <p className="text-sm text-gray-600">Mide y analiza el rendimiento del equipo.</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><Icon icon="solar:target-bold" width={18} /><h4 className="font-semibold">OKRs y metas</h4></div>
              <p className="text-sm text-gray-600">Define y sigue objetivos estratégicos.</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><Icon icon="solar:stars-bold" width={18} /><h4 className="font-semibold">Competencias</h4></div>
              <p className="text-sm text-gray-600">Evalúa habilidades clave por rol.</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><Icon icon="solar:message-dots-bold" width={18} /><h4 className="font-semibold">Feedback</h4></div>
              <p className="text-sm text-gray-600">Fomenta retroalimentación continua.</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><Icon icon="solar:route-bold" width={18} /><h4 className="font-semibold">Plan Individual de Desarrollo</h4></div>
              <p className="text-sm text-gray-600">Crea rutas de mejora personalizadas.</p>
            </Card>
          </div>
        </Card>

        {/* Gestión de Clima */
        }
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-dark dark:text-white">Gestión de Clima</h3>
            <div className="flex gap-2">
              <Button color="light" onClick={() => navigate('/apps/recursos-humanos/clima')}>
                <Icon icon="solar:smile-circle-bold" className="mr-2" width={16} />Panel
              </Button>
              <Button color="primary" onClick={() => navigate('/apps/recursos-humanos/clima')}>
                <Icon icon="solar:pen-bold" className="mr-2" width={16} />Nueva Encuesta
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><Icon icon="solar:graph-line-square-bold" width={18} /><h4 className="font-semibold">Encuestas de clima, eNPS y pulsos</h4></div>
              <p className="text-sm text-gray-600">Mide el ambiente laboral y compromiso del equipo.</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-1"><Icon icon="solar:confetti-bold" width={18} /><h4 className="font-semibold">Reconocimiento</h4></div>
              <p className="text-sm text-gray-600">Destaca y celebra los logros de tus colaboradores.</p>
            </Card>
          </div>
        </Card>
      </div>

      {/* FAQ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-dark dark:text-white mb-4">Preguntas Frecuentes</h3>
          <div className="space-y-3 text-sm text-gray-700 dark:text-gray-300">
            <details className="group border rounded-lg p-3">
              <summary className="cursor-pointer font-medium">¿Cómo publico una vacante?</summary>
              <p className="mt-2">Ve a Vacantes Activas, clic en "Nueva Vacante" y completa el formulario con el perfil requerido.</p>
            </details>
            <details className="group border rounded-lg p-3">
              <summary className="cursor-pointer font-medium">¿Puedo importar candidatos desde CSV?</summary>
              <p className="mt-2">Sí, desde el botón Importar CSV en la cabecera. Asegúrate de descargar la plantilla previamente.</p>
            </details>
            <details className="group border rounded-lg p-3">
              <summary className="cursor-pointer font-medium">¿Cómo mido el desempeño?</summary>
              <p className="mt-2">Utiliza el Tab de Desempeño para revisar ciclos, pendientes y el cumplimiento de metas.</p>
            </details>
          </div>
        </Card>
        <Card className="p-6">
          <h3 className="text-lg font-semibold text-dark dark:text-white mb-4">Centro de Anuncios</h3>
          <div className="space-y-3">
            <Alert color="info"><Icon icon="solar:megaphone-bold" className="mr-2" width={16}/> Semana de Bienestar: únete a las actividades de mindfulness.</Alert>
            <Alert color="warning"><Icon icon="solar:calendar-bold" className="mr-2" width={16}/> Cierre de nómina el día 25 a las 4pm.</Alert>
            <Alert color="success"><Icon icon="solar:confetti-bold" className="mr-2" width={16}/> Bienvenidos 6 nuevos ingresos este mes.</Alert>
          </div>
        </Card>
      </div>

      {/* CTA */}
      <Card className="p-6 mb-8 text-center">
        <h3 className="text-xl font-semibold text-dark dark:text-white mb-2">¿Listo para profesionalizar RR.HH.?</h3>
        <p className="text-gray-600 mb-4">Estandariza tus procesos y eleva la experiencia del colaborador.</p>
        <div className="flex gap-2 justify-center">
          <Button color="primary"><Icon icon="solar:magic-stick-3-bold" className="mr-2" width={16}/>Crear Flujo</Button>
          <Button color="light"><Icon icon="solar:book-bookmark-bold" className="mr-2" width={16}/>Ver Guía</Button>
        </div>
      </Card>
    </>
  );
}
