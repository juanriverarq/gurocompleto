import { Card, Button, Table, Badge, TextInput, Select, Modal, Label, Pagination, Alert } from 'flowbite-react';
import { Icon } from '@iconify/react';
import HeroButton from 'src/components/HeroButton';
import { useState } from 'react';

type EstadoEncuesta = 'Programada' | 'En curso' | 'Cerrada';
type TipoEncuesta = 'Clima' | 'eNPS' | 'Pulso';
type Encuesta = {
  id: string;
  nombre: string;
  tipo: TipoEncuesta;
  estado: EstadoEncuesta;
  respuestas: number; // porcentaje o cantidad; aquí representa % respondido
};

export default function Clima() {
  const [encuestas] = useState<Encuesta[]>([
    { id: 'CL-2025-01', nombre: 'Clima General Q1', tipo: 'Clima', estado: 'En curso', respuestas: 68 },
    { id: 'ENPS-2024-12', nombre: 'eNPS Diciembre', tipo: 'eNPS', estado: 'Cerrada', respuestas: 92 },
    { id: 'PLS-2025-02', nombre: 'Pulso Febrero', tipo: 'Pulso', estado: 'Programada', respuestas: 0 },
    { id: 'ENPS-2025-03', nombre: 'eNPS Marzo', tipo: 'eNPS', estado: 'En curso', respuestas: 34 },
  ]);

  // Toolbar filtros/búsqueda
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState<'todos' | TipoEncuesta>('todos');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | EstadoEncuesta>('todos');

  // Orden y paginación
  const [sortKey, setSortKey] = useState<'nombre' | 'tipo' | 'estado' | 'respuestas'>('nombre');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const perPage = 5;
  const [loading] = useState(false);

  // Modal nueva encuesta
  const [modalOpen, setModalOpen] = useState(false);

  // Derivados: filtros, orden, paginación
  const filtered: Encuesta[] = encuestas
    .filter((e: Encuesta) => (filtroTipo === 'todos' ? true : e.tipo === filtroTipo))
    .filter((e: Encuesta) => (filtroEstado === 'todos' ? true : e.estado === filtroEstado))
    .filter((e: Encuesta) => (search ? (
      e.nombre.toLowerCase().includes(search.toLowerCase()) ||
      e.id.toLowerCase().includes(search.toLowerCase())
    ) : true));

  const sorted: Encuesta[] = [...filtered].sort((a: Encuesta, b: Encuesta) => {
    const A = String(a[sortKey]).toLowerCase();
    const B = String(b[sortKey]).toLowerCase();
    if (A < B) return sortDir === 'asc' ? -1 : 1;
    if (A > B) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  const paginated: Encuesta[] = sorted.slice((page - 1) * perPage, page * perPage);

  return (
    <>
      <Card className="p-6 mb-6 bg-gradient-to-r from-teal-500/10 to-amber-500/10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-dark dark:text-white mb-2">Clima y Compromiso</h1>
            <p className="text-gray-600 dark:text-gray-400 max-w-2xl">Encuestas de clima, eNPS, pulsos y reconocimiento para medir y mejorar el ambiente laboral.</p>
          </div>
          <div className="flex gap-2">
            <HeroButton icon="solar:pen-bold" onClick={() => setModalOpen(true)}>Nueva Encuesta</HeroButton>
            <Button color="light"><Icon icon="solar:download-minimalistic-bold" className="mr-2" width={18} />Exportar</Button>
          </div>
        </div>
      </Card>

      {/* KPIs rápidos: eNPS y participación */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">eNPS actual</p>
              <p className="text-2xl font-semibold">+36</p>
            </div>
            <Icon icon="solar:smile-circle-bold" width={28} className="text-emerald-500" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Participación promedio</p>
              <p className="text-2xl font-semibold">64%</p>
            </div>
            <Icon icon="solar:graph-up-bold" width={28} className="text-primary" />
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-500">Encuestas activas</p>
              <p className="text-2xl font-semibold">2</p>
            </div>
            <Icon icon="solar:bell-bing-bold" width={28} className="text-amber-500" />
          </div>
        </Card>
      </div>

      {/* Toolbar filtros/búsqueda */}
      <Card className="p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <Label htmlFor="search" value="Buscar" className="mb-1 block" />
            <TextInput id="search" placeholder="Buscar por nombre o ID" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="tipo" value="Tipo" className="mb-1 block" />
            <Select id="tipo" value={filtroTipo} onChange={(e) => { setFiltroTipo(e.target.value as typeof filtroTipo); setPage(1); }}>
              <option value="todos">Todos</option>
              <option value="Clima">Clima</option>
              <option value="eNPS">eNPS</option>
              <option value="Pulso">Pulso</option>
            </Select>
          </div>
          <div>
            <Label htmlFor="estado" value="Estado" className="mb-1 block" />
            <Select id="estado" value={filtroEstado} onChange={(e) => { setFiltroEstado(e.target.value as typeof filtroEstado); setPage(1); }}>
              <option value="todos">Todos</option>
              <option value="Programada">Programada</option>
              <option value="En curso">En curso</option>
              <option value="Cerrada">Cerrada</option>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Button color="light" onClick={() => { setSearch(''); setFiltroTipo('todos'); setFiltroEstado('todos'); setPage(1); }}>Limpiar</Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1"><Icon icon="solar:graph-line-square-bold" width={18} /><h4 className="font-semibold">Encuestas</h4></div>
          <p className="text-sm text-gray-600">Clima, eNPS y pulsos con reportes y comparativas.</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1"><Icon icon="solar:smile-circle-bold" width={18} /><h4 className="font-semibold">Compromiso</h4></div>
          <p className="text-sm text-gray-600">Indicadores de satisfacción y driver analysis.</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1"><Icon icon="solar:confetti-bold" width={18} /><h4 className="font-semibold">Reconocimiento</h4></div>
          <p className="text-sm text-gray-600">Programas para celebrar logros y comportamientos clave.</p>
        </Card>
      </div>

      <Card className="p-6 mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-dark dark:text-white">Encuestas</h3>
          <div className="flex gap-2">
            <Button size="xs" color="light" onClick={() => setModalOpen(true)}><Icon icon="solar:pen-bold" width={14} className="mr-1"/>Nueva</Button>
            <Button size="xs" color="light"><Icon icon="solar:download-minimalistic-bold" width={14} className="mr-1"/>Exportar</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <Table.Head>
              <Table.HeadCell onClick={() => { setSortKey('nombre'); setSortDir(sortKey === 'nombre' && sortDir === 'asc' ? 'desc' : 'asc'); }} className="cursor-pointer">Nombre</Table.HeadCell>
              <Table.HeadCell onClick={() => { setSortKey('tipo'); setSortDir(sortKey === 'tipo' && sortDir === 'asc' ? 'desc' : 'asc'); }} className="cursor-pointer">Tipo</Table.HeadCell>
              <Table.HeadCell onClick={() => { setSortKey('estado'); setSortDir(sortKey === 'estado' && sortDir === 'asc' ? 'desc' : 'asc'); }} className="cursor-pointer">Estado</Table.HeadCell>
              <Table.HeadCell onClick={() => { setSortKey('respuestas'); setSortDir(sortKey === 'respuestas' && sortDir === 'asc' ? 'desc' : 'asc'); }} className="cursor-pointer">Participación</Table.HeadCell>
              <Table.HeadCell></Table.HeadCell>
            </Table.Head>
            <Table.Body className="divide-y">
              {loading && (
                <Table.Row>
                  <Table.Cell colSpan={5}>
                    <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-2" />
                    <div className="animate-pulse h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                  </Table.Cell>
                </Table.Row>
              )}
              {!loading && paginated.length === 0 && (
                <Table.Row>
                  <Table.Cell colSpan={5}>
                    <div className="text-center text-sm text-gray-500">No hay encuestas para los filtros aplicados.</div>
                  </Table.Cell>
                </Table.Row>
              )}
              {!loading && paginated.map((e: Encuesta) => (
                <Table.Row key={e.id} className="bg-white dark:border-gray-700 dark:bg-gray-800">
                  <Table.Cell className="whitespace-nowrap font-medium text-gray-900 dark:text-white">{e.nombre} <span className="block text-xs text-gray-500">{e.id}</span></Table.Cell>
                  <Table.Cell>{e.tipo}</Table.Cell>
                  <Table.Cell><Badge color={e.estado === 'Cerrada' ? 'success' : e.estado === 'En curso' ? 'warning' : 'purple'}>{e.estado}</Badge></Table.Cell>
                  <Table.Cell>{e.respuestas}%</Table.Cell>
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
        <div className="pt-3 flex justify-end">
          <Pagination currentPage={page} onPageChange={setPage} totalPages={Math.max(1, Math.ceil(filtered.length / perPage))} />
        </div>
      </Card>

      {/* Modal Nueva Encuesta */}
      <Modal show={modalOpen} size="lg" onClose={() => setModalOpen(false)} popup>
        <Modal.Header />
        <Modal.Body>
          <div className="space-y-4">
            <h3 className="text-xl font-semibold">Nueva Encuesta</h3>
            <Alert color="warning">Formulario de ejemplo (sin persistencia). Integraremos backend más adelante.</Alert>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="nombre" value="Nombre" className="mb-1 block" />
                <TextInput id="nombre" placeholder="Nombre de la encuesta" />
              </div>
              <div>
                <Label htmlFor="tipoEnc" value="Tipo" className="mb-1 block" />
                <Select id="tipoEnc" defaultValue="Clima">
                  <option value="Clima">Clima</option>
                  <option value="eNPS">eNPS</option>
                  <option value="Pulso">Pulso</option>
                </Select>
              </div>
              <div>
                <Label htmlFor="estadoEnc" value="Estado" className="mb-1 block" />
                <Select id="estadoEnc" defaultValue="Programada">
                  <option value="Programada">Programada</option>
                  <option value="En curso">En curso</option>
                  <option value="Cerrada">Cerrada</option>
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
    </>
  );
}
