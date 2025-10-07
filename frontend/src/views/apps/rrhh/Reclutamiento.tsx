import { Card, Button, Table, Badge, TextInput, Select, Modal, Label, Pagination } from 'flowbite-react';
import { Icon } from '@iconify/react';
import { useState } from 'react';

type Vacante = {
  id: string;
  cargo: string;
  area: string;
  ubicacion: string;
  estado: 'Activa' | 'En pausa' | 'Cerrada';
  etapa: 'Sourcing' | 'Screening' | 'Entrevistas' | 'Oferta' | 'Contratación';
};

export default function Reclutamiento() {
  const etapas: Vacante['etapa'][] = ['Sourcing', 'Screening', 'Entrevistas', 'Oferta', 'Contratación'];

  const [vista, setVista] = useState<'kanban' | 'tabla'>('tabla');
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [filtroArea, setFiltroArea] = useState('todas');
  const [filtroUbicacion, setFiltroUbicacion] = useState('todas');
  const [modalOpen, setModalOpen] = useState(false);
  const [sortKey, setSortKey] = useState<'cargo' | 'area' | 'ubicacion' | 'estado'>('cargo');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const perPage = 5;

  const [vacantes] = useState<Vacante[]>([
    { id: 'VAC-001', cargo: 'Frontend Developer', area: 'Tecnología', ubicacion: 'Remoto', estado: 'Activa', etapa: 'Sourcing' },
    { id: 'VAC-002', cargo: 'HRBP', area: 'RR.HH.', ubicacion: 'Bogotá', estado: 'Activa', etapa: 'Entrevistas' },
    { id: 'VAC-003', cargo: 'Data Analyst', area: 'BI', ubicacion: 'Medellín', estado: 'Activa', etapa: 'Screening' },
    { id: 'VAC-004', cargo: 'QA Engineer', area: 'Tecnología', ubicacion: 'Remoto', estado: 'En pausa', etapa: 'Sourcing' },
    { id: 'VAC-005', cargo: 'Sales Executive', area: 'Comercial', ubicacion: 'Bogotá', estado: 'Activa', etapa: 'Oferta' },
    { id: 'VAC-006', cargo: 'Backend Developer', area: 'Tecnología', ubicacion: 'Remoto', estado: 'Cerrada', etapa: 'Contratación' },
  ]);

  return (
    <>
      <Card className="p-6 mb-6 bg-gradient-to-r from-emerald-500/10 to-sky-500/10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-dark dark:text-white mb-2">Reclutamiento</h1>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl">Pipeline, scorecards, matching inteligente y gestión de vacantes.</p>
          </div>
          <div className="flex gap-2">
            <Button color="light" onClick={() => setVista(vista === 'tabla' ? 'kanban' : 'tabla')}>
              <Icon icon={vista === 'tabla' ? 'solar:kanban-bold' : 'solar:table-bold'} className="mr-2" width={18} />
              {vista === 'tabla' ? 'Ver Kanban' : 'Ver Tabla'}
            </Button>
            <Button color="primary" onClick={() => setModalOpen(true)}><Icon icon="solar:add-square-bold" className="mr-2" width={18} />Nueva Vacante</Button>
            <Button color="light"><Icon icon="solar:download-minimalistic-bold" className="mr-2" width={18} />Exportar</Button>
          </div>
        </div>
      </Card>

      {/* Toolbar de Filtros y Búsqueda */}
      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <Label htmlFor="search" value="Buscar" className="mb-1 block" />
            <TextInput id="search" placeholder="Buscar por cargo o ID" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="estado" value="Estado" className="mb-1 block" />
            <Select id="estado" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="todos">Todos</option>
              <option>Activa</option>
              <option>En pausa</option>
              <option>Cerrada</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="area" value="Área" className="mb-1 block" />
            <Select id="area" value={filtroArea} onChange={(e) => setFiltroArea(e.target.value)}>
              <option value="todas">Todas</option>
              <option>Tecnología</option>
              <option>RR.HH.</option>
              <option>Comercial</option>
              <option>BI</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="ubicacion" value="Ubicación" className="mb-1 block" />
            <Select id="ubicacion" value={filtroUbicacion} onChange={(e) => setFiltroUbicacion(e.target.value)}>
              <option value="todas">Todas</option>
              <option>Remoto</option>
              <option>Bogotá</option>
              <option>Medellín</option>
            </Select>
          </div>
          <div className="flex items-end">
            <Button color="light" onClick={() => { setSearch(''); setFiltroEstado('todos'); setFiltroArea('todas'); setFiltroUbicacion('todas'); }}>Limpiar</Button>
          </div>
        </div>
      </Card>

      {/* Contenido principal: Kanban o Tabla */}
      {vista === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {etapas.map((etapa) => (
            <Card key={etapa} className="p-3">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold">{etapa}</h4>
                <Badge color="info">{vacantes.filter((v: Vacante) => v.etapa === etapa).length}</Badge>
              </div>
              <div className="space-y-2 min-h-[120px]">
                {vacantes.filter((v: Vacante) => v.etapa === etapa).map((v: Vacante) => (
                  <Card key={v.id} className="p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{v.cargo}</p>
                        <p className="text-xs text-gray-500">{v.area} • {v.ubicacion}</p>
                      </div>
                      <Badge color={v.estado === 'Activa' ? 'success' : v.estado === 'En pausa' ? 'warning' : 'gray'}>{v.estado}</Badge>
                    </div>
                  </Card>
                ))}
                {vacantes.filter((v: Vacante) => v.etapa === etapa).length === 0 && (
                  <p className="text-xs text-gray-500">Sin vacantes en esta etapa</p>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <Table.Head>
                <Table.HeadCell onClick={() => { setSortKey('cargo'); setSortDir(sortKey === 'cargo' && sortDir === 'asc' ? 'desc' : 'asc'); }} className="cursor-pointer">Cargo</Table.HeadCell>
                <Table.HeadCell onClick={() => { setSortKey('area'); setSortDir(sortKey === 'area' && sortDir === 'asc' ? 'desc' : 'asc'); }} className="cursor-pointer">Área</Table.HeadCell>
                <Table.HeadCell onClick={() => { setSortKey('ubicacion'); setSortDir(sortKey === 'ubicacion' && sortDir === 'asc' ? 'desc' : 'asc'); }} className="cursor-pointer">Ubicación</Table.HeadCell>
                <Table.HeadCell onClick={() => { setSortKey('estado'); setSortDir(sortKey === 'estado' && sortDir === 'asc' ? 'desc' : 'asc'); }} className="cursor-pointer">Estado</Table.HeadCell>
                <Table.HeadCell>Etapa</Table.HeadCell>
                <Table.HeadCell className="text-right">Acciones</Table.HeadCell>
              </Table.Head>
              <Table.Body className="divide-y">
                {vacantes
                  .filter((v: Vacante) => (filtroEstado === 'todos' ? true : v.estado === (filtroEstado as Vacante['estado'])))
                  .filter((v: Vacante) => (filtroArea === 'todas' ? true : v.area === filtroArea))
                  .filter((v: Vacante) => (filtroUbicacion === 'todas' ? true : v.ubicacion === filtroUbicacion))
                  .filter((v: Vacante) => (search ? (v.cargo.toLowerCase().includes(search.toLowerCase()) || v.id.toLowerCase().includes(search.toLowerCase())) : true))
                  .sort((a: Vacante, b: Vacante) => {
                    const A = (a[sortKey] as string).toLowerCase();
                    const B = (b[sortKey] as string).toLowerCase();
                    if (A < B) return sortDir === 'asc' ? -1 : 1;
                    if (A > B) return sortDir === 'asc' ? 1 : -1;
                    return 0;
                  })
                  .slice((page - 1) * perPage, page * perPage)
                  .map((v: Vacante) => (
                    <Table.Row key={v.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                      <Table.Cell className="font-medium">{v.cargo}</Table.Cell>
                      <Table.Cell>{v.area}</Table.Cell>
                      <Table.Cell>{v.ubicacion}</Table.Cell>
                      <Table.Cell><Badge color={v.estado === 'Activa' ? 'success' : v.estado === 'En pausa' ? 'warning' : 'gray'}>{v.estado}</Badge></Table.Cell>
                      <Table.Cell>{v.etapa}</Table.Cell>
                      <Table.Cell className="text-right">
                        <div className="flex gap-2 justify-end">
                          <Button size="xs" color="light"><Icon icon="solar:eye-bold" width={14} className="mr-1"/>Ver</Button>
                          <Button size="xs" color="primary"><Icon icon="solar:pen-bold" width={14} className="mr-1"/>Editar</Button>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  ))}
              </Table.Body>
            </Table>
          </div>
          <div className="p-3 flex justify-end">
            <Pagination currentPage={page} onPageChange={setPage} totalPages={Math.max(1, Math.ceil(
              vacantes
                .filter((v: Vacante) => (filtroEstado === 'todos' ? true : v.estado === (filtroEstado as Vacante['estado'])))
                .filter((v: Vacante) => (filtroArea === 'todas' ? true : v.area === filtroArea))
                .filter((v: Vacante) => (filtroUbicacion === 'todas' ? true : v.ubicacion === filtroUbicacion))
                .filter((v: Vacante) => (search ? (v.cargo.toLowerCase().includes(search.toLowerCase()) || v.id.toLowerCase().includes(search.toLowerCase())) : true))
                .length / perPage
            ))} />
          </div>
        </Card>
      )}

      {/* Modal Nueva Vacante */}
      <Modal show={modalOpen} size="lg" onClose={() => setModalOpen(false)} popup>
        <Modal.Header />
        <Modal.Body>
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Nueva Vacante</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="cargo" value="Cargo" className="mb-1 block" />
                <TextInput id="cargo" placeholder="Ej. Backend Developer" />
              </div>
              <div>
                <Label htmlFor="areaVac" value="Área" className="mb-1 block" />
                <Select id="areaVac">
                  <option>Tecnología</option>
                  <option>RR.HH.</option>
                  <option>Comercial</option>
                  <option>BI</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="ubicVac" value="Ubicación" className="mb-1 block" />
                <Select id="ubicVac">
                  <option>Remoto</option>
                  <option>Bogotá</option>
                  <option>Medellín</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="etapaVac" value="Etapa Inicial" className="mb-1 block" />
                <Select id="etapaVac">
                  {etapas.map((e) => (<option key={e}>{e}</option>))}
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button color="light" onClick={() => setModalOpen(false)}>Cancelar</Button>
              <Button color="primary" onClick={() => setModalOpen(false)}>Crear</Button>
            </div>
          </div>
        </Modal.Body>
      </Modal>

      <Card className="p-6 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-dark dark:text-white">Vacantes</h3>
          <div className="flex gap-2">
            <Button size="xs" color="light"><Icon icon="solar:filter-bold" width={14} className="mr-1"/>Filtrar</Button>
            <Button size="xs" color="light"><Icon icon="solar:download-minimalistic-bold" width={14} className="mr-1"/>Exportar</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <Table.Head>
              <Table.HeadCell>ID</Table.HeadCell>
              <Table.HeadCell>Cargo</Table.HeadCell>
              <Table.HeadCell>Área</Table.HeadCell>
              <Table.HeadCell>Ubicación</Table.HeadCell>
              <Table.HeadCell>Estado</Table.HeadCell>
              <Table.HeadCell></Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {vacantes.map((v) => (
                <Table.Row key={v.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                  <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">{v.id}</Table.Cell>
                  <Table.Cell>{v.cargo}</Table.Cell>
                  <Table.Cell>{v.area}</Table.Cell>
                  <Table.Cell>{v.ubicacion}</Table.Cell>
                  <Table.Cell><Badge color={v.estado === 'Activa' ? 'success' : 'warning'}>{v.estado}</Badge></Table.Cell>
                  <Table.Cell className="text-right">
                    <div className="flex gap-2 justify-end">
                      <Button size="xs" color="light"><Icon icon="solar:eye-bold" width={14} className="mr-1"/>Ver</Button>
                      <Button size="xs" color="primary"><Icon icon="solar:pen-bold" width={14} className="mr-1"/>Editar</Button>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      </Card>
    </>
  );
}
