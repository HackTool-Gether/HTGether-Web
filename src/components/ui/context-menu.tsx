'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';

export interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
}

interface ContextMenuProps {
  items: ContextMenuItem[];
  children: React.ReactNode;
}

export function ContextMenu({ items, children }: ContextMenuProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setPos({ x: e.clientX, y: e.clientY });
      setOpen(true);
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const closeOnKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', closeOnKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', closeOnKey);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let { x, y } = pos;
    if (x + rect.width > vw) x = vw - rect.width - 4;
    if (y + rect.height > vh) y = vh - rect.height - 4;
    if (x !== pos.x || y !== pos.y) setPos({ x, y });
  }, [open, pos]);

  return (
    <>
      <div onContextMenu={handleContextMenu} style={{ display: 'contents' }}>
        {children}
      </div>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-[100] min-w-[160px] rounded-lg border border-border bg-popover shadow-lg py-1 animate-in fade-in-0 zoom-in-95"
            style={{ left: pos.x, top: pos.y }}
          >
            {items.map((item, i) => (
              <button
                key={i}
                type="button"
                disabled={item.disabled}
                onClick={() => {
                  setOpen(false);
                  item.onClick();
                }}
                className={`flex items-center gap-2 w-full px-3 py-1.5 text-[13px] text-left transition-colors disabled:opacity-40 disabled:pointer-events-none ${
                  item.variant === 'destructive'
                    ? 'text-destructive hover:bg-destructive/10'
                    : 'text-popover-foreground hover:bg-accent'
                }`}
              >
                {item.icon && (
                  <span className="w-4 h-4 flex items-center justify-center shrink-0">
                    {item.icon}
                  </span>
                )}
                {item.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
