import React, { useEffect, useMemo, useState } from 'react';
import { Card, Badge, Button, Spinner } from 'flowbite-react';
import { Icon as IconifyIcon } from '@iconify/react';
import { useNavigate } from 'react-router-dom';
import salesFunnelService, { SalesFunnelLead, STAGES, getStageColor, formatCurrency } from 'src/services/salesFunnelService';

const KanbanView: React.FC = () => {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<SalesFunnelLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const orderedStageKeys = useMemo(() => Object.keys(STAGES), []);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        // Traemos una página grande para poblar el tablero (si backend pagina, ajustar según necesidad)
        const res = await salesFunnelService.getLeads({ per_page: 100, page: 1 });
        setLeads(res.data || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Error al cargar negocios');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const leadsByStage = useMemo(() => {
    const map: Record<string, SalesFunnelLead[]> = {};
    orderedStageKeys.forEach(k => { map[k] = []; });
    for (const l of leads) {
      const key = l.stage && orderedStageKeys.includes(l.stage) ? l.stage : orderedStageKeys[0];
      map[key].push(l);
    }
    return map;
  }, [leads, orderedStageKeys]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-dark dark:text-white mb-1">Negocios (Kanban)</h1>
            <p className="text-gray-600 dark:text-gray-400">Visualiza tus negocios por etapa del embudo</p>
          </div>
          <div className="flex gap-2">
            <Button color="light" onClick={() => navigate('/apps/saas/sales-funnel/lista')}>
              <IconifyIcon icon="solar:table-bold" className="mr-2" width={18} />
              Ver Lista
            </Button>
            <Button color="primary" onClick={() => navigate('/apps/saas/sales-funnel/nuevo')}>
              <IconifyIcon icon="solar:add-square-bold" className="mr-2" width={18} />
              Nuevo Negocio
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <Card className="p-4 border border-red-200 bg-red-50 text-red-700">{error}</Card>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spinner size="lg" className="mr-3" />
          <span>Cargando tablero...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {orderedStageKeys.map((stageKey) => {
            const label = STAGES[stageKey as keyof typeof STAGES] || stageKey;
            const items = leadsByStage[stageKey] || [];
            return (
              <Card key={stageKey} className="p-0 overflow-hidden">
                <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getStageColor(stageKey).split(' ')[0]}`}></div>
                    <h3 className="font-semibold text-sm">{label}</h3>
                  </div>
                  <Badge color="info">{items.length}</Badge>
                </div>
                <div className="p-3 space-y-3 min-h-[160px]">
                  {items.length === 0 && (
                    <div className="text-xs text-gray-500">Sin negocios</div>
                  )}
                  {items.map((lead) => (
                    <Card key={lead.id} className="p-3 hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/apps/saas/sales-funnel/${lead.id}`)}>
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-medium text-gray-900 dark:text-white">{lead.full_name || `${lead.first_name} ${lead.last_name}`}</p>
                          <p className="text-[11px] text-gray-500">#{lead.id}</p>
                        </div>
                        <Badge className="text-[10px]" color="gray">{lead.lead_source || '—'}</Badge>
                      </div>
                      <div className="mt-3 flex items-center justify-between">
                        <div className="text-xs text-gray-500">Valor potencial</div>
                        <div className="text-sm font-semibold">{formatCurrency(lead.potential_value || 0)}</div>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <div className="w-16 bg-gray-200 rounded-full h-1.5">
                          <div className="bg-primary h-1.5 rounded-full" style={{ width: `${lead.close_probability || 0}%` }} />
                        </div>
                        <span className="text-[11px] text-gray-600">{lead.close_probability || 0}%</span>
                      </div>
                    </Card>
                  ))}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default KanbanView;
