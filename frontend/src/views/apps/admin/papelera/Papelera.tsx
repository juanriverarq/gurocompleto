import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import saasApi from 'src/services/saasApi';
import { useToast } from 'src/hooks/use-toast';

interface Entidad {
  key: string;
  label: string;
  count: number;
}

interface Pagination {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

const Papelera = () => {
  const { toast } = useToast();
  const [entidades, setEntidades] = useState<Entidad[]>([]);
  const [activeKey, setActiveKey] = useState<string>('');
  const [items, setItems] = useState<any[]>([]);
  const [columns, setColumns] = useState<Record<string, string>>({});
  const [pagination, setPagination] = useState<Pagination>({ current_page: 1, last_page: 1, per_page: 25, total: 0 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [confirmAction, setConfirmAction] = useState<null | { type: 'restore' | 'delete'; count: number }>(null);
  const [busy, setBusy] = useState(false);

  const loadEntidades = useCallback(async () => {
    try {
      const res = await saasApi.getPapeleraEntidades();
      if (res.success && res.data) {
        setEntidades(res.data);
        if (!activeKey && res.data.length > 0) setActiveKey(res.data[0].key);
      }
    } catch (e) { /* ignore */ }
  }, [activeKey]);

  const loadItems = useCallback(async () => {
    if (!activeKey) return;
    setLoading(true);
    try {
      const res = await saasApi.getPapeleraItems(activeKey, { page, per_page: 25, search });
      if (res.success && res.data) {
        setItems(res.data.items || []);
        setColumns(res.data.columns || {});
        setPagination(res.data.pagination || { current_page: 1, last_page: 1, per_page: 25, total: 0 });
      }
    } catch (e) { /* ignore */ }
    setLoading(false);
  }, [activeKey, page, search]);

  useEffect(() => { loadEntidades(); }, [loadEntidades]);
  useEffect(() => { loadItems(); setSelectedIds(new Set()); }, [loadItems]);

  const activeEntidad = useMemo(() => entidades.find(e => e.key === activeKey), [entidades, activeKey]);
  const columnEntries = useMemo(() => Object.entries(columns), [columns]);

  const handleSearch = () => { setPage(1); setSearch(searchInput); };
  const handleSwitchTab = (key: string) => {
    setActiveKey(key);
    setSearch(''); setSearchInput(''); setPage(1);
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === items.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(items.map(it => it.id)));
  };

  const executeAction = async () => {
    if (!confirmAction || selectedIds.size === 0) return;
    setBusy(true);
    try {
      const ids = Array.from(selectedIds);
      const res = confirmAction.type === 'restore'
        ? await saasApi.restaurarPapelera(activeKey, ids)
        : await saasApi.eliminarDefinitivoPapelera(activeKey, ids);
      if (res.success) {
        toast({
          title: confirmAction.type === 'restore' ? 'Restaurado' : 'Eliminado definitivamente',
          description: res.message || `${ids.length} registro(s) procesado(s)`,
        });
        setSelectedIds(new Set());
        await loadItems();
        await loadEntidades();
      } else {
        toast({ variant: 'destructive', title: 'Error', description: res.message || 'No se pudo completar la acción' });
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'Error de red' });
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  };

  const exportarCSV = async () => {
    try {
      const blob = await saasApi.exportarPapelera(activeKey, search);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `papelera_${activeKey}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      toast({ variant: 'destructive', title: 'Error', description: 'No se pudo exportar' });
    }
  };

  const formatCellValue = (col: string, val: any): string => {
    if (val == null || val === '') return '—';
    if (col.endsWith('_at') || col.startsWith('fecha_') || col === 'deleted_at' || col === 'created_at' || col === 'start_date' || col === 'end_date' || col === 'due_date') {
      try {
        return new Date(val).toLocaleString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
      } catch { return String(val); }
    }
    if (typeof val === 'number' || (typeof val === 'string' && /^[\d.]+$/.test(val) && col.match(/(amount|total|monto|prima|valor)/i))) {
      return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(Number(val));
    }
    return String(val);
  };

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <Icon icon="solar:trash-bin-trash-bold-duotone" className="w-7 h-7 text-[#573CFF]" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Papelera</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-neutral-400">
          Registros eliminados — puedes restaurarlos, exportarlos o borrarlos definitivamente.
        </p>
      </div>

      {/* Tabs por entidad */}
      <div className="flex flex-wrap gap-2 mb-4 border-b border-gray-200 dark:border-neutral-800">
        {entidades.map(e => (
          <button
            key={e.key}
            onClick={() => handleSwitchTab(e.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeKey === e.key
                ? 'border-[#573CFF] text-[#573CFF]'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-neutral-200'
            }`}
          >
            {e.label}
            <span className={`px-2 py-0.5 text-xs rounded-full ${
              activeKey === e.key
                ? 'bg-[#573CFF] text-white'
                : 'bg-gray-200 dark:bg-neutral-800 text-gray-600 dark:text-neutral-400'
            }`}>{e.count}</span>
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-800">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Icon icon="solar:magnifer-linear" className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width={16} />
          <input
            type="text"
            placeholder="Buscar..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-white dark:bg-neutral-800 border border-gray-300 dark:border-neutral-700 text-sm focus:border-[#573CFF] outline-none"
          />
        </div>
        <button onClick={handleSearch} className="px-3 py-2 rounded-lg bg-gray-200 dark:bg-neutral-700 hover:bg-gray-300 dark:hover:bg-neutral-600 text-sm transition-colors">Buscar</button>

        <div className="ml-auto flex gap-2">
          <button
            onClick={exportarCSV}
            disabled={!activeEntidad?.count}
            className="px-3 py-2 rounded-lg bg-gray-100 dark:bg-neutral-800 hover:bg-gray-200 dark:hover:bg-neutral-700 disabled:opacity-50 border border-gray-300 dark:border-neutral-700 text-sm flex items-center gap-1.5 transition-colors"
            title="Exportar CSV"
          >
            <Icon icon="solar:download-bold-duotone" width={16} /> Exportar
          </button>
          <button
            onClick={() => setConfirmAction({ type: 'restore', count: selectedIds.size })}
            disabled={selectedIds.size === 0}
            className="px-3 py-2 rounded-lg bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 disabled:opacity-50 border border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 text-sm flex items-center gap-1.5 transition-colors"
          >
            <Icon icon="solar:refresh-circle-bold-duotone" width={16} /> Restaurar ({selectedIds.size})
          </button>
          <button
            onClick={() => setConfirmAction({ type: 'delete', count: selectedIds.size })}
            disabled={selectedIds.size === 0}
            className="px-3 py-2 rounded-lg bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 disabled:opacity-50 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 text-sm flex items-center gap-1.5 transition-colors"
          >
            <Icon icon="solar:trash-bin-2-bold-duotone" width={16} /> Eliminar ({selectedIds.size})
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-neutral-900 rounded-lg border border-gray-200 dark:border-neutral-800 overflow-x-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Icon icon="svg-spinners:ring-resize" width={32} className="text-[#573CFF]" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-neutral-500">
            <Icon icon="solar:trash-bin-trash-bold-duotone" width={48} className="mb-3 opacity-40" />
            <p className="text-sm font-medium">Papelera vacía</p>
            <p className="text-xs mt-1">No hay {activeEntidad?.label.toLowerCase()} eliminados.</p>
          </div>
        ) : (
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 dark:bg-neutral-800 text-xs uppercase text-gray-600 dark:text-neutral-400">
              <tr>
                <th className="px-3 py-2.5 w-10">
                  <input
                    type="checkbox"
                    checked={selectedIds.size > 0 && selectedIds.size === items.length}
                    onChange={toggleSelectAll}
                  />
                </th>
                {columnEntries.map(([col, label]) => (
                  <th key={col} className="px-3 py-2.5 font-medium whitespace-nowrap">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-neutral-800">
              {items.map((row) => (
                <tr key={row.id} className={`hover:bg-gray-50 dark:hover:bg-neutral-800/50 ${selectedIds.has(row.id) ? 'bg-[#573CFF]/5' : ''}`}>
                  <td className="px-3 py-2.5">
                    <input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleSelect(row.id)} />
                  </td>
                  {columnEntries.map(([col]) => (
                    <td key={col} className="px-3 py-2.5 text-gray-700 dark:text-neutral-300 whitespace-nowrap">
                      {formatCellValue(col, row[col])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {pagination.last_page > 1 && (
          <div className="flex items-center justify-between p-3 border-t border-gray-200 dark:border-neutral-800 text-sm">
            <span className="text-gray-500 dark:text-neutral-400">
              Página {pagination.current_page} de {pagination.last_page} · {pagination.total} registros
            </span>
            <div className="flex gap-2">
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={pagination.current_page <= 1} className="px-3 py-1 rounded border border-gray-300 dark:border-neutral-700 disabled:opacity-50">Anterior</button>
              <button onClick={() => setPage(p => Math.min(pagination.last_page, p + 1))} disabled={pagination.current_page >= pagination.last_page} className="px-3 py-1 rounded border border-gray-300 dark:border-neutral-700 disabled:opacity-50">Siguiente</button>
            </div>
          </div>
        )}
      </div>

      {/* Modal de confirmación */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => !busy && setConfirmAction(null)}>
          <div className="bg-white dark:bg-neutral-900 rounded-lg shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                confirmAction.type === 'restore' ? 'bg-green-100 dark:bg-green-900/30 text-green-600' : 'bg-red-100 dark:bg-red-900/30 text-red-600'
              }`}>
                <Icon icon={confirmAction.type === 'restore' ? 'solar:refresh-circle-bold' : 'solar:danger-triangle-bold'} width={24} />
              </div>
              <h3 className="text-lg font-semibold">
                {confirmAction.type === 'restore' ? 'Restaurar registros' : 'Eliminar definitivamente'}
              </h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-neutral-400 mb-6">
              {confirmAction.type === 'restore'
                ? `Vas a restaurar ${confirmAction.count} registro(s). Volverán a aparecer en la lista principal.`
                : `Vas a eliminar PERMANENTEMENTE ${confirmAction.count} registro(s). Esta acción NO se puede deshacer.`}
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmAction(null)} disabled={busy} className="px-4 py-2 rounded border border-gray-300 dark:border-neutral-700 text-sm">Cancelar</button>
              <button
                onClick={executeAction}
                disabled={busy}
                className={`px-4 py-2 rounded text-white text-sm flex items-center gap-2 ${
                  confirmAction.type === 'restore' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                } disabled:opacity-50`}
              >
                {busy && <Icon icon="svg-spinners:ring-resize" width={16} />}
                {confirmAction.type === 'restore' ? 'Restaurar' : 'Eliminar para siempre'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Papelera;
