import { useEffect, useState } from "react";
import {
  addPayment,
  cancelPayment,
  getFinance,
  nowLocal,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  refundPayment,
  tl,
  toKurus,
  updateCharges,
  type ChargeLine,
  type Finance,
} from "../api";
import { useFormError } from "../components/CustomerForm";

interface Props {
  serviceId: number;
  editable: boolean;
}

interface DraftLine extends ChargeLine {
  unit_price_tl: string;
}

const EMPTY_DRAFT: DraftLine[] = [
  { charge_type: "labor", description: "İşçilik", quantity: 1, unit_price_kurus: 0, unit_price_tl: "" },
];

export function FinancePanel({ serviceId, editable }: Props) {
  const [finance, setFinance] = useState<Finance | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<DraftLine[]>(EMPTY_DRAFT);
  const [savingCharges, setSavingCharges] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("cash");
  const [payNote, setPayNote] = useState("");
  const [payDate, setPayDate] = useState(nowLocal());
  const [paySaving, setPaySaving] = useState(false);
  const [refundTarget, setRefundTarget] = useState<{ id: number; no: string; max: number } | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refundNote, setRefundNote] = useState("");
  const [refundSaving, setRefundSaving] = useState(false);
  const { error, setError, clear } = useFormError();

  useEffect(() => {
    getFinance(serviceId).then(setFinance).catch((e) => setError(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serviceId]);

  if (!finance) {
    return (
      <section className="detail-section">
        <h2>Finans</h2>
        <p className="empty-note" style={{ padding: 0 }}>Yükleniyor…</p>
      </section>
    );
  }

  const startEditing = () => {
    clear();
    setDraft(
      finance.charges.length
        ? finance.charges.map((c) => ({
            ...c,
            unit_price_tl: (c.unit_price_kurus / 100).toFixed(2).replace(".", ","),
          }))
        : EMPTY_DRAFT
    );
    setEditing(true);
  };

  const saveCharges = async () => {
    if (savingCharges) return;
    clear();
    setSavingCharges(true);
    try {
      const lines = draft
        .filter((l) => l.description.trim() && l.unit_price_tl !== "")
        .map((l) => ({
          charge_type: l.charge_type,
          description: l.description,
          quantity: l.quantity || 1,
          unit_price_kurus: toKurus(l.unit_price_tl),
        }));
      if (lines.some((l) => Number.isNaN(l.unit_price_kurus) || l.unit_price_kurus < 0)) {
        throw new Error("Tutarlar geçerli bir sayı olmalıdır");
      }
      const updated = await updateCharges(serviceId, lines);
      setFinance(updated);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setSavingCharges(false);
    }
  };

  const submitPayment = async () => {
    if (paySaving) return;
    clear();
    const kurus = toKurus(payAmount);
    if (Number.isNaN(kurus) || kurus <= 0) {
      setError("Tutar sıfırdan büyük olmalıdır");
      return;
    }
    if (kurus > finance.balance) {
      setError(`Tahsilat kalan borcu aşamaz (kalan: ${tl(finance.balance)})`);
      return;
    }
    setPaySaving(true);
    try {
      const updated = await addPayment(serviceId, kurus, payMethod, payNote);
      setFinance(updated);
      setPayAmount("");
      setPayNote("");
      setPayDate(nowLocal());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setPaySaving(false);
    }
  };

  const submitRefund = async () => {
    if (refundSaving || !refundTarget) return;
    clear();
    const kurus = toKurus(refundAmount);
    if (Number.isNaN(kurus) || kurus <= 0) {
      setError("İade tutarı sıfırdan büyük olmalıdır");
      return;
    }
    if (kurus > refundTarget.max) {
      setError(`İade en fazla ${tl(refundTarget.max)} olabilir`);
      return;
    }
    setRefundSaving(true);
    try {
      await refundPayment(refundTarget.id, kurus, refundNote);
      setFinance(await getFinance(serviceId));
      setRefundTarget(null);
      setRefundAmount("");
      setRefundNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setRefundSaving(false);
    }
  };

  const statusChip =
    finance.payment_status === "paid" ? (
      <span className="status-chip tone-ok">{PAYMENT_STATUS_LABELS.paid}</span>
    ) : finance.payment_status === "partially_paid" ? (
      <span className="status-chip tone-warn">{PAYMENT_STATUS_LABELS.partially_paid}</span>
    ) : finance.payment_status === "no_charge" ? (
      <span className="status-chip tone-done">{PAYMENT_STATUS_LABELS.no_charge}</span>
    ) : (
      <span className="status-chip tone-bad">{PAYMENT_STATUS_LABELS.unpaid}</span>
    );

  return (
    <section className="detail-section">
      <div className="section-head">
        <h2>Finans {statusChip}</h2>
        {editable && !editing && (
          <button className="btn btn-secondary" onClick={startEditing}>
            Ücretleri Düzenle
          </button>
        )}
      </div>

      {error && <div className="form-error">{error}</div>}

      {editing ? (
        <>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">Tür</th>
                <th scope="col">Açıklama</th>
                <th scope="col">Adet</th>
                <th scope="col">Birim Fiyat (TL)</th>
                <th scope="col" className="col-actions" />
              </tr>
            </thead>
            <tbody>
              {draft.map((line, i) => (
                <tr key={i}>
                  <td>
                    <select
                      aria-label="Kalem türü"
                      value={line.charge_type}
                      onChange={(e) => {
                        const next = [...draft];
                        next[i] = { ...line, charge_type: e.target.value as DraftLine["charge_type"] };
                        setDraft(next);
                      }}
                    >
                      <option value="labor">İşçilik</option>
                      <option value="extra">Ek hizmet</option>
                      <option value="discount">İndirim</option>
                    </select>
                  </td>
                  <td>
                    <input
                      aria-label="Açıklama"
                      type="text"
                      value={line.description}
                      maxLength={200}
                      onChange={(e) => {
                        const next = [...draft];
                        next[i] = { ...line, description: e.target.value };
                        setDraft(next);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      aria-label="Adet"
                      type="number"
                      min={1}
                      value={line.quantity}
                      onChange={(e) => {
                        const next = [...draft];
                        next[i] = { ...line, quantity: Number(e.target.value) };
                        setDraft(next);
                      }}
                    />
                  </td>
                  <td>
                    <input
                      aria-label="Birim fiyat"
                      type="text"
                      inputMode="decimal"
                      value={line.unit_price_tl}
                      onChange={(e) => {
                        const next = [...draft];
                        next[i] = { ...line, unit_price_tl: e.target.value };
                        setDraft(next);
                      }}
                    />
                  </td>
                  <td className="col-actions">
                    <button
                      className="btn-link"
                      onClick={() => setDraft(draft.filter((_, j) => j !== i))}
                    >
                      Kaldır
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="form-actions">
            <button className="btn btn-secondary" onClick={() => setDraft([...draft, { charge_type: "extra", description: "", quantity: 1, unit_price_kurus: 0, unit_price_tl: "" }])}>
              Kalem Ekle
            </button>
            <button className="btn btn-secondary" onClick={() => setEditing(false)}>Vazgeç</button>
            <button className="btn btn-primary" onClick={saveCharges} disabled={savingCharges}>
              {savingCharges ? "Kaydediliyor…" : "Ücretleri Kaydet"}
            </button>
          </div>
        </>
      ) : (
        <dl className="detail-rows finance-rows">
          <dt>İşçilik</dt>
          <dd className="money">{tl(finance.labor_total)}</dd>
          <dt>Parçalar</dt>
          <dd className="money">{tl(finance.parts_total)}</dd>
          <dt>Ek hizmetler</dt>
          <dd className="money">{tl(finance.extra_total)}</dd>
          <dt>İndirim</dt>
          <dd className="money">−{tl(finance.discount_total)}</dd>
          <dt className="total-row">Genel Toplam</dt>
          <dd className="money total-row">{tl(finance.grand_total)}</dd>
          <dt>Tahsil Edilen</dt>
          <dd className="money">{tl(finance.paid_total)}</dd>
          <dt className="total-row">Kalan Borç</dt>
          <dd className="money total-row">{tl(finance.balance)}</dd>
        </dl>
      )}

      <h2 className="sub-heading">Tahsilat Ekle</h2>
      {editable || finance.balance > 0 ? (
        <div className="stock-adjust-row">
          <div className="form-field">
            <label htmlFor="pay-amount">Tutar (TL) — kalan borç: {tl(finance.balance)}</label>
            <input
              id="pay-amount"
              type="text"
              inputMode="decimal"
              value={payAmount}
              onChange={(e) => setPayAmount(e.target.value)}
            />
          </div>
          <div className="form-field">
            <label htmlFor="pay-method">Ödeme Yöntemi</label>
            <select id="pay-method" value={payMethod} onChange={(e) => setPayMethod(e.target.value)}>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label htmlFor="pay-note">Açıklama (isteğe bağlı)</label>
            <input id="pay-note" type="text" value={payNote} maxLength={300}
              onChange={(e) => setPayNote(e.target.value)} />
          </div>
          <div className="form-field">
            <label htmlFor="pay-date">İşlem Tarihi</label>
            <input id="pay-date" type="datetime-local" value={payDate}
              onChange={(e) => setPayDate(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={submitPayment} disabled={paySaving || !payAmount}>
            {paySaving ? "Kaydediliyor…" : "Tahsilatı Kaydet"}
          </button>
        </div>
      ) : (
        <p className="empty-note" style={{ padding: 0 }}>
          Kapalı servise yeni tahsilat eklenemez.
        </p>
      )}

      {finance.payments.length > 0 && (
        <>
          <h2 className="sub-heading">Tahsilat Geçmişi</h2>
          <table className="data-table">
            <thead>
              <tr>
                <th scope="col">No</th>
                <th scope="col">Tutar</th>
                <th scope="col">Yöntem</th>
                <th scope="col">Tarih</th>
                <th scope="col">Durum</th>
                <th scope="col" className="col-actions">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {finance.payments.map((p) => (
                <tr key={p.id} style={p.status !== "valid" ? { opacity: 0.55 } : undefined}>
                  <td>{p.payment_no}</td>
                  <td className="money">{tl(p.amount_kurus)}</td>
                  <td>{PAYMENT_METHOD_LABELS[p.method]}</td>
                  <td>{new Date(p.created_at).toLocaleString("tr-TR")}</td>
                  <td>
                    {p.status === "cancelled" ? (
                      <span className="status-chip tone-done">İptal edildi</span>
                    ) : p.refunded_kurus > 0 ? (
                      <span className="status-chip tone-warn">
                        İade: {tl(p.refunded_kurus)}
                      </span>
                    ) : (
                      <span className="status-chip tone-ok">Geçerli</span>
                    )}
                  </td>
                  <td className="col-actions">
                    {p.status === "valid" && refundTarget?.id !== p.id && (
                      <>
                        <button
                          className="btn-link"
                          onClick={() => {
                            clear();
                            setRefundTarget({ id: p.id, no: p.payment_no, max: p.amount_kurus - p.refunded_kurus });
                            setRefundAmount("");
                            setRefundNote("");
                          }}
                        >
                          İade
                        </button>
                        {p.refunded_kurus === 0 && (
                          <button
                            className="btn-link"
                            onClick={async () => {
                              clear();
                              try {
                                await cancelPayment(p.id);
                                setFinance(await getFinance(serviceId));
                              } catch (e) {
                                setError(e instanceof Error ? e.message : "Bilinmeyen hata");
                              }
                            }}
                          >
                            İptal
                          </button>
                        )}
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {refundTarget && (
        <div className="refund-box">
          <strong>{refundTarget.no}</strong> için iade — en fazla {tl(refundTarget.max)}
          <div className="stock-adjust-row" style={{ borderTop: "none", paddingBottom: 0 }}>
            <div className="form-field">
              <label htmlFor="rf-amount">İade Tutarı (TL)</label>
              <input id="rf-amount" type="text" inputMode="decimal" value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)} />
            </div>
            <div className="form-field">
              <label htmlFor="rf-note">Açıklama (isteğe bağlı)</label>
              <input id="rf-note" type="text" value={refundNote} maxLength={300}
                onChange={(e) => setRefundNote(e.target.value)} />
            </div>
            <button className="btn btn-primary" onClick={submitRefund} disabled={refundSaving}>
              {refundSaving ? "İşleniyor…" : "İadeyi Kaydet"}
            </button>
            <button className="btn btn-secondary" onClick={() => setRefundTarget(null)}>Vazgeç</button>
          </div>
        </div>
      )}
    </section>
  );
}
