import { useEffect, useState } from "react";
import {
  createService,
  listDevices,
  listServices,
  SERVICE_STATUS_LABELS,
  SERVICE_STATUS_TONE,
  type Device,
  type ServiceRecord,
  type ServiceStatus,
} from "../api";
import { CustomerLookup } from "../components/CustomerLookup";
import { useFormError } from "../components/CustomerForm";
import "./ServicesPage.css";

const EMPTY_FORM = {
  customer_id: null as number | null,
  device_id: null as number | null,
  reported_issue: "",
  physical_condition: "",
  accessories: "",
  note: "",
  estimated_delivery: "",
};

export function statusChip(status: ServiceStatus) {
  return (
    <span className={`status-chip tone-${SERVICE_STATUS_TONE[status]}`}>
      {SERVICE_STATUS_LABELS[status]}
    </span>
  );
}

export function ServicesPage({
  onOpenDetail,
  onGoToDevices,
}: {
  onOpenDetail: (id: number) => void;
  onGoToDevices: () => void;
}) {
  const [services, setServices] = useState<ServiceRecord[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState("created_desc");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [devices, setDevices] = useState<Device[]>([]);
  const [saving, setSaving] = useState(false);
  const [lastCreated, setLastCreated] = useState<ServiceRecord | null>(null);
  const { error, setError, clear } = useFormError();

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      listServices({
        q: query,
        status: statusFilter,
        date_from: dateFrom,
        date_to: dateTo,
        sort,
      })
        .then(setServices)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, statusFilter, dateFrom, dateTo, sort]);

  useEffect(() => {
    if (form.customer_id === null) {
      setDevices([]);
      return;
    }
    listDevices({ customer_id: form.customer_id, status: "active" })
      .then(setDevices)
      .catch(() => setDevices([]));
  }, [form.customer_id]);

  const submit = async () => {
    if (saving) return;
    clear();
    if (!form.customer_id || !form.device_id || !form.reported_issue.trim()) {
      setError("Müşteri, cihaz ve bildirilen arıza alanları zorunludur");
      return;
    }
    setSaving(true);
    try {
      const created = await createService({
        customer_id: form.customer_id,
        device_id: form.device_id,
        reported_issue: form.reported_issue,
        physical_condition: form.physical_condition || null,
        accessories: form.accessories || null,
        note: form.note || null,
        estimated_delivery: form.estimated_delivery || null,
      });
      setShowForm(false);
      setForm(EMPTY_FORM);
      setLastCreated(created);
      onOpenDetail(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setSaving(false);
    }
  };

  const selectedDevice = devices.find((d) => d.id === form.device_id);

  return (
    <main className="page">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Servisler</h1>
            <p className="page-subtitle">
              Servis kabul kayıtları; servis numarası, müşteri, telefon veya cihaz bilgisiyle aranabilir.
            </p>
          </div>
        </div>

        {lastCreated && !showForm && (
          <div className="status-strip success-strip">
            <span className="status-dot" />
            <span>
              Servis kaydı oluşturuldu: <strong>{lastCreated.service_no}</strong>
            </span>
            <button className="btn-link" onClick={() => onOpenDetail(lastCreated.id)}>
              Detaya git
            </button>
          </div>
        )}

        <div className="module-toolbar">
          <input
            type="text"
            className="search-box"
            placeholder="Servis no, müşteri, telefon, marka/model ara…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Durum filtresi">
            <option value="">Tüm durumlar</option>
            {Object.entries(SERVICE_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Başlangıç tarihi" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Bitiş tarihi" />
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sıralama">
            <option value="created_desc">En yeni</option>
            <option value="created_asc">En eski</option>
          </select>
          <span className="toolbar-spacer" />
          <button
            className="btn btn-primary"
            onClick={() => {
              clear();
              setLastCreated(null);
              setForm(EMPTY_FORM);
              setShowForm(true);
            }}
          >
            Yeni Servis Kabul
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        {showForm && (
          <section className="detail-section" aria-label="Yeni servis kabul">
            <h2>Yeni Servis Kabul</h2>
            <div className="form-grid">
              <div className="form-field form-field-wide">
                <CustomerLookup
                  id="svc-customer"
                  value={form.customer_id}
                  onChange={(customer_id) =>
                    setForm({ ...form, customer_id, device_id: null })
                  }
                />
                {form.customer_id !== null && devices.length === 0 && (
                  <span className="lookup-sub">
                    Bu müşteriye kayıtlı cihaz yok.{" "}
                    <a href="#" onClick={(e) => { e.preventDefault(); onGoToDevices(); }}>
                      Cihaz ekleme sayfasına gidin
                    </a>
                  </span>
                )}
              </div>
              <div className="form-field">
                <label htmlFor="svc-device">Cihaz *</label>
                <select
                  id="svc-device"
                  value={form.device_id ?? ""}
                  disabled={form.customer_id === null || devices.length === 0}
                  onChange={(e) =>
                    setForm({ ...form, device_id: e.target.value ? Number(e.target.value) : null })
                  }
                >
                  <option value="">Cihaz seçin…</option>
                  {devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.brand} {d.model} ({d.device_no})
                    </option>
                  ))}
                </select>
                {selectedDevice && (
                  <span className="lookup-sub">
                    {selectedDevice.type} · Seri no: {selectedDevice.serial_no ?? "—"}
                  </span>
                )}
              </div>
              <div className="form-field">
                <label htmlFor="svc-est">Tahmini Teslim Tarihi (isteğe bağlı)</label>
                <input
                  id="svc-est"
                  type="date"
                  value={form.estimated_delivery}
                  onChange={(e) => setForm({ ...form, estimated_delivery: e.target.value })}
                />
              </div>
              <div className="form-field form-field-wide">
                <label htmlFor="svc-issue">Bildirilen Arıza / Şikâyet *</label>
                <textarea
                  id="svc-issue"
                  value={form.reported_issue}
                  maxLength={1000}
                  onChange={(e) => setForm({ ...form, reported_issue: e.target.value })}
                />
              </div>
              <div className="form-field form-field-wide">
                <label htmlFor="svc-phys">Cihazın Fiziksel Durumu (teslim alınırken)</label>
                <input
                  id="svc-phys"
                  type="text"
                  value={form.physical_condition}
                  maxLength={500}
                  onChange={(e) => setForm({ ...form, physical_condition: e.target.value })}
                />
              </div>
              <div className="form-field form-field-wide">
                <label htmlFor="svc-acc">Teslim Alınan Aksesuarlar</label>
                <input
                  id="svc-acc"
                  type="text"
                  value={form.accessories}
                  maxLength={300}
                  onChange={(e) => setForm({ ...form, accessories: e.target.value })}
                />
              </div>
              <div className="form-field form-field-wide">
                <label htmlFor="svc-note">Servis Notu (isteğe bağlı)</label>
                <textarea
                  id="svc-note"
                  value={form.note}
                  maxLength={500}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                />
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

        {loading && services.length === 0 ? (
          <p className="empty-note">Yükleniyor…</p>
        ) : services.length === 0 ? (
          <p className="empty-note">Kayıt bulunamadı.</p>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Servis No</th>
                  <th scope="col">Müşteri</th>
                  <th scope="col">Cihaz</th>
                  <th scope="col">Kabul</th>
                  <th scope="col">Tahmini Teslim</th>
                  <th scope="col">Durum</th>
                  <th scope="col" className="col-actions">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id}>
                    <td>{s.service_no}</td>
                    <td>{s.customer_name}</td>
                    <td>{s.device_label}</td>
                    <td>{new Date(s.created_at).toLocaleDateString("tr-TR")}</td>
                    <td>
                      {s.estimated_delivery
                        ? new Date(s.estimated_delivery).toLocaleDateString("tr-TR")
                        : "—"}
                    </td>
                    <td>{statusChip(s.status)}</td>
                    <td className="col-actions">
                      <button className="btn-link" onClick={() => onOpenDetail(s.id)}>Detay</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="record-cards">
              {services.map((s) => (
                <div className="record-card" key={s.id}>
                  <div className="record-card-head">
                    <span className="record-card-title">{s.service_no}</span>
                    {statusChip(s.status)}
                  </div>
                  <div className="record-card-sub">{s.customer_name} · {s.device_label}</div>
                  <div className="record-card-meta">
                    <span>Kabul: {new Date(s.created_at).toLocaleDateString("tr-TR")}</span>
                    <span>
                      Tahmini: {s.estimated_delivery ? new Date(s.estimated_delivery).toLocaleDateString("tr-TR") : "—"}
                    </span>
                  </div>
                  <div className="record-card-actions">
                    <button className="btn-link" onClick={() => onOpenDetail(s.id)}>Detay</button>
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
