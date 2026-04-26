import React, { useState, useEffect } from 'react';
import { saasApi } from 'src/services/saasApi';

const COTIZADORES_URL = import.meta.env.VITE_COTIZADORES_URL || 'http://localhost:8002';
const MAIN_MICRO_URL = import.meta.env.VITE_MICROSERVICIO_URL || 'http://localhost:8002';

interface VehiculoData {
  placa: string;
  vehiculo: {
    marca?: string;
    modelo?: string;
    valor_comercial?: string | number;
    cod_tipo_desc?: string;
    vin?: string;
    color?: string;
    clase?: string;
    linea?: string;
    cilindraje?: string;
  };
  propietario_runt?: { tipo_doc?: string; num_doc?: string };
}

interface PlanCotizacion {
  plan: string;
  prima_total?: number;
  prima_neta?: number;
}

interface ResultadoCotizacion {
  num_cotizacion?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  planes: PlanCotizacion[];
  descuento_tecnico?: number;
  _raw_amounts?: string[];
}

type Step = 'placa' | 'vehiculo' | 'tomador' | 'cotizando' | 'resultado';

const VRow = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <tr>
    <td className="py-2.5 pr-4 text-gray-500 dark:text-gray-400 w-36 align-top">{label}</td>
    <td className="py-2.5 text-gray-900 dark:text-white font-medium">{children || '—'}</td>
  </tr>
);

const STEPS: { key: Step; label: string }[] = [
  { key: 'placa', label: 'Placa' },
  { key: 'vehiculo', label: 'Vehículo' },
  { key: 'tomador', label: 'Tomador' },
  { key: 'resultado', label: 'Resultado' },
];

const fmtCOP = (v?: string | number) => {
  const n = Number(v || 0);
  if (!n) return '—';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n);
};

