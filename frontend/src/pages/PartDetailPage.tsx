import { useEffect, useState } from "react";
import {
  addStockMovement,
  getPart,
  listPartMovements,
  nowLocal,
  PART_CATEGORY_LABELS,
  PART_UNITS,
  updatePart,
  type Part,
  type StockMovement,
} from "../api";
import { useFormError } from "../components/CustomerForm";
import { Icon } from "../icons/Icon";
import { stockChip } from "./PartsPage";

const MOVEMENT_LABELS: Record<string, string> = {
  initial: "İlk stok girişi",
  purchase: "Parça alımı",
  increase: "Stok artışı",
  decrease: "Stok azalışı",
  count: "Sayım düzeltmesi",
  service_use: "Serviste kullanım",
  usage_reversal: "Kullanım iptali",
};

interface Props {
  partId: number;
  onBack: () => void;
}

export function PartDetailPage({ partId, onBack }: Props) {
  const [part, setPart] = useState<Part | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string | number | boolean>>({});
  const [moveType, setMoveType] = useState("purchase");
  const [moveQty, setMoveQty] = useState("1");
  const [moveNote, setMoveNote] = useState("");
  const [moveDate, setMoveDate] = useState(nowLocal());
  const [savingMove, setSavingMove] = useState(false);
  const { error, setError, clear } = useFormError();

  useEffect(() => {
    getPart(partId)
      .then((p) => {
        setPart(p);
        setForm({
          name: p.name,
          category: p.category,
          compatible_brand: p.compatible_brand ?? "",
          compatibility_note: p.compatibility_note ?? "",
          min_quantity: p.min_quantity,
          unit: p.unit,
          unit_cost: p.unit_cost ?? "",
          supplier: p.supplier ?? "",
          description: p.description ?? "",
          is_active: p.is_active,
        });
      })
      .catch((e) => setError(e.message));
    listPartMovements(partId).then(setMovements).catch(() => setMovements([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partId]);

  if (!part) {
    return (
      <main className="page">
        <div className="page-inner">
          {error ? <div className="form-error">{error}</div> : <p className="empty-note">Yükleniyor…</p>}
        </div>
      </main>
    );
  }

  const fmt = (v: string) => new Date(v).toLocaleString("tr-TR");

  const save = async () => {
    clear();
    try {
      const updated = await updatePart(part.id, {
        name: form.name,
        category: form.category,
        compatible_brand: form.compatible_brand || null,
        compatibility_note: form.compatibility_note || null,
        min_quantity: Number(form.min_quantity) || 0,
        unit: form.unit,
        unit_cost: form.unit_cost === "" ? null : Number(form.unit_cost),
        supplier: form.supplier || null,
        description: form.description || null,
        is_active: Boolean(form.is_active),
      });
      setPart(updated);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    }
  };

  const submitMovement = async () => {
    if (savingMove) return;
    clear();
    setSavingMove(true);
    try {
      const updated = await addStockMovement(part.id, {
        movement_type: moveType,
        quantity: Number(moveQty),
        note: moveNote || null,
        occurred_at: moveDate,
      });
      setPart(updated);
      setMoveQty("1");
      setMoveNote("");
      setMoveDate(nowLocal());
      listPartMovements(part.id).then(setMovements).catch(() => undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setSavingMove(false);
    }
  };

  return (
    <main className="page">
      <div className="page-inner">
        <a href="#" className="back-link" onClick={(e) => { e.preventDefault(); onBack(); }}>
          <Icon name="boxes" size={15} /> Stok listesine dön
        </a>
        <div className="page-header">
          <div>
            <h1 className="page-title">{part.name}</h1>
            <p className="page-subtitle">
              Parça kodu: {part.part_code} · {PART_CATEGORY_LABELS[part.category]}
            </p>
          </div>
          <button className="btn btn-secondary" onClick={() => { clear(); setEditing(!editing); }}>
            {editing ? "Vazgeç" : "Düzenle"}
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        {editing ? (
          <section className="detail-section">
            <h2>Parçayı Düzenle</h2>
            <div className="form-grid">
              <div className="form-field">
                <label htmlFor="ep-name">Parça Adı *</label>
                <input id="ep-name" type="text" value={String(form.name)} maxLength={120}
                  onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="form-field">
                <label htmlFor="ep-cat">Kategori</label>
                <select id="ep-cat" value={String(form.category)}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}>
                  {Object.entries(PART_CATEGORY_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="ep-min">Minimum Stok Seviyesi</label>
                <input id="ep-min" type="number" min={0} value={Number(form.min_quantity)}
                  onChange={(e) => setForm({ ...form, min_quantity: Number(e.target.value) })} />
              </div>
              <div className="form-field">
                <label htmlFor="ep-unit">Birim</label>
                <select id="ep-unit" value={String(form.unit)}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}>
                  {PART_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="ep-cost">Alış Maliyeti</label>
                <input id="ep-cost" type="number" min={0} step="0.01" value={String(form.unit_cost)}
                  onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} />
              </div>
              <div className="form-field">
                <label htmlFor="ep-supplier">Tedarikçi</label>
                <input id="ep-supplier" type="text" value={String(form.supplier)} maxLength={120}
                  onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
              </div>
              <div className="form-field">
                <label htmlFor="ep-brand">Uyumlu Marka</label>
                <input id="ep-brand" type="text" value={String(form.compatible_brand)} maxLength={60}
                  onChange={(e) => setForm({ ...form, compatible_brand: e.target.value })} />
              </div>
              <div className="form-field">
                <label htmlFor="ep-active">Durum</label>
                <select id="ep-active" value={form.is_active ? "active" : "passive"}
                  onChange={(e) => setForm({ ...form, is_active: e.target.value === "active" })}>
                  <option value="active">Aktif</option>
                  <option value="passive">Pasif</option>
                </select>
              </div>
              <div className="form-field form-field-wide">
                <label htmlFor="ep-desc">Açıklama</label>
                <input id="ep-desc" type="text" value={String(form.description)} maxLength={500}
                  onChange={(e) => setForm({ ...form, description: e.target.value })} />
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setEditing(false)}>İptal</button>
              <button className="btn btn-primary" onClick={save}>Kaydet</button>
            </div>
          </section>
        ) : (
          <section className="detail-section">
            <h2>Parça Bilgileri</h2>
            <dl className="detail-rows">
              <dt>Stok Durumu</dt>
              <dd>{stockChip(part.stock_level, part.quantity, part.unit)}</dd>
              <dt>Minimum Seviye</dt>
              <dd>{part.min_quantity} {part.unit}</dd>
              <dt>Uyumlu Marka</dt>
              <dd>{part.compatible_brand ?? "—"}</dd>
              <dt>Uyumluluk Notu</dt>
              <dd>{part.compatibility_note ?? "—"}</dd>
              <dt>Alış Maliyeti</dt>
              <dd>{part.unit_cost !== null ? `${part.unit_cost.toFixed(2)} TL` : "—"}</dd>
              <dt>Tedarikçi</dt>
              <dd>{part.supplier ?? "—"}</dd>
              <dt>Açıklama</dt>
              <dd>{part.description ?? "—"}</dd>
              <dt>Durum</dt>
              <dd>{part.is_active ? "Aktif" : "Pasif"}</dd>
              <dt>Son Güncelleme</dt>
              <dd>{fmt(part.updated_at)}</dd>
            </dl>
          </section>
        )}

        <section className="detail-section">
          <h2>Stok Hareketi Ekle</h2>
          {part.is_active ? (
            <div className="stock-adjust-row">
              <div className="form-field">
                <label htmlFor="mv-type">Hareket Türü</label>
                <select id="mv-type" value={moveType} onChange={(e) => setMoveType(e.target.value)}>
                  <option value="purchase">Parça alımı (+)</option>
                  <option value="increase">Stok artışı (+)</option>
                  <option value="decrease">Stok azalışı (−)</option>
                  <option value="count">Sayım düzeltmesi (=)</option>
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="mv-qty">Miktar</label>
                <input id="mv-qty" type="number" min={1} value={moveQty}
                  onChange={(e) => setMoveQty(e.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="mv-note">Açıklama (isteğe bağlı)</label>
                <input id="mv-note" type="text" value={moveNote} maxLength={300}
                  onChange={(e) => setMoveNote(e.target.value)} />
              </div>
              <div className="form-field">
                <label htmlFor="mv-date">İşlem Tarihi</label>
                <input id="mv-date" type="datetime-local" value={moveDate}
                  onChange={(e) => setMoveDate(e.target.value)} />
              </div>
              <button className="btn btn-primary" onClick={submitMovement} disabled={savingMove || !moveQty}>
                {savingMove ? "Kaydediliyor…" : "Hareketi Kaydet"}
              </button>
            </div>
          ) : (
            <p className="empty-note" style={{ padding: 0 }}>
              Pasif parçaya stok hareketi eklenemez.
            </p>
          )}
        </section>

        <section className="detail-section">
          <h2>Stok Hareketleri ({movements.length})</h2>
          {movements.length === 0 ? (
            <p className="empty-note" style={{ padding: 0 }}>Hareket kaydı yok.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Tarih</th>
                  <th scope="col">Hareket</th>
                  <th scope="col">Miktar</th>
                  <th scope="col">Önce → Sonra</th>
                  <th scope="col">Açıklama</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m.id}>
                    <td>{fmt(m.created_at)}</td>
                    <td><span className="movement-type-label">{MOVEMENT_LABELS[m.movement_type] ?? m.movement_type}</span></td>
                    <td>{m.movement_type === "count" ? `= ${m.quantity}` : m.quantity}</td>
                    <td>{m.stock_before} → {m.stock_after}</td>
                    <td>{m.note ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </main>
  );
}
