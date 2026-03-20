import React, { useState, useEffect } from 'react';
import { Settings, Plus, Trash2, Loader2, CheckCircle2, XCircle, Wifi, WifiOff, Eye, EyeOff, Plug, TestTube2 } from 'lucide-react';
import * as api from '../api';

export default function ConnectionsPanel() {
  const [connections, setConnections] = useState([]);
  const [insurers, setInsurers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(null); // methodId
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [showPasswords, setShowPasswords] = useState({});

  const reload = async () => {
    setLoading(true);
    try {
      const [conns, ins] = await Promise.all([api.getConnections(), api.getInsurers()]);
      setConnections(conns);
      setInsurers(ins);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => { reload(); }, []);

  const handleSave = async (methodId) => {
    setSaving(true);
    try {
      await api.saveCredentials(methodId, formData);
      setShowModal(null);
      setFormData({});
      await reload();
    } catch (e) {
      alert(e.response?.data?.error || 'Error guardando');
    }
    setSaving(false);
  };

  const handleTest = async (methodId) => {
    setTesting(methodId);
    setTestResult(null);
    try {
      const result = await api.testConnection(methodId);
      setTestResult({ methodId, ...result });
      await reload();
    } catch (e) {
      setTestResult({ methodId, success: false, message: e.response?.data?.message || e.message });
    }
    setTesting(null);
  };

  const handleDelete = async (methodId) => {
    if (!confirm('¿Eliminar esta conexión?')) return;
    await api.removeConnection(methodId);
    await reload();
  };

  const handleToggle = async (methodId, active) => {
    await api.toggleConnection(methodId, active);
    await reload();
  };

  // Group connections by insurer
  const grouped = {};
  for (const ins of insurers) {
    grouped[ins.id] = {
      ...ins,
      connections: connections.filter(c => c.insurerId === ins.id),
    };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  const openConfig = (method) => {
    setShowModal(method.id);
    // Pre-fill with existing data if any
    const existing = connections.find(c => c.id === method.id);
    setFormData(existing?.configured ? {} : {});
    setTestResult(null);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Conexiones con Aseguradoras</h2>
          <p className="text-sm text-slate-500 mt-1">Configure las credenciales para cotizar con cada compañía</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
          <div className="w-2 h-2 bg-emerald-500 rounded-full" />
          <span className="text-xs font-medium text-slate-600">
            {connections.filter(c => c.active).length} activas
          </span>
        </div>
      </div>

      {/* Insurers grid */}
      <div className="space-y-4">
        {Object.values(grouped).map(ins => (
          <div key={ins.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 flex items-center gap-4" style={{ borderLeftColor: ins.color, borderLeftWidth: '4px' }}>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center text-white font-bold text-sm" style={{ backgroundColor: ins.color }}>
                {ins.name.split(' ').pop().slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-slate-900">{ins.name}</h3>
                <p className="text-xs text-slate-500">NIT: {ins.nit}</p>
              </div>
            </div>

            <div className="px-5 pb-4">
              {ins.connections.map(conn => (
                <div key={conn.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl mt-2">
                  <div className="flex items-center gap-3">
                    {conn.active ? (
                      <Wifi className="w-4 h-4 text-emerald-500" />
                    ) : conn.configured ? (
                      <WifiOff className="w-4 h-4 text-slate-400" />
                    ) : (
                      <Plug className="w-4 h-4 text-slate-300" />
                    )}
                    <div>
                      <p className="text-sm font-medium text-slate-800">{conn.name}</p>
                      <p className="text-xs text-slate-500">{conn.description}</p>
                    </div>
                    {conn.testResult === 'success' && (
                      <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-xs font-medium rounded-full">
                        <CheckCircle2 className="w-3 h-3" /> Verificada
                      </span>
                    )}
                    {conn.testResult === 'failed' && (
                      <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-700 text-xs font-medium rounded-full">
                        <XCircle className="w-3 h-3" /> Falló
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {conn.configured && (
                      <>
                        <button
                          onClick={() => handleToggle(conn.id, !conn.active)}
                          className={`relative w-10 h-5 rounded-full transition-colors ${conn.active ? 'bg-emerald-500' : 'bg-slate-300'}`}
                        >
                          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${conn.active ? 'left-5.5 translate-x-1' : 'left-0.5'}`} />
                        </button>
                        <button
                          onClick={() => handleTest(conn.id)}
                          disabled={testing === conn.id}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                          title="Probar conexión"
                        >
                          {testing === conn.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube2 className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleDelete(conn.id)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => openConfig(conn)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                        conn.configured
                          ? 'text-slate-600 bg-slate-100 hover:bg-slate-200'
                          : 'text-white bg-indigo-600 hover:bg-indigo-700'
                      }`}
                    >
                      {conn.configured ? 'Editar' : 'Configurar'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Test result toast */}
      {testResult && (
        <div className={`fixed bottom-6 right-6 p-4 rounded-xl shadow-lg border max-w-sm z-50 ${
          testResult.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-center gap-3">
            {testResult.success ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
            ) : (
              <XCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <div>
              <p className={`text-sm font-medium ${testResult.success ? 'text-emerald-800' : 'text-red-800'}`}>
                {testResult.success ? 'Conexión exitosa' : 'Error de conexión'}
              </p>
              <p className={`text-xs mt-0.5 ${testResult.success ? 'text-emerald-600' : 'text-red-600'}`}>
                {testResult.message}
              </p>
            </div>
            <button onClick={() => setTestResult(null)} className="ml-2 text-slate-400 hover:text-slate-600">×</button>
          </div>
        </div>
      )}

      {/* Modal de configuración */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowModal(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
            {(() => {
              const conn = connections.find(c => c.id === showModal) || {};
              const method = insurers.flatMap(i => i.methods).find(m => m.id === showModal);
              if (!method) return null;
              return (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
                      <Settings className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-slate-900">{method.name}</h3>
                      <p className="text-xs text-slate-500">{method.description}</p>
                    </div>
                  </div>

                  {method.helpText && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-xs text-amber-800 whitespace-pre-line">{method.helpText}</p>
                    </div>
                  )}

                  <div className="space-y-4">
                    {method.fields.map(field => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">{field.label}</label>
                        {field.type === 'textarea' ? (
                          <textarea
                            value={formData[field.key] || ''}
                            onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                            placeholder={field.placeholder}
                            rows={5}
                            className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono"
                          />
                        ) : (
                          <div className="relative">
                            <input
                              type={field.type === 'password' && !showPasswords[field.key] ? 'password' : 'text'}
                              value={formData[field.key] || ''}
                              onChange={e => setFormData({ ...formData, [field.key]: e.target.value })}
                              placeholder={field.placeholder}
                              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none pr-10"
                            />
                            {field.type === 'password' && (
                              <button
                                type="button"
                                onClick={() => setShowPasswords(p => ({ ...p, [field.key]: !p[field.key] }))}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                              >
                                {showPasswords[field.key] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-end gap-3 mt-6">
                    <button
                      onClick={() => setShowModal(null)}
                      className="px-4 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={() => handleSave(showModal)}
                      disabled={saving || !method.fields.every(f => formData[f.key])}
                      className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      Guardar y activar
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
