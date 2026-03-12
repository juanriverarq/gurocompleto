import { useState, useCallback, useEffect, useRef } from 'react';
import { Icon } from '@iconify/react';
import api from 'src/config/api';

// ── Types ──
interface UserInfo {
  id?: number;
  user_id?: number;
  nombre: string;
  perfil: string;
  marca: string;
  marca_nit: string;
  email: string;
}

interface EntityCounts {
  [key: string]: number;
}

interface SyncResult {
  entity: string;
  label: string;
  fetched: number;
  created: number;
  updated?: number;
  skipped: number;
  errors?: string[];
}

interface FirebaseSyncStats {
  total: { total: number; firebase: number; softseguros: number };
  polizas: { total: number; firebase: number; softseguros: number };
  clientes: { total: number; firebase: number; softseguros: number };
  siniestros: { total: number; firebase: number; softseguros: number };
}

// ── TEST MODE: limit records per entity (set to 0 or null to sync all) ──
const TEST_LIMIT = 0;

// ── Sync order: catalogs first, then dependent entities ──
const SYNC_ORDER = [
  { key: 'aseguradoras', label: 'Aseguradoras', icon: 'solar:buildings-bold-duotone', color: '#0ea5e9', small: true },
  { key: 'ramos', label: 'Ramos', icon: 'solar:layers-bold-duotone', color: '#f97316', small: true },
  { key: 'comisiones_ramos', label: 'Comisiones Ramos', icon: 'solar:chart-bold-duotone', color: '#8b5cf6', small: true },
  { key: 'vendedores', label: 'Vendedores', icon: 'solar:user-id-bold-duotone', color: '#e11d48', small: true },
  { key: 'clientes', label: 'Clientes', icon: 'solar:users-group-rounded-bold-duotone', color: '#573CFF', small: false },
  { key: 'polizas', label: 'Pólizas', icon: 'solar:document-bold-duotone', color: '#10b981', small: false },
  { key: 'vinculados', label: 'Vinculados/Asegurados', icon: 'solar:shield-user-bold-duotone', color: '#14b8a6', small: false },
  { key: 'beneficiarios', label: 'Beneficiarios', icon: 'solar:heart-bold-duotone', color: '#ec4899', small: false },
  { key: 'siniestros', label: 'Siniestros', icon: 'solar:danger-triangle-bold-duotone', color: '#f59e0b', small: false },
  { key: 'anexos_polizas', label: 'Anexos de Pólizas', icon: 'solar:document-add-bold-duotone', color: '#06b6d4', small: false },
  { key: 'recibos', label: 'Anticipos (Recibos Caja)', icon: 'solar:bill-list-bold-duotone', color: '#22c55e', small: false },
  { key: 'recaudos', label: 'Recaudos Activos', icon: 'solar:hand-money-bold-duotone', color: '#a855f7', small: false },
  { key: 'recaudos_directos', label: 'Recaudos Pago Directo', icon: 'solar:card-transfer-bold-duotone', color: '#0891b2', small: false },
  { key: 'recaudos_anulados', label: 'Recaudos Anulados', icon: 'solar:close-circle-bold-duotone', color: '#dc2626', small: false },
  { key: 'archivos', label: 'Archivos Digitales', icon: 'solar:folder-bold-duotone', color: '#6366f1', small: false },
];

// Entities shown in preview (all SS entities)
const PREVIEW_ENTITIES = [
  { key: 'clientes', label: 'Clientes', icon: 'solar:users-group-rounded-bold-duotone', color: '#573CFF' },
  { key: 'polizas', label: 'Pólizas', icon: 'solar:document-bold-duotone', color: '#10b981' },
  { key: 'siniestros', label: 'Siniestros', icon: 'solar:danger-triangle-bold-duotone', color: '#f59e0b' },
  { key: 'beneficiarios', label: 'Beneficiarios', icon: 'solar:heart-bold-duotone', color: '#ec4899' },
  { key: 'vinculados', label: 'Vinculados/Asegurados', icon: 'solar:shield-user-bold-duotone', color: '#14b8a6' },
  { key: 'aseguradoras', label: 'Aseguradoras', icon: 'solar:buildings-bold-duotone', color: '#0ea5e9' },
  { key: 'ramos_globales', label: 'Ramos', icon: 'solar:layers-bold-duotone', color: '#f97316' },
  { key: 'vendedores', label: 'Vendedores', icon: 'solar:user-id-bold-duotone', color: '#e11d48' },
  { key: 'anexos', label: 'Anexos de Pólizas', icon: 'solar:document-add-bold-duotone', color: '#06b6d4' },
  { key: 'recibos', label: 'Anticipos (Recibos Caja)', icon: 'solar:bill-list-bold-duotone', color: '#22c55e' },
  { key: 'recaudos', label: 'Recaudos Activos', icon: 'solar:hand-money-bold-duotone', color: '#a855f7' },
  { key: 'recaudos_directos', label: 'Recaudos Pago Directo', icon: 'solar:card-transfer-bold-duotone', color: '#0891b2' },
  { key: 'recaudos_anulados', label: 'Recaudos Anulados', icon: 'solar:close-circle-bold-duotone', color: '#dc2626' },
  { key: 'archivos_digitales', label: 'Archivos Digitales', icon: 'solar:folder-bold-duotone', color: '#6366f1' },
];


