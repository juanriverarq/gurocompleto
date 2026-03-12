import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  maxDisplayed?: number;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar...',
  disabled = false,
  loading = false,
  maxDisplayed = 50,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedLabel = useMemo(() => {
    if (!value) return '';
    const found = options.find((o) => o.value === value);
    return found?.label || '';
  }, [value, options]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, maxDisplayed);
    const result: Option[] = [];
    for (let i = 0; i < options.length && result.length < maxDisplayed; i++) {
      if (options[i].label.toLowerCase().includes(q) || options[i].value.toLowerCase().includes(q)) {
        result.push(options[i]);
      }
    }
    return result;
  }, [options, query, maxDisplayed]);

  const handleSelect = useCallback(
    (val: string) => {
      onChange(val);
      setOpen(false);
      setQuery('');
    },
    [onChange],
  );

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus input when opening
  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  if (loading) {
    return (
      <div className="flex items-center h-[42px] px-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm text-gray-500">
        <svg className="animate-spin h-4 w-4 mr-2 text-gray-400" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
        Cargando...
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(!open)}
        className={`flex items-center justify-between w-full h-[42px] px-3 rounded-lg border text-sm text-left transition
          ${disabled ? 'bg-gray-100 dark:bg-gray-700 cursor-not-allowed opacity-60' : 'bg-white dark:bg-gray-800 cursor-pointer hover:border-blue-400'}
          ${open ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-300 dark:border-gray-600'}
          text-gray-900 dark:text-white`}
      >
        <span className={`truncate ${!value ? 'text-gray-400' : ''}`}>
          {value ? selectedLabel : placeholder}
        </span>
        <svg className={`w-4 h-4 ml-2 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-[9999] mt-1 w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar..."
              className="w-full px-3 py-1.5 text-sm rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
              onKeyDown={(e) => {
                if (e.key === 'Escape') { setOpen(false); setQuery(''); }
                if (e.key === 'Enter' && filtered.length === 1) { handleSelect(filtered[0].value); }
              }}
            />
          </div>
          {/* Options list - virtualized via max height + overflow */}
          <div className="max-h-60 overflow-y-auto overscroll-contain">
            {/* "All" option */}
            <button
              type="button"
              onClick={() => handleSelect('')}
              className={`w-full text-left px-3 py-2 text-sm transition hover:bg-blue-50 dark:hover:bg-gray-700 ${
                !value ? 'bg-blue-50 dark:bg-gray-700 font-medium text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
              }`}
            >
              {placeholder}
            </button>
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-center text-gray-400">
                Sin resultados para "{query}"
              </div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => handleSelect(opt.value)}
                  className={`w-full text-left px-3 py-2 text-sm transition hover:bg-blue-50 dark:hover:bg-gray-700 ${
                    opt.value === value ? 'bg-blue-50 dark:bg-gray-700 font-medium text-blue-600 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span className="truncate block">{opt.label}</span>
                </button>
              ))
            )}
            {filtered.length >= maxDisplayed && (
              <div className="px-3 py-2 text-xs text-center text-gray-400 border-t border-gray-100 dark:border-gray-700">
                Mostrando {maxDisplayed} de {options.length} — escribe para filtrar más
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default React.memo(SearchableSelect);
