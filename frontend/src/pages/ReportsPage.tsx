import { useEffect, useState } from "react";
import {
  exportReportCsv,
  fetchReport,
  tl,
  type PaymentsReport,
  type ServicesReport,
  type StockReport,
} from "../api";
import { useFormError } from "../components/CustomerForm";
import "./ReportsPage.css";

type Tab = "services" | "stock" | "payments";

const TAB_LABELS: Record<Tab, string> = {
  services: "Servis Raporu",
  stock: "Stok Raporu",
  payments: "Tahsilat Raporu",
};

export function ReportsPage() {
  const [tab, setTab] = useState<Tab>("services");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState("");
  const [services, setServices] = useState<ServicesReport | null>(null);
  const [stock, setStock] = useState<StockReport | null>(null);
  const [payments, setPayments] = useState<PaymentsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const { error } = useFormError();

  const params: Record<string, string> = { date_from: dateFrom, date_to: dateTo, status };

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(() => {
      setLoading(true);
      Promise.all([
        fetchReport<ServicesReport>("services", params).catch(() => null),
        fetchReport<StockReport>("stock", { date_from: dateFrom, date_to: dateTo }).catch(() => null),
        fetchReport<PaymentsReport>("payments", { date_from: dateFrom, date_to: dateTo }).catch(() => null),
      ]).then(([s, st, p]) => {
        if (cancelled) return;
        if (s) setServices(s);
        if (st) setStock(st);
        if (p) setPayments(p);
        setLoading(false);
      });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo, status]);

  return (
    <main className="page">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Raporlar</h1>
            <p className="page-subtitle">
              Gerçek kayıtlar üzerinden servis, stok ve tahsilat özetleri; CSV olarak dışa aktarılabilir.
            </p>
          </div>
        </div>

        <div className="module-toolbar">
          <div className="report-tabs no-print" role="tablist">
            {(Object.keys(TAB_LABELS) as Tab[]).map((t) => (
              <button
                key={t}
                role="tab"
                aria-selected={tab === t}
                className={`report-tab${tab === t ? " report-tab-active" : ""}`}
                onClick={() => setTab(t)}
              >
                {TAB_LABELS[t]}
              </button>
            ))}
          </div>
          <span className="toolbar-spacer" />
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Başlangıç tarihi" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Bitiş tarihi" />
          {tab === "services" && (
            <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Durum filtresi">
              <option value="">Tüm durumlar</option>
              <option value="intake">Kabul</option>
              <option value="diagnosis">Teşhis</option>
              <option value="awaiting_parts">Parça bekleniyor</option>
              <option value="repairing">Onarım</option>
              <option value="ready">Teslimata hazır</option>
              <option value="delivered">Teslim edildi</option>
              <option value="closed">Kapatıldı</option>
              <option value="cancelled">İptal</option>
            </select>
          )}
          <button className="btn btn-primary" onClick={() => exportReportCsv(tab, params)}>
            CSV İndir
          </button>
          <a className="btn btn-secondary" href={`/api/reports/${tab}/pdf?${new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][])}`} target="_blank" rel="noreferrer">
            PDF İndir
          </a>
        </div>

        {error && <div className="form-error">{error}</div>}
        {loading && <p className="empty-note">Yükleniyor…</p>}

        {!loading && tab === "services" && services && (
          <>
            <div className="report-summary">
              <span>Toplam servis: <strong>{services.total}</strong></span>
              {Object.entries(services.distribution).map(([k, v]) => (
                <span key={k}>{k}: <strong>{v}</strong></span>
              ))}
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Servis No</th>
                  <th scope="col">Müşteri</th>
                  <th scope="col">Cihaz</th>
                  <th scope="col">Durum</th>
                  <th scope="col">Kabul</th>
                </tr>
              </thead>
              <tbody>
                {services.rows.map((r) => (
                  <tr key={r.service_no}>
                    <td>{r.service_no}</td>
                    <td>{r.customer}</td>
                    <td>{r.device}</td>
                    <td>{r.status}</td>
                    <td>{r.created}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {!loading && tab === "stock" && stock && (
          <>
            <div className="report-summary">
              <span>Parça sayısı: <strong>{stock.parts.length}</strong></span>
              <span>Düşük stok: <strong>{stock.low_count}</strong></span>
              <span>Stokta yok: <strong>{stock.out_count}</strong></span>
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Kod</th>
                  <th scope="col">Parça</th>
                  <th scope="col">Kategori</th>
                  <th scope="col">Stok</th>
                  <th scope="col">Min.</th>
                  <th scope="col">Durum</th>
                </tr>
              </thead>
              <tbody>
                {stock.parts.map((p) => (
                  <tr key={p.code}>
                    <td>{p.code}</td>
                    <td>{p.name}</td>
                    <td>{p.category}</td>
                    <td>{p.quantity} {p.unit}</td>
                    <td>{p.min_quantity}</td>
                    <td>{p.level}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h2 className="sub-heading">Stok Hareketleri (seçili aralık)</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Tarih</th>
                  <th scope="col">Parça</th>
                  <th scope="col">Tür</th>
                  <th scope="col">Miktar</th>
                  <th scope="col">Önce → Sonra</th>
                </tr>
              </thead>
              <tbody>
                {stock.movements.map((m, i) => (
                  <tr key={i}>
                    <td>{m.date}</td>
                    <td>{m.part}</td>
                    <td>{m.type}</td>
                    <td>{m.quantity}</td>
                    <td>{m.before} → {m.after}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {!loading && tab === "payments" && payments && (
          <>
            <div className="report-summary">
              <span>Toplam geçerli tahsilat: <strong>{tl(Math.round(payments.total * 100))}</strong></span>
              <span>Toplam iade: <strong>{tl(Math.round(payments.refunded_total * 100))}</strong></span>
              <span>İptal işlem: <strong>{payments.cancelled_count}</strong></span>
              {Object.entries(payments.by_method).map(([k, v]) => (
                <span key={k}>{k}: <strong>{tl(Math.round(v * 100))}</strong></span>
              ))}
            </div>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Tahsilat No</th>
                  <th scope="col">Servis</th>
                  <th scope="col">Müşteri</th>
                  <th scope="col">Tutar</th>
                  <th scope="col">Yöntem</th>
                  <th scope="col">Tarih</th>
                  <th scope="col">Durum</th>
                </tr>
              </thead>
              <tbody>
                {payments.rows.map((r) => (
                  <tr key={r.payment_no} style={r.status !== "valid" ? { opacity: 0.55 } : undefined}>
                    <td>{r.payment_no}</td>
                    <td>{r.service_no}</td>
                    <td>{r.customer}</td>
                    <td className="money">{tl(Math.round(r.amount * 100))}</td>
                    <td>{r.method}</td>
                    <td>{r.created}</td>
                    <td>{r.status === "cancelled" ? "İptal" : "Geçerli"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </main>
  );
}
