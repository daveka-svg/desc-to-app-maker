import { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";

const EU_COUNTRIES = [
  "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Republic",
  "Denmark", "Estonia", "Finland", "France", "Germany", "Greece", "Hungary",
  "Ireland", "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta",
  "Netherlands", "Northern Ireland", "Poland", "Portugal", "Romania",
  "Slovakia", "Slovenia", "Spain", "Sweden",
];

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
}

const CountryCombobox = ({ value, onChange, placeholder = "Search country…", error }: Props) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = EU_COUNTRIES.filter(c =>
    c.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    setHighlightIdx(0);
  }, [search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (country: string) => {
    onChange(country);
    setOpen(false);
    setSearch("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setOpen(true);
        e.preventDefault();
      }
      return;
    }
    if (e.key === "ArrowDown") {
      setHighlightIdx(i => Math.min(i + 1, filtered.length - 1));
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setHighlightIdx(i => Math.max(i - 1, 0));
      e.preventDefault();
    } else if (e.key === "Enter" && filtered[highlightIdx]) {
      select(filtered[highlightIdx]);
      e.preventDefault();
    } else if (e.key === "Escape") {
      setOpen(false);
      setSearch("");
    }
  };

  useEffect(() => {
    if (open && listRef.current) {
      const el = listRef.current.children[highlightIdx] as HTMLElement;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlightIdx, open]);

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`form-input flex items-center gap-2 cursor-pointer ${error ? "ring-2 ring-destructive" : ""}`}
        onClick={() => { setOpen(true); inputRef.current?.focus(); }}
      >
        {open ? (
          <input
            ref={inputRef}
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="flex-1 bg-transparent outline-none text-sm"
            autoFocus
          />
        ) : (
          <span className={`flex-1 text-sm ${value ? "text-foreground" : "text-muted-foreground"}`}>
            {value || placeholder}
          </span>
        )}
        {value && !open ? (
          <button type="button" onClick={(e) => { e.stopPropagation(); onChange(""); }} className="p-0.5">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
      {open && (
        <ul
          ref={listRef}
          className="absolute z-50 mt-1 w-full max-h-52 overflow-auto bg-card border border-border rounded-lg shadow-lg py-1"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-2 text-sm text-muted-foreground">No countries found</li>
          ) : (
            filtered.map((c, idx) => (
              <li
                key={c}
                onClick={() => select(c)}
                className={`px-4 py-2 text-sm cursor-pointer transition-colors ${
                  idx === highlightIdx ? "bg-secondary text-foreground" : "hover:bg-secondary/50"
                } ${c === value ? "font-semibold" : ""}`}
              >
                {c}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default CountryCombobox;
