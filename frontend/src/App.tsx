import { useState } from "react";
import { TopNav } from "./components/TopNav";
import { CustomersPage } from "./pages/CustomersPage";
import { CustomerDetailPage } from "./pages/CustomerDetailPage";
import { DevicesPage } from "./pages/DevicesPage";
import { DeviceDetailPage } from "./pages/DeviceDetailPage";
import { ServicesPage } from "./pages/ServicesPage";
import { ServiceDetailPage } from "./pages/ServiceDetailPage";
import { PartsPage } from "./pages/PartsPage";
import { PartDetailPage } from "./pages/PartDetailPage";
import { PaymentsPage } from "./pages/PaymentsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SettingsPage } from "./pages/SettingsPage";

export type View =
  | { page: "home" }
  | { page: "customers" }
  | { page: "customer"; id: number }
  | { page: "devices" }
  | { page: "device"; id: number }
  | { page: "services" }
  | { page: "service"; id: number }
  | { page: "parts" }
  | { page: "part"; id: number }
  | { page: "payments" }
  | { page: "reports" }
  | { page: "audit" };

const ACTIVE_LABEL: Record<View["page"], string> = {
  home: "Ana Sayfa",
  customers: "Müşteriler",
  customer: "Müşteriler",
  devices: "Cihazlar",
  device: "Cihazlar",
  services: "Servisler",
  service: "Servisler",
  parts: "Stok",
  part: "Stok",
  payments: "Finans",
  reports: "Raporlar",
  audit: "Ayarlar",
};

export function App() {
  const [view, setView] = useState<View>({ page: "home" });

  return (
    <div className="app-shell">
      <TopNav
        active={ACTIVE_LABEL[view.page]}
        onNavigate={(label) => {
          if (label === "Ana Sayfa") setView({ page: "home" });
          else if (label === "Servisler") setView({ page: "services" });
          else if (label === "Müşteriler") setView({ page: "customers" });
          else if (label === "Cihazlar") setView({ page: "devices" });
          else if (label === "Stok") setView({ page: "parts" });
          else if (label === "Finans") setView({ page: "payments" });
          else if (label === "Raporlar") setView({ page: "reports" });
          else if (label === "Ayarlar") setView({ page: "audit" });
        }}
      />
      {view.page === "customers" && (
        <CustomersPage onOpenDetail={(id) => setView({ page: "customer", id })} />
      )}
      {view.page === "customer" && (
        <CustomerDetailPage
          key={view.id}
          customerId={view.id}
          onBack={() => setView({ page: "customers" })}
          onOpenDevice={(id) => setView({ page: "device", id })}
        />
      )}
      {view.page === "devices" && (
        <DevicesPage onOpenDetail={(id) => setView({ page: "device", id })} />
      )}
      {view.page === "device" && (
        <DeviceDetailPage key={view.id} deviceId={view.id} onBack={() => setView({ page: "devices" })} />
      )}
      {view.page === "services" && (
        <ServicesPage
          onOpenDetail={(id) => setView({ page: "service", id })}
          onGoToDevices={() => setView({ page: "devices" })}
        />
      )}
      {view.page === "service" && (
        <ServiceDetailPage key={view.id} serviceId={view.id} onBack={() => setView({ page: "services" })} />
      )}
      {view.page === "parts" && (
        <PartsPage onOpenDetail={(id) => setView({ page: "part", id })} />
      )}
      {view.page === "part" && (
        <PartDetailPage key={view.id} partId={view.id} onBack={() => setView({ page: "parts" })} />
      )}
      {view.page === "payments" && (
        <PaymentsPage onOpenService={(id) => setView({ page: "service", id })} />
      )}
      {view.page === "reports" && <ReportsPage />}
      {view.page === "home" && (
        <DashboardPage onOpenService={(id) => setView({ page: "service", id })} />
      )}
      {view.page === "audit" && <SettingsPage />}
    </div>
  );
}
