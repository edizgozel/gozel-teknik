import { useEffect, useState } from "react";
import {
  getCustomer,
  listDevices,
  updateCustomer,
  type Customer,
  type Device,
} from "../api";
import { CustomerFormFields, toCustomerForm, useFormError, type CustomerFormValues } from "../components/CustomerForm";
import { DEVICE_TYPE_LABELS } from "../api";
import { Icon } from "../icons/Icon";
import "./CustomerDetailPage.css";

interface Props {
  customerId: number;
  onBack: () => void;
  onOpenDevice: (id: number) => void;
}

export function CustomerDetailPage({ customerId, onBack, onOpenDevice }: Props) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [editing, setEditing] = useState(false);
  const [formValues, setFormValues] = useState<CustomerFormValues | null>(null);
  const { error, setError, clear } = useFormError();

  useEffect(() => {
    getCustomer(customerId)
      .then((c) => {
        setCustomer(c);
        setFormValues(toCustomerForm(c));
      })
      .catch((e) => setError(e.message));
    listDevices({ customer_id: customerId })
      .then(setDevices)
      .catch(() => setDevices([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  if (!customer || !formValues) {
    return (
      <main className="page">
        <div className="page-inner">{error ? <div className="form-error">{error}</div> : <p className="empty-note">Yükleniyor…</p>}</div>
      </main>
    );
  }

  const save = async () => {
    clear();
    try {
      const updated = await updateCustomer(customer.id, {
        name: formValues.name,
        phone: formValues.phone,
        email: formValues.email || null,
        address: formValues.address || null,
        note: formValues.note || null,
        is_active: formValues.is_active,
      });
      setCustomer(updated);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    }
  };

  return (
    <main className="page">
      <div className="page-inner">
        <a href="#" className="back-link" onClick={(e) => { e.preventDefault(); onBack(); }}>
          <Icon name="home" size={15} /> Müşteri listesine dön
        </a>
        <div className="page-header">
          <div>
            <h1 className="page-title">
              {customer.name}{" "}
              <span className={`chip ${customer.is_active ? "chip-active" : "chip-passive"}`}>
                {customer.is_active ? "Aktif" : "Pasif"}
              </span>
            </h1>
            <p className="page-subtitle">Müşteri no: {customer.customer_no}</p>
          </div>
          <button className="btn btn-secondary" onClick={() => { clear(); setEditing(!editing); }}>
            {editing ? "Vazgeç" : "Düzenle"}
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        {editing ? (
          <section className="detail-section" aria-label="Müşteriyi düzenle">
            <h2>Müşteriyi Düzenle</h2>
            <CustomerFormFields values={formValues} onChange={setFormValues} />
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setEditing(false)}>İptal</button>
              <button className="btn btn-primary" onClick={save}>Kaydet</button>
            </div>
          </section>
        ) : (
          <section className="detail-section">
            <h2>Kayıt Bilgileri</h2>
            <dl className="detail-rows">
              <dt>Telefon</dt>
              <dd>{customer.phone}</dd>
              <dt>E-posta</dt>
              <dd>{customer.email ?? "—"}</dd>
              <dt>Adres</dt>
              <dd>{customer.address ?? "—"}</dd>
              <dt>Not</dt>
              <dd>{customer.note ?? "—"}</dd>
              <dt>Kayıt tarihi</dt>
              <dd>{new Date(customer.created_at).toLocaleDateString("tr-TR")}</dd>
            </dl>
          </section>
        )}

        <section className="detail-section">
          <h2>Cihazlar ({devices.length})</h2>
          {devices.length === 0 ? (
            <p className="empty-note" style={{ padding: 0 }}>
              Bu müşteriye kayıtlı cihaz yok. Cihazlar sayfasından ekleyebilirsiniz.
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">No</th>
                  <th scope="col">Tür</th>
                  <th scope="col">Marka / Model</th>
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
                    <td>
                      <span className={`chip ${d.is_active ? "chip-active" : "chip-passive"}`}>
                        {d.is_active ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td className="col-actions">
                      <button className="btn-link" onClick={() => onOpenDevice(d.id)}>Detay</button>
                    </td>
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
