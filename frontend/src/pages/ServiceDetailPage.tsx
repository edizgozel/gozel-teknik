import { useEffect, useState } from "react";
import {
  addRepairAction,
  addServicePart,
  cancelServicePart,
  getService,
  listParts,
  SERVICE_STATUS_LABELS,
  SERVICE_STATUS_TONE,
  saveDiagnosis,
  updateServiceStatus,
  type Part,
  type ServiceRecord,
  type ServiceStatus,
} from "../api";
import { useFormError } from "../components/CustomerForm";
import { FinancePanel } from "../components/FinancePanel";
import { ServiceDocument } from "../components/ServiceDocument";
import { Icon } from "../icons/Icon";
import "../pages/PartsPage.css";

const NEXT_STATUSES: Record<ServiceStatus, ServiceStatus[]> = {
  intake: ["diagnosis", "cancelled"],
  diagnosis: ["awaiting_parts", "repairing", "ready", "cancelled"],
  awaiting_parts: ["repairing", "diagnosis", "cancelled"],
  repairing: ["awaiting_parts", "ready", "cancelled"],
  ready: ["delivered", "repairing", "cancelled"],
  delivered: ["closed"],
  closed: [],
  cancelled: [],
};

const EDITABLE_STATUSES: ServiceStatus[] = [
  "intake",
  "diagnosis",
  "awaiting_parts",
  "repairing",
  "ready",
];

const EMPTY_DIAGNOSIS_FORM = {
  diagnosis: "",
  found_issue: "",
  proposed_solution: "",
  customer_message: "",
  internal_note: "",
};

interface Props {
  serviceId: number;
  onBack: () => void;
}

