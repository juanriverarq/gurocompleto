import React, { useState, useEffect } from 'react';
import { saasApi } from 'src/services/saasApi';

const COTIZADORES_URL = import.meta.env.VITE_COTIZADORES_URL || 'http://localhost:8002';
const MAIN_MICRO_URL  = import.meta.env.VITE_MICROSERVICIO_URL || 'http://localhost:8002';

const LOGOS: Record<string, string> = {
  bolivar: '/src/assets/images/logoscompanias/bolivar.png',
  hdi:     '/src/assets/images/logoscompanias/hdi.png',
};
const INSURER_COLORS: Record<string, string> = {
  bolivar: '#E30613',
  hdi:     '#003DA5',
};
const INSURER_NAME: Record<string, string> = { bolivar: 'Bolívar', hdi: 'HDI' };

const fmtCOP = (v?: number | null) => {
  if (!v) return '—';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v);
};

const extractError = (detail: any): string => {
  if (!detail) return 'Error desconocido';
  if (typeof detail === 'string') return detail;
  if (typeof detail === 'object') {
    const msg = detail.message || detail.detail || detail.error;
    if (msg && typeof msg === 'string') return msg;
    if (msg && typeof msg === 'object') return extractError(msg);
    return JSON.stringify(detail);
  }
  return String(detail);
};

// ── Types ─────────────────────────────────────────────────────────────────────
interface PlanResult {
  plan: string;
  prima_neta: number | null;
  iva: number | null;
  prima_total: number | null;
  deducibles?: { daño_parcial?: string | null; daño_total?: string | null; hurto?: string | null };
  coberturas?: {
    rce_limite_smmlv?: number | null; asistencia_full?: number | null;
    asistencia?: number | null; asistencia_ligera?: number | null;
    accidentes_personales?: number | null; pequenos_siniestros?: number | null;
  };
  total_pago_anual?: number;
  cuota_financiacion?: number;
  amparos?: Array<{ codigo: string; prima: number; iva: number }>;
}

interface InsurerResult {
  aseguradora: string; code: 'bolivar' | 'hdi';
  num_cotizacion?: string; vehiculo?: Record<string, any>;
  planes: PlanResult[]; error?: string; loading: boolean;
}

type Step = 'placa' | 'vehiculo' | 'tomador' | 'cotizando' | 'resultado';

interface VehiculoData {
  placa: string;
  vehiculo: {
    marca?: string; modelo?: string; linea?: string; clase?: string;
    valor_comercial?: number; cod_tipo_desc?: string; vin?: string; color?: string; cilindraje?: string;
  };
  propietario_runt?: { tipo_doc?: string; num_doc?: string };
}

// ── Session hooks ─────────────────────────────────────────────────────────────
const SESSION_POLL_MS = 60 * 1000; // revalidate every 60s (Laravel keeps sessions alive)

/**
 * Helper: obtiene el session_id más fresco de insurer_connections.
 * Si el actual falló, pide a Laravel un healthcheck (que reconecta automáticamente).
 */
async function _freshSid(insurerCode: string, currentFailed: boolean): Promise<string | null> {
  // Si falló el actual, pedir a Laravel que reconecte transparentemente
  if (currentFailed) {
    await saasApi.healthCheckInsurer(insurerCode).catch(() => null);
  }
  const connsRes = await saasApi.getInsurerConnections().catch(() => null);
  const conn = (connsRes?.data || []).find((c: any) => c.insurer_code === insurerCode && c.microservice_session_id);
  return conn?.microservice_session_id || null;
}

