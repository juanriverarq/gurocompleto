import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { useNavigate } from 'react-router';
import { createPortal } from 'react-dom';
import confetti from 'canvas-confetti';
import { useUnifiedAuth } from '../../context/UnifiedAuthContext';
import { usePageMeta } from '../../hooks/usePageMeta';
import { getPageMetadata } from '../../config/pageMetadata';
import EmailVerificationBanner from '../../components/EmailVerificationBanner';
import saasApi from '../../services/saasApi';
import { polizaService } from '../../services/polizaService';

import suraLogo from '../../assets/images/logoscompanias/sura.png';
import bolivarLogo from '../../assets/images/logoscompanias/bolivar.png';
import hdiLogo from '../../assets/images/logoscompanias/hdi.png';
import estadoLogo from '../../assets/images/logoscompanias/estado.png';
import equidadLogo from '../../assets/images/logoscompanias/equidad.png';
import axaLogo from '../../assets/images/logoscompanias/axa.png';
import mapfreLogo from '../../assets/images/logoscompanias/mapfre.png';
import allianzLogo from '../../assets/images/logoscompanias/allianz.png';
import mundialLogo from '../../assets/images/logoscompanias/mundial.svg';

const INSURER_META: Record<string, { name: string; logo?: string }> = {
  sura: { name: 'Sura', logo: suraLogo },
  bolivar: { name: 'Bolívar', logo: bolivarLogo },
  hdi: { name: 'HDI', logo: hdiLogo },
  'seguros-del-estado': { name: 'Seguros del Estado', logo: estadoLogo },
  'la-equidad': { name: 'La Equidad', logo: equidadLogo },
  'axa-colpatria': { name: 'Axa Colpatria', logo: axaLogo },
  mapfre: { name: 'Mapfre', logo: mapfreLogo },
  allianz: { name: 'Allianz', logo: allianzLogo },
  mundial: { name: 'Seguros Mundial', logo: mundialLogo },
};

const DATA_TYPES = [
  { id: 'clientes', label: 'Clientes', description: 'Nombres, documentos, contactos y datos de tus asegurados.', icon: 'solar:users-group-rounded-linear' },
  { id: 'polizas', label: 'Pólizas', description: 'Números de póliza, ramos, vigencias y estados.', icon: 'solar:shield-check-linear' },
  { id: 'cartera', label: 'Cartera', description: 'Recibos pendientes, mora y estados de pago.', icon: 'solar:wallet-money-linear' },
] as const;

type SyncStage = 'select-insurers' | 'select-types' | 'syncing' | 'success';

const getGreeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos días';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
};

