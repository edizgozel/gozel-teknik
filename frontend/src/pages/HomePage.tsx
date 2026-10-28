import { useEffect, useState } from "react";
import { NAV_ITEMS } from "../components/TopNav";
import { Icon } from "../icons/Icon";
import "./HomePage.css";

interface SystemStatus {
  status: string;
  database: string;
  version: string;
}

export function HomePage() {
  const [apiStatus, setApiStatus] = useState<"checking" | SystemStatus | "unreachable">(
    "checking"
  );

  useEffect(() => {
    let cancelled = false;
    fetch("/api/health")
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((data: SystemStatus) => {
        if (!cancelled) setApiStatus(data);
      })
      .catch(() => {
        if (!cancelled) setApiStatus("unreachable");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const statusLabel =
    apiStatus === "checking"
      ? "Kontrol ediliyor…"
      : apiStatus === "unreachable"
        ? "Sunucuya ulaşılamıyor"
        : `Çalışıyor · Sürüm ${apiStatus.version} · Veritabanı ${
            apiStatus.database === "connected" ? "bağlı" : "bağlı değil"
          }`;

  return (
    <main className="page">
      <div className="page-inner">
        <div className="page-header">
          <div>
            <h1 className="page-title">Genel Bakış</h1>
            <p className="page-subtitle">
              GOZEL TEKNİK teknik servis yönetim yazılımının temel altyapısı kurulu durumda.
              İşletme verisi içeren modüller sonraki aşamalarda eklenecek.
            </p>
          </div>
        </div>

        <section className="status-strip" aria-label="Sistem durumu">
          <span className="status-dot" data-state={apiStatus === "unreachable" ? "bad" : "ok"} />
          <span className="status-label">Sunucu durumu:</span>
          <span className="status-value">{statusLabel}</span>
        </section>

        <section className="module-section">
          <h2 className="section-title">Modül Planı</h2>
          <p className="section-note">
            Aşağıdaki modüller Aşama 0 kapsamında değildir; her biri kendi aşamasında
            geliştirilecektir.
          </p>
          <table className="module-table">
            <thead>
              <tr>
                <th scope="col">Modül</th>
                <th scope="col">Kapsam</th>
                <th scope="col">Durum</th>
              </tr>
            </thead>
            <tbody>
              {NAV_ITEMS.filter((item) => item.planned).map((item) => (
                <tr key={item.label}>
                  <td>
                    <span className="module-name">
                      <Icon name={item.icon} size={15} />
                      {item.label}
                    </span>
                  </td>
                  <td className="module-desc">{MODULE_SCOPE[item.label]}</td>
                  <td>
                    <span className="status-chip">Planlandı</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </main>
  );
}

const MODULE_SCOPE: Record<string, string> = {
  Servisler: "Servis kabul, arıza teşhisi, onarım takibi ve durum geçmişi",
  Müşteriler: "Müşteri kayıtları ve iletişim bilgileri",
  Cihazlar: "Tamir edilen cihazların tanımları ve geçmişi",
  Stok: "Yedek parça tanımları ve stok takibi",
  Finans: "Servis ücretleri ve tahsilat",
  Raporlar: "Özet raporlar ve CSV dışa aktarma",
  Ayarlar: "İşletme ayarları ve veritabanı yedekleme",
};