function useBolivarSession() {
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('cot_bolivar_session') || '');
  const [sessionOk, setSessionOk] = useState(false);
  const adopt = async (): Promise<string | null> => {
    // 1. Intenta validar el cached
    const cached = localStorage.getItem('cot_bolivar_session');
    if (cached) {
      const r = await fetch(`${COTIZADORES_URL}/bolivar/session/${cached}/export`).catch(() => null);
      if (r?.ok) {
        const d = await r.json();
        if (d?.simon_cookies_str) { setSessionId(cached); setSessionOk(true); return cached; }
      }
    }
    // 2. Obtener sid fresco de Laravel (con reconexión transparente si falló)
    const freshSid = await _freshSid('bolivar', !!cached);
    const targetSid = freshSid || cached;
    if (!targetSid) { setSessionOk(false); return null; }

    // 3. Exportar desde main micro y adoptar en cotizadores
    const exp = await fetch(`${MAIN_MICRO_URL}/bolivar/session/${targetSid}/export`).catch(() => null);
    const expData = exp?.ok ? await exp.json() : null;
    if (expData?.simon_cookies_str) {
      const adoptRes = await fetch(`${COTIZADORES_URL}/bolivar/session/adopt`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(expData),
      }).catch(() => null);
      if (adoptRes?.ok) {
        localStorage.setItem('cot_bolivar_session', targetSid); setSessionId(targetSid); setSessionOk(true); return targetSid;
      }
    }
    setSessionOk(false);
    return null;
  };
  useEffect(() => {
    adopt();
    const t = setInterval(adopt, SESSION_POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') adopt(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  return { sessionId, sessionOk, adopt };
}

function useHdiSession() {
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('cot_hdi_session') || '');
  const [sessionOk, setSessionOk] = useState(false);
  const adopt = async (): Promise<string | null> => {
    // 1. Intenta validar el cached
    const cached = localStorage.getItem('cot_hdi_session');
    if (cached) {
      const r = await fetch(`${COTIZADORES_URL}/cotizador/hdi/autos/session/validate`, { headers: { 'X-Session-Id': cached } }).catch(() => null);
      if (r?.ok) { setSessionId(cached); setSessionOk(true); return cached; }
    }
    // 2. Obtener sid fresco de Laravel (con reconexión transparente)
    const freshSid = await _freshSid('hdi', !!cached);
    const targetSid = freshSid || cached;
    if (!targetSid) { setSessionOk(false); return null; }

    // 3. Validar contra cotizadores
    const r2 = await fetch(`${COTIZADORES_URL}/cotizador/hdi/autos/session/validate`, { headers: { 'X-Session-Id': targetSid } }).catch(() => null);
    if (r2?.ok) {
      localStorage.setItem('cot_hdi_session', targetSid); setSessionId(targetSid); setSessionOk(true); return targetSid;
    }
    setSessionOk(false);
    return null;
  };
  useEffect(() => {
    adopt();
    const t = setInterval(adopt, SESSION_POLL_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') adopt(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVisible); };
  }, []);
  return { sessionId, sessionOk, adopt };
}

// ── Insurer Toggle Chip ───────────────────────────────────────────────────────
const InsurerChip = ({
  code, checked, sessionOk, onChange,
}: { code: 'bolivar' | 'hdi'; checked: boolean; sessionOk: boolean; onChange: (v: boolean) => void }) => (
  <button
    onClick={() => onChange(!checked)}
    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all text-left ${
      checked
        ? 'border-current bg-white dark:bg-gray-800 shadow-sm'
        : 'border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/50 opacity-50'
    }`}
    style={{ borderColor: checked ? INSURER_COLORS[code] : undefined }}
  >
    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
      checked ? 'border-current bg-current' : 'border-gray-300 dark:border-gray-600 bg-transparent'
    }`} style={{ borderColor: checked ? INSURER_COLORS[code] : undefined, backgroundColor: checked ? INSURER_COLORS[code] : undefined }}>
      {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </div>
    <img src={LOGOS[code]} alt={INSURER_NAME[code]} className="h-5 w-auto object-contain flex-shrink-0"
      onError={e => { e.currentTarget.style.display = 'none'; }} />
    <div className="min-w-0 flex-1">
      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{INSURER_NAME[code]}</p>
      <p className={`text-[10px] ${sessionOk ? 'text-green-500' : 'text-amber-500'}`}>
        {sessionOk ? '● Conectado' : '○ Sin sesión'}
      </p>
    </div>
  </button>
);

// ── Step sidebar item ─────────────────────────────────────────────────────────
const SideStep = ({
  num, label, active, done, summary,
}: { num: number; label: string; active: boolean; done: boolean; summary?: React.ReactNode }) => (
  <div className="relative">
    {/* Connector line */}
    {num < 4 && (
      <div className={`absolute left-[18px] top-[36px] w-0.5 h-full -bottom-2 ${done ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'}`} style={{ height: 'calc(100% - 28px)' }} />
    )}
    <div className="flex gap-3 py-2">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 z-10 ${
        done    ? 'bg-primary text-white' :
        active  ? 'bg-primary text-white ring-4 ring-primary/20' :
                  'bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500'
      }`}>
        {done ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 16 16"><path d="M3 8l3.5 3.5L13 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
        ) : num}
      </div>
      <div className="flex-1 pt-1.5">
        <p className={`text-sm font-medium ${active || done ? 'text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-500'}`}>
          {label}
        </p>
        {summary && (
          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{summary}</div>
        )}
      </div>
    </div>
  </div>
);

// ── Plan Card (full standalone) ───────────────────────────────────────────────
const PlanCard = ({ plan, code }: { plan: PlanResult; code: 'bolivar' | 'hdi' }) => {
  const color = INSURER_COLORS[code];
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
      {/* Color bar */}
      <div className="h-1.5" style={{ background: color }} />

      {/* Header: logo + plan + price */}
      <div className="px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-start justify-between gap-3">
          <div>
            <img src={LOGOS[code]} alt={INSURER_NAME[code]} className="h-7 w-auto object-contain mb-2"
              onError={e => { e.currentTarget.style.display = 'none'; }} />
            <p className="font-bold text-gray-900 dark:text-white text-sm">{plan.plan}</p>
            <p className="text-[11px] text-gray-400 mt-0.5">{INSURER_NAME[code]}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="font-black text-xl leading-none" style={{ color }}>{fmtCOP(plan.prima_total)}</p>
            <p className="text-[10px] text-gray-400 mt-1">año</p>
          </div>
        </div>
      </div>

      {/* Price breakdown */}
      <div className="px-5 py-2.5 bg-gray-50 dark:bg-gray-900/50 flex gap-4 text-xs border-b border-gray-100 dark:border-gray-700">
        <div><span className="text-gray-400">Neta </span><span className="font-semibold text-gray-700 dark:text-gray-300">{fmtCOP(plan.prima_neta)}</span></div>
        <div><span className="text-gray-400">IVA </span><span className="font-semibold text-gray-700 dark:text-gray-300">{fmtCOP(plan.iva)}</span></div>
        {plan.cuota_financiacion != null && plan.cuota_financiacion > 0 && (
          <div className="ml-auto"><span className="text-gray-400">Cuota/mes </span><span className="font-semibold" style={{ color }}>{fmtCOP(plan.cuota_financiacion)}</span></div>
        )}
      </div>

      {/* Coverage content */}
      <div className="px-5 py-3 flex-1 space-y-3">
        {/* Bolívar coberturas */}
        {plan.coberturas && Object.values(plan.coberturas).some(v => v != null) && (
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Coberturas</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {plan.coberturas.rce_limite_smmlv != null && (<><span className="text-gray-400">RCE</span><span className="text-right font-medium text-gray-700 dark:text-gray-300">{plan.coberturas.rce_limite_smmlv.toLocaleString()} SMMLV</span></>)}
              {plan.coberturas.asistencia_full != null && (<><span className="text-gray-400">Asistencia full</span><span className="text-right font-medium text-gray-700 dark:text-gray-300">{fmtCOP(plan.coberturas.asistencia_full)}</span></>)}
              {plan.coberturas.asistencia != null && (<><span className="text-gray-400">Asistencia</span><span className="text-right font-medium text-gray-700 dark:text-gray-300">{fmtCOP(plan.coberturas.asistencia)}</span></>)}
              {plan.coberturas.asistencia_ligera != null && (<><span className="text-gray-400">Asistencia ligera</span><span className="text-right font-medium text-gray-700 dark:text-gray-300">{fmtCOP(plan.coberturas.asistencia_ligera)}</span></>)}
              {plan.coberturas.accidentes_personales != null && (<><span className="text-gray-400">Acc. personales</span><span className="text-right font-medium text-gray-700 dark:text-gray-300">{fmtCOP(plan.coberturas.accidentes_personales)}</span></>)}
              {plan.coberturas.pequenos_siniestros != null && (<><span className="text-gray-400">Pequeños siniestros</span><span className="text-right font-medium text-gray-700 dark:text-gray-300">{fmtCOP(plan.coberturas.pequenos_siniestros)}</span></>)}
            </div>
          </div>
        )}

        {/* HDI amparos */}
        {plan.amparos && plan.amparos.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Coberturas</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {plan.amparos.slice(0, 8).map((a, i) => (
                <React.Fragment key={i}>
                  <span className="text-gray-400 truncate">Cob. {a.codigo}</span>
                  <span className="text-right font-medium text-gray-700 dark:text-gray-300">{fmtCOP(a.prima)}</span>
                </React.Fragment>
              ))}
            </div>
          </div>
        )}

        {/* Deducibles */}
        {plan.deducibles && (plan.deducibles.daño_parcial || plan.deducibles.daño_total || plan.deducibles.hurto) && (
          <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">Deducibles</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
              {plan.deducibles.daño_parcial && (<><span className="text-gray-400">Daño parcial</span><span className="text-right font-medium text-gray-700 dark:text-gray-300">{plan.deducibles.daño_parcial}</span></>)}
              {plan.deducibles.daño_total && (<><span className="text-gray-400">Daño total</span><span className="text-right font-medium text-gray-700 dark:text-gray-300">{plan.deducibles.daño_total}</span></>)}
              {plan.deducibles.hurto && (<><span className="text-gray-400">Hurto</span><span className="text-right font-medium text-gray-700 dark:text-gray-300">{plan.deducibles.hurto}</span></>)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Loading skeleton ──────────────────────────────────────────────────────────
const PlanSkeleton = () => (
  <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden animate-pulse">
    <div className="h-1.5 bg-gray-200 dark:bg-gray-700" />
    <div className="px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-700">
      <div className="h-7 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
      <div className="h-3 w-16 bg-gray-100 dark:bg-gray-700 rounded" />
    </div>
    <div className="px-5 py-2.5 bg-gray-50 dark:bg-gray-900/50 flex gap-4 border-b border-gray-100 dark:border-gray-700">
      <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
      <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
    </div>
    <div className="px-5 py-3 space-y-2">
      {[1,2,3,4].map(i => <div key={i} className="h-3 bg-gray-100 dark:bg-gray-700/50 rounded" />)}
    </div>
  </div>
);

// ── Cotizando Loader ──────────────────────────────────────────────────────────
const CotizandoLoader = ({ insurers }: { insurers: Record<string, boolean> }) => {
  const [progress, setProgress] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const msgs = [
    'Verificando el vehículo…',
    'Calculando coberturas…',
    'Comparando primas…',
    'Obteniendo resultados…',
  ];
  useEffect(() => {
    const t1 = setInterval(() => setProgress(p => Math.min(p + 1.2, 95)), 200);
    const t2 = setInterval(() => setMsgIdx(i => (i + 1) % msgs.length), 2000);
    return () => { clearInterval(t1); clearInterval(t2); };
  }, []);
  return (
    <div className="flex flex-col items-center justify-center py-20 px-8">
      {/* Insurer logos */}
      <div className="flex items-center gap-10 mb-10">
        {(Object.entries(insurers).filter(([, v]) => v) as [string, boolean][]).map(([code]) => (
          <div key={code} className="flex flex-col items-center gap-3">
            <div className="relative w-24 h-24 rounded-2xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 flex items-center justify-center shadow-md">
              <img src={LOGOS[code]} alt={INSURER_NAME[code]} className="h-12 w-auto object-contain"
                onError={e => { e.currentTarget.style.display = 'none'; }} />
              {/* Pulsing ring */}
              <span className="absolute inset-0 rounded-2xl border-2 animate-ping opacity-25"
                style={{ borderColor: INSURER_COLORS[code] }} />
            </div>
            <p className="text-xs font-semibold text-gray-500">{INSURER_NAME[code]}</p>
          </div>
        ))}
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-sm">
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden mb-3">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${progress}%`,
              background: 'linear-gradient(90deg, #573CFF, #E30613)',
            }}
          />
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400 text-center min-h-[20px] transition-all">
          {msgs[msgIdx]}
        </p>
      </div>
    </div>
  );
};

