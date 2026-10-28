import { useEffect, useState } from "react";
import { createCustomer, listCustomers, type Customer } from "../api";
import {
  CustomerFormFields,
  EMPTY_CUSTOMER,
  useFormError,
  type CustomerFormValues,
} from "../components/CustomerForm";
import "./CustomersPage.css";

interface Props {
  onOpenDetail: (id: number) => void;
}

export function CustomersPage({ onOpenDetail }: Props) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("created_desc");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formValues, setFormValues] = useState<CustomerFormValues>(EMPTY_CUSTOMER);
  const { error, setError, clear } = useFormError();

  useEffect(() => {
    const handle = setTimeout(() => {
      setLoading(true);
      listCustomers({ q: query, status, sort })
        .then(setCustomers)
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, status, sort]);

  const submit = async () => {
    clear();
    try {
      const created = await createCustomer({
        name: formValues.name,
        phone: formValues.phone,
        email: formValues.email || null,
        address: formValues.address || null,
        note: formValues.note || null,
      });
      setShowForm(false);
      setFormValues(EMPTY_CUSTOMER);
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
            <h1 className="page-title">Müşteriler</h1>
            <p className="page-subtitle">
              Müşteri kayıtları; ad, müşteri numarası veya telefon ile aranabilir.
            </p>
          </div>
        </div>

        <div className="module-toolbar">
          <input
            type="text"
            className="search-box"
            placeholder="Ad, müşteri no veya telefon ara…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Durum filtresi">
            <option value="all">Tümü</option>
            <option value="active">Aktif</option>
            <option value="passive">Pasif</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sıralama">
            <option value="created_desc">En yeni</option>
            <option value="name_asc">Ad (A-Z)</option>
            <option value="name_desc">Ad (Z-A)</option>
          </select>
          <span className="toolbar-spacer" />
          <button
            className="btn btn-primary"
            onClick={() => {
              clear();
              setFormValues(EMPTY_CUSTOMER);
              setShowForm(true);
            }}
          >
            Yeni Müşteri
          </button>
        </div>

        {error && <div className="form-error">{error}</div>}

        {showForm && (
          <section className="detail-section" aria-label="Yeni müşteri">
            <h2>Yeni Müşteri</h2>
            <CustomerFormFields values={formValues} onChange={setFormValues} />
            <div className="form-actions" style={{ marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setShowForm(false)}>
                İptal
              </button>
              <button className="btn btn-primary" onClick={submit}>
                Kaydet
              </button>
            </div>
          </section>
        )}

        {loading && customers.length === 0 ? (
          <p className="empty-note">Yükleniyor…</p>
        ) : customers.length === 0 ? (
          <p className="empty-note">Kayıt bulunamadı.</p>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">No</th>
                  <th scope="col">Ad / İşletme</th>
                  <th scope="col">Telefon</th>
                  <th scope="col">Durum</th>
                  <th scope="col" className="col-actions">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>{c.customer_no}</td>
                    <td>{c.name}</td>
                    <td>{c.phone}</td>
                    <td>
                      <span className={`chip ${c.is_active ? "chip-active" : "chip-passive"}`}>
                        {c.is_active ? "Aktif" : "Pasif"}
                      </span>
                    </td>
                    <td className="col-actions">
                      <button className="btn-link" onClick={() => onOpenDetail(c.id)}>
                        Detay
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="record-cards">
              {customers.map((c) => (
                <div className="record-card" key={c.id}>
                  <div className="record-card-head">
                    <span className="record-card-title">{c.name}</span>
                    <span className={`chip ${c.is_active ? "chip-active" : "chip-passive"}`}>
                      {c.is_active ? "Aktif" : "Pasif"}
                    </span>
                  </div>
                  <div className="record-card-sub">{c.customer_no} · {c.phone}</div>
                  <div className="record-card-actions">
                    <button className="btn-link" onClick={() => onOpenDetail(c.id)}>
                      Detay
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
