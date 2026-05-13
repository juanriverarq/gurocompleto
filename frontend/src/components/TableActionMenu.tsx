import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { IconDots } from '@tabler/icons-react';

interface TableActionMenuProps {
  children: React.ReactNode;
}

/**
 * Portal-based action menu for tables.
 * Renders the dropdown in a portal so it escapes overflow:auto containers.
 */
const TableActionMenu: React.FC<TableActionMenuProps> = ({ children }) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  const computePosition = useCallback(() => {
    if (!triggerRef.current || !menuRef.current) return;
    const btn = triggerRef.current.getBoundingClientRect();
    const menu = menuRef.current;
    const menuRect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Place to the right of the trigger, aligned to its top
    let top = btn.top;
    let right = vw - btn.right + 4;

    // If it goes off-screen bottom, shift up
    if (top + menuRect.height > vh - 8) top = vh - menuRect.height - 8;
    if (top < 8) top = 8;
    // If it goes off-screen right, flip to the left
    if (right < 8) right = vw - btn.left - menuRect.width - 4;

    setPos({ top, right });
  }, []);

  useEffect(() => {
    if (!open) return;
    // Wait one frame so the menu is rendered and we can measure it
    requestAnimationFrame(() => computePosition());

    const handleClickOutside = (e: MouseEvent) => {
      if (
        menuRef.current && !menuRef.current.contains(e.target as Node) &&
        triggerRef.current && !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    const handleScroll = () => setOpen(false);
    const handleResize = () => setOpen(false);

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', handleResize);
    };
  }, [open, computePosition]);

  return (
    <>
      <span
        ref={triggerRef}
        className="h-8 w-8 flex justify-center items-center rounded-lg hover:bg-[#573CFF]/10 hover:text-[#573CFF] cursor-pointer transition-colors"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <IconDots size={18} />
      </span>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed bg-white dark:bg-[#1e293b] rounded-lg shadow-xl border border-gray-200 dark:border-white/10 py-1"
            style={{
              top: pos.top,
              right: pos.right,
              minWidth: 220,
              zIndex: 2147483647,
            }}
            onClick={() => setOpen(false)}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
};

interface MenuItemProps {
  children: React.ReactNode;
  onClick?: () => void;
  className?: string;
}

export const TableMenuItem: React.FC<MenuItemProps> = ({ children, onClick, className = '' }) => (
  <button
    type="button"
    className={`flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/[0.08] transition-colors text-left ${className}`}
    onClick={(e) => {
      e.stopPropagation();
      onClick?.();
    }}
  >
    {children}
  </button>
);

export default TableActionMenu;