export function ServiceDetailPage({ serviceId, onBack }: Props) {
  const [service, setService] = useState<ServiceRecord | null>(null);
  const [statusNote, setStatusNote] = useState("");
  const [pendingStatus, setPendingStatus] = useState<ServiceStatus | null>(null);
  const [diagEditing, setDiagEditing] = useState(false);
  const [diagForm, setDiagForm] = useState(EMPTY_DIAGNOSIS_FORM);
  const [diagSaving, setDiagSaving] = useState(false);
  const [repairAction, setRepairAction] = useState("");
  const [repairNote, setRepairNote] = useState("");
  const [repairSaving, setRepairSaving] = useState(false);
  const [parts, setParts] = useState<Part[]>([]);
  const [usagePartId, setUsagePartId] = useState("");
  const [usageQty, setUsageQty] = useState("1");
  const [usageSaving, setUsageSaving] = useState(false);
  const [documentKind, setDocumentKind] = useState<"intake" | "delivery" | null>(null);
  const { error, setError, clear } = useFormError();

  useEffect(() => {
    getService(serviceId)
      .then((s) => {
        setService(s);
        setDiagForm(s.diagnosis ? {
          diagnosis: s.diagnosis.diagnosis ?? "",
          found_issue: s.diagnosis.found_issue ?? "",
          proposed_solution: s.diagnosis.proposed_solution ?? "",
          customer_message: s.diagnosis.customer_message ?? "",
          internal_note: s.diagnosis.internal_note ?? "",
        } : EMPTY_DIAGNOSIS_FORM);
      })
      .catch((e) => setError(e.message));
    listParts({ status: "active" })
      .then(setParts)
      .catch(() => setParts([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  if (!service) {
    return (
      <main className="page">
        <div className="page-inner">
          {error ? <div className="form-error">{error}</div> : <p className="empty-note">Yükleniyor…</p>}
        </div>
      </main>
    );
  }

  const editable = EDITABLE_STATUSES.includes(service.status);

  const changeStatus = async (newStatus: ServiceStatus) => {
    clear();
    setPendingStatus(newStatus);
    try {
      const updated = await updateServiceStatus(service.id, newStatus, statusNote);
      setService(updated);
      setStatusNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setPendingStatus(null);
    }
  };

  const addPartUsage = async () => {
    if (usageSaving) return;
    clear();
    if (!usagePartId) {
      setError("Parça seçin");
      return;
    }
    setUsageSaving(true);
    try {
      const updated = await addServicePart(service.id, Number(usagePartId), Number(usageQty));
      setService(updated);
      setUsagePartId("");
      setUsageQty("1");
      listParts({ status: "active" }).then(setParts).catch(() => undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setUsageSaving(false);
    }
  };

  const revertUsage = async (usageId: number) => {
    clear();
    try {
      const updated = await cancelServicePart(service.id, usageId);
      setService(updated);
      listParts({ status: "active" }).then(setParts).catch(() => undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    }
  };

  const fmt = (value: string) => new Date(value).toLocaleString("tr-TR");

  const saveDiagnosisForm = async () => {
    if (diagSaving) return;
    clear();
    setDiagSaving(true);
    try {
      await saveDiagnosis(service.id, diagForm);
      const refreshed = await getService(service.id);
      setService(refreshed);
      setDiagEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setDiagSaving(false);
    }
  };

  const addRepair = async () => {
    if (repairSaving) return;
    clear();
    if (!repairAction.trim()) {
      setError("İşlem açıklaması zorunludur");
      return;
    }
    setRepairSaving(true);
    try {
      const updated = await addRepairAction(service.id, repairAction, repairNote);
      setService(updated);
      setRepairAction("");
      setRepairNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setRepairSaving(false);
    }
  };

  return (
    <main className="page">
      <div className="page-inner">
        <a href="#" className="back-link" onClick={(e) => { e.preventDefault(); onBack(); }}>
          <Icon name="wrench" size={15} /> Servis listesine dön
        </a>
        <div className="page-header">
          <div>
            <h1 className="page-title">{service.service_no}</h1>
            <p className="page-subtitle">
              {service.customer_name} · {service.device_label} ·{" "}
              {SERVICE_STATUS_LABELS[service.status]}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setDocumentKind("intake")}>
              Kabul Belgesi
            </button>
            <button className="btn btn-secondary" onClick={() => setDocumentKind("delivery")}>
              Teslim Belgesi
            </button>
          </div>
        </div>

        {error && <div className="form-error">{error}</div>}

        <section className="detail-section">
          <h2>Servis Bilgileri</h2>
          <dl className="detail-rows">
            <dt>Durum</dt>
            <dd>
              <span className={`status-chip tone-${SERVICE_STATUS_TONE[service.status]}`}>
                {SERVICE_STATUS_LABELS[service.status]}
              </span>
            </dd>
            <dt>Müşteri</dt>
            <dd>{service.customer_name} ({service.customer_phone})</dd>
            <dt>Cihaz</dt>
            <dd>{service.device_label}</dd>
            <dt>Bildirilen Arıza</dt>
            <dd>{service.reported_issue}</dd>
            <dt>Fiziksel Durum</dt>
            <dd>{service.physical_condition ?? "—"}</dd>
            <dt>Aksesuarlar</dt>
            <dd>{service.accessories ?? "—"}</dd>
            <dt>Servis Notu</dt>
            <dd>{service.note ?? "—"}</dd>
            <dt>Kabul Tarihi</dt>
            <dd>{fmt(service.created_at)}</dd>
            <dt>Tahmini Teslim</dt>
            <dd>
              {service.estimated_delivery
                ? new Date(service.estimated_delivery).toLocaleDateString("tr-TR")
                : "—"}
            </dd>
            <dt>Son Güncelleme</dt>
            <dd>{fmt(service.updated_at)}</dd>
          </dl>
        </section>

        <section className="detail-section">
          <h2>Durum Değiştir</h2>
          {NEXT_STATUSES[service.status].length === 0 ? (
            <p className="empty-note" style={{ padding: 0 }}>
              Bu durumda başka işlem yapılamaz.
            </p>
          ) : (
            <>
              <div className="form-field" style={{ maxWidth: 480 }}>
                <label htmlFor="status-note">Açıklama (isteğe bağlı)</label>
                <input
                  id="status-note"
                  type="text"
                  value={statusNote}
                  maxLength={500}
                  onChange={(e) => setStatusNote(e.target.value)}
                />
              </div>
              <div className="status-actions">
                {NEXT_STATUSES[service.status].map((next) => (
                  <button
                    key={next}
                    className={`btn ${next === "cancelled" ? "btn-outline-danger" : "btn-primary"}`}
                    disabled={pendingStatus !== null}
                    onClick={() => changeStatus(next)}
                  >
                    {pendingStatus === next ? "Uygulanıyor…" : SERVICE_STATUS_LABELS[next]}
                  </button>
                ))}
              </div>
            </>
          )}
        </section>

        <section className="detail-section">
          <div className="section-head">
            <h2>Teknik Teşhis</h2>
            {editable && (
              <button
                className="btn btn-secondary"
                onClick={() => { clear(); setDiagEditing(!diagEditing); }}
              >
                {diagEditing ? "Vazgeç" : service.diagnosis ? "Düzenle" : "Teşhis Ekle"}
              </button>
            )}
          </div>
          {diagEditing ? (
            <>
              <div className="form-grid">
                <div className="form-field form-field-wide">
                  <label htmlFor="dg-diag">Teknik Teşhis Açıklaması</label>
                  <textarea
                    id="dg-diag"
                    value={diagForm.diagnosis}
                    maxLength={1000}
                    onChange={(e) => setDiagForm({ ...diagForm, diagnosis: e.target.value })}
                  />
                </div>
                <div className="form-field form-field-wide">
                  <label htmlFor="dg-issue">Tespit Edilen Arıza</label>
                  <textarea
                    id="dg-issue"
                    value={diagForm.found_issue}
                    maxLength={1000}
                    onChange={(e) => setDiagForm({ ...diagForm, found_issue: e.target.value })}
                  />
                </div>
                <div className="form-field form-field-wide">
                  <label htmlFor="dg-solution">Önerilen Çözüm</label>
                  <textarea
                    id="dg-solution"
                    value={diagForm.proposed_solution}
                    maxLength={1000}
                    onChange={(e) => setDiagForm({ ...diagForm, proposed_solution: e.target.value })}
                  />
                </div>
                <div className="form-field form-field-wide">
                  <label htmlFor="dg-msg">Müşteriye İletilecek Açıklama</label>
                  <textarea
                    id="dg-msg"
                    value={diagForm.customer_message}
                    maxLength={1000}
                    onChange={(e) => setDiagForm({ ...diagForm, customer_message: e.target.value })}
                  />
                </div>
                <div className="form-field form-field-wide">
                  <label htmlFor="dg-note">Dahili Not (isteğe bağlı)</label>
                  <input
                    id="dg-note"
                    type="text"
                    value={diagForm.internal_note}
                    maxLength={500}
                    onChange={(e) => setDiagForm({ ...diagForm, internal_note: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-actions" style={{ marginTop: 16 }}>
                <button className="btn btn-secondary" onClick={() => setDiagEditing(false)}>
                  Vazgeç
                </button>
                <button className="btn btn-primary" onClick={saveDiagnosisForm} disabled={diagSaving}>
                  {diagSaving ? "Kaydediliyor…" : "Kaydet"}
                </button>
              </div>
            </>
          ) : service.diagnosis ? (
            <dl className="detail-rows">
              <dt>Teşhis</dt>
              <dd>{service.diagnosis.diagnosis ?? "—"}</dd>
              <dt>Tespit Edilen Arıza</dt>
              <dd>{service.diagnosis.found_issue ?? "—"}</dd>
              <dt>Önerilen Çözüm</dt>
              <dd>{service.diagnosis.proposed_solution ?? "—"}</dd>
              <dt>Müşteri Açıklaması</dt>
              <dd>{service.diagnosis.customer_message ?? "—"}</dd>
              <dt>Dahili Not</dt>
              <dd>{service.diagnosis.internal_note ?? "—"}</dd>
              <dt>Teşhis Tarihi</dt>
              <dd>{fmt(service.diagnosis.diagnosed_at)}</dd>
            </dl>
          ) : (
            <p className="empty-note" style={{ padding: 0 }}>
              Henüz teşhis kaydı girilmemiş.
            </p>
          )}
        </section>

        <section className="detail-section">
          <div className="section-head">
            <h2>Onarım İşlemleri ({service.repairs?.length ?? 0})</h2>
          </div>
          {editable ? (
            <div className="repair-form">
              <div className="form-field">
                <label htmlFor="rp-action">Yeni İşlem Açıklaması *</label>
                <input
                  id="rp-action"
                  type="text"
                  value={repairAction}
                  maxLength={1000}
                  onChange={(e) => setRepairAction(e.target.value)}
                />
              </div>
              <div className="form-field">
                <label htmlFor="rp-note">Ek Not (isteğe bağlı)</label>
                <input
                  id="rp-note"
                  type="text"
                  value={repairNote}
                  maxLength={500}
                  onChange={(e) => setRepairNote(e.target.value)}
                />
              </div>
              <button
                className="btn btn-primary"
                onClick={addRepair}
                disabled={repairSaving || !repairAction.trim()}
              >
                {repairSaving ? "Ekleniyor…" : "İşlem Ekle"}
              </button>
            </div>
          ) : (
            <p className="empty-note" style={{ padding: 0 }}>
              Servis {SERVICE_STATUS_LABELS[service.status].toLowerCase()} durumunda;
              yeni işlem eklenemez.
            </p>
          )}
          {(service.repairs?.length ?? 0) > 0 ? (
            <ol className="history-list" style={{ marginTop: 12 }}>
              {[...(service.repairs ?? [])].reverse().map((r) => (
                <li key={r.id} className="history-item">
                  <span className="history-line">
                    <span className="repair-action">{r.action}</span>
                    <span className="history-time">{fmt(r.performed_at)}</span>
                  </span>
                  {r.note && <span className="history-note">{r.note}</span>}
                </li>
              ))}
            </ol>
          ) : (
            editable && (
              <p className="empty-note" style={{ padding: 0 }}>
                Henüz onarım işlemi kaydı yok.
              </p>
            )
          )}
        </section>

        <section className="detail-section">
          <h2>Kullanılan Parçalar</h2>          {editable ? (
            <div className="stock-adjust-row">
              <div className="form-field">
                <label htmlFor="up-part">Parça</label>
                <select id="up-part" value={usagePartId} onChange={(e) => setUsagePartId(e.target.value)}>
                  <option value="">Parça seçin…</option>
                  {parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.part_code} · {p.name} (stok: {p.quantity} {p.unit})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="up-qty">Miktar</label>
                <input id="up-qty" type="number" min={1} value={usageQty}
                  onChange={(e) => setUsageQty(e.target.value)} />
              </div>
              <button
                className="btn btn-primary"
                onClick={addPartUsage}
                disabled={usageSaving || !usagePartId || Number(usageQty) < 1}
              >
                {usageSaving ? "Ekleniyor…" : "Parça Kullan"}
              </button>
            </div>
          ) : (
            <p className="empty-note" style={{ padding: 0 }}>
              Servis {SERVICE_STATUS_LABELS[service.status].toLowerCase()} durumunda; parça kullanımı eklenemez.
            </p>
          )}
          {(service.parts?.length ?? 0) > 0 ? (
            <table className="data-table" style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th scope="col">Parça</th>
                  <th scope="col">Miktar</th>
                  <th scope="col">Tarih</th>
                  <th scope="col" className="col-actions">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {service.parts!.map((u) => (
                  <tr key={u.id} style={u.reversed ? { opacity: 0.55 } : undefined}>
                    <td>
                      {u.part_name}
                      <span className="part-sub"> ({u.part_code})</span>
                    </td>
                    <td>{u.quantity} {u.unit}</td>
                    <td>{fmt(u.created_at)}</td>
                    <td className="col-actions">
                      {u.reversed ? (
                        <span className="status-chip tone-done">İptal edildi</span>
                      ) : (
                        editable && (
                          <button
                            className="btn-link"
                            style={{ color: "var(--danger-700)" }}
                            title="Stoku geri ekler ve bu kullanımı iptal eder"
                            onClick={() => revertUsage(u.id)}
                          >
                            Kullanımı İptal Et
                          </button>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            editable && (
              <p className="empty-note" style={{ padding: 0 }}>
                Bu serviste henüz parça kullanılmadı.
              </p>
            )
          )}
        </section>

        <FinancePanel serviceId={service.id} editable={editable} />

        <section className="detail-section">
          <h2>Servis Geçmişi</h2>
          <ol className="history-list">
            {[...service.history ?? []].reverse().map((h) => (
              <li key={h.id} className="history-item">
                <span className="history-line">
                  {h.previous_status ? (
                    <>
                      <span className="chip chip-passive">
                        {SERVICE_STATUS_LABELS[h.previous_status as ServiceStatus]}
                      </span>
                      <span className="history-arrow">→</span>
                    </>
                  ) : null}
                  <span className={`status-chip tone-${SERVICE_STATUS_TONE[h.new_status]}`}>
                    {SERVICE_STATUS_LABELS[h.new_status]}
                  </span>
                  <span className="history-time">{fmt(h.changed_at)}</span>
                </span>
                {h.note && <span className="history-note">{h.note}</span>}
              </li>
            ))}
          </ol>
        </section>
      </div>
      {documentKind && (
        <ServiceDocument
          service={service}
          kind={documentKind}
          onClose={() => setDocumentKind(null)}
        />
      )}
    </main>
  );
}
