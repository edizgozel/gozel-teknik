import { useEffect, useState } from "react";
import { listAudit, request, type AuditEntry } from "../api";
import "../pages/ReportsPage.css";
import "./SettingsPage.css";

type Tab = "business" | "backup" | "audit";

const EMPTY_BUSINESS = {
  business_name: "",
  business_phone: "",
  business_email: "",
  business_address: "",
  business_website: "",
  document_footer: "",
  currency: "TRY",
};

const FIELD_LABELS: Record<string, string> = {
  business_name: "İşletme Adı",
  business_phone: "Telefon",
  business_email: "E-posta",
  business_address: "Adres",
  business_website: "İnternet Sitesi",
  document_footer: "Belge Alt Bilgisi",
  currency: "Para Birimi",
};

export function SettingsPage() {
  const [tab, setTab] = useState<Tab>("business");
  const [business, setBusiness] = useState<Record<string, string>>(EMPTY_BUSINESS);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [backups, setBackups] = useState<Array<{ filename: string; size: number; created_at: string }>>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [confirmFile, setConfirmFile] = useState<File | null>(null);

  const loadBackups = () =>
    request<Array<{ filename: string; size: number; created_at: string }>>("/api/settings/backups")
      .then(setBackups)
      .catch(() => undefined);

  useEffect(() => {
    request<Record<string, string>>("/api/settings").then(setBusiness).catch(() => undefined);
    loadBackups();
  }, []);

  const set = (key: string, value: string) => setBusiness({ ...business, [key]: value });

  const saveBusiness = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const payload: Record<string, string> = {};
      for (const key of Object.keys(EMPTY_BUSINESS)) payload[key] = business[key] ?? "";
      const updated = await request<Record<string, string>>("/api/settings", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setBusiness(updated);
      setSaved(true);
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Kaydedilemedi" });
    } finally {
      setSaving(false);
    }
  };

  const createBackup = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await request<{ filename: string }>("/api/settings/backup", { method: "POST" });
      setMessage({ kind: "ok", text: `Yedek oluşturuldu: ${result.filename}` });
      loadBackups();
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Yedekleme başarısız" });
    } finally {
      setBusy(false);
    }
  };

  const restore = async () => {
    if (!confirmFile || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const form = new FormData();
      form.append("file", confirmFile);
      const resp = await fetch("/api/settings/restore", { method: "POST", body: form });
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({ detail: "Geri yükleme başarısız" }));
        throw new Error(typeof body.detail === "string" ? body.detail : "Geri yükleme başarısız");
      }
      const result = await resp.json();
      setMessage({ kind: "ok", text: `${result.message} Güvenlik yedeği: ${result.safety_backup}` });
      setConfirmFile(null);
      loadBackups();
    } catch (e) {
      setMessage({ kind: "err", text: e instanceof Error ? e.message : "Geri yükleme başarısız" });
    } finally {
      setBusy(false);
    }
  };

  const fmtSize = (bytes: number) => `${(bytes / 1024).toFixed(0)} KB`;

  return (
    <main className="page">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Ayarlar</h1>
            <p className="page-subtitle">İşletme bilgileri, veritabanı yedekleme ve geri yükleme.</p>
          </div>
        </div>

        <div className="module-toolbar">
          <div className="report-tabs" role="tablist">
            {(["business", "backup", "audit"] as Tab[]).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                className={`report-tab${tab === t ? " report-tab-active" : ""}`}
                onClick={() => setTab(t)}
              >
                {t === "business" ? "İşletme Bilgileri" : t === "backup" ? "Yedekleme" : "İşlem Geçmişi"}
              </button>
            ))}
          </div>
        </div>

        {message && (
          <div className={`form-error ${message.kind === "ok" ? "msg-ok" : ""}`} style={message.kind === "ok" ? { color: "var(--success-700)", background: "var(--success-100)", borderColor: "var(--success-700)" } : undefined}>
            {message.text}
          </div>
        )}

        {tab === "business" && (
          <section className="detail-section">
            <h2>İşletme Bilgileri</h2>
            <p className="section-note">Bu bilgiler servis kabul/teslim belgelerinde ve PDF çıktılarında kullanılır. Boş bırakılan alanlar belgelerde gösterilmez.</p>
            <div className="form-grid">
              {(["business_name", "business_phone", "business_email", "business_website"] as const).map((key) => (
                <div className="form-field" key={key}>
                  <label htmlFor={key}>{FIELD_LABELS[key]}</label>
                  <input id={key} type={key === "business_email" ? "email" : "text"} value={business[key] ?? ""}
                    onChange={(e) => set(key, e.target.value)} maxLength={120} />
                </div>
              ))}
              <div className="form-field">
                <label htmlFor="currency">Para Birimi</label>
                <input id="currency" type="text" value="TRY" disabled />
              </div>
              <div className="form-field form-field-wide">
                <label htmlFor="business_address">Adres</label>
                <input id="business_address" type="text" value={business.business_address ?? ""} maxLength={300}
                  onChange={(e) => set("business_address", e.target.value)} />
              </div>
              <div className="form-field form-field-wide">
                <label htmlFor="document_footer">Belge Alt Bilgisi (isteğe bağlı)</label>
                <input id="document_footer" type="text" value={business.document_footer ?? ""} maxLength={300}
                  onChange={(e) => set("document_footer", e.target.value)} />
              </div>
            </div>
            <div className="form-actions" style={{ marginTop: 16 }}>
              {saved && <span style={{ color: "var(--success-700)", alignSelf: "center" }}>Kaydedildi.</span>}
              <button className="btn btn-primary" onClick={saveBusiness} disabled={saving}>
                {saving ? "Kaydediliyor…" : "Kaydet"}
              </button>
            </div>
          </section>
        )}

        {tab === "backup" && (
          <>
            <section className="detail-section">
              <h2>Yedek Oluştur</h2>
              <p className="section-note">
                Veritabanının tutarlı bir kopyası alınır ve indirilebilir hâle gelir. Yedek dosyaları
                <code> backend/data/backups </code> klasöründe saklanır.
              </p>
              <button className="btn btn-primary" onClick={createBackup} disabled={busy}>
                {busy ? "Çalışıyor…" : "Yeni Yedek Oluştur"}
              </button>
            </section>

            <section className="detail-section">
              <h2>Yedekler</h2>
              {backups.length === 0 ? (
                <p className="empty-note" style={{ padding: 0 }}>Henüz yedek alınmamış.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Dosya</th>
                      <th scope="col">Boyut</th>
                      <th scope="col">Oluşturulma</th>
                      <th scope="col" className="col-actions">İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {backups.map((b) => (
                      <tr key={b.filename}>
                        <td>{b.filename}</td>
                        <td>{fmtSize(b.size)}</td>
                        <td>{b.created_at}</td>
                        <td className="col-actions">
                          <a className="btn-link" href={`/api/settings/backups/${b.filename}/download`} download>
                            İndir
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>

            <section className="detail-section restore-section">
              <h2>Geri Yükle</h2>
              <div className="restore-warning">
                <strong>Dikkat:</strong> Geri yükleme, mevcut veritabanındaki tüm kayıtları seçtiğiniz yedekteki
                hâliyle değiştirir. Servis, stok, ücret ve tahsilat geçmişiniz etkilenebilir. İşlem öncesinde
                otomatik bir güvenlik yedeği alınır.
              </div>
              <div className="stock-adjust-row">
                <div className="form-field">
                  <label htmlFor="restore-file">Yedek dosyası (.db)</label>
                  <input id="restore-file" type="file" accept=".db"
                    onChange={(e) => setConfirmFile(e.target.files?.[0] ?? null)} />
                </div>
                <button
                  className="btn btn-danger"
                  onClick={restore}
                  disabled={!confirmFile || busy}
                  title="Mevcut verilerin üzerine yedek içeriği yazılır"
                >
                  {busy ? "Çalışıyor…" : "Veritabanını Geri Yükle"}
                </button>
              </div>
              {confirmFile && (
                <p className="section-note">
                  Seçildi: <strong>{confirmFile.name}</strong> — işlemi onaylamak için "Geri Yükle"ye basın.
                </p>
              )}
            </section>
          </>
        )}

        {tab === "audit" && <AuditSection />}
      </div>
    </main>
  );
}


function AuditSection() {
  const [rows, setRows] = useState<AuditEntry[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [action, setAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      listAudit({ q: query, action, date_from: dateFrom, date_to: dateTo })
        .then((d) => {
          setRows(d.rows);
          setActions(d.actions);
        })
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [query, action, dateFrom, dateTo]);

  return (
    <section className="detail-section">
      <h2>İşlem Geçmişi</h2>
      <div className="module-toolbar">
        <input
          type="text"
          className="search-box"
          placeholder="Açıklama veya işlem türü ara…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select value={action} onChange={(e) => setAction(e.target.value)} aria-label="İşlem türü filtresi">
          <option value="">Tüm işlem türleri</option>
          {actions.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Başlangıç tarihi" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Bitiş tarihi" />
      </div>
      {loading && rows.length === 0 ? (
        <p className="empty-note">Yükleniyor…</p>
      ) : rows.length === 0 ? (
        <p className="empty-note">Kayıt bulunamadı.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Tarih</th>
              <th scope="col">İşlem</th>
              <th scope="col">Kayıt</th>
              <th scope="col">Açıklama</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l) => (
              <tr key={l.id}>
                <td>{l.created_at}</td>
                <td><span className="movement-type-label">{l.action}</span></td>
                <td>{l.entity_type}{l.entity_id !== null ? ` #${l.entity_id}` : ""}</td>
                <td>{l.description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
