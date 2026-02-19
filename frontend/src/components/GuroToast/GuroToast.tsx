import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';

// ─── Types ───────────────────────────────────────────────────────────
type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number;
}

const ICONS: Record<ToastType, string> = {
  success: 'solar:check-circle-bold',
  error: 'solar:close-circle-bold',
  warning: 'solar:danger-triangle-bold',
  info: 'solar:info-circle-bold',
};

const COLORS: Record<ToastType, { bg: string; border: string; icon: string; ring: string }> = {
  success: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'text-emerald-400', ring: 'ring-emerald-500/20' },
  error: { bg: 'bg-red-500/10', border: 'border-red-500/20', icon: 'text-red-400', ring: 'ring-red-500/20' },
  warning: { bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: 'text-amber-400', ring: 'ring-amber-500/20' },
  info: { bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: 'text-blue-400', ring: 'ring-blue-500/20' },
};

// ─── Global state ────────────────────────────────────────────────────
let listeners: Array<(toasts: ToastItem[]) => void> = [];
let toasts: ToastItem[] = [];
let idCounter = 0;

function emit() {
  listeners.forEach((fn) => fn([...toasts]));
}

/**
 * Show a styled toast notification.
 * Usage: guroToast.success('¡Guardado!') or guroToast.error('Error', 'Detalle...')
 */
export const guroToast = {
  _add(type: ToastType, title: string, message?: string, duration?: number) {
    const id = `gt_${++idCounter}_${Date.now()}`;
    toasts = [...toasts, { id, type, title, message, duration: duration ?? 4000 }];
    emit();
    return id;
  },
  success(title: string, message?: string, duration?: number) {
    return this._add('success', title, message, duration);
  },
  error(title: string, message?: string, duration?: number) {
    return this._add('error', title, message, duration ?? 6000);
  },
  warning(title: string, message?: string, duration?: number) {
    return this._add('warning', title, message, duration ?? 5000);
  },
  info(title: string, message?: string, duration?: number) {
    return this._add('info', title, message, duration);
  },
  dismiss(id: string) {
    toasts = toasts.filter((t) => t.id !== id);
    emit();
  },
};

// ─── Single toast card ───────────────────────────────────────────────
const ToastCard: React.FC<{ item: ToastItem; onDismiss: (id: string) => void }> = ({ item, onDismiss }) => {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const c = COLORS[item.type];

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(() => {
      setExiting(true);
      setTimeout(() => onDismiss(item.id), 300);
    }, item.duration ?? 4000);
    return () => clearTimeout(timer);
  }, [item.id, item.duration, onDismiss]);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-2xl border ${c.border} ${c.bg} backdrop-blur-xl shadow-2xl shadow-black/30 ring-1 ${c.ring} transition-all duration-300 ease-out max-w-[380px] w-full`}
      style={{
        opacity: visible && !exiting ? 1 : 0,
        transform: visible && !exiting ? 'translateY(0) scale(1)' : 'translateY(-8px) scale(0.97)',
        fontFamily: "'General Sans', sans-serif",
      }}
    >
      <div className={`mt-0.5 shrink-0 ${c.icon}`}>
        <Icon icon={ICONS[item.type]} width={20} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-gray-900 dark:text-white leading-tight">{item.title}</p>
        {item.message && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 leading-relaxed">{item.message}</p>
        )}
      </div>
      <button
        onClick={() => { setExiting(true); setTimeout(() => onDismiss(item.id), 200); }}
        className="shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-black/5 dark:hover:bg-white/5 transition-all mt-0.5"
      >
        <Icon icon="solar:close-circle-bold" width={14} />
      </button>
    </div>
  );
};

// ─── Container (rendered once at app root) ───────────────────────────
export const GuroToastContainer: React.FC = () => {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    listeners.push(setItems);
    return () => {
      listeners = listeners.filter((fn) => fn !== setItems);
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    guroToast.dismiss(id);
  }, []);

  if (items.length === 0) return null;

  return createPortal(
    <div className="fixed top-4 right-4 z-[99998] flex flex-col gap-2 items-end pointer-events-none">
      {items.map((item) => (
        <div key={item.id} className="pointer-events-auto">
          <ToastCard item={item} onDismiss={dismiss} />
        </div>
      ))}
    </div>,
    document.body,
  );
};

export default guroToast;
