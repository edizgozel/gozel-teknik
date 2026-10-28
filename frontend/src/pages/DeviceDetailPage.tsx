import { useEffect, useState } from "react";
import {
  DEVICE_TYPE_LABELS,
  getDevice,
  updateDevice,
  type Device,
} from "../api";
import { useFormError } from "../components/CustomerForm";
import { Icon } from "../icons/Icon";
import { DeviceFormFields, type DeviceFormValues } from "./DevicesPage";

interface Props {
  deviceId: number;
  onBack: () => void;
}

export function DeviceDetailPage({ deviceId, onBack }: Props) {
  const [device, setDevice] = useState<Device | null>(null);
  const [editing, setEditing] = useState(false);
  const [formValues, setFormValues] = useState<DeviceFormValues | null>(null);
  const { error, setError, clear } = useFormError();

  useEffect(() => {
    getDevice(deviceId)
      .then((d) => {
        setDevice(d);
        setFormValues({
          customer_id: d.customer_id,
          type: d.type,
          brand: d.brand,
          model: d.model,
          serial_no: d.serial_no ?? "",
          note: d.note ?? "",
          is_active: d.is_active,
        });
      })
      .catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  if (!device || !formValues) {
    return (
      <main className="page">
        <div className="page-inner">{error ? <div className="form-error">{error}</div> : <p className="empty-note">Yükleniyor…</p>}</div>
      </main>
    );
  }

  const save = async () => {
    clear();
    try {
      const updated = await updateDevice(device.id, {
        customer_id: formValues.customer_id,
        type: formValues.type,
        brand: formValues.brand,
        model: formValues.model,
        serial_no: formValues.serial_no || null,
        note: formValues.note || null,
        is_active: formValues.is_active,
      });
      setDevice(updated);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    }
  };

  return (
    <main className="page">
      <div className="page-inner">
        <a href="#" className="back-link" onClick={(e) => { e.preventDefault(); onBack(); }}>
          <Icon name="devices" size={15} /> Cihaz listesine dön
        </a>
        <div className="page-header">
          <div>
            <h1 className="page-title">
              {device.brand} {device.model}{" "}
              <span className={`chip ${device.is_active ? "chip-active" : "chip-passive"}`}>
                {device.is_active ? "Aktif" : "Pasif"}
              </span>
            </h1>
            <p className="page-subtitle">
              Cihaz no: {device.device_no} · {DEVICE_TYPE_LABELS[device.type]}
            </p>
          </div>
          <button className="btn btn-secondary" onClick={() => { clear(); setEditing(!editing); }}>
            {editing ? "Vazgeç" : "Düzenle"}
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        {editing ? (
          <section className="detail-section" aria-label="Cihazı düzenle">
            <h2>Cihazı Düzenle</h2>
            <DeviceFormFields values={formValues} onChange={setFormValues} />
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setEditing(false)}>İptal</button>
              <button className="btn btn-primary" onClick={save}>Kaydet</button>
            </div>
          </section>
        ) : (
          <section className="detail-section">
            <h2>Kayıt Bilgileri</h2>
            <dl className="detail-rows">
              <dt>Müşteri</dt>
              <dd>{device.customer_name ?? "—"}</dd>
              <dt>Seri No</dt>
              <dd>{device.serial_no ?? "—"}</dd>
              <dt>Açıklama</dt>
              <dd>{device.note ?? "—"}</dd>
              <dt>Kayıt tarihi</dt>
              <dd>{new Date(device.created_at).toLocaleDateString("tr-TR")}</dd>
            </dl>
          </section>
        )}
      </div>
    </main>
  );
}
