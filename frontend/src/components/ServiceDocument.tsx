import { useEffect, useState } from "react";
import {
  getFinance,
  request,
  tl,
  DEVICE_TYPE_LABELS,
  type Finance,
  type ServiceRecord,
} from "../api";
import "./ServiceDocument.css";

interface Props {
  service: ServiceRecord;
  kind: "intake" | "delivery";
  onClose: () => void;
}

export function ServiceDocument({ service, kind, onClose }: Props) {
  const [finance, setFinance] = useState<Finance | null>(null);
  const [business, setBusiness] = useState<Record<string, string>>({});

  useEffect(() => {
    if (kind === "delivery") {
      getFinance(service.id).then(setFinance).catch(() => setFinance(null));
    }
    request<Record<string, string>>("/api/settings")
      .then(setBusiness)
      .catch(() => undefined);
  }, [service.id, kind]);

  const businessInfo = [
    business.business_phone,
    business.business_email,
    business.business_address,
    business.business_website,
  ]
    .filter(Boolean)
    .join(" | ");

  const delivery = kind === "delivery";
  const fmt = (v: string) => new Date(v).toLocaleDateString("tr-TR");
  const row = (label: string, value: string | null | undefined) => (
    <tr>
      <th scope="row">{label}</th>
      <td>{value && value !== "" ? value : "—"}</td>
    </tr>
  );

  return (
    <div className="doc-overlay" role="dialog" aria-modal="true">
      <div className="doc-actions no-print">
        <button className="btn btn-secondary" onClick={() => window.print()}>
          Yazdır
        </button>
        <a
          className="btn btn-primary"
          href={`/api/services/${service.id}/documents/${kind === "delivery" ? "teslim" : "kabul"}.pdf`}
          download
        >
          PDF İndir
        </a>
        <button className="btn btn-secondary" onClick={onClose}>
          Kapat
        </button>
        {!delivery && service.status !== "delivered" && service.status !== "closed" && (
          <span className="doc-note">
            Not: Bu servis henüz teslim edilmedi; belge kabul bilgilerini gösterir.
          </span>
        )}
        {delivery && service.status !== "delivered" && service.status !== "closed" && (
          <span className="doc-note">
            Not: Servis henüz teslim edilmedi; bu belge taslaktır ve teslim kaydı oluşturmaz.
          </span>
        )}
      </div>

      <div className="print-document doc-paper">
        <header className="doc-header">
          <img src="/logo.png" alt="GOZEL TEKNİK logosu" className="doc-logo" />
          <div>
            <h1 className="doc-title">
              {business.business_name || "GOZEL TEKNİK"}
            </h1>
            <p className="doc-subtitle">Teknik Servis Yönetimi</p>
            {businessInfo && <p className="doc-bizinfo">{businessInfo}</p>}
          </div>
          <div className="doc-kind">{delivery ? "SERVİS TESLİM BELGESİ" : "SERVİS KABUL BELGESİ"}</div>
        </header>

        <table className="doc-table">
          <tbody>
            {row("Servis Numarası", service.service_no)}
            {row("Kabul Tarihi", fmt(service.created_at))}
            {delivery && row("Teslim Tarihi", service.status === "delivered" || service.status === "closed" ? fmt(service.updated_at) : "— (teslim edilmedi)")}
            {row("Müşteri", `${service.customer_name} — ${service.customer_phone}`)}
            {row("Cihaz", `${DEVICE_TYPE_LABELS[service.device_type]} · ${service.device_label}`)}
            {row("Seri Numarası", service.device_serial)}
          </tbody>
        </table>

        {!delivery && (
          <table className="doc-table">
            <tbody>
              {row("Bildirilen Arıza / Şikâyet", service.reported_issue)}
              {row("Fiziksel Durum (kabulde)", service.physical_condition)}
              {row("Teslim Alınan Aksesuarlar", service.accessories)}
              {row("Kabul Notu", service.note)}
            </tbody>
          </table>
        )}

        {delivery && (
          <>
            <h2 className="doc-heading">Teşhis ve Onarım</h2>
            <table className="doc-table">
              <tbody>
                {row("Bildirilen Arıza", service.reported_issue)}
                {row("Teşhis", service.diagnosis?.diagnosis)}
                {row("Tespit Edilen Arıza", service.diagnosis?.found_issue)}
                {row("Yapılan İşlemler", service.repairs?.length ? service.repairs.map((r) => r.action).join(" | ") : null)}
              </tbody>
            </table>

            <h2 className="doc-heading">Kullanılan Parçalar</h2>
            {service.parts && service.parts.length > 0 ? (
              <table className="doc-table doc-lines">
                <thead>
                  <tr>
                    <th scope="col">Parça</th>
                    <th scope="col">Kod</th>
                    <th scope="col">Miktar</th>
                  </tr>
                </thead>
                <tbody>
                  {service.parts.map((u) => (
                    <tr key={u.id}>
                      <td>{u.part_name}</td>
                      <td>{u.part_code}</td>
                      <td>{u.quantity} {u.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="doc-muted">Kayıtlı parça kullanımı yok.</p>
            )}

            {finance && (
              <>
                <h2 className="doc-heading">Ücretlendirme</h2>
                <table className="doc-table doc-lines">
                  <tbody>
                    <tr><th scope="row">İşçilik</th><td className="money">{tl(finance.labor_total)}</td></tr>
                    <tr><th scope="row">Parçalar</th><td className="money">{tl(finance.parts_total)}</td></tr>
                    <tr><th scope="row">Ek Hizmetler</th><td className="money">{tl(finance.extra_total)}</td></tr>
                    <tr><th scope="row">İndirim</th><td className="money">−{tl(finance.discount_total)}</td></tr>
                    <tr className="doc-total"><th scope="row">Genel Toplam</th><td className="money">{tl(finance.grand_total)}</td></tr>
                    <tr><th scope="row">Tahsil Edilen</th><td className="money">{tl(finance.paid_total)}</td></tr>
                    <tr><th scope="row">Kalan Borç</th><td className="money">{tl(finance.balance)}</td></tr>
                  </tbody>
                </table>
              </>
            )}
          </>
        )}

        <div className="doc-signatures">
          <div className="sig-box">
            <div className="sig-line" />
            <span>Müşteri</span>
          </div>
          <div className="sig-box">
            <div className="sig-line" />
            <span>Servis Yetkilisi</span>
          </div>
        </div>
      </div>
    </div>
  );
}
