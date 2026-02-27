import { useState, useRef, useEffect } from "react";
import { ChevronDown, X } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}

const SearchableSelect = ({ value, onChange, options, placeholder = "Select…", error, disabled }: Props) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlightIdx, setHighlightIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = options.filter(o =>
    o.toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => { setHighlightIdx(0); }, [search]);

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

  const select = (val: string) => {
    onChange(val);
    setOpen(false);
    setSearch("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") { setOpen(true); e.preventDefault(); }
      return;
    }
    if (e.key === "ArrowDown") { setHighlightIdx(i => Math.min(i + 1, filtered.length - 1)); e.preventDefault(); }
    else if (e.key === "ArrowUp") { setHighlightIdx(i => Math.max(i - 1, 0)); e.preventDefault(); }
    else if (e.key === "Enter" && filtered[highlightIdx]) { select(filtered[highlightIdx]); e.preventDefault(); }
    else if (e.key === "Escape") { setOpen(false); setSearch(""); }
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
        className={`form-input flex items-center gap-2 cursor-pointer ${error ? "ring-2 ring-destructive" : ""} ${disabled ? "opacity-50 pointer-events-none" : ""}`}
        onClick={() => { if (!disabled) { setOpen(true); inputRef.current?.focus(); } }}
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
          className="absolute z-50 mt-1 w-full max-h-52 overflow-auto bg-background border border-border rounded-md shadow-lg py-1"
        >
          {filtered.length === 0 ? (
            <li className="px-4 py-2 text-sm text-muted-foreground">No results found</li>
          ) : (
            filtered.map((item, idx) => (
              <li
                key={item}
                onClick={() => select(item)}
                className={`px-4 py-2 text-sm cursor-pointer transition-colors ${
                  idx === highlightIdx ? "bg-secondary text-foreground" : "hover:bg-secondary/50"
                } ${item === value ? "font-semibold" : ""}`}
              >
                {item}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default SearchableSelect;
