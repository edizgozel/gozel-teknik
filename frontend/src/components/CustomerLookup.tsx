import { useEffect, useRef, useState } from "react";
import { listCustomers, type Customer } from "../api";

interface Props {
  value: number | null;
  onChange: (customerId: number | null) => void;
  id?: string;
}

export function CustomerLookup({ value, onChange, id }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [selected, setSelected] = useState<Customer | null>(null);
  const [open, setOpen] = useState(false);
  const [skip, setSkip] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    if (skip) return;
    const handle = setTimeout(() => {
      listCustomers({ q: query, status: "active", sort: "name_asc" })
        .then((r) => {
          setResults(r.slice(0, 8));
          setOpen(true);
        })
        .catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, skip]);

  const select = (customer: Customer) => {
    setSelected(customer);
    onChange(customer.id);
    setQuery(customer.name);
    setOpen(false);
    setSkip(true);
  };

  return (
    <div className="device-lookup" ref={containerRef}>
      <label htmlFor={id}>Müşteri</label>
      <input
        id={id}
        type="text"
        placeholder="Müşteri ara (ad veya telefon)…"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setSkip(false);
          if (!e.target.value) {
            setSelected(null);
            onChange(null);
          }
        }}
        autoComplete="off"
      />
      {selected && !skip ? null : null}
      {open && !skip && results.length > 0 && (
        <div className="device-lookup-results" role="listbox">
          {results.map((c) => (
            <button type="button" key={c.id} className="device-lookup-item" onClick={() => select(c)}>
              {c.name}
              <span className="lookup-sub">{c.customer_no} · {c.phone}</span>
            </button>
          ))}
        </div>
      )}
      {value !== null && selected === null && (
        <span className="lookup-sub">Seçili müşteri no: {value}</span>
      )}
    </div>
  );
}