const Inicio = () => {
  const nav = useNavigate();
  const { usuarioSaas, tenant } = useUnifiedAuth();
  const metadata = getPageMetadata('dashboard3');
  usePageMeta(metadata);

  const [hasConnectedInsurer, setHasConnectedInsurer] = useState(false);
  const [connectionsLoading, setConnectionsLoading] = useState(true);
  const [connectedInsurers, setConnectedInsurers] = useState<string[]>([]);

  // Sync modal state
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncStage, setSyncStage] = useState<SyncStage>('select-insurers');
  const [selectedInsurers, setSelectedInsurers] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>(['clientes', 'polizas']);
  const [syncResult, setSyncResult] = useState<any>(null);
  const [syncError, setSyncError] = useState('');
  const [currentSyncInsurer, setCurrentSyncInsurer] = useState('');
  const [syncBatchId, setSyncBatchId] = useState<string | null>(null);
  const [cancellingSync, setCancellingSync] = useState(false);
  const [insurerStatuses, setInsurerStatuses] = useState<Record<string, { status: string; progress?: any; error?: string }>>({});
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [setupCompleted, setSetupCompleted] = useState(() => localStorage.getItem('guro_setup_steps_completed') === '1');
  const [syncStepCompleted, setSyncStepCompleted] = useState(() => localStorage.getItem('guro_setup_sync_completed') === '1');
  const [carteraStepCompleted, setCarteraStepCompleted] = useState(() => localStorage.getItem('guro_setup_cartera_completed') === '1');

  const firstName = useMemo(() => {
    if (usuarioSaas?.nombre) return usuarioSaas.nombre.split(' ')[0] || usuarioSaas.nombre;
    if (tenant?.nombre) return tenant.nombre;
    return '';
  }, [usuarioSaas, tenant]);

  const loadConnections = useCallback(async () => {
    try {
      const res = await saasApi.getInsurerConnections();
      const rows = Array.isArray(res?.data) ? res.data : [];
      const connected = rows
        .filter((r: any) => r?.connected === true || r?.status === 'connected')
        .map((r: any) => r.insurer_code as string);
      setHasConnectedInsurer(connected.length > 0);
      setConnectedInsurers(connected);
    } catch {
      setHasConnectedInsurer(false);
      setConnectedInsurers([]);
    } finally {
      setConnectionsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConnections();
  }, [loadConnections]);

  const markSetupCompleted = () => {
    localStorage.setItem('guro_setup_steps_completed', '1');
    setSetupCompleted(true);
  };

  const markCarteraStepCompleted = () => {
    localStorage.setItem('guro_setup_cartera_completed', '1');
    setCarteraStepCompleted(true);
  };

  const reopenSetupSteps = () => {
    localStorage.removeItem('guro_setup_steps_completed');
    setSetupCompleted(false);
  };

  const openSyncModal = () => {
    setSelectedInsurers([...connectedInsurers]);
    setSelectedTypes(['clientes', 'polizas']);
    setSyncStage('select-insurers');
    setSyncResult(null);
    setSyncError('');
    setCurrentSyncInsurer('');
    setSyncOpen(true);
  };

  const closeSyncModal = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    setSyncOpen(false);
    setSyncBatchId(null);
    setCancellingSync(false);
    setInsurerStatuses({});
  };

  const cancelCurrentSync = async () => {
    if (!syncBatchId || cancellingSync) return;
    try {
      setCancellingSync(true);
      await saasApi.cancelSync(syncBatchId);
    } catch {
      // keep polling; backend status will reflect real state
    } finally {
      setCancellingSync(false);
    }
  };

  const toggleInsurer = (code: string) => {
    setSelectedInsurers((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const toggleType = (id: string) => {
    setSelectedTypes((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id],
    );
  };

  useEffect(() => {
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const startSync = async () => {
    setSyncStage('syncing');
    setSyncError('');
    setCurrentSyncInsurer(selectedInsurers[0] || '');
    setInsurerStatuses(Object.fromEntries(selectedInsurers.map((c) => [c, { status: 'pending' }])));

    try {
      const res = await saasApi.syncInsurers(selectedInsurers, selectedTypes);
      const batchId = res.data?.batch_id;
      if (!batchId) {
        setSyncError('No se recibió identificador de sincronización.');
        setSyncStage('select-types');
        return;
      }
      setSyncBatchId(batchId);
      startPolling(batchId);
    } catch (e: any) {
      const msg = e?.message || '';
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('fetch')) {
        setSyncError('No se pudo conectar con el servidor. Verifica que el backend esté ejecutándose e intenta de nuevo.');
      } else if (msg.includes('timed out') || msg.includes('timeout') || msg.includes('504')) {
        setSyncError('La sincronización tardó demasiado. Intenta de nuevo.');
      } else {
        setSyncError(msg || 'Error desconocido en la sincronización');
      }
      setSyncStage('select-types');
    }
  };

  const startPolling = (batchId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);

    const poll = async () => {
      try {
        const res = await saasApi.getSyncStatus(batchId);
        if (!res.success || !res.data) return;

        const { overall_status, details, totals } = res.data;

        const newStatuses: Record<string, { status: string; progress?: any; error?: string }> = {};
        for (const [code, d] of Object.entries(details) as [string, any][]) {
          newStatuses[code] = { status: d.status, progress: d.progress, error: d.error };
        }
        setInsurerStatuses(newStatuses);

        const processing = Object.values(newStatuses).find((s) => s.status === 'processing');
        if (processing) {
          const code = Object.entries(newStatuses).find(([, s]) => s.status === 'processing')?.[0] || '';
          setCurrentSyncInsurer(code);
        }

        if (overall_status === 'completed' || overall_status === 'failed' || overall_status === 'partial' || overall_status === 'cancelled') {
          if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }

          setSyncResult({ totals, details, overall_status });
          setSyncStage('success');

          if (overall_status === 'completed') {
            localStorage.setItem('guro_setup_sync_completed', '1');
            setSyncStepCompleted(true);
            const duration = 1300;
            const end = Date.now() + duration;
            const colors = ['#573CFF', '#7B61FF', '#A78BFA', '#ffffff'];
            (function frame() {
              confetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0 }, colors });
              confetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1 }, colors });
              if (Date.now() < end) requestAnimationFrame(frame);
            })();
          }

          // Auto-trigger detail sync in background when polizas were included
          if (overall_status !== 'cancelled') {
            const polizasSynced = Object.values(details as Record<string, any>)
              .some((d: any) => (d?.progress?.polizas?.created ?? 0) + (d?.progress?.polizas?.updated ?? 0) > 0);
            if (polizasSynced) {
              // Small delay to let DB writes settle before queuing jobs
              setTimeout(() => {
                polizaService.syncAllPolizasDetail().catch(() => {});
                // Signal to polizas page (works across tabs and same tab)
                const ts = Date.now().toString();
                localStorage.setItem('guro_detail_sync_triggered', ts);
                window.dispatchEvent(new StorageEvent('storage', { key: 'guro_detail_sync_triggered', newValue: ts }));
              }, 2000);
            }
          }
        }
      } catch { /* network blip, keep polling */ }
    };

    poll();
    pollRef.current = setInterval(poll, 3000);
  };

  // ---------- Render helpers for the modal ----------

  const renderStageIndicator = () => {
    const stages = [
      { key: 'select-insurers', label: 'Aseguradoras' },
      { key: 'select-types', label: 'Datos' },
      { key: 'syncing', label: 'Sincronizando' },
      { key: 'success', label: 'Listo' },
    ];
    const idx = stages.findIndex((s) => s.key === syncStage);

  return (
      <div className="flex items-center gap-2 mb-8">
        {stages.map((s, i) => (
          <div key={s.key} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-semibold transition-colors ${
                i <= idx ? 'bg-[#573CFF] text-white' : 'bg-neutral-800 text-neutral-500'
              }`}
            >
              {i < idx ? (
                <Icon icon="solar:check-read-linear" width={14} />
              ) : (
                i + 1
              )}
            </div>
            <span className={`text-xs font-medium hidden sm:inline ${i <= idx ? 'text-white' : 'text-neutral-600'}`}>
              {s.label}
            </span>
            {i < stages.length - 1 && (
              <div className={`w-8 h-px ${i < idx ? 'bg-[#573CFF]' : 'bg-neutral-800'}`} />
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderSelectInsurers = () => (
    <>
      <h3 className="text-[32px] leading-tight font-semibold tracking-[-0.02em] mb-2">
        ¿Qué aseguradoras deseas sincronizar?
      </h3>
      <p className="text-neutral-400 text-[15px] mb-6">
        Selecciona las compañías de las que deseas importar información a GURO.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
        {connectedInsurers.map((code) => {
          const meta = INSURER_META[code];
          const checked = selectedInsurers.includes(code);
          return (
            <button
              key={code}
              type="button"
              onClick={() => toggleInsurer(code)}
              className={`rounded-2xl border p-4 flex items-center gap-3 text-left transition-all ${
                checked
                  ? 'border-[#573CFF]/50 bg-[#573CFF]/8'
                  : 'border-neutral-800 bg-neutral-950/70 hover:border-neutral-700'
              }`}
            >
              <div className="w-11 h-11 rounded-xl bg-white flex items-center justify-center overflow-hidden shrink-0">
                {meta?.logo ? (
                  <img src={meta.logo} alt={meta?.name} className="w-8 h-8 object-contain" />
                ) : (
                  <span className="text-[10px] font-bold text-[#111]">{(meta?.name || code).slice(0, 3).toUpperCase()}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{meta?.name || code}</p>
                <p className="text-xs text-emerald-400">Conectada</p>
          </div>
              <div
                className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                  checked ? 'bg-[#573CFF] border-[#573CFF]' : 'border-neutral-600'
                }`}
              >
                {checked && <Icon icon="solar:check-read-linear" width={12} className="text-white" />}
        </div>
      </button>
          );
        })}
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={closeSyncModal}
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => setSyncStage('select-types')}
          disabled={selectedInsurers.length === 0}
          className="rounded-lg bg-[#573CFF] hover:bg-[#4b31e6] disabled:opacity-40 px-5 py-2 text-sm text-white font-medium"
        >
          Continuar
        </button>
      </div>
    </>
  );

  const renderSelectTypes = () => (
    <>
      <h3 className="text-[32px] leading-tight font-semibold tracking-[-0.02em] mb-2">
        ¿Qué información deseas importar?
      </h3>
      <p className="text-neutral-400 text-[15px] mb-6">
        Elige los tipos de datos que se sincronizarán desde {selectedInsurers.length === 1 ? INSURER_META[selectedInsurers[0]]?.name : `${selectedInsurers.length} aseguradoras`}.
      </p>

      <div className="flex flex-col gap-3 mb-8">
        {DATA_TYPES.map((dt) => {
          const checked = selectedTypes.includes(dt.id);
          return (
            <button
              key={dt.id}
              type="button"
              onClick={() => toggleType(dt.id)}
              className={`rounded-2xl border p-4 flex items-center gap-4 text-left transition-all ${
                checked
                  ? 'border-[#573CFF]/50 bg-[#573CFF]/8'
                  : 'border-neutral-800 bg-neutral-950/70 hover:border-neutral-700'
              }`}
            >
              <div
                className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-colors ${
                  checked ? 'bg-[#573CFF]/20' : 'bg-neutral-800'
                }`}
              >
                <Icon icon={dt.icon} width={22} className={checked ? 'text-[#573CFF]' : 'text-neutral-400'} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">{dt.label}</p>
                <p className="text-xs text-neutral-400 leading-relaxed">{dt.description}</p>
              </div>
              <div
                className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-colors ${
                  checked ? 'bg-[#573CFF] border-[#573CFF]' : 'border-neutral-600'
                }`}
              >
                {checked && <Icon icon="solar:check-read-linear" width={12} className="text-white" />}
              </div>
            </button>
          );
        })}
          </div>

      {syncError && <p className="text-sm text-red-400 mb-4">{syncError}</p>}

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => { setSyncStage('select-insurers'); setSyncError(''); }}
          className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
        >
          Atrás
        </button>
        <button
          type="button"
          onClick={startSync}
          disabled={selectedTypes.length === 0}
          className="rounded-lg bg-[#573CFF] hover:bg-[#4b31e6] disabled:opacity-40 px-5 py-2 text-sm text-white font-medium"
        >
          Sincronizar ahora
        </button>
      </div>
    </>
  );

  const renderSyncing = () => {
    const doneCount = Object.values(insurerStatuses).filter((s) => s.status === 'completed' || s.status === 'failed' || s.status === 'cancelled').length;
    const totalCount = selectedInsurers.length;

    return (
      <div className="text-center">
        <h3 className="text-[24px] leading-tight font-semibold tracking-[-0.02em] mb-2">
          Sincronizando información...
        </h3>
        <p className="text-neutral-400 text-[13px] mb-3">
          Estamos importando datos de tus aseguradoras. Esto puede tomar unos minutos.
        </p>
        <p className="text-neutral-500 text-xs mb-8">
          {doneCount} de {totalCount} aseguradoras completadas
        </p>
        {syncBatchId && (
          <div className="mb-6">
            <button
              type="button"
              onClick={cancelCurrentSync}
              disabled={cancellingSync}
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 px-4 py-2 text-xs text-amber-300 font-medium disabled:opacity-50"
            >
              {cancellingSync ? 'Deteniendo...' : 'Detener sincronización'}
            </button>
          </div>
        )}

        {/* Global progress bar */}
        <div className="max-w-md mx-auto mb-10">
          <div className="h-1.5 rounded-full bg-neutral-800 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#573CFF] to-[#8b6dff] transition-all duration-700 ease-out"
              style={{ width: `${totalCount > 0 ? Math.max(5, (doneCount / totalCount) * 100) : 5}%` }}
            />
          </div>
        </div>

        {/* Per-insurer status rows */}
        <div className="max-w-md mx-auto space-y-2.5">
          {selectedInsurers.map((code) => {
            const meta = INSURER_META[code];
            const st = insurerStatuses[code] || { status: 'pending' };
            const isPending = st.status === 'pending';
            const isProcessing = st.status === 'processing';
            const isDone = st.status === 'completed';
            const isFailed = st.status === 'failed';
            const isCancelled = st.status === 'cancelled';

            const progressSummary: string[] = [];
            if (st.progress) {
              for (const [type, data] of Object.entries(st.progress) as [string, any][]) {
                const fetched = data?.total_fetched ?? 0;
                const c = data?.created ?? 0;
                const u = data?.updated ?? 0;
                const un = data?.unchanged ?? 0;
                const sm = data?.skipped_manual ?? 0;
                const er = data?.errors ?? 0;
                if (fetched + c + u + un + sm + er === 0) continue;
                const parts: string[] = [];
                if (fetched > 0) parts.push(`${fetched.toLocaleString('es-CO')} recibidos`);
                if (c > 0) parts.push(`${c.toLocaleString('es-CO')} nuevos`);
                if (u > 0) parts.push(`${u.toLocaleString('es-CO')} actualizados`);
                if (un > 0) parts.push(`${un.toLocaleString('es-CO')} sin cambios`);
                if (sm > 0) parts.push(`${sm.toLocaleString('es-CO')} manual (saltados)`);
                if (er > 0) parts.push(`${er.toLocaleString('es-CO')} con error`);
                progressSummary.push(`${type}: ${parts.join(' · ')}`);
              }
            }

            return (
              <div
                key={code}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  isDone ? 'border-emerald-500/30 bg-emerald-500/5'
                    : isFailed ? 'border-red-500/30 bg-red-500/5'
                    : isProcessing ? 'border-[#573CFF]/40 bg-[#573CFF]/5'
                    : 'border-neutral-800 bg-neutral-950/60'
                }`}
              >
                <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center overflow-hidden shrink-0">
                  {meta?.logo ? (
                    <img src={meta.logo} alt={meta.name} className="w-6 h-6 object-contain" />
                  ) : (
                    <span className="text-[8px] font-bold text-[#111]">{(meta?.name || '').slice(0, 3)}</span>
                  )}
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm text-white font-medium">{meta?.name || code}</p>
                  {isProcessing && (
                    <p className="text-[11px] text-[#a78bfa]">
                      {progressSummary.length > 0 ? progressSummary.join(', ') + '...' : 'Procesando...'}
                    </p>
                  )}
                  {isDone && progressSummary.length > 0 && (
                    <p className="text-[11px] text-emerald-400">{progressSummary.join(' · ')}</p>
                  )}
                  {isDone && progressSummary.length === 0 && (
                    <p className="text-[11px] text-neutral-500">Sin cambios</p>
                  )}
                  {isFailed && (
                    <p className="text-[11px] text-red-400 truncate">{st.error || 'Error'}</p>
                  )}
                  {isCancelled && (
                    <p className="text-[11px] text-amber-300 truncate">Sincronización detenida</p>
                  )}
                  {isPending && <p className="text-[11px] text-neutral-500">En espera</p>}
                </div>
                {isPending && <div className="w-4 h-4 rounded-full border-2 border-neutral-700 shrink-0" />}
                {isProcessing && <Icon icon="svg-spinners:ring-resize" width={18} className="text-[#573CFF] shrink-0" />}
                {isDone && <Icon icon="solar:check-circle-bold" width={18} className="text-emerald-400 shrink-0" />}
                {isFailed && <Icon icon="solar:danger-triangle-bold" width={18} className="text-red-400 shrink-0" />}
                {isCancelled && <Icon icon="solar:stop-circle-bold" width={18} className="text-amber-300 shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSuccess = () => {
    const t = syncResult?.totals || {};
    const cc = t.clientes_created ?? 0;
    const cu = t.clientes_updated ?? 0;
    const cs = t.clientes_unchanged ?? 0;
    const csm = t.clientes_skipped_manual ?? 0;
    const cf = t.clientes_fetched ?? 0;
    const pc = t.polizas_created ?? 0;
    const pu = t.polizas_updated ?? 0;
    const ps = t.polizas_unchanged ?? 0;
    const psm = t.polizas_skipped_manual ?? 0;
    const pf = t.polizas_fetched ?? 0;
    const kc = t.cartera_created ?? 0;
    const ku = t.cartera_updated ?? 0;
    const ks = t.cartera_unchanged ?? 0;
    const hasCartera = selectedTypes.includes('cartera');

    const overallStatus = syncResult?.overall_status;
    const isCancelled = overallStatus === 'cancelled';
    const hasAnyError = syncResult?.details
      ? Object.values(syncResult.details).some((d: any) => d?.status === 'failed' || !!d?.error)
      : false;
    const allFailed = syncResult?.details
      ? Object.values(syncResult.details).every((d: any) => d?.status === 'failed')
      : false;
    const polizasSynced = syncResult?.details
      ? Object.values(syncResult.details as Record<string, any>)
        .some((d: any) => (d?.progress?.polizas?.created ?? 0) + (d?.progress?.polizas?.updated ?? 0) > 0)
      : false;

    return (
      <div className="text-center">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5 ${isCancelled ? 'bg-amber-500/15 border border-amber-500/30' : allFailed ? 'bg-red-500/15 border border-red-500/30' : hasAnyError ? 'bg-amber-500/15 border border-amber-500/30' : 'bg-emerald-500/15 border border-emerald-500/30'}`}>
          <Icon
            icon={isCancelled ? 'solar:stop-circle-bold' : allFailed ? 'solar:danger-triangle-bold' : hasAnyError ? 'solar:danger-triangle-bold' : 'solar:check-circle-bold'}
            width={36}
            className={isCancelled ? 'text-amber-300' : allFailed ? 'text-red-400' : hasAnyError ? 'text-amber-400' : 'text-emerald-400'}
          />
        </div>

        <h3 className="text-[28px] leading-tight font-semibold tracking-[-0.02em] mb-2">
          {isCancelled ? 'Sincronización detenida' : allFailed ? 'Sincronización fallida' : hasAnyError ? 'Sincronización parcial' : 'Sincronización completada'}
        </h3>
        <p className="text-neutral-400 text-[14px] mb-8">
          {isCancelled
            ? 'La sincronización fue detenida por el usuario. Puedes reanudarla cuando quieras.'
            : allFailed
            ? 'No se pudo sincronizar la información. Revisa los detalles abajo.'
            : hasAnyError
              ? 'Algunos datos se importaron correctamente, pero hubo errores con algunas aseguradoras.'
              : 'La información fue importada exitosamente a tu cuenta de GURO.'}
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-3xl mx-auto mb-4">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
            <p className="text-2xl font-bold text-white">{cf.toLocaleString('es-CO')}</p>
            <p className="text-[10px] text-neutral-500 leading-tight">Clientes recibidos</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
            <p className="text-2xl font-bold text-white">{cc.toLocaleString('es-CO')}</p>
            <p className="text-[10px] text-neutral-500 leading-tight">Clientes nuevos</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
            <p className="text-2xl font-bold text-[#573CFF]">{cu.toLocaleString('es-CO')}</p>
            <p className="text-[10px] text-neutral-500 leading-tight">Clientes actualizados</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
            <p className="text-2xl font-bold text-neutral-500">{cs.toLocaleString('es-CO')}</p>
            <p className="text-[10px] text-neutral-500 leading-tight">Sin cambios</p>
          </div>
          {csm > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-2xl font-bold text-amber-300">{csm.toLocaleString('es-CO')}</p>
              <p className="text-[10px] text-neutral-400 leading-tight">Manual (saltados)</p>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-w-3xl mx-auto mb-8">
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
            <p className="text-2xl font-bold text-white">{pf.toLocaleString('es-CO')}</p>
            <p className="text-[10px] text-neutral-500 leading-tight">Pólizas recibidas</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
            <p className="text-2xl font-bold text-white">{pc.toLocaleString('es-CO')}</p>
            <p className="text-[10px] text-neutral-500 leading-tight">Pólizas nuevas</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
            <p className="text-2xl font-bold text-[#573CFF]">{pu.toLocaleString('es-CO')}</p>
            <p className="text-[10px] text-neutral-500 leading-tight">Pólizas actualizadas</p>
          </div>
          <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
            <p className="text-2xl font-bold text-neutral-500">{ps.toLocaleString('es-CO')}</p>
            <p className="text-[10px] text-neutral-500 leading-tight">Sin cambios</p>
          </div>
          {psm > 0 && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3">
              <p className="text-2xl font-bold text-amber-300">{psm.toLocaleString('es-CO')}</p>
              <p className="text-[10px] text-neutral-400 leading-tight">Manual (saltados)</p>
            </div>
          )}
        </div>

        {hasCartera && (
          <div className="grid grid-cols-3 gap-2 max-w-3xl mx-auto mb-8">
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
              <p className="text-2xl font-bold text-white">{kc.toLocaleString('es-CO')}</p>
              <p className="text-[10px] text-neutral-500 leading-tight">Cartera nueva</p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
              <p className="text-2xl font-bold text-[#573CFF]">{ku.toLocaleString('es-CO')}</p>
              <p className="text-[10px] text-neutral-500 leading-tight">Cartera actualizada</p>
            </div>
            <div className="rounded-xl border border-neutral-800 bg-neutral-950/60 p-3">
              <p className="text-2xl font-bold text-neutral-500">{ks.toLocaleString('es-CO')}</p>
              <p className="text-[10px] text-neutral-500 leading-tight">Sin cambios</p>
            </div>
          </div>
        )}

        {/* Per-insurer detail */}
        {syncResult?.details && (
          <div className="max-w-lg mx-auto mb-8 space-y-2">
            {Object.entries(syncResult.details).map(([code, detail]: [string, any]) => {
              const meta = INSURER_META[code];
              const p = detail?.progress || {};
              const isRowCancelled = detail?.status === 'cancelled';
              const cliProgErr = typeof p?.clientes?.error === 'string' ? p.clientes.error : '';
              const hasError =
                detail?.status === 'failed' || !!detail?.error || !!cliProgErr;
              const hasProgress = Object.keys(p).length > 0;
              const partialError = hasError && hasProgress;

              const fmt = (n: number) => n.toLocaleString('es-CO');
              const buildLine = (label: string, data: any): string => {
                if (!data) return '';
                const c = data?.created ?? 0;
                const u = data?.updated ?? 0;
                const un = data?.unchanged ?? 0;
                const sm = data?.skipped_manual ?? 0;
                const er = data?.errors ?? 0;
                const fetched = data?.total_fetched ?? 0;
                const total = c + u + un + sm + er + fetched;
                if (total === 0) return '';
                const parts: string[] = [];
                if (fetched > 0) parts.push(`${fmt(fetched)} recibidos`);
                if (c > 0) parts.push(`${fmt(c)} nuevos`);
                if (u > 0) parts.push(`${fmt(u)} actualizados`);
                if (un > 0) parts.push(`${fmt(un)} sin cambios`);
                if (sm > 0) parts.push(`${fmt(sm)} manual saltados`);
                if (er > 0) parts.push(`${fmt(er)} con error`);
                return `${label}: ${parts.join(' · ')}`;
              };
              const insurerCliMsg = buildLine('Clientes', p?.clientes);
              const insurerPolMsg = buildLine('Pólizas', p?.polizas);
              const insurerCarMsg = buildLine('Cartera', p?.cartera);
              const insurerComMsg = buildLine('Comisiones', p?.comisiones);
              const anyData = !!(insurerCliMsg || insurerPolMsg || insurerCarMsg || insurerComMsg);

              return (
                <div key={code} className={`rounded-xl border px-4 py-3 ${isRowCancelled ? 'border-amber-500/30 bg-amber-500/5' : hasError && !partialError ? 'border-red-500/30 bg-red-500/5' : partialError ? 'border-amber-500/30 bg-amber-500/5' : 'border-neutral-800 bg-neutral-950/60'}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center overflow-hidden shrink-0">
                      {meta?.logo ? (
                        <img src={meta.logo} alt={meta?.name} className="w-6 h-6 object-contain" />
                      ) : (
                        <span className="text-[8px] font-bold text-[#111]">{(meta?.name || '').slice(0, 3)}</span>
                      )}
                    </div>
                    <div className="flex-1 text-left">
                      <p className="text-sm text-white font-medium">{meta?.name || code}</p>
                      {anyData && (
                        <div className="text-[11px] text-neutral-400 space-y-0.5 mt-0.5">
                          {insurerCliMsg && <p>{insurerCliMsg}</p>}
                          {insurerPolMsg && <p>{insurerPolMsg}</p>}
                          {insurerCarMsg && <p>{insurerCarMsg}</p>}
                          {insurerComMsg && <p>{insurerComMsg}</p>}
                        </div>
                      )}
                      {!anyData && !hasError && (
                        <p className="text-[11px] text-neutral-500">Todo al día, sin cambios</p>
                      )}
                    </div>
                    {isRowCancelled ? (
                      <Icon icon="solar:stop-circle-bold" width={18} className="text-amber-300 shrink-0" />
                    ) : hasError && !partialError ? (
                      <Icon icon="solar:danger-triangle-bold" width={18} className="text-red-400 shrink-0" />
                    ) : partialError ? (
                      <Icon icon="solar:danger-triangle-bold" width={18} className="text-amber-400 shrink-0" />
                    ) : (
                      <Icon icon="solar:check-circle-bold" width={18} className="text-emerald-400 shrink-0" />
                    )}
                  </div>

                  {(hasError || isRowCancelled) && (
                    <div className={`mt-2 rounded-lg px-3 py-2 text-left ${isRowCancelled ? 'bg-amber-500/10' : partialError ? 'bg-amber-500/10' : 'bg-red-500/10'}`}>
                      <p className={`text-[12px] font-medium ${isRowCancelled ? 'text-amber-300' : partialError ? 'text-amber-300' : 'text-red-300'}`}>
                        {isRowCancelled ? 'Sincronización detenida' : partialError ? 'Sincronización parcial' : 'Error de sincronización'}
                      </p>
                      <p className="text-[11px] text-neutral-400 mt-0.5">
                        {isRowCancelled
                          ? 'Este proceso fue detenido manualmente.'
                          : (() => {
                              const raw = cliProgErr || (typeof detail.error === 'string' ? detail.error : '');
                              if (!raw) return 'Error desconocido';
                              return raw.replace(
                                /cURL error \d+:.*?for\s+\S+/i,
                                'Tiempo de espera agotado al conectar con el servidor de la aseguradora.',
                              );
                            })()}
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {!isCancelled && !allFailed && polizasSynced && (
          <div className="max-w-md mx-auto mb-6 rounded-xl border border-[#573CFF]/30 bg-[#573CFF]/8 px-4 py-3 flex items-start gap-3">
            <Icon icon="solar:layers-minimalistic-bold" width={18} className="text-[#a78bfa] mt-0.5 shrink-0" />
            <div className="text-left">
              <p className="text-sm text-[#a78bfa] font-medium">Sincronización de detalles en segundo plano</p>
              <p className="text-[12px] text-neutral-400 mt-0.5">
                Las coberturas, primas y datos completos de cada póliza se están cargando automáticamente. Puedes ver el progreso en la lista de pólizas.
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => nav('/apps/seguros/clientes')}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
          >
            Ver clientes
          </button>
          <button
            type="button"
            onClick={() => nav('/apps/seguros/polizas')}
            className="rounded-lg bg-[#573CFF] hover:bg-[#4b31e6] px-5 py-2 text-sm text-white font-medium"
          >
            Ver pólizas
          </button>
          {hasCartera && (
            <button
              type="button"
              onClick={() => nav('/apps/cartera/aseguradoras')}
              className="rounded-lg border border-[#573CFF]/40 bg-[#573CFF]/10 hover:bg-[#573CFF]/20 px-4 py-2 text-sm text-[#a78bfa] font-medium"
            >
              Ver cartera
        </button>
          )}
          <button
            type="button"
            onClick={closeSyncModal}
            className="rounded-lg border border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
          >
            Cerrar
          </button>
        </div>
      </div>
    );
  };

  // ---------- Main render ----------

  return (
    <div>
      <style>{`
        @keyframes inicio-sync-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes inicio-sync-core-pulse {
          0%, 100% { opacity: 0.75; filter: brightness(1); }
          50% { opacity: 1; filter: brightness(1.12); }
        }
        .inicio-sync-shell {
          position: relative;
          display: inline-flex;
          border-radius: 9999px;
          padding: 2px;
          overflow: hidden;
          flex-shrink: 0;
          filter: drop-shadow(0 0 10px rgba(87, 60, 255, 0.3));
          transition: filter 0.35s ease;
        }
        .inicio-sync-shell:hover {
          filter: drop-shadow(0 0 18px rgba(87, 60, 255, 0.55)) drop-shadow(0 0 28px rgba(251, 146, 60, 0.22));
        }
        .inicio-sync-spin-track {
          position: absolute;
          inset: -60%;
          background: conic-gradient(
            from 0deg,
            #573CFF,
            #7B61FF,
            #A78BFA,
            #fb923c,
            #f97316,
            #573CFF
          );
          animation: inicio-sync-spin 3.8s linear infinite;
        }
        .inicio-sync-shell:hover .inicio-sync-spin-track {
          animation-duration: 2.2s;
        }
        .inicio-sync-halo {
          position: absolute;
          inset: -45%;
          border-radius: 9999px;
          opacity: 0;
          transition: opacity 0.4s ease;
          background: conic-gradient(
            from 120deg,
            rgba(87, 60, 255, 0.95),
            rgba(251, 146, 60, 0.45),
            rgba(167, 139, 250, 0.85),
            rgba(87, 60, 255, 0.95)
          );
          animation: inicio-sync-spin 2.2s linear infinite reverse;
          filter: blur(16px);
          pointer-events: none;
        }
        .inicio-sync-shell:hover .inicio-sync-halo {
          opacity: 0.72;
        }
        .inicio-sync-spark {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          opacity: 0;
          transition: opacity 0.35s ease;
          background: radial-gradient(circle at 50% 35%, rgba(255,255,255,0.35) 0%, transparent 42%);
          pointer-events: none;
          z-index: 2;
          animation: inicio-sync-core-pulse 2s ease-in-out infinite;
        }
        .inicio-sync-shell:hover .inicio-sync-spark {
          opacity: 0.55;
        }
        .inicio-sync-inner {
          position: relative;
          z-index: 3;
          border-radius: 9999px;
          border: none;
          padding: 0.5rem 1.35rem;
          font-size: 0.875rem;
          font-weight: 600;
          color: #fff;
          cursor: pointer;
          background: linear-gradient(180deg, #141414 0%, #000000 100%);
          transition: box-shadow 0.35s ease, background 0.35s ease;
          text-shadow: 0 1px 2px rgba(0,0,0,0.45);
        }
        .inicio-sync-inner:hover {
          background:
            radial-gradient(ellipse 100% 80% at 50% 0%, rgba(87, 60, 255, 0.22) 0%, transparent 52%),
            linear-gradient(180deg, #1a1528 0%, #050508 100%);
          box-shadow:
            inset 0 0 28px rgba(123, 97, 255, 0.18),
            inset 0 -12px 32px rgba(251, 146, 60, 0.08),
            0 0 0 1px rgba(167, 139, 250, 0.12);
        }
      `}</style>
      <EmailVerificationBanner />

      <div
        className="-mx-4 md:-mx-6 xl:-mx-8 2xl:-mx-10 -mt-8 md:-mt-10 min-h-[calc(100vh-8rem)] px-4 md:px-6 xl:px-8 2xl:px-10 py-10 md:py-12 pb-16 text-white"
        style={{ fontFamily: "'General Sans', system-ui, sans-serif" }}
      >
        <div className="max-w-3xl mx-auto w-full">
          <p className="text-sm text-neutral-500 mb-1">
            ¡{getGreeting()}
            {firstName ? `, ${firstName}` : ''}!
          </p>
          <h1 className="text-2xl md:text-[1.75rem] font-bold text-white tracking-[-0.02em] mb-2">
            Configura tu cuenta de seguros
          </h1>
          <p className="text-neutral-400 text-[15px] leading-snug mb-8">
            Sigue estos pasos para centralizar pólizas, clientes, cartera y comisiones según lo que tenga disponible cada compañía.
          </p>

          {setupCompleted ? (
            <div className="rounded-3xl border border-emerald-500/25 bg-emerald-500/10 px-5 py-5 md:px-6 md:py-6">
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                  <Icon icon="solar:check-circle-bold" width={22} className="text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-semibold text-white mb-1">Implementación inicial completada</h2>
                  <p className="text-sm text-neutral-400 leading-relaxed mb-4">
                    Ya puedes operar desde tus módulos principales: sincronizar compañías, importar cartera, revisar comisiones y gestionar pólizas/clientes.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => nav('/apps/integraciones/apis-aseguradoras')} className="rounded-lg bg-[#573CFF] hover:bg-[#4b31e6] text-white text-sm font-medium px-4 py-2 transition-colors">
                      Integraciones
                    </button>
                    <button type="button" onClick={() => nav('/apps/cartera/aseguradoras')} className="rounded-lg border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium px-4 py-2 transition-colors">
                      Cartera
                    </button>
                    <button type="button" onClick={() => nav('/apps/comisiones/aseguradoras')} className="rounded-lg border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-medium px-4 py-2 transition-colors">
                      Comisiones
                    </button>
                    <button type="button" onClick={reopenSetupSteps} className="rounded-lg text-neutral-400 hover:text-white text-sm font-medium px-3 py-2 transition-colors">
                      Ver pasos de nuevo
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
          <div className="flex flex-col gap-3">
            {/* Paso 1 — Conectar aseguradoras */}
            <div className="relative rounded-2xl border border-neutral-800 bg-neutral-950/80 px-4 py-4 md:px-5 md:py-5 flex gap-4 items-center">
              {hasConnectedInsurer ? (
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                  <Icon icon="solar:check-read-linear" width={18} className="text-emerald-400" />
                </div>
              ) : (
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center"
                  style={{ background: '#573CFF' }}
                >
                  <span className="w-2 h-2 rounded-full bg-white" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h2 className="text-[15px] font-semibold text-white">
                  Conecta tus compañías de seguros
                </h2>
                <p className="text-sm text-neutral-500 leading-relaxed">
                  {hasConnectedInsurer
                    ? `${connectedInsurers.length} aseguradora${connectedInsurers.length > 1 ? 's' : ''} conectada${connectedInsurers.length > 1 ? 's' : ''}`
                    : 'Vincula tus credenciales de aseguradoras y revisa qué sincroniza cada una: clientes, pólizas, cartera o comisiones.'}
                </p>
      </div>

              {hasConnectedInsurer ? (
                <div className="flex items-center gap-3 shrink-0">
                  <div className="flex items-center gap-1.5">
                    {connectedInsurers.slice(0, 4).map((code) => {
                      const meta = INSURER_META[code];
                      return (
                        <div key={code} className="w-8 h-8 rounded-full bg-white flex items-center justify-center overflow-hidden border border-gray-200 dark:border-neutral-700 shrink-0">
                          {meta?.logo ? (
                            <img src={meta.logo} alt={meta.name} className="w-5 h-5 object-contain" />
                          ) : (
                            <span className="text-[7px] font-bold text-[#111]">{(meta?.name || code).slice(0, 3).toUpperCase()}</span>
                          )}
                        </div>
                      );
                    })}
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center ml-1">
                      <Icon icon="solar:check-read-bold" width={14} className="text-emerald-400" />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => nav('/apps/integraciones/apis-aseguradoras')}
                    className="text-xs font-medium text-neutral-400 hover:text-white transition-colors underline underline-offset-4 decoration-neutral-700 hover:decoration-white/70"
                  >
                    Añadir más
                  </button>
                </div>
              ) : (
                <span className="inicio-sync-shell">
                  <span className="inicio-sync-spin-track" aria-hidden />
                  <span className="inicio-sync-halo" aria-hidden />
                  <span className="inicio-sync-spark" aria-hidden />
            <button
                    type="button"
                    onClick={() => nav('/apps/integraciones/apis-aseguradoras')}
                    className="inicio-sync-inner"
                  >
                    Conectar
                  </button>
                </span>
              )}
            </div>

            {/* Paso 2 — Sincronizar información */}
            <div
              className={`relative rounded-2xl border px-4 py-4 md:px-5 md:py-5 flex gap-4 items-center transition-colors ${
                hasConnectedInsurer
                  ? 'border-neutral-800 bg-neutral-950/80'
                  : 'border-neutral-800/90 opacity-80'
              }`}
            >
              <div
                className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                  hasConnectedInsurer ? 'bg-[#573CFF]' : 'bg-neutral-800 text-neutral-500'
                }`}
              >
                {hasConnectedInsurer ? (
                  <span className="w-2 h-2 rounded-full bg-white" />
                ) : (
                  2
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 gap-y-1 mb-1">
                  <h2 className={`text-[15px] font-semibold ${hasConnectedInsurer ? 'text-white' : 'text-neutral-500'}`}>
                    Sincroniza lo disponible
                  </h2>
                  {hasConnectedInsurer && (
                    <span className="inline-flex items-center gap-1 text-xs text-neutral-500">
                      <Icon icon="solar:clock-circle-linear" width={14} className="text-neutral-500" />
                      ~5 min
                    </span>
                  )}
                </div>
                <p className={`text-sm leading-relaxed ${hasConnectedInsurer ? 'text-neutral-500' : 'text-neutral-600'}`}>
                  Ejecuta la sincronización automática de clientes, pólizas y cartera según las capacidades de cada aseguradora.
                </p>
              </div>
              {hasConnectedInsurer ? (
                <span className="inicio-sync-shell">
                  <span className="inicio-sync-spin-track" aria-hidden />
                  <span className="inicio-sync-halo" aria-hidden />
                  <span className="inicio-sync-spark" aria-hidden />
                  <button type="button" onClick={openSyncModal} className="inicio-sync-inner">
                    Sincronizar
            </button>
                </span>
              ) : (
                <Icon
                  icon={connectionsLoading ? 'solar:refresh-linear' : 'solar:lock-keyhole-minimalistic-linear'}
                  width={22}
                  className={`flex-shrink-0 ${connectionsLoading ? 'text-neutral-500 animate-spin' : 'text-neutral-500'}`}
                />
              )}
            </div>

            {/* Paso 3 — bloqueado */}
            <div className={`relative rounded-2xl border px-4 py-4 md:px-5 md:py-5 flex gap-4 items-center transition-colors ${
              syncStepCompleted ? 'border-neutral-800 bg-neutral-950/80' : 'border-neutral-800/90 opacity-80'
            }`}>
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                syncStepCompleted ? 'bg-[#573CFF] text-white' : 'bg-neutral-800 text-neutral-500'
              }`}>
                {syncStepCompleted ? <Icon icon="solar:upload-linear" width={18} /> : 3}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className={`text-[15px] font-semibold mb-1 ${syncStepCompleted ? 'text-white' : 'text-neutral-500'}`}>Importa cartera desde Excel</h2>
                <p className={`text-sm leading-relaxed ${syncStepCompleted ? 'text-neutral-500' : 'text-neutral-600'}`}>
                  Para compañías sin endpoint de cartera o archivos históricos, sube Excel/CSV con automapeo y reemplazo por aseguradora.
                </p>
              </div>
              {syncStepCompleted ? (
                <span className="inicio-sync-shell">
                  <span className="inicio-sync-spin-track" aria-hidden />
                  <span className="inicio-sync-halo" aria-hidden />
                  <span className="inicio-sync-spark" aria-hidden />
                  <button type="button" onClick={() => { markCarteraStepCompleted(); nav('/apps/cartera/aseguradoras'); }} className="inicio-sync-inner">
                    Ir a cartera
                  </button>
                </span>
              ) : (
                <Icon icon="solar:lock-keyhole-minimalistic-linear" width={22} className="text-neutral-500 flex-shrink-0" />
              )}
            </div>

            {/* Paso 4 — bloqueado */}
            <div className={`relative rounded-2xl border px-4 py-4 md:px-5 md:py-5 flex gap-4 items-center transition-colors ${
              carteraStepCompleted ? 'border-neutral-800 bg-neutral-950/80' : 'border-neutral-800/90 opacity-80'
            }`}>
              <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                carteraStepCompleted ? 'bg-[#573CFF] text-white' : 'bg-neutral-800 text-neutral-500'
              }`}>
                {carteraStepCompleted ? <Icon icon="solar:chart-2-linear" width={18} /> : 4}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className={`text-[15px] font-semibold mb-1 ${carteraStepCompleted ? 'text-white' : 'text-neutral-500'}`}>
                  Revisa cartera y comisiones
                </h2>
                <p className={`text-sm leading-relaxed ${carteraStepCompleted ? 'text-neutral-500' : 'text-neutral-600'}`}>
                  Consulta saldos pendientes, comisiones recibidas, recibos por compañía y seguimiento de pagos.
                </p>
              </div>
              {carteraStepCompleted ? (
                <div className="flex items-center gap-2 shrink-0">
                  <span className="inicio-sync-shell">
                    <span className="inicio-sync-spin-track" aria-hidden />
                    <span className="inicio-sync-halo" aria-hidden />
                    <span className="inicio-sync-spark" aria-hidden />
                    <button type="button" onClick={() => nav('/apps/cartera/aseguradoras')} className="inicio-sync-inner">Cartera</button>
                  </span>
                  <span className="inicio-sync-shell">
                    <span className="inicio-sync-spin-track" aria-hidden />
                    <span className="inicio-sync-halo" aria-hidden />
                    <span className="inicio-sync-spark" aria-hidden />
                    <button type="button" onClick={() => nav('/apps/comisiones/aseguradoras')} className="inicio-sync-inner">Comisiones</button>
                  </span>
                  <button
                    type="button"
                    onClick={markSetupCompleted}
                    title="Marcar implementación como completada"
                    aria-label="Marcar implementación como completada"
                    className="rounded-full bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 p-2 transition-colors"
                  >
                    <Icon icon="solar:check-circle-bold" width={18} />
                  </button>
                </div>
              ) : (
                <Icon icon="solar:lock-keyhole-minimalistic-linear" width={22} className="text-neutral-500 flex-shrink-0" />
              )}
            </div>

            {false && (
            <div className="relative rounded-2xl border border-[#573CFF]/20 bg-[#573CFF]/10 px-4 py-4 md:px-5 flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-[#573CFF]/20 border border-[#573CFF]/30 flex items-center justify-center shrink-0">
                <Icon icon="solar:question-circle-linear" width={18} className="text-[#a78bfa]" />
              </div>
              <div className="flex-1 min-w-0 pr-32">
                <h2 className="text-[15px] font-semibold text-white mb-1">¿Tienes dudas de implementación?</h2>
                <p className="text-sm text-neutral-400 leading-relaxed">
                  Contáctanos y te ayudamos a configurar integraciones, importaciones, asesores, cartera y comisiones según tu operación.
                </p>
              </div>
              <div className="absolute right-4 top-4">
                <button
                  type="button"
                  onClick={() => nav('/apps/guiame')}
                  className="inline-flex items-center gap-2 rounded-full border border-neutral-700 bg-neutral-900/80 hover:bg-neutral-800 px-3 py-1.5 text-xs font-medium text-white transition-colors"
                >
                  <Icon icon="solar:magic-stick-3-bold" width={14} className="text-[#a78bfa]" />
                  Guíame
                  <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-bold text-amber-300">BETA</span>
                </button>
              </div>
            </div>
            )}
          </div>
          )}
        </div>
      </div>

      {/* ── Full-screen sync modal ── */}
      {syncOpen && typeof document !== 'undefined' && createPortal(
        <div className="inicio-sync-modal fixed inset-0 z-[9999] bg-white dark:bg-[#0d0d0e] text-gray-900 dark:text-white">
          {/* Close button */}
          {syncStage !== 'syncing' && (
            <button
              type="button"
              onClick={closeSyncModal}
              className="absolute top-5 right-5 z-10 w-8 h-8 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-colors flex items-center justify-center"
              aria-label="Cerrar"
            >
              <Icon icon="solar:close-circle-linear" width={18} />
            </button>
          )}

          <div className="h-full flex">
            {/* Sidebar */}
            <aside className="hidden lg:flex w-[4d00px] border-r border-neutral-800/80 p-8 items-end">
              <div>
                <p className="text-[44px] leading-[0.95] font-semibold tracking-[-0.02em] text-white">
                  Sincroniza<br />tu información
                </p>
                <p className="text-neutral-500 text-[15px] mt-2 leading-tight">
                  Importa clientes, pólizas y cartera desde tus aseguradoras conectadas.
                </p>
              </div>
            </aside>

            {/* Main content */}
            <main className="flex-1 flex items-center justify-center px-5 md:px-8 overflow-y-auto">
              <div className="w-full max-w-2xl py-10">
                {(syncStage === 'select-insurers' || syncStage === 'select-types') && renderStageIndicator()}

                {syncStage === 'select-insurers' && renderSelectInsurers()}
                {syncStage === 'select-types' && renderSelectTypes()}
                {syncStage === 'syncing' && renderSyncing()}
                {syncStage === 'success' && renderSuccess()}
              </div>
            </main>
          </div>
        </div>
      , document.body)}
    </div>
  );
};

export default Inicio;
