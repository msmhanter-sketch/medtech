"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, ServiceSearchResult } from "@/lib/api";

interface UseSearchReturn {
  query: string;
  setQuery: (q: string) => void;
  results: ServiceSearchResult[];
  isLoading: boolean;
  isOpen: boolean;
  setIsOpen: (v: boolean) => void;
  selectedService: ServiceSearchResult | null;
  selectService: (svc: ServiceSearchResult) => void;
  clearSelection: () => void;
}

/**
 * Хук для живого поиска услуг с debounce.
 * Запрос на бэкенд идёт через 300ms после последнего ввода.
 */
export function useSearch(debounceMs = 300): UseSearchReturn {
  const [query, setQueryRaw] = useState("");
  const [results, setResults] = useState<ServiceSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedService, setSelectedService] =
    useState<ServiceSearchResult | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const setQuery = useCallback((q: string) => {
    setQueryRaw(q);
    setSelectedService(null);

    if (timerRef.current) clearTimeout(timerRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (q.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    timerRef.current = setTimeout(async () => {
      abortRef.current = new AbortController();
      try {
        const data = await api.searchServices(q.trim(), 8);
        setResults(data);
        setIsOpen(data.length > 0);
      } catch {
        setResults([]);
        setIsOpen(false);
      } finally {
        setIsLoading(false);
      }
    }, debounceMs);
  }, [debounceMs]);

  const selectService = useCallback((svc: ServiceSearchResult) => {
    setSelectedService(svc);
    setQueryRaw(svc.name);
    setIsOpen(false);
    setResults([]);
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedService(null);
    setQueryRaw("");
    setResults([]);
    setIsOpen(false);
  }, []);

  // Cleanup при размонтировании
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return {
    query,
    setQuery,
    results,
    isLoading,
    isOpen,
    setIsOpen,
    selectedService,
    selectService,
    clearSelection,
  };
}