// ── Main component ────────────────────────────────────────────────────────────
export default function ComparadorAutos() {
  const bolivar = useBolivarSession();
  const hdi     = useHdiSession();

  const [step, setStep]   = useState<Step>('placa');
  const [placa, setPlaca] = useState('');
  const [placaError, setPlacaError]   = useState('');
  const [placaLoading, setPlacaLoading] = useState(false);
  const [vehiculo, setVehiculo]       = useState<VehiculoData | null>(null);
  const [form, setForm] = useState({
    tipo_doc: 'CC', num_doc: '', nombres: '', apellidos: '',
    celular: '', email: '', fecha_nacimiento: '', sexo: 'M',
    uso: 'particular', suma_accesorios: '0', anios_experiencia: '3',
  });
  const [results, setResults]     = useState<InsurerResult[]>([]);
  // Which insurers to include in cotización
  const [insurers, setInsurers]   = useState<Record<string, boolean>>({ bolivar: true, hdi: true });

  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(p => ({ ...p, [k]: e.target.value }));

  const stepIdx: Record<Step, number> = { placa: 0, vehiculo: 1, tomador: 2, cotizando: 3, resultado: 3 };
  const STEPS = [
    { label: 'Placa del vehículo' },
    { label: 'Información del vehículo' },
    { label: 'Datos del tomador' },
    { label: 'Resultados' },
  ];

  // ── Step summaries ─────────────────────────────────────────────────────────
  const stepSummaries: Record<number, React.ReactNode> = {
    0: placa ? (
      <span className="font-mono font-bold" style={{ color: '#E30613' }}>{placa}</span>
    ) : null,
    1: vehiculo ? (
      <>
        <div className="font-medium text-gray-700 dark:text-gray-300">
          {vehiculo.vehiculo.marca} {vehiculo.vehiculo.linea || vehiculo.vehiculo.clase}
        </div>
        <div>Modelo {vehiculo.vehiculo.modelo}</div>
        {vehiculo.vehiculo.valor_comercial && <div>{fmtCOP(vehiculo.vehiculo.valor_comercial as number)}</div>}
      </>
    ) : null,
    2: form.nombres ? (
      <>
        <div className="font-medium text-gray-700 dark:text-gray-300">{form.nombres} {form.apellidos}</div>
        <div>{form.tipo_doc} {form.num_doc}</div>
      </>
    ) : null,
  };

  // ── Buscar placa ──────────────────────────────────────────────────────────
  const buscarPlaca = async () => {
    setPlacaError('');
    if (placa.length < 5) { setPlacaError('Placa inválida'); return; }
    setPlacaLoading(true);
    try {
      const sid = bolivar.sessionId || await bolivar.adopt();
      const url = `${COTIZADORES_URL}/cotizador/bolivar/cotizar/vehiculo/${placa.toUpperCase()}?tipo_doc=${form.tipo_doc}&num_doc=${form.num_doc || '0'}`;
      const r = await fetch(url, { headers: sid ? { 'X-Session-Id': sid } : {} });
      const data = await r.json();
      if (!r.ok) throw new Error(extractError(data.detail));
      setVehiculo({ placa: placa.toUpperCase(), ...data });
      if (data.propietario_runt?.num_doc && !form.num_doc)
        setForm(p => ({ ...p, num_doc: data.propietario_runt.num_doc, tipo_doc: data.propietario_runt.tipo_doc || 'CC' }));
      setStep('vehiculo');
    } catch (e: any) { setPlacaError(e.message || 'Error buscando placa'); }
    finally { setPlacaLoading(false); }
  };

  // ── Cotizar en paralelo ───────────────────────────────────────────────────
  const cotizar = async () => {
    if (!form.num_doc || !form.nombres || !form.apellidos) return;
    setStep('cotizando');
    const initialResults: InsurerResult[] = [];
    if (insurers.bolivar) initialResults.push({ aseguradora: 'Bolívar', code: 'bolivar', planes: [], loading: true });
    if (insurers.hdi)     initialResults.push({ aseguradora: 'HDI',     code: 'hdi',     planes: [], loading: true });
    setResults(initialResults);

    const common = {
      placa: placa.toUpperCase(), tipo_doc: form.tipo_doc, num_doc: form.num_doc,
      nombres: form.nombres, apellidos: form.apellidos,
      celular: form.celular, email: form.email, sexo: form.sexo,
      fecha_nacimiento: form.fecha_nacimiento,
      suma_accesorios: parseInt(form.suma_accesorios) || 0,
    };

    const cotizarBolivar = async (): Promise<Partial<InsurerResult>> => {
      let sid = bolivar.sessionId || await bolivar.adopt();
      if (!sid) return { error: 'Sin sesión Bolívar. Conecta en Integraciones → APIs Aseguradoras.' };
      const doPost = (s: string) => fetch(`${COTIZADORES_URL}/cotizador/bolivar/cotizar?return_html=false`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Session-Id': s },
        body: JSON.stringify({ ...common, ciudad: 14000, uso: 31, periodo_facturacion: 12 }),
      });
      let res = await doPost(sid);
      if (res.status === 401 || res.status === 404) { sid = await bolivar.adopt() || sid; res = await doPost(sid); }
      const data = await res.json();
      if (!res.ok) return { error: extractError(data.detail) || 'Error Bolívar' };
      const cotiz = data.cotizacion || data;
      return { num_cotizacion: cotiz.num_cotizacion || data.uuid, vehiculo: cotiz.vehiculo, planes: cotiz.planes || [] };
    };

    const cotizarHdi = async (): Promise<Partial<InsurerResult>> => {
      let sid = hdi.sessionId || await hdi.adopt();
      if (!sid) return { error: 'Sin sesión HDI. Conecta en Integraciones → APIs Aseguradoras.' };
      const doPost = (s: string) => fetch(`${COTIZADORES_URL}/cotizador/hdi/autos/cotizar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Session-Id': s },
        body: JSON.stringify({ ...common, uso: form.uso, anios_experiencia: parseInt(form.anios_experiencia) || 3 }),
      });
      let res = await doPost(sid);
      if (res.status === 401 || res.status === 404) { sid = await hdi.adopt() || sid; res = await doPost(sid); }
      const data = await res.json();
      if (!res.ok) return { error: extractError(data.detail) || 'Error HDI' };
      return { num_cotizacion: data.num_cotizacion, vehiculo: data.vehiculo, planes: data.planes || [] };
    };

    const tasks: Promise<Partial<InsurerResult>>[] = [];
    if (insurers.bolivar) tasks.push(cotizarBolivar());
    if (insurers.hdi)     tasks.push(cotizarHdi());
    const settled = await Promise.allSettled(tasks);

    const finalResults: InsurerResult[] = [];
    let taskIdx = 0;
    if (insurers.bolivar) {
      const r = settled[taskIdx++];
      finalResults.push({ aseguradora: 'Bolívar', code: 'bolivar', loading: false,
        ...(r.status === 'fulfilled' ? r.value : { error: (r as PromiseRejectedResult).reason?.message || 'Error Bolívar' }),
        planes: r.status === 'fulfilled' ? (r.value.planes || []) : [] });
    }
    if (insurers.hdi) {
      const r = settled[taskIdx++];
      finalResults.push({ aseguradora: 'HDI', code: 'hdi', loading: false,
        ...(r.status === 'fulfilled' ? r.value : { error: (r as PromiseRejectedResult).reason?.message || 'Error HDI' }),
        planes: r.status === 'fulfilled' ? (r.value.planes || []) : [] });
    }
    setResults(finalResults);
    setStep('resultado');
  };

  const reset = () => { setPlaca(''); setVehiculo(null); setResults([]); setPlacaError(''); setStep('placa'); };

  const inputCls = "w-full border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors";
  const labelCls = "block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5";

  // All plans flat-sorted by price for the results grid
  const allPlans: Array<PlanResult & { code: 'bolivar' | 'hdi'; aseguradora: string; num_cotizacion?: string }> = results
    .filter(r => !r.loading && !r.error && r.planes.length > 0)
    .flatMap(r => r.planes.map(p => ({ ...p, code: r.code, aseguradora: r.aseguradora, num_cotizacion: r.num_cotizacion })));

  const currentIdx = stepIdx[step];

  return (
    <div className="min-h-screen flex bg-gray-100 bg-lightgray dark:bg-dark rounded-2x" >

      {/* ── LEFT SIDEBAR ── */}
      <aside className="w-60 flex-shrink-0 min-h-screen bg-gray-100 bg-lightgray dark:bg-dark flex flex-col">
        <div className="p-5 flex flex-col h-full">

          {/* Title */}
          <div className="mb-7">
            <h1 className="text-sm font-bold text-gray-900 dark:text-white">Comparador de Autos</h1>
            <p className="text-xs text-gray-400 mt-0.5">Cotización simultánea</p>
          </div>

          {/* Steps */}
          <div className="space-y-1 flex-1">
            {STEPS.map((s, i) => (
              <SideStep
                key={i} num={i + 1} label={s.label}
                active={currentIdx === i}
                done={currentIdx > i}
                summary={currentIdx > i ? stepSummaries[i] : undefined}
              />
            ))}
          </div>

          {/* Bottom: nueva comparación */}
          {step === 'resultado' && (
            <div className="pt-5">
              <button onClick={reset}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-600 py-2 text-xs text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 transition-colors">
                ← Nueva comparación
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ── MAIN CONTENT ── */}
      <main className="flex-1 overflow-auto">

        {/* ── INSURER SELECTOR (always visible at top, centered) ── */}
        {step !== 'cotizando' && (
          <div className="flex justify-center pt-6 pb-2 px-8">
            <div className="flex items-center gap-3">
              {(['bolivar', 'hdi'] as const).map(code => {
                const ok = code === 'bolivar' ? bolivar.sessionOk : hdi.sessionOk;
                const checked = insurers[code];
                return (
                  <button
                    key={code}
                    onClick={() => setInsurers(p => ({ ...p, [code]: !p[code] }))}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-2xl border-2 transition-all select-none ${
                      checked
                        ? 'bg-white dark:bg-gray-800 shadow-sm'
                        : 'bg-gray-200/60 dark:bg-gray-800/40 opacity-50 border-transparent'
                    }`}
                    style={{ borderColor: checked ? INSURER_COLORS[code] : undefined }}
                  >
                    {/* Checkbox dot */}
                    <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                      checked ? 'border-current' : 'border-gray-400'
                    }`} style={{ borderColor: checked ? INSURER_COLORS[code] : undefined, backgroundColor: checked ? INSURER_COLORS[code] : undefined }}>
                      {checked && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </span>
                    <img src={LOGOS[code]} alt={INSURER_NAME[code]} className="h-5 w-auto object-contain"
                      onError={e => { e.currentTarget.style.display = 'none'; }} />
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{INSURER_NAME[code]}</span>
                    <span className={`text-[10px] font-medium ${ok ? 'text-green-500' : 'text-amber-400'}`}>
                      {ok ? '●' : '○'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* ── PLACA ── */}
        {step === 'placa' && (
          <div className="flex items-start justify-center px-8 pt-10 pb-16">
            <div className="w-full max-w-md">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Ingresa la placa</h2>
                  <p className="text-sm text-gray-400 mt-1">Consultamos Fasecolda y RUNT automáticamente</p>
                </div>

                <div className="space-y-5">
                  <div>
                    <label className={labelCls}>Placa del vehículo</label>
                    <input
                      value={placa}
                      onChange={e => setPlaca(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && buscarPlaca()}
                      placeholder="ABC-123"
                      maxLength={7}
                      className={`${inputCls} font-mono uppercase text-center text-2xl tracking-[0.3em] py-4 font-bold`}
                    />
                    {placaError && (
                      <div className="mt-2 flex items-center gap-2 text-sm text-red-500">
                        <span>⚠</span> {placaError}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={buscarPlaca}
                    disabled={placaLoading || placa.length < 5}
                    className="w-full rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-40 py-3 text-sm text-white font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    {placaLoading ? (
                      <>
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Consultando RUNT…
                      </>
                    ) : (
                      <>Buscar vehículo <span className="ml-1">→</span></>
                    )}
                  </button>

                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── VEHÍCULO ── */}
        {step === 'vehiculo' && vehiculo && (
          <div className="flex items-start justify-center px-8 pt-10 pb-16">
            <div className="w-full max-w-lg">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-7 py-6 border-b border-gray-100 dark:border-gray-700">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Información del vehículo</h2>
                  <p className="text-sm text-gray-400 mt-0.5">Confirma que los datos sean correctos</p>
                </div>

                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {[
                    ['Placa', <span className="font-mono font-bold text-base tracking-widest" style={{ color: '#E30613' }}>{vehiculo.placa}</span>],
                    ['Marca', vehiculo.vehiculo.marca],
                    ['Línea / Versión', vehiculo.vehiculo.linea || vehiculo.vehiculo.clase],
                    ['Modelo', vehiculo.vehiculo.modelo],
                    ['Valor comercial', fmtCOP(vehiculo.vehiculo.valor_comercial as number)],
                    vehiculo.vehiculo.cod_tipo_desc && ['Tipo', vehiculo.vehiculo.cod_tipo_desc],
                    vehiculo.vehiculo.color && ['Color', vehiculo.vehiculo.color],
                    vehiculo.vehiculo.cilindraje && ['Cilindraje', `${vehiculo.vehiculo.cilindraje} cc`],
                  ].filter(Boolean).map(([label, value]: any, i: number) => (
                    <div key={i} className="flex items-center px-7 py-3.5">
                      <span className="text-xs text-gray-400 w-40 flex-shrink-0">{label as string}</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{value as React.ReactNode}</span>
                    </div>
                  ))}
                </div>

                <div className="px-7 py-5 flex gap-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                  <button onClick={() => setStep('placa')}
                    className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 transition-colors">
                    ← Cambiar placa
                  </button>
                  <button onClick={() => setStep('tomador')}
                    className="flex-1 rounded-xl bg-primary hover:bg-primary/90 py-2.5 text-sm text-white font-semibold transition-colors">
                    Continuar →
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TOMADOR ── */}
        {step === 'tomador' && (
          <div className="flex justify-center px-8 pt-10 pb-16">
            <div className="w-full max-w-2xl">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-700">
                  <h2 className="text-lg font-bold text-gray-900 dark:text-white">Datos del tomador</h2>
                  <p className="text-sm text-gray-400 mt-0.5">
                    Se cotizará en{' '}
                    {(Object.entries(insurers).filter(([, v]) => v) as [string, boolean][])
                      .map(([code]) => INSURER_NAME[code]).join(' y ')} simultáneamente
                  </p>
                </div>

                <div className="px-8 py-6">
                  <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                    <div>
                      <label className={labelCls}>Tipo de documento *</label>
                      <select value={form.tipo_doc} onChange={f('tipo_doc')} className={inputCls}>
                        <option value="CC">Cédula (CC)</option>
                        <option value="CE">Cédula extranjería</option>
                        <option value="NIT">NIT</option>
                        <option value="PA">Pasaporte</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Número de documento *</label>
                      <input value={form.num_doc} onChange={f('num_doc')} placeholder="1036686527" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Nombres *</label>
                      <input value={form.nombres} onChange={f('nombres')} placeholder="Juan Fernando" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Apellidos *</label>
                      <input value={form.apellidos} onChange={f('apellidos')} placeholder="Rivera Quevedo" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Fecha de nacimiento</label>
                      <input value={form.fecha_nacimiento} onChange={f('fecha_nacimiento')} placeholder="dd/mm/aaaa" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Celular</label>
                      <input value={form.celular} onChange={f('celular')} placeholder="3001234567" className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Sexo</label>
                      <select value={form.sexo} onChange={f('sexo')} className={inputCls}>
                        <option value="M">Masculino</option>
                        <option value="F">Femenino</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Uso del vehículo</label>
                      <select value={form.uso} onChange={f('uso')} className={inputCls}>
                        <option value="particular">Particular</option>
                        <option value="taxi">Taxi</option>
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>Años de experiencia conduciendo</label>
                      <input type="number" min={0} max={50} value={form.anios_experiencia} onChange={f('anios_experiencia')} className={inputCls} />
                    </div>
                    <div>
                      <label className={labelCls}>Valor accesorios ($)</label>
                      <input value={form.suma_accesorios} onChange={f('suma_accesorios')} placeholder="0" className={inputCls} />
                    </div>
                  </div>
                </div>

                <div className="px-8 py-5 flex gap-3 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/30">
                  <button onClick={() => setStep('vehiculo')}
                    className="px-5 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-800 transition-colors">
                    ← Atrás
                  </button>
                  <button
                    onClick={cotizar}
                    disabled={!form.num_doc || !form.nombres || !form.apellidos || !Object.values(insurers).some(Boolean)}
                    className="flex-1 rounded-xl bg-primary hover:bg-primary/90 disabled:opacity-40 py-2.5 text-sm text-white font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    <span>Cotizar ahora</span>
                    <div className="flex gap-1.5 items-center">
                      {(Object.entries(insurers).filter(([, v]) => v) as [string, boolean][]).map(([code]) => (
                        <img key={code} src={LOGOS[code]} alt="" className="h-4 w-auto" onError={e => (e.currentTarget.style.display = 'none')} />
                      ))}
                    </div>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── COTIZANDO ── */}
        {step === 'cotizando' && (
          <div className="flex items-center justify-center min-h-screen">
            <div className="w-full max-w-md">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <CotizandoLoader insurers={insurers} />
              </div>
            </div>
          </div>
        )}

        {/* ── RESULTADO ── */}
        {step === 'resultado' && (
          <div className="p-8">
            {/* Header */}
            <div className="mb-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Resultados de cotización</h2>
                  {vehiculo && (
                    <p className="text-sm text-gray-400 mt-1">
                      <span className="font-mono font-bold" style={{ color: '#E30613' }}>{vehiculo.placa}</span>
                      {' · '}{vehiculo.vehiculo.marca} {vehiculo.vehiculo.linea || vehiculo.vehiculo.clase} {vehiculo.vehiculo.modelo}
                    </p>
                  )}
                </div>
              </div>

              {/* Summary row: lowest price per insurer */}
              {results.filter(r => r.planes.length > 0).length > 0 && (
                <div className="mt-4 flex flex-wrap gap-3">
                  {results.filter(r => r.planes.length > 0).map(ins => (
                    <div key={ins.code} className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 shadow-sm">
                      <img src={LOGOS[ins.code]} alt={ins.aseguradora} className="h-6 w-auto object-contain"
                        onError={e => { e.currentTarget.style.display = 'none'; }} />
                      <div>
                        <p className="text-xs text-gray-400">{ins.aseguradora} · desde</p>
                        <p className="font-bold text-sm" style={{ color: INSURER_COLORS[ins.code] }}>
                          {fmtCOP(Math.min(...ins.planes.map(p => p.prima_total || Infinity)))}
                        </p>
                      </div>
                      {ins.num_cotizacion && (
                        <p className="text-[10px] font-mono text-gray-300 dark:text-gray-600 ml-1">#{ins.num_cotizacion}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Error states */}
            {results.filter(r => r.error).map(ins => (
              <div key={ins.code} className="mb-4 flex items-center gap-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-xl px-5 py-4">
                <img src={LOGOS[ins.code]} alt={ins.aseguradora} className="h-5 w-auto opacity-60"
                  onError={e => { e.currentTarget.style.display = 'none'; }} />
                <p className="text-sm text-red-600 dark:text-red-400"><strong>{ins.aseguradora}:</strong> {ins.error}</p>
              </div>
            ))}

            {/* Loading skeletons if any still loading */}
            {results.some(r => r.loading) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => <PlanSkeleton key={i} />)}
              </div>
            )}

            {/* All plans grid */}
            {allPlans.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {allPlans.map((plan, i) => (
                  <PlanCard key={`${plan.code}-${i}`} plan={plan} code={plan.code} />
                ))}
              </div>
            )}

            {allPlans.length === 0 && !results.some(r => r.loading) && !results.some(r => r.error) && (
              <div className="text-center py-16 text-gray-400">Sin resultados de cotización</div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}
