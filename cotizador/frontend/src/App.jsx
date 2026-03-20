import React, { useState } from 'react';
import { Car, Settings, BarChart3, Shield } from 'lucide-react';
import QuoteForm from './components/QuoteForm';
import ConnectionsPanel from './components/ConnectionsPanel';
import QuoteResults from './components/QuoteResults';

const TABS = [
  { id: 'quote', label: 'Cotizar', icon: Car },
  { id: 'results', label: 'Resultados', icon: BarChart3 },
  { id: 'connections', label: 'Conexiones', icon: Settings },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('quote');
  const [currentQuote, setCurrentQuote] = useState(null);

  const handleQuoteCreated = (quote) => {
    setCurrentQuote(quote);
    setActiveTab('results');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-indigo-600 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-slate-900">Guro Cotizador</h1>
                <p className="text-xs text-slate-500 -mt-0.5">Seguros Vehiculares</p>
              </div>
            </div>
            <nav className="flex gap-1">
              {TABS.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === tab.id
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'quote' && <QuoteForm onQuoteCreated={handleQuoteCreated} />}
        {activeTab === 'results' && <QuoteResults quote={currentQuote} />}
        {activeTab === 'connections' && <ConnectionsPanel />}
      </main>
    </div>
  );
}
