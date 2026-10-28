import { useEffect, useState } from "react";
import {
  createDevice,
  DEVICE_TYPE_LABELS,
  listDevices,
  type Device,
  type DeviceType,
} from "../api";
import { CustomerLookup } from "../components/CustomerLookup";
import { useFormError } from "../components/CustomerForm";
import "./DevicesPage.css";

interface DeviceFormValues {
  customer_id: number | null;
  type: DeviceType;
  brand: string;
  model: string;
  serial_no: string;
  note: string;
  is_active: boolean;
}

export const EMPTY_DEVICE: DeviceFormValues = {
  customer_id: null,
  type: "telefon",
  brand: "",
  model: "",
  serial_no: "",
  note: "",
  is_active: true,
};

export function DeviceFormFields({
  values,
  onChange,
}: {
  values: DeviceFormValues;
  onChange: (v: DeviceFormValues) => void;
}) {
  const set = (patch: Partial<DeviceFormValues>) => onChange({ ...values, ...patch });

  return (
    <div className="form-grid">
      <CustomerLookup
        id="dev-customer"
        value={values.customer_id}
        onChange={(customer_id) => set({ customer_id })}
      />
      <div className="form-field">
        <label htmlFor="dev-type">Cihaz Türü *</label>
        <select
          id="dev-type"
          value={values.type}
          onChange={(e) => set({ type: e.target.value as DeviceType })}
        >
          {Object.entries(DEVICE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div className="form-field">
        <label htmlFor="dev-brand">Marka *</label>
        <input
          id="dev-brand"
          type="text"
          value={values.brand}
          maxLength={60}
          onChange={(e) => set({ brand: e.target.value })}
        />
      </div>
      <div className="form-field">
        <label htmlFor="dev-model">Model *</label>
        <input
          id="dev-model"
          type="text"
          value={values.model}
          maxLength={60}
          onChange={(e) => set({ model: e.target.value })}
        />
      </div>
      <div className="form-field">
        <label htmlFor="dev-serial">Seri No (isteğe bağlı)</label>
        <input
          id="dev-serial"
          type="text"
          value={values.serial_no}
          maxLength={80}
          onChange={(e) => set({ serial_no: e.target.value })}
        />
      </div>
      <div className="form-field">
        <label htmlFor="dev-status">Durum</label>
        <select
          id="dev-status"
          value={values.is_active ? "active" : "passive"}
          onChange={(e) => set({ is_active: e.target.value === "active" })}
        >
          <option value="active">Aktif</option>
          <option value="passive">Pasif</option>
        </select>
      </div>
      <div className="form-field form-field-wide">
        <label htmlFor="dev-note">Açıklama (isteğe bağlı)</label>
        <textarea
          id="dev-note"
          value={values.note}
          maxLength={500}
          onChange={(e) => set({ note: e.target.value })}
        />
      </div>
    </div>
  );
}

export { type DeviceFormValues };

export function DevicesPage({
  onOpenDetail,
  initialCustomerId,
}: {
  onOpenDetail: (id: number) => void;
  initialCustomerId?: number;
}) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formValues, setFormValues] = useState<DeviceFormValues>({
    ...EMPTY_DEVICE,
    customer_id: initialCustomerId ?? null,
  });
  const { error, setError, clear } = useFormError();

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      listDevices({ q: query, type, status })
        .then(setDevices)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, type, status]);

  const submit = async () => {
    clear();
    try {
      const created = await createDevice({
        customer_id: formValues.customer_id,
        type: formValues.type,
        brand: formValues.brand,
        model: formValues.model,
        serial_no: formValues.serial_no || null,
        note: formValues.note || null,
      });
      setShowForm(false);
      setFormValues(EMPTY_DEVICE);
      onOpenDetail(created.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    }
  };

  return (
    <main className="page">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Cihazlar</h1>
            <p className="page-subtitle">
              Servise gelen cihazların kayıtları; numara, marka, model, seri no veya müşteri ile aranabilir.
            </p>
          </div>
        </div>

        <div className="module-toolbar">
          <input
            type="text"
            className="search-box"
            placeholder="Cihaz no, marka, model, seri no veya müşteri ara…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Tür filtresi">
            <option value="">Tüm türler</option>
            {Object.entries(DEVICE_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Durum filtresi">
            <option value="all">Tümü</option>
            <option value="active">Aktif</option>
            <option value="passive">Pasif</option>
          </select>
          <span className="toolbar-spacer" />
          <button
            className="btn btn-primary"
            onClick={() => {
              clear();
              setFormValues({ ...EMPTY_DEVICE, customer_id: initialCustomerId ?? null });
              setShowForm(true);
            }}
          >
            Yeni Cihaz
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        {showForm && (
          <section className="detail-section" aria-label="Yeni cihaz">
            <h2>Yeni Cihaz</h2>
            <DeviceFormFields values={formValues} onChange={setFormValues} />
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>İptal</button>
              <button className="btn btn-primary" onClick={submit}>Kaydet</button>
            </div>
          </section>
        )}

        {loading && devices.length === 0 ? (
          <p className="empty-note">Yükleniyor…</p>
        ) : devices.length === 0 ? (
          <p className="empty-note">Kayıt bulunamadı.</p>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">No</th>
                  <th scope="col">Tür</th>
                  <th scope="col">Marka / Model</th>
                  <th scope="col">Müşteri</th>
                  <th scope="col">Durum</th>
                  <th scope="col" className="col-actions">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((d) => (
                  <tr key={d.id}>
                    <td>{d.device_no}</td>
                    <td>{DEVICE_TYPE_LABELS[d.type]}</td>
                    <td>{d.brand} {d.model}</td>
                    <td>{d.customer_name ?? "—"}</td>
                    <td>
                      <span className={`chip ${d.is_active ? "chip-active" : "chip-passive"}`}>
                        {d.is_active ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td className="col-actions">
                      <button className="btn-link" onClick={() => onOpenDetail(d.id)}>Detay</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="record-cards">
              {devices.map((d) => (
                <div className="record-card" key={d.id}>
                  <div className="record-card-head">
                    <span className="record-card-title">{d.brand} {d.model}</span>
                    <span className={`chip ${d.is_active ? "chip-active" : "chip-passive"}`}>
                      {d.is_active ? "Aktif" : "Pasif"}
                    </span>
                  </div>
                  <div className="record-card-sub">
                    {d.device_no} · {DEVICE_TYPE_LABELS[d.type]}
                  </div>
                  <div className="record-card-meta">
                    <span>Müşteri: {d.customer_name ?? "—"}</span>
                  </div>
                  <div className="record-card-actions">
                    <button className="btn-link" onClick={() => onOpenDetail(d.id)}>Detay</button>
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
