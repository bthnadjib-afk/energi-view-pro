import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { MapPin } from 'lucide-react';

interface AddressSuggestion {
  label: string;
  housenumber?: string;
  street?: string;
  postcode?: string;
  city?: string;
}

interface AddressAutocompleteProps {
  value?: string;
  onSelect: (address: { rue: string; codePostal: string; ville: string }) => void;
  placeholder?: string;
  className?: string;
}

export function AddressAutocomplete({ value, onSelect, placeholder = 'Adresse', className }: AddressAutocompleteProps) {
  const [query, setQuery] = useState(value || '');
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value !== undefined) setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const search = (q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.length < 3) { setSuggestions([]); setOpen(false); return; }

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=5`);
        const data = await res.json();
        const results: AddressSuggestion[] = data.features?.map((f: any) => ({
          label: f.properties.label,
          housenumber: f.properties.housenumber,
          street: f.properties.street || f.properties.name,
          postcode: f.properties.postcode,
          city: f.properties.city,
        })) || [];
        setSuggestions(results);
        setOpen(results.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 300);
  };

  const handleSelect = (s: AddressSuggestion) => {
    const rue = [s.housenumber, s.street].filter(Boolean).join(' ');
    setQuery(s.label);
    setOpen(false);
    onSelect({ rue, codePostal: s.postcode || '', ville: s.city || '' });
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); search(e.target.value); }}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder={placeholder}
          className={`pl-9 ${className || 'glass border-border/50'}`}
        />
      </div>
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-background shadow-xl overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={i}
              type="button"
              className="w-full text-left px-4 py-2.5 text-sm text-foreground hover:bg-accent/50 transition-colors flex items-center gap-2"
              onClick={() => handleSelect(s)}
            >
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
