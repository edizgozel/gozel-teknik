import { useEffect, useState } from "react";
import {
  listPayments,
  PAYMENT_METHOD_LABELS,
  tl,
  type PaymentRecord,
} from "../api";
import { useFormError } from "../components/CustomerForm";
import "./PaymentsPage.css";

interface Props {
  onOpenService: (id: number) => void;
}

export function PaymentsPage({ onOpenService }: Props) {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [query, setQuery] = useState("");
  const [method, setMethod] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const { error, setError } = useFormError();

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      listPayments({ q: query, method, date_from: dateFrom, date_to: dateTo })
        .then(setPayments)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, method, dateFrom, dateTo]);

  return (
    <main className="page">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Tahsilatlar</h1>
            <p className="page-subtitle">
              Servis tahsilat kayıtları; tahsilat numarası, servis numarası veya müşteri ile aranabilir.
            </p>
          </div>
        </div>

        <div className="module-toolbar">
          <input
            type="text"
            className="search-box"
            placeholder="Tahsilat no, servis no veya müşteri ara…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Ödeme yöntemi filtresi">
            <option value="">Tüm yöntemler</option>
            {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} aria-label="Başlangıç tarihi" />
          <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} aria-label="Bitiş tarihi" />
        </div>

        {error && <div className="form-error">{error}</div>}

        {loading && payments.length === 0 ? (
          <p className="empty-note">Yükleniyor…</p>
        ) : payments.length === 0 ? (
          <p className="empty-note">Tahsilat kaydı bulunamadı.</p>
        ) : (
          <>
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
                  <th scope="col" className="col-actions">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} style={p.status !== "valid" ? { opacity: 0.55 } : undefined}>
                    <td>{p.payment_no}</td>
                    <td>{p.service_no}</td>
                    <td>{p.customer_name}</td>
                    <td className="money">{tl(p.amount_kurus)}</td>
                    <td>{PAYMENT_METHOD_LABELS[p.method]}</td>
                    <td>{new Date(p.created_at).toLocaleString("tr-TR")}</td>
                    <td>
                      {p.status === "cancelled" ? (
                        <span className="status-chip tone-done">İptal edildi</span>
                      ) : p.refunded_kurus >= p.amount_kurus ? (
                        <span className="status-chip tone-bad">Tamamı iade edildi</span>
                      ) : p.refunded_kurus > 0 ? (
                        <span className="status-chip tone-warn">Kısmi iade</span>
                      ) : (
                        <span className="status-chip tone-ok">Geçerli</span>
                      )}
                    </td>
                    <td className="col-actions">
                      <button className="btn-link" onClick={() => onOpenService(p.service_id)}>
                        Servise Git
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="record-cards">
              {payments.map((p) => (
                <div className="record-card" key={p.id}>
                  <div className="record-card-head">
                    <span className="record-card-title">{p.payment_no}</span>
                    <span className="money">{tl(p.amount_kurus)}</span>
                  </div>
                  <div className="record-card-sub">
                    {p.service_no} · {p.customer_name}
                  </div>
                  <div className="record-card-meta">
                    <span>{PAYMENT_METHOD_LABELS[p.method]}</span>
                    <span>{new Date(p.created_at).toLocaleString("tr-TR")}</span>
                    <span>
                      {p.status === "cancelled"
                        ? "İptal edildi"
                        : p.refunded_kurus > 0
                          ? `İade: ${tl(p.refunded_kurus)}`
                          : "Geçerli"}
                    </span>
                  </div>
                  <div className="record-card-actions">
                    <button className="btn-link" onClick={() => onOpenService(p.service_id)}>
                      Servise Git
                    </button>
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
