import { useEffect, useState } from "react";
import { getDashboard, SERVICE_STATUS_LABELS, tl, type Dashboard, type ServiceStatus } from "../api";
import "./DashboardPage.css";

export function DashboardPage({ onOpenService }: { onOpenService: (id: number) => void }) {
  const [data, setData] = useState<Dashboard | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const handle = setTimeout(() => {
      getDashboard(dateFrom, dateTo)
        .then((d) => { if (!cancelled) { setData(d); setError(null); } })
        .catch((e) => { if (!cancelled) setError(e.message); });
    }, 300);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [dateFrom, dateTo]);

  if (error) {
    return <main className="page"><div className="page-inner"><div className="form-error">{error}</div></div></main>;
  }
  if (!data) {
    return <main className="page"><div className="page-inner"><p className="empty-note">Yükleniyor…</p></div></main>;
  }

  const statusItems: Array<[string, string, number]> = [
    ["Yeni kabul", "intake", data.by_status.intake],
    ["Teşhis bekleyen", "diagnosis", data.by_status.diagnosis],
    ["Parça bekleyen", "awaiting_parts", data.by_status.awaiting_parts],
    ["Onarımda", "repairing", data.by_status.repairing],
    ["Teslimata hazır", "ready", data.by_status.ready],
  ];

  return (
    <main className="page">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Genel Bakış</h1>
            <p className="page-subtitle">
              Güncel iş durumu; tüm sayılar veritabanından hesaplanır.
            </p>
          </div>
          <div className="dash-dates">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Başlangıç tarihi" />
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Bitiş tarihi" />
          </div>
        </div>

        <section className="dash-strip">
          <div className="dash-cell">
            <span className="dash-number">{data.active_services}</span>
            <span className="dash-label">Aktif servis</span>
          </div>
          {statusItems.map(([label, key, count]) => (
            <div className="dash-cell" key={key}>
              <span className="dash-number">{count}</span>
              <span className="dash-label">{label}</span>
            </div>
          ))}
          <div className="dash-cell" data-warn={data.low_stock_count > 0 || undefined}>
            <span className="dash-number">{data.low_stock_count}</span>
            <span className="dash-label">Düşük stok</span>
          </div>
          <div className="dash-cell" data-warn={data.out_of_stock_count > 0 || undefined}>
            <span className="dash-number">{data.out_of_stock_count}</span>
            <span className="dash-label">Stokta yok</span>
          </div>
        </section>

        <section className="dash-columns">
          <div className="detail-section dash-col">
            <h2>Finans</h2>
            <dl className="detail-rows">
              <dt>Dönem</dt>
              <dd>{data.collection_range.from} – {data.collection_range.to}</dd>
              <dt>Dönem tahsilatı</dt>
              <dd className="money">{tl(data.collected_kurus)}</dd>
              <dt>Ödenmemiş servis</dt>
              <dd>{data.unpaid_services}</dd>
              <dt className="total-row">Toplam alacak</dt>
              <dd className="money total-row">{tl(data.total_receivable_kurus)}</dd>
            </dl>
          </div>

          <div className="detail-section dash-col">
            <h2>Düşük Stok Uyarıları</h2>
            {data.low_stock_parts.length === 0 ? (
              <p className="empty-note" style={{ padding: 0 }}>Dikkat gerektiren stok yok.</p>
            ) : (
              <ul className="dash-lowstock">
                {data.low_stock_parts.map((p) => (
                  <li key={p.code}>
                    <span>{p.name} <span className="part-sub">({p.code})</span></span>
                    <span className={`status-chip ${p.level === "out" ? "tone-bad" : "tone-warn"}`}>
                      {p.level === "out" ? "Stokta yok" : `${p.quantity} ${p.unit}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="detail-section">
          <h2>Son Servisler</h2>
          {data.recent_services.length === 0 ? (
            <p className="empty-note" style={{ padding: 0 }}>Henüz servis kaydı yok.</p>
          ) : (
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
                {data.recent_services.map((s) => (
                  <tr key={s.id} onClick={() => onOpenService(s.id)} className="row-clickable">
                    <td>{s.service_no}</td>
                    <td>{s.customer}</td>
                    <td>{s.device}</td>
                    <td>{SERVICE_STATUS_LABELS[s.status as ServiceStatus]}</td>
                    <td>{s.created_at}</td>
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