// Map sync entity key → preview count keys
const COUNT_KEYS: Record<string, string[]> = {
  aseguradoras: ['aseguradoras'],
  ramos: ['ramos_globales'],
  comisiones_ramos: ['ramos_globales'],
  vendedores: ['vendedores'],
  clientes: ['clientes'],
  polizas: ['polizas'],
  vinculados: ['vinculados'],
  beneficiarios: ['beneficiarios'],
  siniestros: ['siniestros'],
  anexos_polizas: ['anexos'],
  recibos: ['recibos'],
  recaudos: ['recaudos'],
  recaudos_directos: ['recaudos_directos'],
  recaudos_anulados: ['recaudos_anulados'],
  archivos: ['archivos_digitales'],
};

const SS_CACHE_KEY = 'ss_credentials';
const SS_PROGRESS_KEY = 'ss_sync_progress';

// Helper to get/set sync progress per entity from localStorage
const getSyncProgressMap = (): Record<string, { lastPage: number; done: boolean }> => {
  try { return JSON.parse(localStorage.getItem(SS_PROGRESS_KEY) || '{}'); } catch { return {}; }
};
const saveSyncProgress = (entity: string, lastPage: number, done: boolean) => {
  const map = getSyncProgressMap();
  map[entity] = { lastPage, done };
  localStorage.setItem(SS_PROGRESS_KEY, JSON.stringify(map));
};
const clearSyncProgress = () => localStorage.removeItem(SS_PROGRESS_KEY);

