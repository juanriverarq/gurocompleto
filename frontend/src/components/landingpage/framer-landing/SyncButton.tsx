import { Icon } from '@iconify/react';
import type { ReactNode } from 'react';

type Size = 'sm' | 'md' | 'lg';

type Props = {
  href?: string;
  onClick?: () => void;
  children: ReactNode;
  icon?: string;
  size?: Size;
  className?: string;
};

const sizePad: Record<Size, string> = {
  sm: '0.55rem 1.1rem',
  md: '0.8rem 1.5rem',
  lg: '0.95rem 1.85rem',
};

const sizeFont: Record<Size, string> = {
  sm: '0.7rem',
  md: '0.75rem',
  lg: '0.78rem',
};

const SyncButton = ({ href, onClick, children, icon = 'solar:arrow-right-linear', size = 'md', className = '' }: Props) => {
  const inner = (
    <>
      {icon && <Icon icon={icon} className={size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} />}
      {children}
    </>
  );
  return (
    <span className={`hero-sync-shell ${className}`}>
      <span className="hero-sync-spin-track" aria-hidden />
      <span className="hero-sync-halo" aria-hidden />
      <span className="hero-sync-spark" aria-hidden />
      {href ? (
        <a
          href={href}
          className="hero-sync-inner"
          style={{ padding: sizePad[size], fontSize: sizeFont[size] }}
        >
          {inner}
        </a>
      ) : (
        <button
          type="button"
          onClick={onClick}
          className="hero-sync-inner"
          style={{ padding: sizePad[size], fontSize: sizeFont[size] }}
        >
          {inner}
        </button>
      )}
    </span>
  );
};

export default SyncButton;
