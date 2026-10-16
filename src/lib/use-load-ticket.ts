"use client";

import { useCallback, useEffect, useRef } from "react";

export function asList<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export function isAbortError(error: unknown) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

/**
 * Marks in-flight dashboard loads stale when a newer request starts or the panel unmounts,
 * so a late response cannot keep a spinner up or write into the wrong screen.
 */
export function useLoadTicket() {
  const generation = useRef(0);

  useEffect(() => {
    return () => {
      generation.current += 1;
    };
  }, []);

  return useCallback(() => {
    const id = ++generation.current;
    return {
      stale: () => id !== generation.current,
    };
  }, []);
}
