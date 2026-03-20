import React, { useState, useEffect } from 'react';
import { Car, Search, User, MapPin, Loader2, AlertCircle, ChevronRight } from 'lucide-react';
import * as api from '../api';

export default function QuoteForm({ onQuoteCreated }) {
  const [step, setStep] = useState(1);
  const [brands, setBrands] = useState([]);
  const [lines, setLines] = useState([]);
  const [models, setModels] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [error, setError] = useState('');

  const [vehicle, setVehicle] = useState({
    brand: '', line: '', model: '', code: '',
    type: '', cylinder: '', price: 0,
    plate: '', insuranceUse: 'PARTICULAR',
  });

  const [client, setClient] = useState({
    idType: 'CC', id: '', names: '', lastNames: '',
    city: 'BOGOTA', birthdate: '', gender: 'M',
  });

  useEffect(() => {
    api.getBrands().then(setBrands).catch(() => setError('Error cargando marcas'));
  }, []);

  useEffect(() => {
    if (vehicle.brand) {
      setLines([]);
      setModels([]);
      setVehicles([]);
      setVehicle(v => ({ ...v, line: '', model: '', code: '' }));
      api.getLines(vehicle.brand).then(setLines);
    }
  }, [vehicle.brand]);

  useEffect(() => {
    if (vehicle.brand && vehicle.line) {
      setModels([]);
      setVehicles([]);
      setVehicle(v => ({ ...v, model: '', code: '' }));
      api.getModels(vehicle.brand, vehicle.line).then(setModels);
    }
  }, [vehicle.brand, vehicle.line]);

  useEffect(() => {
    if (vehicle.brand && vehicle.line && vehicle.model) {
      setLoading(true);
      api.searchVehicles(vehicle.brand, vehicle.line, vehicle.model)
        .then(results => {
          setVehicles(results);
          if (results.length === 1) {
            const v = results[0];
            setVehicle(prev => ({
              ...prev, code: v.code, type: v.type,
              cylinder: v.cylinder, price: v.price,
            }));
          }
        })
        .finally(() => setLoading(false));
    }
  }, [vehicle.brand, vehicle.line, vehicle.model]);

  const selectVehicle = (v) => {
    setVehicle(prev => ({
      ...prev, code: v.code, type: v.type,
      cylinder: v.cylinder, price: v.price, line: v.line,
    }));
  };

  const canGoStep2 = vehicle.brand && vehicle.line && vehicle.model && vehicle.code;
  const canQuote = canGoStep2 && client.id && client.names;

  const handleQuote = async () => {
    setQuoting(true);
    setError('');
    try {
      const result = await api.createQuote(vehicle, client);
      onQuoteCreated(result);
    } catch (e) {
      setError(e.response?.data?.error || 'Error al cotizar');
    } finally {
      setQuoting(false);
    }
  };

  const formatPrice = (p) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(p);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Steps indicator */}
      <div className="flex items-center gap-3 mb-8">
        {[
          { n: 1, label: 'Vehículo' },
          { n: 2, label: 'Tomador' },
        ].map(({ n, label }) => (
          <button
            key={n}
            onClick={() => n < step || (n === 2 && canGoStep2) ? setStep(n) : null}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all ${
              step === n
                ? 'bg-indigo-600 text-white shadow-md'
                : step > n
                  ? 'bg-indigo-100 text-indigo-700 cursor-pointer hover:bg-indigo-200'
                  : 'bg-slate-100 text-slate-400'
            }`}
          >
            <span className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">
              {n}
            </span>
            {label}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-700">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Step 1: Vehículo */}
      {step === 1 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <Car className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Datos del Vehículo</h2>
              <p className="text-sm text-slate-500">Seleccione marca, línea y modelo</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Marca */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Marca</label>
              <select
                value={vehicle.brand}
                onChange={e => setVehicle({ ...vehicle, brand: e.target.value })}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                <option value="">Seleccionar marca</option>
                {brands.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>

            {/* Línea */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Línea</label>
              <select
                value={vehicle.line}
                onChange={e => setVehicle({ ...vehicle, line: e.target.value })}
                disabled={!vehicle.brand}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:opacity-50"
              >
                <option value="">Seleccionar línea</option>
                {lines.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            {/* Modelo (año) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Modelo (año)</label>
              <select
                value={vehicle.model}
                onChange={e => setVehicle({ ...vehicle, model: e.target.value })}
                disabled={!vehicle.line}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none disabled:opacity-50"
              >
                <option value="">Seleccionar año</option>
                {models.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Resultados de búsqueda */}
          {loading && (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              <span className="text-sm">Buscando vehículo...</span>
            </div>
          )}

          {vehicles.length > 1 && (
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-700 mb-2">Seleccione la versión exacta:</p>
              <div className="space-y-2">
                {vehicles.map((v, i) => (
                  <button
                    key={i}
                    onClick={() => selectVehicle(v)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      vehicle.code === v.code && vehicle.cylinder === v.cylinder
                        ? 'border-indigo-400 bg-indigo-50 ring-1 ring-indigo-400'
                        : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium text-slate-900">{v.line}</span>
                        <span className="ml-2 text-xs text-slate-500">FASECOLDA: {v.code}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-700">{formatPrice(v.price)}</span>
                    </div>
                    <div className="flex gap-3 mt-1">
                      <span className="text-xs text-slate-400">Tipo: {v.type}</span>
                      <span className="text-xs text-slate-400">Cilindraje: {v.cylinder}cc</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Vehículo seleccionado */}
          {vehicle.code && (
            <div className="mt-4 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-indigo-900">{vehicle.brand} {vehicle.line}</p>
                  <p className="text-xs text-indigo-600">
                    Modelo {vehicle.model} | FASECOLDA: {vehicle.code} | {vehicle.type} | {vehicle.cylinder}cc
                  </p>
                </div>
                <p className="text-lg font-bold text-indigo-900">{formatPrice(vehicle.price)}</p>
              </div>
            </div>
          )}

          {/* Uso y placa */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Uso del vehículo</label>
              <select
                value={vehicle.insuranceUse}
                onChange={e => setVehicle({ ...vehicle, insuranceUse: e.target.value })}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                <option value="PARTICULAR">Particular</option>
                <option value="PUBLICO">Público</option>
                <option value="DIPLOMATICO">Diplomático</option>
                <option value="OFICIAL">Oficial</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Placa (opcional)</label>
              <input
                type="text"
                value={vehicle.plate}
                onChange={e => setVehicle({ ...vehicle, plate: e.target.value.toUpperCase() })}
                placeholder="ABC123"
                maxLength={6}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none uppercase"
              />
            </div>
          </div>

          <div className="flex justify-end mt-6">
            <button
              onClick={() => setStep(2)}
              disabled={!canGoStep2}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Datos del tomador */}
      {step === 2 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <User className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Datos del Tomador</h2>
              <p className="text-sm text-slate-500">Información del asegurado</p>
            </div>
          </div>

          {/* Resumen vehículo */}
          <div className="mb-6 p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Car className="w-4 h-4 text-slate-400" />
              <span className="text-sm text-slate-600">
                {vehicle.brand} {vehicle.line} {vehicle.model}
              </span>
            </div>
            <span className="text-sm font-semibold text-slate-700">{formatPrice(vehicle.price)}</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Tipo de documento</label>
              <select
                value={client.idType}
                onChange={e => setClient({ ...client, idType: e.target.value })}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                <option value="CC">Cédula de Ciudadanía</option>
                <option value="NIT">NIT</option>
                <option value="CE">Cédula de Extranjería</option>
                <option value="PA">Pasaporte</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Número de documento *</label>
              <input
                type="text"
                value={client.id}
                onChange={e => setClient({ ...client, id: e.target.value })}
                placeholder="1234567890"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Nombres *</label>
              <input
                type="text"
                value={client.names}
                onChange={e => setClient({ ...client, names: e.target.value })}
                placeholder="Juan Carlos"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Apellidos</label>
              <input
                type="text"
                value={client.lastNames}
                onChange={e => setClient({ ...client, lastNames: e.target.value })}
                placeholder="Rivera Pérez"
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Ciudad de circulación</label>
              <select
                value={client.city}
                onChange={e => setClient({ ...client, city: e.target.value })}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              >
                {['BOGOTA','MEDELLIN','CALI','BARRANQUILLA','CARTAGENA','BUCARAMANGA','PEREIRA','MANIZALES','CUCUTA','IBAGUE','SANTA MARTA','VILLAVICENCIO','PASTO','NEIVA','ARMENIA','POPAYAN','MONTERIA','VALLEDUPAR','TUNJA'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Fecha de nacimiento</label>
              <input
                type="date"
                value={client.birthdate}
                onChange={e => setClient({ ...client, birthdate: e.target.value })}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Género</label>
              <div className="flex gap-3">
                {[{ v: 'M', l: 'Masculino' }, { v: 'F', l: 'Femenino' }].map(({ v, l }) => (
                  <button
                    key={v}
                    onClick={() => setClient({ ...client, gender: v })}
                    className={`flex-1 py-2.5 rounded-xl text-sm font-medium border transition-colors ${
                      client.gender === v
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-700'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-indigo-300'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-8">
            <button
              onClick={() => setStep(1)}
              className="px-6 py-2.5 text-slate-600 text-sm font-medium hover:text-slate-900 transition-colors"
            >
              Volver
            </button>
            <button
              onClick={handleQuote}
              disabled={!canQuote || quoting}
              className="flex items-center gap-2 px-8 py-3 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-200"
            >
              {quoting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cotizando...
                </>
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  Cotizar con todas las aseguradoras
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
