import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import confetti from 'canvas-confetti';
import { createPortal } from 'react-dom';
import suraLogo from '../../../../assets/images/logoscompanias/sura.png';
import bolivarLogo from '../../../../assets/images/logoscompanias/bolivar.png';
import hdiLogo from '../../../../assets/images/logoscompanias/hdi.png';
import estadoLogo from '../../../../assets/images/logoscompanias/estado.png';
import axaLogo from '../../../../assets/images/logoscompanias/axa.png';
import equidadLogo from '../../../../assets/images/logoscompanias/equidad.png';
import mapfreLogo from '../../../../assets/images/logoscompanias/mapfre.png';
import qualitasLogo from '../../../../assets/images/logoscompanias/qualitas.svg';
import allianzLogo from '../../../../assets/images/logoscompanias/allianz.png';
import saasApi from '../../../../services/saasApi';

type InsurerCard = {
  id:
    | 'sura'
    | 'bolivar'
    | 'hdi'
    | 'axa-colpatria'
    | 'seguros-del-estado'
    | 'la-equidad'
    | 'mapfre'
    | 'qualitas'
    | 'allianz';
  name: string;
  description: string;
  logo?: string;
  shortLabel?: string;
  comingSoon?: boolean;
};

const insurers: InsurerCard[] = [
  {
    id: 'sura',
    name: 'Sura',
    description: 'Conecta Sura para sincronizar pólizas, clientes y renovaciones.',
    logo: suraLogo,
  },
  {
    id: 'bolivar',
    name: 'Bolívar',
    description: 'Conecta Seguros Bolívar y habilita la sincronización operativa.',
    logo: bolivarLogo,
  },
  {
    id: 'hdi',
    name: 'HDI',
    description: 'Conecta HDI para sincronizar pólizas, clientes y cartera.',
    logo: hdiLogo,
  },
  {
    id: 'axa-colpatria',
    name: 'Axa Colpatria',
    description: 'Configura Axa Colpatria para importar cartera y estados.',
    logo: axaLogo,
  },
  {
    id: 'seguros-del-estado',
    name: 'Seguros del Estado',
    description: 'Conecta Seguros del Estado para centralizar la gestión.',
    logo: estadoLogo,
  },
  {
    id: 'la-equidad',
    name: 'La Equidad',
    description: 'Conecta La Equidad para sincronizar pólizas, clientes y cartera.',
    logo: equidadLogo,
  },
  {
    id: 'mapfre',
    name: 'Mapfre',
    description: 'Integración con Mapfre para sincronizar pólizas y clientes. Disponible próximamente.',
    logo: mapfreLogo,
    comingSoon: true,
  },
  {
    id: 'qualitas',
    name: 'Quálitas',
    description: 'Integración con Quálitas para centralizar la operación. Disponible próximamente.',
    logo: qualitasLogo,
    comingSoon: true,
  },
  {
    id: 'allianz',
    name: 'Allianz',
    description: 'Conecta Allianz para sincronizar recibos y cartera del mediador.',
    logo: allianzLogo,
  },
];

