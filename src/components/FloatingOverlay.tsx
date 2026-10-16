"use client";

import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Overlay stacking (do not rely on z-index alone — floating layers portal to document.body):
 * 40 sidebar / dim backdrop, 55 modal, 56 floating menus (must sit above modals so
 * selects and calendars inside dialogs remain usable), 60 toast.
 */
export const OVERLAY_Z = {
  backdrop: 40,
  modal: 55,
  floating: 56,
  toast: 60,
} as const;

const VIEWPORT_PAD = 8;

type Align = "start" | "end";

function placeMenu(
  trigger: DOMRect,
  menu: { width: number; height: number },
  align: Align,
) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(menu.width, vw - VIEWPORT_PAD * 2);
  const height = Math.min(menu.height, vh - VIEWPORT_PAD * 2);
  let top = trigger.bottom + 6;
  if (top + height > vh - VIEWPORT_PAD && trigger.top - 6 - height >= VIEWPORT_PAD) {
    top = trigger.top - height - 6;
  }
  top = Math.max(VIEWPORT_PAD, Math.min(top, vh - height - VIEWPORT_PAD));
  let left = align === "end" ? trigger.right - width : trigger.left;
  left = Math.max(VIEWPORT_PAD, Math.min(left, vw - width - VIEWPORT_PAD));
  return { top, left, width };
}

export function FloatingOverlay({
  open,
  onClose,
  triggerRef,
  align = "start",
  matchTriggerWidth = true,
  minWidth,
  maxWidth,
  className = "",
  children,
  role = "dialog",
}: {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  align?: Align;
  matchTriggerWidth?: boolean;
  minWidth?: number;
  maxWidth?: number;
  className?: string;
  children: React.ReactNode;
  role?: string;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const updatePosition = () => {
    const trigger = triggerRef.current?.getBoundingClientRect();
    const menuBox = menuRef.current?.getBoundingClientRect();
    if (!trigger) return;
    let width = matchTriggerWidth ? trigger.width : Math.max(minWidth ?? 0, menuBox?.width || trigger.width);
    if (minWidth) width = Math.max(width, minWidth);
    if (maxWidth) width = Math.min(width, maxWidth);
    const height = menuBox?.height || 240;
    setCoords(placeMenu(trigger, { width, height }, align));
  };

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
  }, [open, align, matchTriggerWidth, minWidth, maxWidth]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => updatePosition();
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    const observer = typeof ResizeObserver !== "undefined" && menuRef.current
      ? new ResizeObserver(onScrollOrResize)
      : null;
    if (menuRef.current && observer) observer.observe(menuRef.current);
    return () => {
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
      observer?.disconnect();
    };
  }, [open, align, matchTriggerWidth, minWidth, maxWidth]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node;
      if (menuRef.current?.contains(target)) return;
      if (triggerRef.current?.contains(target)) return;
      onClose();
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open, onClose, triggerRef]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      role={role}
      className={`fixed bg-enrollaa-navy border border-white/15 rounded-md shadow-2xl ${className}`}
      style={{
        zIndex: OVERLAY_Z.floating,
        top: coords?.top ?? 0,
        left: coords?.left ?? 0,
        width: coords?.width ?? undefined,
        visibility: coords ? "visible" : "hidden",
      }}
    >
      {children}
    </div>,
    document.body,
  );
}