export default function CotizadorBolivar() {
  const [sessionId, setSessionId] = useState(() => localStorage.getItem('cot_bolivar_session') || '');
  const [sessionOk, setSessionOk] = useState(false);
  const [adoptLoading, setAdoptLoading] = useState(true);
  const [adoptError, setAdoptError] = useState('');

  const [step, setStep] = useState<Step>('placa');
  const [placa, setPlaca] = useState('');
  const [placaLoading, setPlacaLoading] = useState(false);
  const [placaError, setPlacaError] = useState('');
  const [vehiculo, setVehiculo] = useState<VehiculoData | null>(null);

  const [form, setForm] = useState({
    tipo_doc: 'CC', num_doc: '', nombres: '', apellidos: '',
    celular: '', email: '', dir_residencial: '',
    sexo: 'M', ciudad: '14000', uso: '31',
    periodo_facturacion: '12', suma_accesorios: '0',
    fecha_nacimiento: '',
  });

  const [cotizando, setCotizando] = useState(false);
  const [cotizError, setCotizError] = useState('');
  const [resultado, setResultado] = useState<ResultadoCotizacion | null>(null);

  useEffect(() => { adopt(true); }, []);

  /**
   * Intenta adoptar la sesión Bolívar de :8002 → :8010.
   * Si la sesión expiró en :8002 (vacía o inválida), llama al reconectar de Laravel
   * para que re-autentique automáticamente con las credenciales guardadas.
   */
  const adopt = async (allowReconnect = true): Promise<boolean> => {
    setAdoptLoading(true);
    setAdoptError('');
    try {
      // 1. ¿Hay sesión cacheada viva en :8010?
      const cached = localStorage.getItem('cot_bolivar_session');
      if (cached) {
        const r = await fetch(`${COTIZADORES_URL}/bolivar/session/${cached}/export`).catch(() => null);
        if (r?.ok) {
          const expData = await r.json();
          if (expData?.simon_cookies_str) {
            setSessionId(cached); setSessionOk(true); return true;
          }
        }
        localStorage.removeItem('cot_bolivar_session');
      }

      // 2. Obtener session_id del backend Guro
      const connsRes = await saasApi.getInsurerConnections();
      const conn = (connsRes.data || []).find((c: any) => c.insurer_code === 'bolivar' && c.status === 'connected');
      if (!conn?.microservice_session_id) {
        setAdoptError('Sin sesión activa. Conecta Bolívar en Integraciones → APIs Aseguradoras.');
        return false;
      }

      // 3. Exportar sesión de :8002
      const exp = await fetch(`${MAIN_MICRO_URL}/bolivar/session/${conn.microservice_session_id}/export`).catch(() => null);
      const expData = exp?.ok ? await exp.json() : null;
      const simonOk = !!expData?.simon_cookies_str;

      if (!simonOk && allowReconnect) {
        // Sesión expirada en :8002 → reconectar automáticamente con credenciales guardadas
        setAdoptError('Sesión expirada. Reconectando automáticamente…');
        const reconRes = await saasApi.reconnectInsurer('bolivar').catch(() => null);
        if (!reconRes?.data?.microservice_session_id && !reconRes?.data?.connected) {
          setAdoptError('No se pudo reconectar. Ve a Integraciones → APIs Aseguradoras y reconecta manualmente.');
          return false;
        }
        // Reintentar con la nueva sesión (sin recursión infinita)
        return adopt(false);
      }

      if (!expData) {
        setAdoptError('Sesión Bolívar no disponible. Reconecta en Integraciones.');
        return false;
      }

      // 4. Adoptar en :8010
      const adpt = await fetch(`${COTIZADORES_URL}/bolivar/session/adopt`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(expData),
      }).catch(() => null);
      if (!adpt?.ok) {
        setAdoptError('No se pudo importar la sesión al cotizador.');
        return false;
      }

      localStorage.setItem('cot_bolivar_session', conn.microservice_session_id);
      setSessionId(conn.microservice_session_id);
      setSessionOk(true);
      setAdoptError('');
      return true;
    } catch {
      setAdoptError('Error al verificar la sesión.');
      return false;
    } finally {
      setAdoptLoading(false);
    }
  };

  const buscarPlaca = async () => {
    if (placa.length < 5) { setPlacaError('Placa inválida'); return; }
    setPlacaLoading(true); setPlacaError(''); setVehiculo(null);
    try {
      const res = await fetch(
        `${COTIZADORES_URL}/cotizador/bolivar/cotizar/vehiculo/${placa.toUpperCase()}?tipo_doc=${form.tipo_doc}&num_doc=${form.num_doc}`,
        { headers: { 'X-Session-Id': sessionId } }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al consultar');
      setVehiculo({ placa: placa.toUpperCase(), ...data });
      if (data.propietario_runt?.num_doc && !form.num_doc) {
        setForm(f => ({ ...f, num_doc: data.propietario_runt.num_doc, tipo_doc: data.propietario_runt.tipo_doc || 'CC' }));
      }
      setStep('vehiculo');
    } catch (e: any) {
      const msg = e.message || '';
      if (msg.toLowerCase().includes('login') || msg.toLowerCase().includes('sesión') || msg.includes('401')) {
        setPlacaError('Sesión inválida. Reconectando…');
        const ok = await adopt(true);
        if (ok) {
          // Reintentar automáticamente
          setPlacaError('');
          setPlacaLoading(false);
          buscarPlaca();
          return;
        }
      } else {
        setPlacaError(msg || 'No se encontró el vehículo');
      }
    } finally { setPlacaLoading(false); }
  };

  const cotizar = async () => {
    if (!form.num_doc || !form.nombres || !form.apellidos || !form.celular) {
      setCotizError('Completa los campos requeridos.');
      return;
    }
    setCotizando(true); setCotizError(''); setResultado(null); setStep('cotizando');
    const doPost = async (sid: string) => {
      return fetch(`${COTIZADORES_URL}/cotizador/bolivar/cotizar?return_html=false`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Session-Id': sid },
        body: JSON.stringify({
          placa: placa.toUpperCase(),
          tipo_doc: form.tipo_doc, num_doc: form.num_doc,
          nombres: form.nombres, apellidos: form.apellidos,
          celular: form.celular, email: form.email,
          dir_residencial: form.dir_residencial, sexo: form.sexo,
          ciudad: parseInt(form.ciudad), uso: parseInt(form.uso),
          periodo_facturacion: parseInt(form.periodo_facturacion),
          suma_accesorios: parseInt(form.suma_accesorios) || 0,
          fecha_nacimiento: form.fecha_nacimiento,
        }),
      });
    };
    try {
      let res = await doPost(sessionId);
      // Si sesión caducó en :8010, re-adopt y reintentar una vez
      if (res.status === 401 || res.status === 404) {
        const ok = await adopt(true);
        if (!ok) throw new Error('No se pudo renovar la sesión. Ve a Integraciones y reconecta Bolívar.');
        const freshSid = localStorage.getItem('cot_bolivar_session') || sessionId;
        res = await doPost(freshSid);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Error al cotizar');
      setResultado(data.cotizacion || data);
      setStep('resultado');
    } catch (e: any) {
      setCotizError(e.message || 'Error al procesar la cotización');
      setStep('tomador');
    } finally { setCotizando(false); }
  };

  const reset = () => { setPlaca(''); setVehiculo(null); setResultado(null); setCotizError(''); setStep('placa'); };
  const f = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(prev => ({ ...prev, [k]: e.target.value }));

  const stepIdx = ['placa', 'vehiculo', 'tomador', 'cotizando', 'resultado'].indexOf(step);
  const displayIdx = step === 'cotizando' ? 3 : stepIdx;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">

      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Cotizador</h1>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          sessionOk
            ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
            : 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
        }`}>
          {sessionOk ? 'Sesión activa' : 'Sin sesión'}
        </span>
      </div>

      {/* Session error banner */}
      {adoptError && (
        <div className="mb-6 flex items-start justify-between gap-4 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 dark:border-amber-800">
          <p className="text-sm text-amber-800 dark:text-amber-300">{adoptError}</p>
          <button
            onClick={() => adopt(true)}
            className="text-xs text-amber-700 underline whitespace-nowrap dark:text-amber-400"
          >
            Reintentar
          </button>
        </div>
      )}

      {/* Stepper */}
      <div className="flex items-center gap-1 mb-8">
        {STEPS.map((s, i) => {
          const active = i === (step === 'cotizando' ? 2 : STEPS.findIndex(x => x.key === step));
          const done = i < displayIdx && !(step === 'cotizando' && i === 3);
          return (
            <React.Fragment key={s.key}>
              <span className={`text-xs font-medium ${
                active ? 'text-gray-900 dark:text-white' :
                done ? 'text-gray-400 dark:text-gray-500 line-through' :
                'text-gray-400 dark:text-gray-500'
              }`}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && (
                <span className="text-gray-200 dark:text-gray-700 mx-1 text-xs">›</span>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* ── PLACA ── */}
      {step === 'placa' && (
        <div className="space-y-4">
          {adoptLoading && (
            <p className="text-xs text-neutral-400">Verificando sesión…</p>
          )}
          <div>
            <label className="block text-sm text-neutral-600 dark:text-neutral-400 mb-2">
              Placa del vehículo
            </label>
            <div className="flex gap-2">
              <input
                className="flex-1 border border-neutral-300 dark:border-neutral-700 rounded-lg px-4 py-2 text-sm bg-white dark:bg-neutral-900 text-gray-900 dark:text-white placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-400 uppercase tracking-widest font-mono"
                placeholder="ABC123"
                value={placa}
                onChange={e => setPlaca(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && !adoptLoading && buscarPlaca()}
                maxLength={8}
              />
              <button
                onClick={buscarPlaca}
                disabled={placaLoading || adoptLoading}
                className="rounded-lg bg-[#573CFF] hover:bg-[#4b31e6] disabled:opacity-40 px-5 py-2 text-sm text-white font-medium"
              >
                {placaLoading ? 'Buscando…' : adoptLoading ? 'Espera…' : 'Buscar'}
              </button>
            </div>
            {placaError && <p className="mt-2 text-sm text-red-500">{placaError}</p>}
            <p className="mt-2 text-xs text-neutral-400">Consulta Fasecolda y RUNT automáticamente</p>
          </div>
        </div>
      )}

      {/* ── VEHÍCULO ── */}
      {step === 'vehiculo' && vehiculo && (
        <div className="space-y-5">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              <VRow label="Placa">
                <span className="font-mono font-bold" style={{ color: '#E30613' }}>{vehiculo.placa}</span>
              </VRow>
              <VRow label="Marca">{vehiculo.vehiculo.marca}</VRow>
              <VRow label="Línea">{vehiculo.vehiculo.linea || vehiculo.vehiculo.clase}</VRow>
              <VRow label="Modelo">{vehiculo.vehiculo.modelo}</VRow>
              <VRow label="Valor comercial">{fmtCOP(vehiculo.vehiculo.valor_comercial)}</VRow>
              {vehiculo.vehiculo.cod_tipo_desc && <VRow label="Tipo">{vehiculo.vehiculo.cod_tipo_desc}</VRow>}
              {vehiculo.vehiculo.color && <VRow label="Color">{vehiculo.vehiculo.color}</VRow>}
              {vehiculo.vehiculo.cilindraje && <VRow label="Cilindraje">{vehiculo.vehiculo.cilindraje} cc</VRow>}
              {vehiculo.vehiculo.vin && (
                <VRow label="VIN"><span className="font-mono text-xs">{vehiculo.vehiculo.vin}</span></VRow>
              )}
            </tbody>
          </table>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep('placa')}
              className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900"
            >
              Cambiar placa
            </button>
            <button
              onClick={() => setStep('tomador')}
              className="flex-1 rounded-lg bg-[#573CFF] hover:bg-[#4b31e6] px-5 py-2 text-sm text-white font-medium"
            >
              Continuar
            </button>
          </div>
        </div>
      )}

      {/* ── TOMADOR ── */}
      {step === 'tomador' && (
        <div className="space-y-5">
          {cotizError && <p className="text-sm text-red-600 dark:text-red-400">{cotizError}</p>}

          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            {/* tipo doc */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Tipo de documento *</label>
              <select
                value={form.tipo_doc} onChange={f('tipo_doc')}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-300"
              >
                <option value="CC">CC</option>
                <option value="NIT">NIT</option>
                <option value="CE">CE</option>
                <option value="PA">Pasaporte</option>
              </select>
            </div>
            {/* num doc */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Número de documento *</label>
              <input value={form.num_doc} onChange={f('num_doc')} placeholder="1036686527"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-300" />
            </div>
            {/* nombres */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Nombres *</label>
              <input value={form.nombres} onChange={f('nombres')} placeholder="Juan Fernando"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-300" />
            </div>
            {/* apellidos */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Apellidos *</label>
              <input value={form.apellidos} onChange={f('apellidos')} placeholder="Rivera Quevedo"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-300" />
            </div>
            {/* celular */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Celular *</label>
              <input value={form.celular} onChange={f('celular')} placeholder="3001234567"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-300" />
            </div>
            {/* email */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Correo</label>
              <input type="email" value={form.email} onChange={f('email')} placeholder="juan@email.com"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-300" />
            </div>
            {/* fecha nacimiento */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Fecha de nacimiento</label>
              <input value={form.fecha_nacimiento} onChange={f('fecha_nacimiento')} placeholder="dd/mm/aaaa"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-300" />
            </div>
            {/* dirección */}
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Dirección</label>
              <input value={form.dir_residencial} onChange={f('dir_residencial')} placeholder="Calle 10 # 20-30"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-300" />
            </div>
            {/* uso */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Uso</label>
              <select value={form.uso} onChange={f('uso')}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-300">
                <option value="31">Particular</option>
                <option value="32">Taxi</option>
                <option value="33">Rentacar</option>
              </select>
            </div>
            {/* periodo */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Período de pago</label>
              <select value={form.periodo_facturacion} onChange={f('periodo_facturacion')}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-300">
                <option value="12">Anual</option>
                <option value="6">Semestral</option>
                <option value="3">Trimestral</option>
                <option value="1">Mensual</option>
              </select>
            </div>
            {/* sexo */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Sexo</label>
              <select value={form.sexo} onChange={f('sexo')}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-300">
                <option value="M">Masculino</option>
                <option value="F">Femenino</option>
              </select>
            </div>
            {/* accesorios */}
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Suma accesorios ($)</label>
              <input value={form.suma_accesorios} onChange={f('suma_accesorios')} placeholder="0"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-gray-300" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => setStep('vehiculo')}
              className="flex-1 rounded-lg border border-neutral-300 dark:border-neutral-700 px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-900"
            >
              Atrás
            </button>
            <button
              onClick={cotizar}
              disabled={cotizando}
              className="flex-1 rounded-lg bg-[#573CFF] hover:bg-[#4b31e6] disabled:opacity-40 px-5 py-2 text-sm text-white font-medium"
            >
              Cotizar
            </button>
          </div>
        </div>
      )}

      {/* ── COTIZANDO ── */}
      {step === 'cotizando' && (
        <div className="py-16 text-center space-y-3">
          <div className="inline-block w-6 h-6 border-2 border-gray-300 border-t-red-600 rounded-full animate-spin" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Procesando cotización en Simon Quotation…</p>
        </div>
      )}

      {/* ── RESULTADO ── */}
      {step === 'resultado' && resultado && (
        <div className="space-y-6">
          {/* meta */}
          <div className="flex items-baseline justify-between">
            <div>
              {resultado.num_cotizacion && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Cotización <span className="font-mono text-gray-700 dark:text-gray-300">{resultado.num_cotizacion}</span>
                </p>
              )}
              {resultado.fecha_inicio && (
                <p className="text-xs text-gray-400 mt-0.5">
                  {resultado.fecha_inicio} — {resultado.fecha_fin}
                </p>
              )}
            </div>
            {resultado.descuento_tecnico !== undefined && resultado.descuento_tecnico !== 0 && (
              <span className="text-xs text-amber-700 dark:text-amber-400">
                Dto. técnico {resultado.descuento_tecnico}%
              </span>
            )}
          </div>

          {/* vehículo resumen */}
          {vehiculo && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-mono font-semibold text-gray-900 dark:text-white mr-2">{vehiculo.placa}</span>
              {vehiculo.vehiculo.marca} · {vehiculo.vehiculo.linea || vehiculo.vehiculo.clase} · {vehiculo.vehiculo.modelo}
            </p>
          )}

          {/* planes */}
          {resultado.planes?.length > 0 ? (
            <div className="space-y-4">
              {resultado.planes.map((p: any, i: number) => (
                <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {/* plan header */}
                  <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50">
                    <span className="font-semibold text-sm text-gray-900 dark:text-white">{p.plan}</span>
                    <div className="text-right">
                      <p className="font-bold text-base text-gray-900 dark:text-white">{fmtCOP(p.prima_total)}</p>
                      <p className="text-xs text-gray-400">Neta: {fmtCOP(p.prima_neta)} · IVA: {fmtCOP(p.iva)}</p>
                    </div>
                  </div>

                  {/* coberturas */}
                  {p.coberturas && (
                    <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Coberturas</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        {p.coberturas.rce_limite_smmlv != null && (
                          <><span className="text-gray-500 dark:text-gray-400">RCE límite</span><span className="text-right font-medium text-gray-800 dark:text-gray-200">{p.coberturas.rce_limite_smmlv.toLocaleString()} SMMLV</span></>
                        )}
                        {p.coberturas.asistencia_full != null && (
                          <><span className="text-gray-500 dark:text-gray-400">Asistencia full</span><span className="text-right font-medium text-gray-800 dark:text-gray-200">{fmtCOP(p.coberturas.asistencia_full)}</span></>
                        )}
                        {p.coberturas.asistencia != null && (
                          <><span className="text-gray-500 dark:text-gray-400">Asistencia</span><span className="text-right font-medium text-gray-800 dark:text-gray-200">{fmtCOP(p.coberturas.asistencia)}</span></>
                        )}
                        {p.coberturas.asistencia_ligera != null && (
                          <><span className="text-gray-500 dark:text-gray-400">Asistencia ligera</span><span className="text-right font-medium text-gray-800 dark:text-gray-200">{fmtCOP(p.coberturas.asistencia_ligera)}</span></>
                        )}
                        {p.coberturas.accidentes_personales != null && (
                          <><span className="text-gray-500 dark:text-gray-400">Acc. personales</span><span className="text-right font-medium text-gray-800 dark:text-gray-200">{fmtCOP(p.coberturas.accidentes_personales)}</span></>
                        )}
                        {p.coberturas.pequenos_siniestros != null && (
                          <><span className="text-gray-500 dark:text-gray-400">Pequeños siniestros</span><span className="text-right font-medium text-gray-800 dark:text-gray-200">{fmtCOP(p.coberturas.pequenos_siniestros)}</span></>
                        )}
                      </div>
                    </div>
                  )}

                  {/* deducibles */}
                  {p.deducibles && (p.deducibles.daño_parcial || p.deducibles.daño_total || p.deducibles.hurto) && (
                    <div className="px-4 py-3 border-t border-gray-100 dark:border-gray-700">
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Deducibles</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                        {p.deducibles.daño_parcial && (
                          <><span className="text-gray-500 dark:text-gray-400">Daño parcial</span><span className="text-right font-medium text-gray-800 dark:text-gray-200">{p.deducibles.daño_parcial}</span></>
                        )}
                        {p.deducibles.daño_total && (
                          <><span className="text-gray-500 dark:text-gray-400">Daño total</span><span className="text-right font-medium text-gray-800 dark:text-gray-200">{p.deducibles.daño_total}</span></>
                        )}
                        {p.deducibles.hurto && (
                          <><span className="text-gray-500 dark:text-gray-400">Hurto</span><span className="text-right font-medium text-gray-800 dark:text-gray-200">{p.deducibles.hurto}</span></>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : resultado._raw_amounts?.length ? (
            <div className="space-y-2">
              {resultado._raw_amounts.map((a, i) => (
                <p key={i} className="text-lg font-semibold text-gray-900 dark:text-white">{fmtCOP(a)}</p>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Cotización procesada. Revisa el resultado en Simon Quotation de Bolívar.
            </p>
          )}

          <button
            onClick={reset}
            className="mt-4 text-sm text-gray-500 dark:text-gray-400 underline hover:text-gray-700 dark:hover:text-gray-200"
          >
            Nueva cotización
          </button>
        </div>
      )}
    </div>
  );
}
