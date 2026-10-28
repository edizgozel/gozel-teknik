import { useEffect, useState } from "react";
import {
  createPart,
  listParts,
  PART_CATEGORY_LABELS,
  PART_UNITS,
  type Part,
  type PartCategory,
} from "../api";
import { useFormError } from "../components/CustomerForm";
import "./PartsPage.css";

const EMPTY_FORM = {
  name: "",
  category: "diger" as PartCategory,
  compatible_brand: "",
  compatibility_note: "",
  min_quantity: 0,
  unit: "adet",
  unit_cost: "",
  supplier: "",
  description: "",
  initial_quantity: 0,
};

export function stockChip(level: Part["stock_level"], quantity: number, unit: string) {
  if (level === "out") return <span className="status-chip tone-bad">Stokta yok</span>;
  if (level === "low") return <span className="status-chip tone-warn">Düşük stok ({quantity} {unit})</span>;
  return <span className="status-chip tone-ok">Yeterli stok ({quantity} {unit})</span>;
}

export function PartsPage({ onOpenDetail }: { onOpenDetail: (id: number) => void }) {
  const [parts, setParts] = useState<Part[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [stock, setStock] = useState("");
  const [status, setStatus] = useState("active");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const { error, setError, clear } = useFormError();

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      listParts({ q: query, category, stock, status })
        .then(setParts)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category, stock, status]);

  const submit = async () => {
    if (saving) return;
    clear();
    if (!form.name.trim()) {
      setError("Parça adı zorunludur");
      return;
    }
    setSaving(true);
    try {
      const created = await createPart({
        name: form.name,
        category: form.category,
        compatible_brand: form.compatible_brand || null,
        compatibility_note: form.compatibility_note || null,
        min_quantity: Number(form.min_quantity) || 0,
        unit: form.unit,
        unit_cost: form.unit_cost ? Number(form.unit_cost) : null,
        supplier: form.supplier || null,
        description: form.description || null,
        initial_quantity: Number(form.initial_quantity) || 0,
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      onOpenDetail(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setSaving(false);
    }
  };

  const set = (patch: Partial<typeof form>) => setForm({ ...form, ...patch });

  return (
    <main className="page">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Stok</h1>
            <p className="page-subtitle">
              Yedek parça kataloğu ve stok hareketleri; parça kodu veya adıyla aranabilir.
            </p>
          </div>
        </div>

        <div className="module-toolbar">
          <input
            type="text"
            className="search-box"
            placeholder="Parça kodu veya adı ara…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Kategori filtresi">
            <option value="">Tüm kategoriler</option>
            {Object.entries(PART_CATEGORY_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <select value={stock} onChange={(e) => setStock(e.target.value)} aria-label="Stok durumu filtresi">
            <option value="">Tüm stok durumları</option>
            <option value="low">Düşük stok</option>
            <option value="out">Stokta yok</option>
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Durum filtresi">
            <option value="active">Aktif</option>
            <option value="passive">Pasif</option>
            <option value="all">Tümü</option>
          </select>
          <span className="toolbar-spacer" />
          <button
            className="btn btn-primary"
            onClick={() => { clear(); setForm(EMPTY_FORM); setShowForm(true); }}
          >
            Yeni Parça
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        {showForm && (
          <section className="detail-section" aria-label="Yeni parça">
            <h2>Yeni Parça</h2>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="pt-name">Parça Adı *</label>
                <input id="pt-name" type="text" value={form.name} maxLength={120}
                  onChange={(e) => set({ name: e.target.value })} />
              </div>
              <div className="form-field">
                <label htmlFor="pt-cat">Kategori *</label>
                <select id="pt-cat" value={form.category} onChange={(e) => set({ category: e.target.value as PartCategory })}>
                  {Object.entries(PART_CATEGORY_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="pt-brand">Uyumlu Marka (isteğe bağlı)</label>
                <input id="pt-brand" type="text" value={form.compatible_brand} maxLength={60}
                  onChange={(e) => set({ compatible_brand: e.target.value })} />
              </div>
              <div className="form-field">
                <label htmlFor="pt-compat">Uyumluluk Açıklaması (isteğe bağlı)</label>
                <input id="pt-compat" type="text" value={form.compatibility_note} maxLength={300}
                  onChange={(e) => set({ compatibility_note: e.target.value })} />
              </div>
              <div className="form-field">
                <label htmlFor="pt-initial">İlk Stok Miktarı</label>
                <input id="pt-initial" type="number" min={0} value={form.initial_quantity}
                  onChange={(e) => set({ initial_quantity: Number(e.target.value) })} />
              </div>
              <div className="form-field">
                <label htmlFor="pt-min">Minimum Stok Seviyesi</label>
                <input id="pt-min" type="number" min={0} value={form.min_quantity}
                  onChange={(e) => set({ min_quantity: Number(e.target.value) })} />
              </div>
              <div className="form-field">
                <label htmlFor="pt-unit">Birim</label>
                <select id="pt-unit" value={form.unit} onChange={(e) => set({ unit: e.target.value })}>
                  {PART_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="pt-cost">Alış Maliyeti (isteğe bağlı)</label>
                <input id="pt-cost" type="number" min={0} step="0.01" value={form.unit_cost}
                  onChange={(e) => set({ unit_cost: e.target.value })} />
              </div>
              <div className="form-field">
                <label htmlFor="pt-supplier">Tedarikçi (isteğe bağlı)</label>
                <input id="pt-supplier" type="text" value={form.supplier} maxLength={120}
                  onChange={(e) => set({ supplier: e.target.value })} />
              </div>
              <div className="form-field form-field-wide">
                <label htmlFor="pt-desc">Açıklama (isteğe bağlı)</label>
                <input id="pt-desc" type="text" value={form.description} maxLength={500}
                  onChange={(e) => set({ description: e.target.value })} />
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>İptal</button>
              <button className="btn btn-primary" onClick={submit} disabled={saving}>
                {saving ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          </section>
        )}

        {loading && parts.length === 0 ? (
          <p className="empty-note">Yükleniyor…</p>
        ) : parts.length === 0 ? (
          <p className="empty-note">Kayıt bulunamadı.</p>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Kod</th>
                  <th scope="col">Parça</th>
                  <th scope="col">Kategori</th>
                  <th scope="col">Stok</th>
                  <th scope="col">Min.</th>
                  <th scope="col" className="col-actions">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {parts.map((p) => (
                  <tr key={p.id}>
                    <td>{p.part_code}</td>
                    <td>
                      {p.name}
                      {p.compatible_brand && (
                        <span className="part-sub"> · {p.compatible_brand}</span>
                      )}
                    </td>
                    <td>{PART_CATEGORY_LABELS[p.category]}</td>
                    <td>{stockChip(p.stock_level, p.quantity, p.unit)}</td>
                    <td>{p.min_quantity}</td>
                    <td className="col-actions">
                      <button className="btn-link" onClick={() => onOpenDetail(p.id)}>Detay</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="record-cards">
              {parts.map((p) => (
                <div className="record-card" key={p.id}>
                  <div className="record-card-head">
                    <span className="record-card-title">{p.name}</span>
                    {stockChip(p.stock_level, p.quantity, p.unit)}
                  </div>
                  <div className="record-card-sub">{p.part_code} · {PART_CATEGORY_LABELS[p.category]}</div>
                  <div className="record-card-actions">
                    <button className="btn-link" onClick={() => onOpenDetail(p.id)}>Detay</button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