const SoftSegurosBackup = () => {
  // ── State ──
  const [step, setStep] = useState<'login' | 'preview' | 'syncing' | 'done'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [counts, setCounts] = useState<EntityCounts>({});
  const [totalRecords, setTotalRecords] = useState(0);

  // Load cached credentials on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(SS_CACHE_KEY);
      if (cached) {
        const { u, p } = JSON.parse(cached);
        if (u) setUsername(u);
        if (p) setPassword(p);
      }
    } catch {}
  }, []);

  // Sync state
  const [syncStatus, setSyncStatus] = useState<Record<string, 'pending' | 'syncing' | 'done' | 'error'>>({});
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncCurrentLabel, setSyncCurrentLabel] = useState('');
  const [syncResults, setSyncResults] = useState<SyncResult[]>([]);

  // Firebase sync state
  const [fbStats, setFbStats] = useState<FirebaseSyncStats | null>(null);
  const [fbHasCredentials, setFbHasCredentials] = useState(false);
  const [fbSyncing, setFbSyncing] = useState(false);
  const [fbSyncOutput, setFbSyncOutput] = useState('');
  const [fbLoading, setFbLoading] = useState(false);

  // Fetch firebase sync status on mount
  useEffect(() => {
    const fetchFbStatus = async () => {
      try {
        setFbLoading(true);
        const res = await api.get('/saas/softseguros/sync-status');
        if (res.data.success) {
          setFbStats(res.data.data.stats);
          setFbHasCredentials(res.data.data.has_credentials);
        }
      } catch {}
      finally { setFbLoading(false); }
    };
    fetchFbStatus();
  }, []);

  const fbSyncRef = useRef(false);
  const handleFirebaseSync = async (entity: string = 'all', totalLimit: number = 50) => {
    if (fbSyncRef.current) return;
    fbSyncRef.current = true;
    setFbSyncing(true);
    setFbSyncOutput('');
    const BATCH = 50;
    let remaining = totalLimit;
    let totalCopied = 0, totalFailed = 0, totalAlready = 0, totalSkipped = 0;
    let batchNum = 0;
    try {
      while (remaining > 0) {
        batchNum++;
        const batchSize = Math.min(BATCH, remaining);
        setFbSyncOutput(`Lote ${batchNum}: procesando ${batchSize} archivos... (${totalCopied} copiados hasta ahora)`);
        const res = await api.post('/saas/softseguros/sync-to-firebase', { entity, limit: batchSize }, { timeout: 300000 });
        if (!res.data.success) {
          setFbSyncOutput(prev => prev + '\n' + (res.data.message || 'Error en lote'));
          break;
        }
        const d = res.data.data;
        totalCopied += d.copied || 0;
        totalFailed += d.failed || 0;
        totalAlready += d.already_firebase || 0;
        totalSkipped += d.skipped || 0;
        setFbStats(d.stats);
        remaining -= batchSize;
        // If nothing was copied in this batch, all remaining are already synced or failed
        if ((d.copied || 0) === 0) {
          setFbSyncOutput(`Completado en ${batchNum} lotes.\nCopiados: ${totalCopied} | Ya en Firebase: ${totalAlready} | Fallidos: ${totalFailed} | Omitidos: ${totalSkipped}`);
          break;
        }
        setFbSyncOutput(`Lote ${batchNum} completado. Copiados: ${totalCopied} | Ya en Firebase: ${totalAlready} | Fallidos: ${totalFailed}`);
      }
      if (remaining <= 0) {
        setFbSyncOutput(`Completado (${batchNum} lotes).\nCopiados: ${totalCopied} | Ya en Firebase: ${totalAlready} | Fallidos: ${totalFailed} | Omitidos: ${totalSkipped}`);
      }
    } catch (err: any) {
      setFbSyncOutput(prev => prev + '\n❌ Error: ' + (err.response?.data?.message || err.message || 'Error de conexión'));
    } finally {
      setFbSyncing(false);
      fbSyncRef.current = false;
    }
  };

  // ── Login ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/saas/softseguros/authenticate', { username, password });
      if (res.data.success) {
        setToken(res.data.token);
        setUserInfo(res.data.user);
        setFbHasCredentials(true);
        // Cache credentials
        try { localStorage.setItem(SS_CACHE_KEY, JSON.stringify({ u: username, p: password })); } catch {}
        // Refresh firebase sync status (credentials now stored)
        try {
          const fbRes = await api.get('/saas/softseguros/sync-status');
          if (fbRes.data.success) {
            setFbStats(fbRes.data.data.stats);
            setFbHasCredentials(fbRes.data.data.has_credentials);
          }
        } catch {}
        const preview = await api.post('/saas/softseguros/preview', { token: res.data.token });
        if (preview.data.success) {
          setCounts(preview.data.counts);
          setTotalRecords(preview.data.total);
          setStep('preview');
        }
      } else {
        setError('Credenciales inválidas');
      }
    } catch (err: any) {
      setError(err.response?.data?.message || 'Error de conexión');
    } finally {
      setLoading(false);
    }
  };

  // ── Sync directly to Guro ──
  const handleSync = useCallback(async (singleEntityKey?: string) => {
    setStep('syncing');
    setSyncProgress(0);
    setSyncResults([]);

    const progressMap = getSyncProgressMap();

    const entitiesToSync = SYNC_ORDER.filter(e => {
      // If syncing a single entity, only include that one
      if (singleEntityKey && e.key !== singleEntityKey) return false;
      const keys = COUNT_KEYS[e.key] || [e.key];
      const hasData = keys.some(k => (counts[k] || 0) > 0);
      if (!hasData) return false;
      // Skip entities fully completed in a previous run (unless single entity)
      if (!singleEntityKey && progressMap[e.key]?.done) return false;
      return true;
    });

    // For single entity sync, clear its saved progress so it starts fresh
    if (singleEntityKey) {
      saveSyncProgress(singleEntityKey, 0, false);
    }

    const total = entitiesToSync.length;
    let completed = 0;

    // Init statuses
    const initial: Record<string, 'pending' | 'syncing' | 'done' | 'error'> = {};
    SYNC_ORDER.forEach(e => {
      const keys = COUNT_KEYS[e.key] || [e.key];
      const hasData = keys.some(k => (counts[k] || 0) > 0);
      // Already done from previous run
      if (progressMap[e.key]?.done) {
        initial[e.key] = 'done';
      } else {
        initial[e.key] = hasData ? 'pending' : 'done';
      }
    });
    setSyncStatus(initial);

    const results: SyncResult[] = [];

    for (const entity of entitiesToSync) {
      setSyncCurrentLabel(entity.label);
      setSyncStatus(prev => ({ ...prev, [entity.key]: 'syncing' }));

      try {
        if (entity.small) {
          // Small entities: sync all in one call (backend fetches all pages + imports)
          // comisiones_ramos needs extra timeout (~123 sequential API calls)
          const timeout = entity.key === 'comisiones_ramos' ? 300000 : 60000;
          const res = await api.post('/saas/softseguros/sync', {
            token,
            entity: entity.key,
            ...(TEST_LIMIT ? { limit: TEST_LIMIT } : {}),
          }, { timeout });

          if (res.data.success) {
            results.push({
              entity: entity.key,
              label: entity.label,
              fetched: res.data.fetched || 0,
              created: res.data.created || 0,
              updated: res.data.updated,
              skipped: res.data.skipped || 0,
              errors: res.data.errors,
            });
          }
        } else {
          // Large entities: sync page by page NEWEST FIRST (last page → first page)
          let totalInSs = 0;
          let totalFetched = 0;
          let totalCreated = 0;
          let totalUpdated = 0;
          let totalSkipped = 0;
          let allErrors: string[] = [];
          let consecutiveErrors = 0;

          const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
          const PAGE_SIZE = 10; // SS API returns 10 per page

          // Use counts from preview to calculate total pages (no extra API call needed)
          const countKey = COUNT_KEYS[entity.key] || [entity.key];
          totalInSs = countKey.reduce((sum, k) => sum + (counts[k] || 0), 0);
          const totalPages = totalInSs > 0 ? Math.ceil(totalInSs / PAGE_SIZE) : 1;

          // Resume from last saved page (if any) instead of starting from scratch
          const savedProgress = getSyncProgressMap()[entity.key];
          let page = (savedProgress && !savedProgress.done && savedProgress.lastPage > 0)
            ? savedProgress.lastPage
            : totalPages;
          if (savedProgress && !savedProgress.done && savedProgress.lastPage > 0) {
            console.log(`Resuming ${entity.key} from page ${page} (was at ${totalPages})`);
          }
          let keepGoing = true;

          while (keepGoing && page >= 1) {
            const pctText = totalInSs > 0
              ? `${entity.label} (${Math.round((totalFetched / totalInSs) * 100)}% — ${totalFetched.toLocaleString()} nuevos→viejos)`
              : `${entity.label} (página ${page})`;
            setSyncCurrentLabel(pctText);

            let res: any = null;
            let success = false;

            // Retry up to 3 times on failure
            for (let attempt = 0; attempt < 3; attempt++) {
              try {
                // archivos needs extra timeout (~10 file downloads+uploads per page)
                const pageTimeout = entity.key === 'archivos' ? 120000 : 60000;
                res = await api.post('/saas/softseguros/sync-page', {
                  token,
                  entity: entity.key,
                  page,
                  ss_user_id: userInfo?.user_id,
                }, { timeout: pageTimeout });
                success = res.data.success;
                if (success) break;
              } catch (err: any) {
                const status = err.response?.status;
                if (status === 502 || status === 429) {
                  const waitSec = Math.pow(2, attempt + 1);
                  setSyncCurrentLabel(`${entity.label} — esperando ${waitSec}s (rate limit)...`);
                  await delay(waitSec * 1000);
                } else {
                  throw err;
                }
              }
            }

            if (success && res?.data) {
              totalFetched += res.data.fetched || 0;
              totalCreated += res.data.created || 0;
              if (res.data.updated) totalUpdated += res.data.updated;
              totalSkipped += res.data.skipped || 0;
              if (res.data.errors?.length) allErrors = [...allErrors, ...res.data.errors];
              // Stop if we've reached the test limit
              if (TEST_LIMIT && totalFetched >= TEST_LIMIT) keepGoing = false;
              // Save progress so we can resume if interrupted
              saveSyncProgress(entity.key, page, false);
              page--;
              consecutiveErrors = 0;
            } else {
              consecutiveErrors++;
              allErrors.push(res?.data?.message || 'Error en página ' + page);
              if (consecutiveErrors >= 3) {
                allErrors.push('Detenido tras 3 errores consecutivos');
                keepGoing = false;
              } else {
                page--;
              }
            }

            // Small delay between pages to avoid rate limiting
            await delay(150);
          }

          results.push({
            entity: entity.key,
            label: entity.label,
            fetched: totalFetched,
            created: totalCreated,
            updated: totalUpdated || undefined,
            skipped: totalSkipped,
            errors: allErrors.length > 0 ? allErrors.slice(0, 20) : undefined,
          });
        }

        // Mark entity as fully done so re-sync skips it
        saveSyncProgress(entity.key, 0, true);
        setSyncStatus(prev => ({ ...prev, [entity.key]: 'done' }));
        // Wait 1s between entities to let SS API rate limiter cool down
        await new Promise(r => setTimeout(r, 1000));
      } catch (err: any) {
        console.error(`Error syncing ${entity.key}:`, err);
        results.push({
          entity: entity.key,
          label: entity.label,
          fetched: 0,
          created: 0,
          skipped: 0,
          errors: [err.response?.data?.message || err.message || 'Error desconocido'],
        });
        setSyncStatus(prev => ({ ...prev, [entity.key]: 'error' }));
      }

      completed++;
      setSyncProgress(Math.round((completed / total) * 100));
    }

    setSyncResults(results);
    setStep('done');
  }, [counts, token, userInfo]);

  // ── Render ──
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0a0a]">
      {/* Header */}
      <div className="bg-white dark:bg-[#111] border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-5xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#573CFF] to-[#7c3aed] flex items-center justify-center shadow-lg shadow-[#573CFF]/20">
              <Icon icon="solar:refresh-circle-bold-duotone" className="text-white text-2xl" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-[-0.02em]">
                Sincronización SoftSeguros → Guro
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Importa toda tu información directamente desde softseguros.com a Guro
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* ── FIREBASE SYNC STATUS PANEL ── */}
        {fbStats && fbStats.total.total > 0 && (
          <div className="mb-8 bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center">
                  <Icon icon="solar:cloud-upload-bold-duotone" className="text-orange-500 text-xl" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm">Archivos de SoftSeguros → Firebase</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Los archivos importados deben copiarse a Firebase para acceso permanente
                  </p>
                </div>
              </div>
              {fbStats.total.softseguros === 0 ? (
                <span className="px-3 py-1 rounded-full bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-semibold flex items-center gap-1.5">
                  <Icon icon="solar:check-circle-bold" className="text-sm" />
                  Todos sincronizados
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs font-semibold">
                  {fbStats.total.softseguros.toLocaleString()} pendientes
                </span>
              )}
            </div>

            <div className="px-6 py-4">
              {/* Progress bar */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {fbStats.total.firebase.toLocaleString()} de {fbStats.total.total.toLocaleString()} archivos en Firebase
                  </span>
                  <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                    {fbStats.total.total > 0 ? Math.round((fbStats.total.firebase / fbStats.total.total) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2.5">
                  <div
                    className="h-2.5 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 transition-all duration-500"
                    style={{ width: `${fbStats.total.total > 0 ? (fbStats.total.firebase / fbStats.total.total) * 100 : 0}%` }}
                  />
                </div>
              </div>

              {/* Per-entity breakdown */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                {[
                  { key: 'polizas' as const, label: 'Pólizas', icon: 'solar:document-bold-duotone', color: '#10b981' },
                  { key: 'clientes' as const, label: 'Clientes', icon: 'solar:users-group-rounded-bold-duotone', color: '#573CFF' },
                  { key: 'siniestros' as const, label: 'Siniestros', icon: 'solar:danger-triangle-bold-duotone', color: '#f59e0b' },
                ].map(e => {
                  const s = fbStats[e.key];
                  const pct = s.total > 0 ? Math.round((s.firebase / s.total) * 100) : 100;
                  return (
                    <div key={e.key} className="rounded-xl border border-gray-100 dark:border-gray-800 p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon icon={e.icon} className="text-sm" style={{ color: e.color }} />
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{e.label}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-gray-400">{s.firebase}/{s.total}</span>
                        <span className={pct === 100 ? 'text-green-500 font-semibold' : 'text-amber-500 font-semibold'}>{pct}%</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-1.5">
                        <div
                          className={`h-1.5 rounded-full transition-all ${pct === 100 ? 'bg-green-400' : 'bg-amber-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sync button + output */}
              {fbStats.total.softseguros > 0 && (
                <div>
                  {!fbHasCredentials && (
                    <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-xl mb-3">
                      <p className="text-xs text-amber-700 dark:text-amber-400">
                        <strong>Nota:</strong> Debes autenticarte con SoftSeguros primero (paso de arriba) para poder sincronizar los archivos a Firebase.
                      </p>
                    </div>
                  )}
                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={() => handleFirebaseSync('all', 1000)}
                      disabled={fbSyncing || !fbHasCredentials}
                      className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white rounded-xl font-semibold text-sm transition disabled:opacity-50 flex items-center gap-2 shadow-sm"
                    >
                      {fbSyncing ? (
                        <>
                          <Icon icon="svg-spinners:ring-resize" className="text-base" />
                          Sincronizando...
                        </>
                      ) : (
                        <>
                          <Icon icon="solar:cloud-upload-bold" className="text-base" />
                          Sincronizar 1,000 archivos
                        </>
                      )}
                    </button>
                    {[100, 500].map(n => (
                      <button
                        key={n}
                        onClick={() => handleFirebaseSync('all', n)}
                        disabled={fbSyncing || !fbHasCredentials}
                        className="px-4 py-2.5 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl font-medium text-sm transition disabled:opacity-50"
                      >
                        {n}
                      </button>
                    ))}
                    <span className="text-xs text-gray-400 dark:text-gray-500">archivos por lote</span>
                  </div>
                </div>
              )}

              {fbSyncOutput && (
                <pre className="mt-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-xl text-xs text-gray-600 dark:text-gray-400 max-h-40 overflow-y-auto whitespace-pre-wrap font-mono">
                  {fbSyncOutput}
                </pre>
              )}
            </div>
          </div>
        )}

        {fbLoading && !fbStats && (
          <div className="mb-8 flex items-center justify-center gap-2 text-sm text-gray-400">
            <Icon icon="svg-spinners:ring-resize" className="text-base" />
            Cargando estado de archivos...
          </div>
        )}

        {/* ── STEP 1: LOGIN ── */}
        {step === 'login' && (
          <div className="max-w-md mx-auto">
            <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm">
              <div className="text-center mb-8">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center mx-auto mb-4">
                  <Icon icon="solar:lock-keyhole-bold-duotone" className="text-blue-500 text-3xl" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  Conectar con SoftSeguros
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Ingresa tus credenciales de softseguros.com
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Usuario</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    placeholder="usuario.softseguros"
                    required
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:border-[#573CFF] focus:ring-1 focus:ring-[#573CFF]/20 outline-none transition placeholder:text-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Contraseña</label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      className="w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] text-gray-900 dark:text-white focus:border-[#573CFF] focus:ring-1 focus:ring-[#573CFF]/20 outline-none transition pr-12 placeholder:text-gray-400"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <Icon icon={showPassword ? 'solar:eye-closed-linear' : 'solar:eye-linear'} className="text-xl" />
                    </button>
                  </div>
                </div>

                {error && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#573CFF] hover:bg-[#4930d9] text-white rounded-xl font-semibold transition disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Icon icon="svg-spinners:ring-resize" className="text-lg" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <Icon icon="solar:login-2-bold-duotone" className="text-lg" />
                      Conectar y analizar
                    </>
                  )}
                </button>
              </form>

              <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl border border-amber-200 dark:border-amber-800/30">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  <strong>Nota:</strong> Las credenciales se almacenan de forma encriptada para permitir el acceso
                  permanente a los archivos importados desde SoftSeguros.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 2: PREVIEW + SYNC BUTTON ── */}
        {step === 'preview' && userInfo && (
          <div className="space-y-6">
            {/* User info card */}
            <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                    <Icon icon="solar:check-circle-bold-duotone" className="text-green-500 text-2xl" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white">{userInfo.marca}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {userInfo.nombre} · {userInfo.perfil} · NIT: {userInfo.marca_nit}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-[#573CFF]">{totalRecords.toLocaleString()}</div>
                  <div className="text-xs text-gray-500">registros en SoftSeguros</div>
                </div>
              </div>
            </div>

            {/* Entity grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {PREVIEW_ENTITIES.map(entity => {
                const count = counts[entity.key] || 0;
                return (
                  <div
                    key={entity.key}
                    className={`bg-white dark:bg-[#161616] rounded-xl border border-gray-200 dark:border-gray-800 p-4 transition ${
                      count > 0 ? '' : 'opacity-40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${entity.color}15` }}
                        >
                          <Icon icon={entity.icon} className="text-lg" style={{ color: entity.color }} />
                        </div>
                        <div className="min-w-0">
                          <div className="text-lg font-bold text-gray-900 dark:text-white">{count.toLocaleString()}</div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 truncate">{entity.label}</div>
                        </div>
                      </div>
                      {count > 0 && (() => {
                        const syncKey = Object.entries(COUNT_KEYS).find(([, v]) => v.includes(entity.key))?.[0];
                        if (!syncKey) return null;
                        return (
                          <button
                            onClick={() => handleSync(syncKey)}
                            title={`Sincronizar solo ${entity.label}`}
                            className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 transition text-gray-400 hover:text-[#573CFF]"
                          >
                            <Icon icon="solar:refresh-bold" className="text-sm" />
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Info + Sync button */}
            <div className="bg-white dark:bg-[#161616] rounded-2xl border border-blue-200 dark:border-blue-800/30 p-6 shadow-sm">
              <div className="flex items-start gap-4 mb-5">
                <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon icon="solar:info-circle-bold-duotone" className="text-blue-500 text-xl" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white mb-1">Sincronización directa</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Los datos se leerán directamente desde SoftSeguros y se importarán a Guro en tiempo real.
                    Los registros duplicados se omiten automáticamente. Es seguro ejecutar múltiples veces.
                  </p>
                </div>
              </div>

              {(() => {
                const pm = getSyncProgressMap();
                const hasProgress = Object.values(pm).some(v => v.done || v.lastPage > 0);
                const doneCount = Object.values(pm).filter(v => v.done).length;
                return (
                  <>
                    {hasProgress && (
                      <div className="flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 rounded-xl px-4 py-3 mb-3">
                        <span className="text-sm text-blue-700 dark:text-blue-300 flex items-center gap-2">
                          <Icon icon="solar:restart-bold" className="text-lg" />
                          Progreso guardado: {doneCount} entidades completadas. La sincronización continuará donde quedó.
                        </span>
                        <button
                          onClick={() => { clearSyncProgress(); window.location.reload(); }}
                          className="text-xs text-blue-600 dark:text-blue-400 hover:text-red-500 font-medium underline ml-3 whitespace-nowrap"
                        >
                          Reiniciar todo
                        </button>
                      </div>
                    )}
                    <button
                      onClick={() => handleSync()}
                      className="w-full py-4 bg-gradient-to-r from-[#573CFF] to-[#7c3aed] hover:from-[#4930d9] hover:to-[#6d28d9] text-white rounded-xl font-bold text-lg transition shadow-lg shadow-[#573CFF]/20 flex items-center justify-center gap-3"
                    >
                      <Icon icon="solar:refresh-circle-bold-duotone" className="text-2xl" />
                      {hasProgress ? 'Continuar sincronización' : 'Sincronizar con Guro'}
                    </button>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {/* ── STEP 3: SYNCING ── */}
        {step === 'syncing' && (
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 p-8 shadow-sm text-center">
              <div className="w-20 h-20 rounded-full bg-[#573CFF]/10 flex items-center justify-center mx-auto mb-6">
                <Icon icon="svg-spinners:blocks-shuffle-3" className="text-[#573CFF] text-4xl" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Sincronizando...
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">{syncCurrentLabel}</p>
              <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-3 mb-2">
                <div
                  className="h-3 rounded-full bg-gradient-to-r from-[#573CFF] to-[#7c3aed] transition-all duration-500"
                  style={{ width: `${syncProgress}%` }}
                />
              </div>
              <p className="text-sm text-gray-500">{syncProgress}% completado</p>
            </div>

            <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 p-4">
              <div className="space-y-1">
                {SYNC_ORDER.map(entity => {
                  const status = syncStatus[entity.key];
                  if (status === undefined) return null;
                  return (
                    <div key={entity.key} className="flex items-center justify-between py-2.5 px-3 rounded-lg">
                      <div className="flex items-center gap-3">
                        <Icon icon={entity.icon} className="text-lg" style={{ color: entity.color }} />
                        <span className="text-sm text-gray-700 dark:text-gray-300">{entity.label}</span>
                      </div>
                      <div>
                        {status === 'done' && <Icon icon="solar:check-circle-bold" className="text-green-500 text-lg" />}
                        {status === 'syncing' && <Icon icon="svg-spinners:ring-resize" className="text-[#573CFF] text-lg" />}
                        {status === 'error' && <Icon icon="solar:close-circle-bold" className="text-red-500 text-lg" />}
                        {status === 'pending' && <div className="w-4 h-4 rounded-full bg-gray-200 dark:bg-gray-700" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ── STEP 4: DONE ── */}
        {step === 'done' && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="bg-white dark:bg-[#161616] rounded-2xl border border-green-200 dark:border-green-800/30 p-8 shadow-sm text-center">
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-6">
                <Icon icon="solar:check-circle-bold-duotone" className="text-green-500 text-4xl" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                ¡Sincronización completada!
              </h2>
              <div className="flex items-center justify-center gap-8 mt-4">
                <div>
                  <div className="text-3xl font-bold text-green-500">{syncResults.reduce((a, r) => a + r.created, 0).toLocaleString()}</div>
                  <div className="text-xs text-gray-500">creados</div>
                </div>
                {syncResults.some(r => (r.updated || 0) > 0) && (
                  <div>
                    <div className="text-3xl font-bold text-blue-500">{syncResults.reduce((a, r) => a + (r.updated || 0), 0).toLocaleString()}</div>
                    <div className="text-xs text-gray-500">actualizados</div>
                  </div>
                )}
                <div>
                  <div className="text-3xl font-bold text-gray-400">{syncResults.reduce((a, r) => a + r.skipped, 0).toLocaleString()}</div>
                  <div className="text-xs text-gray-500">ya existían</div>
                </div>
              </div>
            </div>

            {/* Results per entity */}
            <div className="bg-white dark:bg-[#161616] rounded-2xl border border-gray-200 dark:border-gray-800 p-6">
              <h3 className="font-bold text-gray-900 dark:text-white mb-4">Detalle por entidad</h3>
              <div className="space-y-2">
                {syncResults.map(r => (
                  <div key={r.entity} className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-gray-50 dark:bg-gray-800/40">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{r.label}</span>
                    <div className="flex items-center gap-4 text-xs">
                      <span className="text-gray-400">{r.fetched.toLocaleString()} leídos</span>
                      {r.created > 0 && <span className="text-green-600 dark:text-green-400 font-semibold">+{r.created.toLocaleString()} creados</span>}
                      {(r.updated || 0) > 0 && <span className="text-blue-600 dark:text-blue-400">{r.updated} actualizados</span>}
                      {r.skipped > 0 && <span className="text-gray-500">{r.skipped.toLocaleString()} omitidos</span>}
                      {(r.errors?.length || 0) > 0 && <span className="text-red-500">{r.errors!.length} errores</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Show errors if any */}
            {syncResults.some(r => r.errors && r.errors.length > 0) && (
              <div className="bg-white dark:bg-[#161616] rounded-2xl border border-red-200 dark:border-red-800/30 p-6">
                <h3 className="font-bold text-red-600 dark:text-red-400 mb-3">Errores durante la sincronización</h3>
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {syncResults.filter(r => r.errors?.length).flatMap(r =>
                    r.errors!.map((err, i) => (
                      <div key={`${r.entity}-${i}`} className="text-xs text-red-600 dark:text-red-400 py-1">
                        <strong>{r.label}:</strong> {err}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-center gap-4">
              <button
                onClick={() => {
                  setSyncResults([]);
                  setSyncStatus({});
                  setSyncProgress(0);
                  setStep('preview');
                }}
                className="px-6 py-2.5 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-xl font-semibold transition text-sm"
              >
                Volver al panel
              </button>
              <button
                onClick={() => {
                  setStep('login');
                  clearSyncProgress();
                  setToken('');
                  setUserInfo(null);
                  setCounts({});
                  setUsername('');
                  setPassword('');
                  setSyncResults([]);
                }}
                className="px-6 py-2.5 bg-[#573CFF] hover:bg-[#4930d9] text-white rounded-xl font-semibold transition text-sm"
              >
                Nueva sincronización
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SoftSegurosBackup;
