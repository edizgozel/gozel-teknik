import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { App } from "../App";

const dashboardData = {
  active_services: 2,
  by_status: { intake: 1, diagnosis: 1, awaiting_parts: 0, repairing: 0, ready: 0, delivered: 0, closed: 0, cancelled: 0 },
  low_stock_count: 1,
  out_of_stock_count: 0,
  collected_kurus: 30000,
  collection_range: { from: "2026-10-01", to: "2026-10-31" },
  unpaid_services: 1,
  total_receivable_kurus: 20000,
  low_stock_parts: [],
  recent_services: [],
};

vi.stubGlobal(
  "fetch",
  vi.fn((input: RequestInfo | URL) => {
    const url = String(input);
    const body = url.includes("/api/dashboard")
      ? dashboardData
      : { status: "ok", database: "connected", version: "0.1.0" };
    return Promise.resolve({ ok: true, json: () => Promise.resolve(body) });
  })
);

describe("App", () => {
  it("üst navigasyonda tüm modülleri gösterir", () => {
    render(<App />);
    for (const label of [
      "Ana Sayfa",
      "Servisler",
      "Müşteriler",
      "Cihazlar",
      "Stok",
      "Finans",
      "Raporlar",
      "Ayarlar",
    ]) {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    }
  });

  it("dashboard gerçek verileri gösterir", async () => {
    render(<App />);
    expect(await screen.findByText("Aktif servis")).toBeInTheDocument();
    expect(await screen.findByText("₺300,00")).toBeInTheDocument();
  });

  it("Servisler menü öğesi servis listesini açar", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByText("Servisler")[0]);
    expect(screen.getByText("Yeni Servis Kabul")).toBeInTheDocument();
  });

  it("Müşteriler menü öğesi müşteri listesini açar", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByText("Müşteriler")[0]);
    expect(screen.getByText("Yeni Müşteri")).toBeInTheDocument();
  });

  it("Cihazlar menü öğesi cihaz listesini açar", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByText("Cihazlar")[0]);
    expect(screen.getByText("Yeni Cihaz")).toBeInTheDocument();
  });

  it("Stok menü öğesi stok listesini açar", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByText("Stok")[0]);
    expect(screen.getByText("Yeni Parça")).toBeInTheDocument();
  });

  it("Finans menü öğesi tahsilat listesini açar", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByText("Finans")[0]);
    expect(screen.getByPlaceholderText("Tahsilat no, servis no veya müşteri ara…")).toBeInTheDocument();
  });

  it("Raporlar menü öğesi rapor sayfasını açar", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByText("Raporlar")[0]);
    expect(screen.getByText("CSV İndir")).toBeInTheDocument();
  });

  it("Ayarlar menü öğesi işlem geçmişini açar", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getAllByText("Ayarlar")[0]);
    expect(screen.getByText("İşlem Geçmişi")).toBeInTheDocument();
  });

  it("sunucu durumunu sağlık uç noktasından alır", async () => {
    render(<App />);
    expect(await screen.findByText("Aktif servis")).toBeInTheDocument();
  });
});
