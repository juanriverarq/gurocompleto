import { useEffect, useState } from 'react';
import api from '../lib/api';
import {
  Link2,
  Plus,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  Eye,
  EyeOff,
  Zap,
} from 'lucide-react';

interface Insurer {
  id: string;
  slug: string;
  name: string;
  description: string;
  isActive: boolean;
  hasConnector: boolean;
}

interface Connection {
  id: string;
  insurer: Insurer;
  username: string;
  status: string;
  lastSyncAt: string | null;
  lastError: string | null;
  autoSync: boolean;
  syncCount: number;
  createdAt: string;
}

export function ConnectionsPage() {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [insurers, setInsurers] = useState<Insurer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedInsurer, setSelectedInsurer] = useState<Insurer | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState('');
  const [connectSuccess, setConnectSuccess] = useState('');
  const [syncing, setSyncing] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<{ message: string; current: number; total: number } | null>(null);
  const [syncResult, setSyncResult] = useState<{ connectionId: string; message: string } | null>(null);
  const [suraCookies, setSuraCookies] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [connRes, insRes] = await Promise.all([
        api.get('/connections'),
        api.get('/insurers'),
      ]);
      setConnections(connRes.data.data);
      setInsurers(insRes.data.data);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedInsurer) return;
    setConnecting(true);
    setConnectError('');
    setConnectSuccess('');
    try {
      const isSura = selectedInsurer.slug === 'sura';
      const extraConfig: Record<string, any> = {};
      if (isSura) {
        extraConfig.cookies = suraCookies;
      }

      const res = await api.post('/connections', {
        insurerSlug: selectedInsurer.slug,
        username: isSura ? 'cookie-auth' : username,
        password: isSura ? 'cookie-auth' : password,
        extraConfig,
      });

      if (res.data.success) {
        setConnectSuccess(res.data.userInfo?.name ? `Conectado como ${res.data.userInfo.name}` : 'Conexión exitosa');
        setTimeout(() => {
          setShowModal(false);
          resetModal();
          fetchData();
        }, 1500);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || 'Error al conectar';
      setConnectError(msg);
    } finally {
      setConnecting(false);
    }
  };

  const resetModal = () => {
    setSelectedInsurer(null);
    setUsername('');
    setPassword('');
    setSuraCookies('');
    setConnectError('');
    setConnectSuccess('');
  };

  const handleSync = async (connectionId: string) => {
    setSyncing(connectionId);
    setSyncProgress(null);
    setSyncResult(null);
    try {
      const res = await api.post(`/sync/${connectionId}`);
      const syncLogId = res.data.data?.syncLogId;
      if (syncLogId) {
        pollSyncStatus(syncLogId, connectionId);
      }
    } catch (err: any) {
      console.error('Sync error:', err);
      setSyncing(null);
      setSyncResult({ connectionId, message: err.response?.data?.message || 'Error al sincronizar' });
    }
  };

  const pollSyncStatus = async (syncLogId: string, connectionId: string) => {
    const poll = async () => {
      try {
        const res = await api.get(`/sync/logs/${syncLogId}`);
        const log = res.data.data;
        const meta = log.metadata as any;

        if (meta?.progressMessage) {
          setSyncProgress({
            message: meta.progressMessage,
            current: meta.progressCurrent || 0,
            total: meta.progressTotal || 100,
          });
        }

        if (log.status === 'RUNNING') {
          setTimeout(poll, 1500);
        } else {
          // Sync finished
          setSyncing(null);
          setSyncProgress(null);
          const pols = meta?.policiesSynced || 0;
          const cls = meta?.clientsSynced || 0;
          if (log.status === 'COMPLETED') {
            setSyncResult({ connectionId, message: `Sincronizado: ${pols} pólizas, ${cls} clientes` });
          } else {
            setSyncResult({ connectionId, message: log.errorMessage || 'Error en sincronización' });
          }
          fetchData();
        }
      } catch {
        setSyncing(null);
        setSyncProgress(null);
      }
    };
    setTimeout(poll, 1000);
  };

  const handleDelete = async (connectionId: string) => {
    if (!confirm('¿Eliminar esta conexión? Se perderán los datos sincronizados.')) return;
    try {
      await api.delete(`/connections/${connectionId}`);
      fetchData();
    } catch (err) {
      console.error('Delete error:', err);
    }
  };

  const connectedSlugs = connections.map((c) => c.insurer.slug);
  const availableInsurers = insurers.filter((i) => !connectedSlugs.includes(i.slug));

  const statusBadge = (status: string) => {
    const map: Record<string, { class: string; label: string; icon: any }> = {
      CONNECTED: { class: 'bg-green-100 text-green-700', label: 'Conectado', icon: CheckCircle2 },
      DISCONNECTED: { class: 'bg-gray-100 text-gray-600', label: 'Desconectado', icon: XCircle },
      SYNCING: { class: 'bg-blue-100 text-blue-700', label: 'Sincronizando', icon: Loader2 },
      ERROR: { class: 'bg-red-100 text-red-700', label: 'Error', icon: AlertTriangle },
      SESSION_EXPIRED: { class: 'bg-yellow-100 text-yellow-700', label: 'Sesión expirada', icon: AlertTriangle },
    };
    const s = map[status] || map.DISCONNECTED;
    const Icon = s.icon;
    return (
      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${s.class}`}>
        <Icon className={`h-3.5 w-3.5 ${status === 'SYNCING' ? 'animate-spin' : ''}`} />
        {s.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Conexiones</h1>
          <p className="text-sm text-gray-500 mt-1">Conecta tus aseguradoras con usuario y contraseña</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Agregar Conexión
        </button>
      </div>

      {/* Active Connections */}
      {connections.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white p-12 text-center">
          <Link2 className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-4 text-lg font-medium text-gray-900">Sin conexiones</h3>
          <p className="mt-2 text-sm text-gray-500">
            Agrega tu primera aseguradora para comenzar a sincronizar pólizas, clientes y cartera.
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" />
            Conectar aseguradora
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {connections.map((conn) => (
            <div key={conn.id} className="rounded-xl border border-gray-200 bg-white p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-lg">
                    {conn.insurer.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">{conn.insurer.name}</h3>
                    <p className="text-sm text-gray-500">
                      Usuario: {conn.username}
                      {conn.lastSyncAt && (
                        <span className="ml-3">
                          Última sync: {new Date(conn.lastSyncAt).toLocaleDateString('es-CO')}
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {statusBadge(conn.status)}

                  <button
                    onClick={() => handleSync(conn.id)}
                    disabled={syncing === conn.id || conn.status === 'SYNCING'}
                    className="flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                    title="Sincronizar"
                  >
                    <RefreshCw className={`h-4 w-4 ${syncing === conn.id ? 'animate-spin' : ''}`} />
                    Sync
                  </button>

                  <button
                    onClick={() => handleDelete(conn.id)}
                    className="rounded-lg border border-gray-200 p-1.5 text-gray-400 hover:text-red-500 hover:border-red-200"
                    title="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {/* Sync progress */}
              {syncing === conn.id && syncProgress && (
                <div className="mt-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs text-blue-600">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {syncProgress.message}
                    </span>
                    <span>{syncProgress.current}/{syncProgress.total}</span>
                  </div>
                  <div className="h-1.5 w-full rounded-full bg-blue-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-blue-500 transition-all duration-300"
                      style={{ width: `${Math.min(100, (syncProgress.current / Math.max(1, syncProgress.total)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {syncing === conn.id && !syncProgress && (
                <div className="mt-3 flex items-center gap-2 text-xs text-blue-600">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Iniciando sincronización...
                </div>
              )}

              {/* Sync result */}
              {syncResult?.connectionId === conn.id && (
                <div className={`mt-3 rounded-lg px-3 py-2 text-xs flex items-center justify-between ${
                  syncResult.message.startsWith('Sincronizado') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
                }`}>
                  <span>{syncResult.message}</span>
                  <button onClick={() => setSyncResult(null)} className="ml-2 opacity-50 hover:opacity-100">&times;</button>
                </div>
              )}

              {conn.lastError && !syncResult?.connectionId && (
                <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">
                  {conn.lastError}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Connection Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
            <div className="border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedInsurer ? `Conectar ${selectedInsurer.name}` : 'Seleccionar Aseguradora'}
              </h2>
            </div>

            <div className="p-6">
              {!selectedInsurer ? (
                <div className="grid gap-2 max-h-96 overflow-y-auto">
                  {availableInsurers.map((ins) => (
                    <button
                      key={ins.slug}
                      onClick={() => ins.hasConnector && setSelectedInsurer(ins)}
                      disabled={!ins.hasConnector}
                      className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                        ins.hasConnector
                          ? 'border-gray-200 hover:border-primary hover:bg-primary/5 cursor-pointer'
                          : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg font-bold text-sm ${
                        ins.hasConnector ? 'bg-primary/10 text-primary' : 'bg-gray-200 text-gray-400'
                      }`}>
                        {ins.name.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{ins.name}</p>
                        <p className="text-xs text-gray-500">{ins.description}</p>
                      </div>
                      {ins.hasConnector ? (
                        <Zap className="h-4 w-4 text-green-500" />
                      ) : (
                        <span className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Próximamente</span>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {connectError && (
                    <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{connectError}</div>
                  )}
                  {connectSuccess && (
                    <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{connectSuccess}</div>
                  )}

                  {selectedInsurer.slug === 'sura' ? (
                    <>
                      <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700 space-y-1">
                        <p className="font-medium">Conexión por cookies de sesión</p>
                        <ol className="list-decimal list-inside text-xs space-y-0.5 text-blue-600">
                          <li>Abre <a href="https://asistentevirtualasesores.sura.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">asistentevirtualasesores.sura.com</a> e inicia sesión</li>
                          <li>Abre DevTools (F12) → pestaña Application → Cookies</li>
                          <li>Selecciona todas las cookies, clic derecho → Copiar</li>
                          <li>Pega las cookies abajo</li>
                        </ol>
                      </div>
                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">Cookies de sesión SURA</label>
                        <textarea
                          value={suraCookies}
                          onChange={(e) => setSuraCookies(e.target.value)}
                          rows={5}
                          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-xs font-mono outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
                          placeholder={'Pega las cookies aquí...\n\nFormato: nombre=valor; nombre2=valor2\nO pega la tabla de Chrome DevTools'}
                        />
                      </div>
                      <p className="text-xs text-gray-400">
                        También puedes ejecutar <code className="bg-gray-100 px-1 rounded">document.cookie</code> en la consola del navegador y pegar el resultado.
                      </p>
                    </>
                  ) : (
                    <>
                      <div className="rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
                        Ingresa las credenciales que usas para acceder al portal de {selectedInsurer.name}
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">Usuario</label>
                        <input
                          type="text"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                          placeholder="Tu usuario o NIT"
                        />
                      </div>

                      <div>
                        <label className="mb-1.5 block text-sm font-medium text-gray-700">Contraseña</label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full rounded-lg border border-gray-300 px-4 py-2.5 pr-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                            placeholder="Tu contraseña"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t px-6 py-4">
              <button
                onClick={() => {
                  setShowModal(false);
                  resetModal();
                }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              {selectedInsurer && (
                <button
                  onClick={handleConnect}
                  disabled={connecting || (selectedInsurer?.slug === 'sura' ? !suraCookies.trim() : (!username || !password))}
                  className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {connecting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <Link2 className="h-4 w-4" />
                      Conectar
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