const ApisAseguradoras: React.FC = () => {
  const [connections, setConnections] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [busyByInsurer, setBusyByInsurer] = useState<Record<string, boolean>>({});
  const [syncingByInsurer, setSyncingByInsurer] = useState<Record<string, boolean>>({});
  const [syncResultByInsurer, setSyncResultByInsurer] = useState<Record<string, 'ok' | 'error' | null>>({});
  const syncPollRefs = useRef<Record<string, number>>({});

  const [modalOpen, setModalOpen] = useState(false);
  const [activeInsurer, setActiveInsurer] = useState<InsurerCard | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [modalError, setModalError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [modalStage, setModalStage] = useState<'form' | 'connecting' | 'mfa' | 'success'>('form');
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [connectingMessage, setConnectingMessage] = useState<string>('');
  const pollIntervalRef = useRef<number | null>(null);

  // Limpia intervalos al desmontar
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        window.clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      Object.values(syncPollRefs.current).forEach(window.clearInterval);
    };
  }, []);

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const loadConnections = async () => {
    try {
      setLoading(true);
      const res = await saasApi.getInsurerConnections();
      const byCode: Record<string, any> = {};
      (res.data || []).forEach((row: any) => {
        byCode[row.insurer_code] = row;
      });
      setConnections(byCode);
    } catch {
      // Silence to avoid blocking UI; card status will remain disconnected.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadConnections();
  }, []);

  const mergedInsurers = useMemo(() => {
    return insurers.map((insurer) => ({
      ...insurer,
      connection: connections[insurer.id] || null,
    }));
  }, [connections]);

  const openConnectModal = (insurer: InsurerCard) => {
    setActiveInsurer(insurer);
    setModalError('');
    setSubmitting(false);
    setModalStage('form');
    setChallengeId(null);
    setModalOpen(true);

    // Default vacío: el broker ingresa sus propias credenciales por seguridad.
    // AXA Colpatria mantiene el tipo de documento y perfil por defecto que la
    // mayoría de brokers usan, pero sin doc_number ni password.
    const defaults: Record<string, string> = {};
    if (insurer.id === 'axa-colpatria') {
      defaults.doc_type = 'CC';
      defaults.profile = 'ADM';
    }
    setFormData(defaults);
  };

  const closeModal = () => {
    stopPolling();
    setModalOpen(false);
    setActiveInsurer(null);
    setFormData({});
    setModalError('');
    setSubmitting(false);
    setModalStage('form');
    setChallengeId(null);
    setConnectingMessage('');
  };

  const setBusy = (insurerId: string, busy: boolean) => {
    setBusyByInsurer((prev) => ({ ...prev, [insurerId]: busy }));
  };

  /**
   * Espera a que termine un job de conexión async (queued|processing → terminal).
   * Mantiene el botón "ocupado" y refresca la lista al finalizar.
   */
  const pollCardJob = (insurerId: string) => {
    const startedAt = Date.now();
    const maxMs = 240_000;
    const interval = window.setInterval(async () => {
      if (Date.now() - startedAt > maxMs) {
        window.clearInterval(interval);
        setBusy(insurerId, false);
        await loadConnections();
        return;
      }
      let res;
      try {
        res = await saasApi.getConnectStatus(insurerId);
      } catch {
        return;
      }
      const data: any = res?.data || {};
      const s = data.connect_job_status || 'idle';
      if (s === 'success' || s === 'failed' || s === 'requires_mfa' || s === 'idle') {
        window.clearInterval(interval);
        setBusy(insurerId, false);
        await loadConnections();
      }
    }, 2000);
  };

  const runHealthCheck = async (insurerId: string) => {
    try {
      setBusy(insurerId, true);
      const res: any = await saasApi.healthCheckInsurer(insurerId);
      // 202 → backend encoló reconexión async, hacer polling sin bloquear
      if (res?.queued) {
        pollCardJob(insurerId);
        return;
      }
      await loadConnections();
      setBusy(insurerId, false);
    } catch {
      await loadConnections();
      setBusy(insurerId, false);
    }
  };

  const reconnect = async (insurerId: string) => {
    try {
      setBusy(insurerId, true);
      const res: any = await saasApi.reconnectInsurer(insurerId);
      if (res?.queued) {
        pollCardJob(insurerId);
        return;
      }
      await loadConnections();
      setBusy(insurerId, false);
    } catch {
      await loadConnections();
      setBusy(insurerId, false);
    }
  };

  const disconnect = async (insurerId: string) => {
    try {
      setBusy(insurerId, true);
      await saasApi.disconnectInsurer(insurerId);
      await loadConnections();
    } catch {
      await loadConnections();
    } finally {
      setBusy(insurerId, false);
    }
  };

  const triggerSync = async (insurer: InsurerCard) => {
    const id = insurer.id;
    if (syncPollRefs.current[id]) window.clearInterval(syncPollRefs.current[id]);
    setSyncingByInsurer((p) => ({ ...p, [id]: true }));
    setSyncResultByInsurer((p) => ({ ...p, [id]: null }));

    const finishSync = (result: 'ok' | 'error') => {
      if (syncPollRefs.current[id]) window.clearInterval(syncPollRefs.current[id]);
      setSyncingByInsurer((p) => ({ ...p, [id]: false }));
      setSyncResultByInsurer((p) => ({ ...p, [id]: result }));
      setTimeout(() => setSyncResultByInsurer((p) => ({ ...p, [id]: null })), 5000);
      if (result === 'ok') loadConnections();
    };

    try {
      const types = id === 'seguros-del-estado' ? ['clientes', 'polizas'] : ['clientes', 'polizas', 'cartera'];
      const res: any = await saasApi.syncInsurers([id], types);
      const batchId = res?.data?.batch_id;
      if (!batchId) throw new Error('Sin batch_id');

      let attempts = 0;
      syncPollRefs.current[id] = window.setInterval(async () => {
        attempts++;
        if (attempts > 120) { finishSync('error'); return; }
        try {
          const sr: any = await saasApi.getSyncStatus(batchId);
          const overall = sr?.data?.overall_status;
          if (overall === 'completed') finishSync('ok');
          else if (overall === 'failed' || overall === 'cancelled') finishSync('error');
        } catch { /* tolerar errores transitorios */ }
      }, 3000);
    } catch {
      finishSync('error');
    }
  };

  /**
   * Conexión asíncrona: el backend encola un Job y devuelve 202 inmediatamente.
   * Aquí hacemos polling a /connect-status cada 2s para reflejar el progreso
   * sin bloquear el resto de la app.
   */
  const connectInsurer = async () => {
    if (!activeInsurer) return;
    const insurerId = activeInsurer.id;
    try {
      stopPolling();
      setSubmitting(true);
      setModalError('');
      setModalStage('connecting');
      setConnectingMessage('Conectando con la aseguradora…');

      // 1) Dispatch del job (devuelve 202 rápido)
      if (insurerId === 'sura') {
        if (modalStage === 'mfa' && challengeId) {
          // Step 2: enviar OTP al backend (encola otro job)
          await saasApi.connectAutoInsurer('sura', undefined, formData.mfa_code, challengeId);
        } else {
          const creds = {
            doc_type: formData.doc_type || 'C',
            doc_number: formData.doc_number || '',
            password: formData.password || '',
          };
          await saasApi.connectAutoInsurer('sura', creds);
        }
      } else if (insurerId === 'seguros-del-estado') {
        await saasApi.connectBrowserInsurer(insurerId);
      } else {
        await saasApi.connectInsurer(insurerId, formData);
      }

      // 2) Polling del status del job (no bloquea otras llamadas)
      const startedAt = Date.now();
      const maxMs = 240_000; // 4 min hard cap

      pollIntervalRef.current = window.setInterval(async () => {
        // Timeout de seguridad
        if (Date.now() - startedAt > maxMs) {
          stopPolling();
          setModalError('La conexión está tardando demasiado. Inténtalo de nuevo.');
          setModalStage('form');
          setSubmitting(false);
          return;
        }

        let res;
        try {
          res = await saasApi.getConnectStatus(insurerId);
        } catch {
          return; // tolera errores transitorios y vuelve a intentar
        }
        const data: any = res?.data || {};
        const jobStatus = data.connect_job_status || 'idle';

        if (data.connect_job_message) {
          setConnectingMessage(data.connect_job_message);
        }

        // ── MFA requerido ──
        if (jobStatus === 'requires_mfa') {
          stopPolling();
          setChallengeId(data.challenge_id || null);
          setModalStage('mfa');
          setModalError('');
          setSubmitting(false);
          return;
        }

        // ── Éxito ──
        if (jobStatus === 'success' || data.connected === true) {
          stopPolling();
          setChallengeId(null);
          setModalStage('success');
          const duration = 1300;
          const end = Date.now() + duration;
          const colors = ['#573CFF', '#7B61FF', '#A78BFA', '#ffffff'];
          (function frame() {
            confetti({ particleCount: 5, angle: 60, spread: 60, origin: { x: 0 }, colors });
            confetti({ particleCount: 5, angle: 120, spread: 60, origin: { x: 1 }, colors });
            if (Date.now() < end) requestAnimationFrame(frame);
          })();
          setTimeout(() => closeModal(), 1400);
          await loadConnections();
          return;
        }

        // ── Falla ──
        if (jobStatus === 'failed') {
          stopPolling();
          const err = data.connect_job_error || data.connect_job_message || 'No se pudo conectar';
          setModalError(typeof err === 'string' ? err : JSON.stringify(err));
          setModalStage('form');
          setSubmitting(false);
          return;
        }

        // queued / processing → seguir esperando
      }, 2000);
    } catch (e: any) {
      stopPolling();
      const detail = e?.details?.error || e?.details?.message || '';
      const msg = e?.message || 'No se pudo iniciar la conexión';
      setModalError(detail ? `${msg} — ${detail}` : msg);
      setModalStage('form');
      setSubmitting(false);
    }
  };

  const statusView = (rawStatus?: string) => {
    if (rawStatus === 'connected') {
      return {
        label: 'conectado',
        className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30',
      };
    }
    if (rawStatus === 'reconnect_required' || rawStatus === 'error') {
      return {
        label: 'reconectar',
        className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30',
      };
    }
    return {
      label: loading ? 'cargando' : 'desconectado',
      className: 'bg-gray-100 dark:bg-neutral-800 text-gray-500 dark:text-neutral-400 border border-gray-300 dark:border-neutral-700',
    };
  };

  const renderCredentialFields = () => {
    if (!activeInsurer) return null;

    if (activeInsurer.id === 'sura') {
      // Paso 2: si el backend pidió MFA, mostramos input para el OTP.
      if (modalStage === 'mfa') {
        return (
          <div className="space-y-3">
            <div className="rounded-xl bg-[#573CFF]/8 dark:bg-[#573CFF]/15 border border-[#573CFF]/20 px-4 py-3 flex gap-3 items-start">
              <div className="mt-0.5 text-[#573CFF] shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
              </div>
              <div className="text-xs text-gray-700 dark:text-neutral-300 space-y-1">
                <p className="font-semibold text-gray-900 dark:text-white">Verificación doble factor</p>
                <p>Abre tu app de autenticación (Google Authenticator / Microsoft Authenticator) y copia el código de 6 dígitos de <strong>SURA</strong>.</p>
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 dark:text-neutral-400 block mb-1.5">Código de 6 dígitos</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoFocus
                placeholder="000000"
                value={formData.mfa_code || ''}
                onChange={(e) => setFormData({ ...formData, mfa_code: e.target.value.replace(/\D/g, '') })}
                className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-center text-xl font-mono tracking-widest text-gray-900 dark:text-white focus:outline-none focus:border-[#573CFF] focus:ring-2 focus:ring-[#573CFF]/30"
              />
            </div>
            <div className="rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 px-3 py-2 text-xs text-gray-500 dark:text-neutral-400">
              El código cambia cada 30 segundos. Si expira, espera uno nuevo en tu app antes de enviar.
            </div>
          </div>
        );
      }

      // Paso 1: credenciales
      return (
        <div className="space-y-3">
          <div className="rounded-xl bg-[#573CFF]/8 dark:bg-[#573CFF]/15 border border-[#573CFF]/20 px-4 py-3 flex gap-3 items-start">
            <div className="mt-0.5 text-[#573CFF] shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            </div>
            <div className="text-xs text-gray-700 dark:text-neutral-300 space-y-1">
              <p className="font-semibold text-gray-900 dark:text-white">Ingresa con tus credenciales de Asesores SURA</p>
              <p>Si tu cuenta tiene MFA activado, después te pediremos el código del Authenticator.</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-gray-500 dark:text-neutral-400 block mb-1.5">Tipo doc.</label>
              <select
                value={formData.doc_type || 'C'}
                onChange={(e) => setFormData({ ...formData, doc_type: e.target.value })}
                className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#573CFF] focus:ring-2 focus:ring-[#573CFF]/30"
              >
                <option value="C">Cédula</option>
                <option value="E">Cédula Extranjería</option>
                <option value="A">NIT</option>
                <option value="CA">NIT Persona Natural</option>
                <option value="P">Pasaporte</option>
                <option value="T">Tarj. Identidad</option>
                <option value="X">Doc. Ident. Extranjeros</option>
                <option value="N">NUIP</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 dark:text-neutral-400 block mb-1.5">Número documento</label>
              <input
                type="text"
                placeholder="9007093091"
                value={formData.doc_number || ''}
                onChange={(e) => setFormData({ ...formData, doc_number: e.target.value })}
                className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#573CFF] focus:ring-2 focus:ring-[#573CFF]/30"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 dark:text-neutral-400 block mb-1.5">Contraseña</label>
            <input
              type="password"
              placeholder="••••••••"
              value={formData.password || ''}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full rounded-lg border border-gray-300 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#573CFF] focus:ring-2 focus:ring-[#573CFF]/30"
            />
          </div>
          <div className="rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 px-3 py-2 text-xs text-gray-500 dark:text-neutral-400">
            Tus credenciales se cifran y se guardan solo para reconexión automática (TTL ~6h).
          </div>
        </div>
      );
    }

    if (activeInsurer.id === 'seguros-del-estado') {
      return (
        <div className="space-y-3">
          <div className="rounded-xl bg-[#573CFF]/8 dark:bg-[#573CFF]/15 border border-[#573CFF]/20 px-4 py-3 flex gap-3 items-start">
            <div className="mt-0.5 text-[#573CFF] shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            </div>
            <div className="text-xs text-gray-700 dark:text-neutral-300 space-y-1">
              <p className="font-semibold text-gray-900 dark:text-white">Login manual — se abrirá Chrome</p>
              <p>Al presionar <strong>Conectar</strong>, se abrirá una ventana de Chrome con el portal de Seguros del Estado.</p>
              <p>Inicia sesión normalmente (usuario, contraseña, CAPTCHA si aparece). Una vez dentro del dashboard, <strong>la conexión se completa sola</strong>.</p>
            </div>
          </div>
          <div className="rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-200 dark:border-neutral-700 px-3 py-2 text-xs text-gray-500 dark:text-neutral-400">
            La sesión dura ~8 horas. Después deberás reconectar de la misma forma.
          </div>
        </div>
      );
    }

    if (activeInsurer.id === 'la-equidad') {
      return (
        <>
          <label className="block">
            <span className="text-xs text-gray-500 dark:text-neutral-400 mb-1 block">Email</span>
            <input
              type="email"
              value={formData.email || ''}
              onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
              className="w-full rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-[#573CFF]"
              placeholder="correo@dominio.com"
              autoComplete="email"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500 dark:text-neutral-400 mb-1 block">Contraseña</span>
            <input
              type="password"
              value={formData.password || ''}
              onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
              className="w-full rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-[#573CFF]"
              placeholder="Contraseña del portal intermediario"
              autoComplete="current-password"
            />
          </label>
        </>
      );
    }

    if (activeInsurer.id === 'allianz') {
      return (
        <>
          <div className="rounded-xl bg-[#573CFF]/8 dark:bg-[#573CFF]/15 border border-[#573CFF]/20 px-4 py-3 flex gap-3 items-start">
            <div className="mt-0.5 text-[#573CFF] shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
            </div>
            <div className="text-xs text-gray-700 dark:text-neutral-300 space-y-1">
              <p className="font-semibold text-gray-900 dark:text-white">Portal Allianz ePAC</p>
              <p>Ingresa con tu usuario del portal <strong>allia2net.com.co</strong>. La sesión se renueva automáticamente (TTL ~1h).</p>
            </div>
          </div>
          <label className="block">
            <span className="text-xs text-gray-500 dark:text-neutral-400 mb-1 block">Usuario</span>
            <input
              type="text"
              value={formData.username || ''}
              onChange={(e) => setFormData((p) => ({ ...p, username: e.target.value }))}
              className="w-full rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-[#573CFF]"
              placeholder="CA014200"
              autoComplete="username"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500 dark:text-neutral-400 mb-1 block">Contraseña</span>
            <input
              type="password"
              value={formData.password || ''}
              onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
              className="w-full rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-[#573CFF]"
              placeholder="Contraseña del portal"
              autoComplete="current-password"
            />
          </label>
        </>
      );
    }

    if (activeInsurer.id === 'axa-colpatria') {
      return (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs text-gray-500 dark:text-neutral-400 mb-1 block">Tipo doc.</span>
              <select
                value={formData.doc_type || 'CC'}
                onChange={(e) => setFormData((p) => ({ ...p, doc_type: e.target.value }))}
                className="w-full rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-[#573CFF]"
              >
                <option value="CC">CC</option>
                <option value="CE">CE</option>
                <option value="NIT">NIT</option>
                <option value="PA">PA</option>
              </select>
            </label>
            <label className="block">
              <span className="text-xs text-gray-500 dark:text-neutral-400 mb-1 block">Perfil</span>
              <input
                value={formData.profile || 'ADM'}
                onChange={(e) => setFormData((p) => ({ ...p, profile: e.target.value }))}
                className="w-full rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-[#573CFF]"
                placeholder="ADM"
              />
            </label>
          </div>
          <label className="block">
            <span className="text-xs text-gray-500 dark:text-neutral-400 mb-1 block">Número documento</span>
            <input
              value={formData.doc_number || ''}
              onChange={(e) => setFormData((p) => ({ ...p, doc_number: e.target.value }))}
              className="w-full rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-[#573CFF]"
              placeholder="Número de documento"
            />
          </label>
          <label className="block">
            <span className="text-xs text-gray-500 dark:text-neutral-400 mb-1 block">Contraseña</span>
            <input
              type="password"
              value={formData.password || ''}
              onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
              className="w-full rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-[#573CFF]"
              placeholder="Contraseña"
            />
          </label>
        </>
      );
    }

    return (
      <>
        <label className="block">
          <span className="text-xs text-gray-500 dark:text-neutral-400 mb-1 block">Número documento</span>
          <input
            value={formData.doc_number || ''}
            onChange={(e) => setFormData((p) => ({ ...p, doc_number: e.target.value }))}
            className="w-full rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-[#573CFF]"
            placeholder="Número de documento"
          />
        </label>
        <label className="block">
          <span className="text-xs text-gray-500 dark:text-neutral-400 mb-1 block">Contraseña</span>
          <input
            type="password"
            value={formData.password || ''}
            onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
            className="w-full rounded-lg bg-gray-50 dark:bg-neutral-900 border border-gray-300 dark:border-neutral-700 px-3 py-2 text-sm text-gray-900 dark:text-white outline-none focus:border-[#573CFF]"
            placeholder="Contraseña"
          />
        </label>
      </>
    );
  };

  return (
    <>
      <div
        className="-mx-4 md:-mx-6 xl:-mx-8 2xl:-mx-10 -mt-8 md:-mt-10 min-h-[calc(100vh-8rem)] px-4 md:px-6 xl:px-8 2xl:px-10 py-10 md:py-12 pb-16 text-gray-900 dark:text-white"
        style={{ fontFamily: "'General Sans', system-ui, sans-serif" }}
      >
        <div className="max-w-6xl mx-auto w-full">
          <h1 className="text-[34px] font-bold tracking-[-0.02em] mb-1">Conecta tus plataformas</h1>
          <p className="text-gray-500 dark:text-neutral-400 text-sm mb-7">
            Gestiona tus integraciones y autoriza los accesos necesarios.
          </p>

          <div className="flex items-center gap-6 border-b border-gray-200 dark:border-neutral-800 mb-6">
            <button
              type="button"
              className="relative pb-3 text-sm font-semibold text-gray-900 dark:text-white after:content-[''] after:absolute after:left-0 after:right-0 after:-bottom-px after:h-[2px] after:bg-[#573CFF]"
            >
              CANALES
            </button>
            <button type="button" className="pb-3 text-sm font-medium text-gray-400 dark:text-neutral-500">
              FINANCIERAS
            </button>
            <span className="mb-[13px] -ml-3 px-1.5 py-[2px] rounded-full text-[9px] font-semibold bg-[#573CFF]/20 text-[#573CFF] border border-[#573CFF]/30 leading-none">
              PRÓXIMAMENTE
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {mergedInsurers.map((insurer) => {
              const currentStatus = statusView(insurer.connection?.status);
              const isConnected = insurer.connection?.status === 'connected';
              const needsReconnect =
                insurer.connection?.status === 'reconnect_required' || insurer.connection?.status === 'error';
              const busy = !!busyByInsurer[insurer.id];

              return (
              <div
                key={insurer.id}
                className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-white dark:bg-neutral-950/70 p-4 md:p-5 flex flex-col min-h-[220px] shadow-sm dark:shadow-none"
              >
                <div className="flex items-start justify-between gap-3 mb-5">
                  <div className="w-12 h-12 rounded-xl bg-white flex items-center justify-center overflow-hidden">
                    {insurer.logo ? (
                      <img src={insurer.logo} alt={insurer.name} className="w-9 h-9 object-contain" />
                    ) : (
                      <span className="text-[12px] font-bold tracking-wide text-[#111]">{insurer.shortLabel || insurer.name.slice(0, 3).toUpperCase()}</span>
                    )}
                  </div>
                  {insurer.comingSoon ? (
                    <span className="px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide bg-[#573CFF]/15 text-[#573CFF] dark:text-[#a78bfa] border border-[#573CFF]/30">
                      próximamente
                    </span>
                  ) : (
                    <span className={`px-2 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wide ${currentStatus.className}`}>
                      {currentStatus.label}
                    </span>
                  )}
                </div>

                <h3 className="text-lg font-semibold text-gray-900 dark:text-white leading-tight mb-2">{insurer.name}</h3>
                <p className="text-sm text-gray-500 dark:text-neutral-400 leading-relaxed mb-5 flex-1">{insurer.description}</p>

                <div className="flex items-center gap-2">
                  {insurer.comingSoon && (
                    <button
                      type="button"
                      disabled
                      title="La integración con esta aseguradora estará disponible pronto"
                      className="w-fit rounded-lg border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 text-gray-400 dark:text-neutral-500 text-sm font-medium px-4 py-2 cursor-not-allowed opacity-70"
                    >
                      Próximamente
                    </button>
                  )}

                  {!insurer.comingSoon && !isConnected && !needsReconnect && (
                    <button
                      type="button"
                      onClick={() => openConnectModal(insurer)}
                      disabled={busy}
                      className="w-fit rounded-lg border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-50 text-gray-900 dark:text-white text-sm font-medium px-4 py-2 transition-colors"
                    >
                      {busy ? 'Conectando...' : 'Conectar'}
                    </button>
                  )}

                  {isConnected && (
                    <>
                      <button
                        type="button"
                        onClick={() => triggerSync(insurer)}
                        disabled={busy || !!syncingByInsurer[insurer.id]}
                        className="w-fit rounded-lg border border-[#573CFF]/40 bg-[#573CFF]/15 hover:bg-[#573CFF]/25 disabled:opacity-50 text-white text-sm font-medium px-3 py-2 transition-colors flex items-center gap-1.5"
                        title="Importar clientes, pólizas y cartera desde la aseguradora"
                      >
                        <Icon
                          icon={syncingByInsurer[insurer.id] ? 'solar:refresh-bold' : syncResultByInsurer[insurer.id] === 'ok' ? 'solar:check-circle-bold' : syncResultByInsurer[insurer.id] === 'error' ? 'solar:close-circle-bold' : 'solar:refresh-linear'}
                          width={14}
                          className={syncingByInsurer[insurer.id] ? 'animate-spin' : syncResultByInsurer[insurer.id] === 'error' ? 'text-red-400' : ''}
                        />
                        {syncingByInsurer[insurer.id] ? 'Sincronizando...' : 'Sincronizar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => disconnect(insurer.id)}
                        disabled={busy || !!syncingByInsurer[insurer.id]}
                        className="w-fit rounded-lg border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-50 text-gray-600 dark:text-neutral-300 text-sm font-medium px-4 py-2 transition-colors"
                      >
                        Desconectar
                      </button>
                    </>
                  )}

                  {needsReconnect && (
                    <>
                      <button
                        type="button"
                        onClick={() => reconnect(insurer.id)}
                        disabled={busy}
                        className="w-fit rounded-lg border border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/25 disabled:opacity-50 text-amber-100 text-sm font-medium px-4 py-2 transition-colors"
                      >
                        {busy ? 'Reconectando...' : 'Reconectar'}
                      </button>
                      <button
                        type="button"
                        onClick={() => openConnectModal(insurer)}
                        disabled={busy}
                        className="w-fit rounded-lg border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 hover:bg-gray-100 dark:hover:bg-neutral-800 disabled:opacity-50 text-gray-600 dark:text-neutral-300 text-sm font-medium px-4 py-2 transition-colors"
                      >
                        Editar
                      </button>
                    </>
                  )}
                </div>

                {syncResultByInsurer[insurer.id] === 'ok' && (
                  <p className="mt-3 text-[11px] text-emerald-600 dark:text-emerald-400 leading-snug flex items-center gap-1">
                    <Icon icon="solar:check-circle-bold" width={12} />
                    Sincronización completada
                  </p>
                )}
                {syncResultByInsurer[insurer.id] === 'error' && (
                  <p className="mt-3 text-[11px] text-red-500 dark:text-red-400 leading-snug flex items-center gap-1">
                    <Icon icon="solar:close-circle-bold" width={12} />
                    Error al sincronizar. Verifica la conexión.
                  </p>
                )}
                {!syncResultByInsurer[insurer.id] && insurer.connection?.last_error && (
                  <p className="mt-3 text-[11px] text-amber-600 dark:text-amber-300/85 leading-snug">
                    {insurer.connection.last_error}
                  </p>
                )}
              </div>
              );
            })}
          </div>
        </div>
      </div>

      {modalOpen && activeInsurer && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[9999] bg-white dark:bg-[#0d0d0e] text-gray-900 dark:text-white">
          <button
            type="button"
            onClick={closeModal}
            className="absolute top-5 right-5 z-[10] w-8 h-8 rounded-lg text-gray-400 dark:text-neutral-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5 transition-colors flex items-center justify-center"
            aria-label="Cerrar"
          >
            <Icon icon="solar:close-circle-linear" width={18} />
          </button>

          <div className="h-full flex">
            <aside className="hidden lg:flex w-[300px] border-r border-gray-200 dark:border-neutral-800/80 p-8 items-end">
              <div>
                <p className="text-[44px] leading-[0.95] font-semibold tracking-[-0.02em] text-gray-900 dark:text-white">
                  Elige tu<br />plataforma
                </p>
                <p className="text-gray-400 dark:text-neutral-500 text-[15px] mt-2 leading-tight">
                  Configura el acceso para mantener la conexión activa.
                </p>
              </div>
            </aside>

            <main className="flex-1 flex items-center justify-center px-5 md:px-8">
              <div className="w-full max-w-2xl">
                {(modalStage === 'form' || modalStage === 'mfa') && (
                  <>
                    <h3 className="text-[36px] leading-tight font-semibold tracking-[-0.02em] mb-2">
                      {modalStage === 'mfa' ? 'Verificación doble factor' : '¿Qué plataforma vas a configurar?'}
                    </h3>
                    <p className="text-gray-500 dark:text-neutral-400 text-[15px] mb-6">
                      {modalStage === 'mfa'
                        ? 'Ingresa el código de 6 dígitos de tu aplicación de autenticación.'
                        : 'Guarda tus credenciales para reconexión automática cuando la sesión expire.'}
                    </p>

                    <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-gray-50 dark:bg-neutral-950/70 px-4 py-3 mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-white dark:bg-white flex items-center justify-center overflow-hidden border border-gray-200 dark:border-transparent">
                          {activeInsurer.logo ? (
                            <img src={activeInsurer.logo} alt={activeInsurer.name} className="w-8 h-8 object-contain" />
                          ) : (
                            <span className="text-[11px] font-bold tracking-wide text-[#111]">{activeInsurer.shortLabel || activeInsurer.name.slice(0, 3).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{activeInsurer.name}</p>
                          <p className="text-xs text-gray-500 dark:text-neutral-400 truncate">{activeInsurer.description}</p>
                        </div>
                      </div>
                      <Icon icon="solar:alt-arrow-right-linear" width={16} className="text-gray-400 dark:text-neutral-500" />
                    </div>

                    <div className="rounded-2xl border border-gray-200 dark:border-neutral-800 bg-gray-50/50 dark:bg-neutral-950/60 p-4 md:p-5">
                      <div className="space-y-3">{renderCredentialFields()}</div>

                      {modalError && <p className="mt-3 text-sm text-red-400">{modalError}</p>}

                      <div className="flex items-center justify-end gap-2 mt-5">
                        <button
                          type="button"
                          onClick={closeModal}
                          className="rounded-lg border border-gray-300 dark:border-neutral-700 px-4 py-2 text-sm text-gray-600 dark:text-neutral-300 hover:bg-gray-100 dark:hover:bg-neutral-900"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={connectInsurer}
                          disabled={submitting}
                          className="rounded-lg border border-[#573CFF]/40 bg-[#573CFF] hover:bg-[#4b31e6] disabled:opacity-60 px-4 py-2 text-sm text-white font-medium"
                        >
                          {submitting
                            ? (modalStage === 'mfa' ? 'Validando código...' : 'Conectando...')
                            : modalStage === 'mfa'
                              ? 'Validar código'
                              : activeInsurer?.id === 'seguros-del-estado'
                                ? 'Abrir Chrome y conectar'
                                : 'Guardar y conectar'}
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {(modalStage === 'connecting' || modalStage === 'success') && (
                  <div className="text-center">
                    <h3 className="text-[24px] leading-tight font-semibold tracking-[-0.02em] mb-2">
                      {modalStage === 'connecting' ? `Conectando con ${activeInsurer.name}...` : 'Conexión exitosa'}
                    </h3>
                    <p className="text-gray-500 dark:text-neutral-400 text-[13px] mb-10">
                      {modalStage === 'connecting'
                        ? activeInsurer.id === 'seguros-del-estado'
                          ? 'Se abrió una ventana de Chrome. Inicia sesión allí con tu usuario y contraseña. Una vez dentro, la conexión se completa sola.'
                          : (connectingMessage || 'Estamos validando acceso y creando una sesión persistente.')
                        : `${activeInsurer.name} quedó conectada con GURO.`}
                    </p>

                    <div className="flex items-center justify-center gap-4 sm:gap-6">
                      <div className="w-20 h-20 sm:w-[5.6rem] sm:h-[5.6rem] rounded-full border border-[#573CFF]/40 bg-gradient-to-br from-[#573CFF] to-[#8b6dff] flex items-center justify-center overflow-hidden shadow-[0_0_40px_rgba(87,60,255,0.35)]">
                        <img src="/favicon.png" alt="Guro" className="w-full h-full object-cover scale-110" />
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="relative w-20 sm:w-28 h-[1px]">
                          <div className="absolute inset-0 border-t border-dashed border-gray-300 dark:border-neutral-700" />
                          {modalStage === 'connecting' && (
                            <>
                              <div className="absolute top-1/2 left-0 -translate-y-1/2 h-[1px] w-10 bg-gradient-to-r from-transparent via-[#573CFF] to-transparent animate-[flowRight_1.1s_linear_infinite]" />
                              <div className="absolute top-1/2 left-0 -translate-y-1/2 w-2 h-2 rounded-full bg-[#573CFF] shadow-[0_0_10px_rgba(87,60,255,0.9)] animate-[dotRight_1.1s_linear_infinite]" />
                            </>
                          )}
                        </div>
                        <div className="w-7 h-7 rounded-full border border-gray-300 dark:border-neutral-700 bg-gray-50 dark:bg-neutral-900 flex items-center justify-center shrink-0">
                          <div className={`w-2.5 h-2.5 rounded-full ${modalStage === 'connecting' ? 'bg-[#573CFF] animate-pulse' : 'bg-emerald-400'}`} />
                        </div>
                        <div className="relative w-20 sm:w-28 h-[1px]">
                          <div className="absolute inset-0 border-t border-dashed border-gray-300 dark:border-neutral-700" />
                          {modalStage === 'connecting' && (
                            <>
                              <div className="absolute top-1/2 left-0 -translate-y-1/2 h-[1px] w-10 bg-gradient-to-r from-transparent via-[#573CFF] to-transparent animate-[flowRight_1.1s_linear_infinite]" />
                              <div className="absolute top-1/2 left-0 -translate-y-1/2 w-2 h-2 rounded-full bg-[#573CFF] shadow-[0_0_10px_rgba(87,60,255,0.9)] animate-[dotRight_1.1s_linear_infinite]" />
                            </>
                          )}
                        </div>
                      </div>

                      <div className="w-20 h-20 sm:w-[5.6rem] sm:h-[5.6rem] rounded-full border border-gray-200 dark:border-white/70 bg-white flex items-center justify-center overflow-hidden p-3">
                        {activeInsurer.logo ? (
                          <img
                            src={activeInsurer.logo}
                            alt={activeInsurer.name}
                            className="w-full h-full object-contain"
                          />
                        ) : (
                          <span className="text-[15px] font-bold tracking-wide text-gray-900 dark:text-white">{activeInsurer.shortLabel || activeInsurer.name.slice(0, 3).toUpperCase()}</span>
                        )}
                      </div>
                    </div>

                    <style>{`
                      @keyframes dotRight {
                        0% { left: 0%; opacity: 0; }
                        10% { opacity: 1; }
                        90% { opacity: 1; }
                        100% { left: calc(100% - 0.5rem); opacity: 0; }
                      }
                      @keyframes flowRight {
                        0% { left: 0%; opacity: 0; }
                        20% { opacity: 1; }
                        80% { opacity: 1; }
                        100% { left: calc(100% - 2.5rem); opacity: 0; }
                      }
                    `}</style>
                  </div>
                )}
              </div>
            </main>
          </div>
        </div>
      , document.body)}
    </>
  );
};

export default ApisAseguradoras;
