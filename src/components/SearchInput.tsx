// Autocomplete search input for places, addresses, landmarks.
// Uses Nominatim via /api/geocode endpoint.
import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin, Loader2, X } from "lucide-react";
import type { LatLng } from "@/lib/algorithms/graph";

interface PlaceResult {
  id: number;
  name: string;
  shortName: string;
  coords: LatLng;
  type: string;
  importance: number;
}

interface Props {
  label: string;
  value: string;
  onSelect: (coords: LatLng, name: string) => void;
  onClear: () => void;
  accentColor: string;
  placeholder?: string;
}

export default function SearchInput({
  label,
  value,
  onSelect,
  onClear,
  accentColor,
  placeholder = "Search place, address, landmark...",
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        console.log(data);
        setResults(data.results || []);
        setOpen(true);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 400);
  };

  const handleSelect = (place: PlaceResult) => {
    setQuery(place.shortName);
    setOpen(false);
    setResults([]);
    onSelect(place.coords, place.shortName);
  };

  const handleClear = () => {
    setQuery("");
    setResults([]);
    setOpen(false);
    onClear();
  };

  // Sync display value when parent sets coordinates (e.g. from map click)
  useEffect(() => {
    if (value && !query) {
      setQuery(value);
    }
  }, [value]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <div
        className="flex items-center gap-2 rounded-lg border px-3 py-2 transition"
        style={{ borderColor: `${accentColor}44` }}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/50"
        />
        {loading && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted-foreground" />}
        {query && !loading && (
          <button onClick={handleClear} className="shrink-0">
            <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.97 }}
            transition={{ duration: 0.15 }}
            className="absolute left-0 right-0 top-full z-[9999] mt-1 max-h-52 overflow-y-auto rounded-lg border border-border bg-black shadow-2xl"
          >
            {results.map((r) => (
              <button
                key={r.id}
                onClick={() => handleSelect(r)}
                className="flex w-full items-start gap-2 px-3 py-2.5 text-left text-xs transition hover:bg-secondary/60"
              >
                <MapPin
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                  style={{ color: accentColor }}
                />
                <div className="min-w-0">
                  <div className="truncate font-medium text-foreground">
                    {r.shortName}
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {r.name}
                  </div>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
