export interface Customer {
  id: number;
  customer_no: string;
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  note: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Device {
  id: number;
  device_no: string;
  customer_id: number | null;
  customer_name: string | null;
  type: DeviceType;
  brand: string;
  model: string;
  serial_no: string | null;
  note: string | null;
  is_active: boolean;
  created_at: string;
}

export type DeviceType = "bilgisayar" | "dizustu" | "telefon" | "tablet" | "diger";

export const DEVICE_TYPE_LABELS: Record<DeviceType, string> = {
  bilgisayar: "Bilgisayar",
  dizustu: "Dizüstü",
  telefon: "Telefon",
  tablet: "Tablet",
  diger: "Diğer",
};

export async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    let detail = "İşlem başarısız";
    try {
      const body = await response.json();
      if (typeof body.detail === "string") detail = body.detail;
      else if (Array.isArray(body.detail)) detail = formatValidationErrors(body.detail);
    } catch {
      /* gövde yok */
    }
    throw new Error(detail);
  }
  return response.json();
}

function formatValidationErrors(errors: Array<{ loc: string[]; msg: string }>): string {
  const fieldNames: Record<string, string> = {
    name: "Ad",
    phone: "Telefon",
    email: "E-posta",
    address: "Adres",
    note: "Not",
    type: "Cihaz türü",
    brand: "Marka",
    model: "Model",
    serial_no: "Seri numarası",
    customer_id: "Müşteri",
  };
  return errors
    .map((e) => {
      const field = e.loc.filter((l) => typeof l === "string").pop() ?? "";
      const label = fieldNames[field] ?? field;
      return `${label}: ${e.msg}`;
    })
    .join("\n");
}

export type ServiceStatus =
  | "intake"
  | "diagnosis"
  | "awaiting_parts"
  | "repairing"
  | "ready"
  | "delivered"
  | "closed"
  | "cancelled";

export const SERVICE_STATUS_LABELS: Record<ServiceStatus, string> = {
  intake: "Servis kabul edildi",
  diagnosis: "Arıza teşhisi yapılıyor",
  awaiting_parts: "Parça bekleniyor",
  repairing: "Onarım yapılıyor",
  ready: "Teslimata hazır",
  delivered: "Müşteriye teslim edildi",
  closed: "Servis kapatıldı",
  cancelled: "İptal edildi",
};

export const SERVICE_STATUS_TONE: Record<ServiceStatus, "info" | "warn" | "ok" | "done" | "bad"> = {
  intake: "info",
  diagnosis: "info",
  awaiting_parts: "warn",
  repairing: "info",
  ready: "ok",
  delivered: "done",
  closed: "done",
  cancelled: "bad",
};

export interface ServiceStatusHistory {
  id: number;
  previous_status: string | null;
  new_status: ServiceStatus;
  changed_at: string;
  note: string | null;
}

export interface Diagnosis {
  id: number;
  service_id: number;
  diagnosis: string | null;
  found_issue: string | null;
  proposed_solution: string | null;
  customer_message: string | null;
  internal_note: string | null;
  diagnosed_at: string;
}

export interface RepairAction {
  id: number;
  service_id: number;
  action: string;
  note: string | null;
  performed_at: string;
}

export interface ServiceRecord {
  id: number;
  service_no: string;
  customer_id: number;
  device_id: number;
  customer_name: string;
  customer_phone: string;
  device_label: string;
  device_type: DeviceType;
  device_serial: string | null;
  status: ServiceStatus;
  reported_issue: string;
  physical_condition: string | null;
  accessories: string | null;
  note: string | null;
  estimated_delivery: string | null;
  created_at: string;
  updated_at: string;
  history?: ServiceStatusHistory[];
  diagnosis?: Diagnosis | null;
  repairs?: RepairAction[];
  parts?: ServicePartUsage[];
}

export function listServices(params: {
  q?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  sort?: string;
}) {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v) as [string, string][]
  );
  return request<ServiceRecord[]>(`/api/services?${search}`);
}

export function getService(id: number) {
  return request<ServiceRecord>(`/api/services/${id}`);
}

export function createService(data: Record<string, unknown>) {
  return request<ServiceRecord>("/api/services", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateServiceStatus(id: number, new_status: string, note: string) {
  return request<ServiceRecord>(`/api/services/${id}/status`, {
    method: "POST",
    body: JSON.stringify({ new_status, note: note || null }),
  });
}

export function saveDiagnosis(
  id: number,
  data: {
    diagnosis: string;
    found_issue: string;
    proposed_solution: string;
    customer_message: string;
    internal_note: string;
  }
) {
  return request<Diagnosis>(`/api/services/${id}/diagnosis`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function addRepairAction(id: number, action: string, note: string) {
  return request<ServiceRecord>(`/api/services/${id}/repairs`, {
    method: "POST",
    body: JSON.stringify({ action, note: note || null }),
  });
}

export type PartCategory =
  | "ekran"
  | "batarya"
  | "klavye"
  | "anakart"
  | "sarj_girisi"
  | "kablo_flex"
  | "fan_sogutma"
  | "kasa_parca"
  | "vida_seti"
  | "diger";

export const PART_CATEGORY_LABELS: Record<PartCategory, string> = {
  ekran: "Ekran",
  batarya: "Batarya",
  klavye: "Klavye",
  anakart: "Anakart",
  sarj_girisi: "Şarj Girişi",
  kablo_flex: "Kablo / Flex",
  fan_sogutma: "Fan / Soğutma",
  kasa_parca: "Kasa Parçası",
  vida_seti: "Vida Seti",
  diger: "Diğer",
};

export const PART_UNITS = ["adet", "takim", "metre", "paket"];

export interface Part {
  id: number;
  part_code: string;
  name: string;
  category: PartCategory;
  compatible_brand: string | null;
  compatibility_note: string | null;
  quantity: number;
  min_quantity: number;
  unit: string;
  unit_cost: number | null;
  supplier: string | null;
  description: string | null;
  is_active: boolean;
  stock_level: "ok" | "low" | "out";
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: number;
  part_id: number;
  movement_type: string;
  quantity: number;
  stock_before: number | null;
  stock_after: number | null;
  note: string | null;
  service_id: number | null;
  original_movement_id: number | null;
  created_at: string;
}

export interface ServicePartUsage {
  id: number;
  service_id: number;
  part_id: number;
  part_code: string;
  part_name: string;
  unit: string;
  quantity: number;
  movement_id: number;
  reversed: boolean;
  created_at: string;
}

export function listParts(params: {
  q?: string;
  category?: string;
  stock?: string;
  status?: string;
}) {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v) as [string, string][]
  );
  return request<Part[]>(`/api/parts?${search}`);
}

export function getPart(id: number) {
  return request<Part>(`/api/parts/${id}`);
}

export function createPart(data: Record<string, unknown>) {
  return request<Part>("/api/parts", { method: "POST", body: JSON.stringify(data) });
}

export function updatePart(id: number, data: Record<string, unknown>) {
  return request<Part>(`/api/parts/${id}`, { method: "PUT", body: JSON.stringify(data) });
}

export function listPartMovements(id: number) {
  return request<StockMovement[]>(`/api/parts/${id}/movements`);
}

export const nowLocal = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function addStockMovement(id: number, data: Record<string, unknown>) {
  return request<Part>(`/api/parts/${id}/movements`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function addServicePart(serviceId: number, part_id: number, quantity: number) {
  return request<ServiceRecord>(`/api/services/${serviceId}/parts`, {
    method: "POST",
    body: JSON.stringify({ part_id, quantity }),
  });
}

export function cancelServicePart(serviceId: number, usageId: number) {
  return request<ServiceRecord>(`/api/services/${serviceId}/parts/${usageId}`, {
    method: "DELETE",
  });
}

export interface ChargeLine {
  id?: number;
  charge_type: "labor" | "extra" | "discount";
  description: string;
  quantity: number;
  unit_price_kurus: number;
}

export interface PaymentRecord {
  id: number;
  payment_no: string;
  service_id: number;
  service_no: string;
  customer_name: string;
  amount_kurus: number;
  method: "cash" | "transfer" | "card" | "other";
  status: "valid" | "cancelled";
  refunded_kurus: number;
  note: string | null;
  created_at: string;
}

export interface Finance {
  labor_total: number;
  parts_total: number;
  extra_total: number;
  discount_total: number;
  grand_total: number;
  paid_total: number;
  balance: number;
  payment_status: "unpaid" | "partially_paid" | "paid" | "no_charge";
  charges: ChargeLine[];
  payments: Array<{
    id: number;
    payment_no: string;
    amount_kurus: number;
    method: PaymentRecord["method"];
    status: PaymentRecord["status"];
    refunded_kurus: number;
    note: string | null;
    created_at: string;
  }>;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentRecord["method"], string> = {
  cash: "Nakit",
  transfer: "Havale/EFT",
  card: "Kart",
  other: "Diğer",
};

export const PAYMENT_STATUS_LABELS: Record<Finance["payment_status"], string> = {
  unpaid: "Ödeme alınmadı",
  partially_paid: "Kısmi ödeme alındı",
  paid: "Tamamı ödendi",
  no_charge: "Ücret belirlenmedi",
};

export const tl = (kurus: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(
    kurus / 100
  );

export const toKurus = (tlValue: string) => {
  const normalized = tlValue.replace(/\s/g, "").replace(",", ".");
  const value = Number(normalized);
  if (!Number.isFinite(value)) return NaN;
  return Math.round(value * 100);
};

export function getFinance(serviceId: number) {
  return request<Finance>(`/api/services/${serviceId}/finance`);
}

export function updateCharges(
  serviceId: number,
  lines: Array<{ charge_type: string; description: string; quantity: number; unit_price_kurus: number }>
) {
  return request<Finance>(`/api/services/${serviceId}/charges`, {
    method: "PUT",
    body: JSON.stringify({ lines }),
  });
}

export function addPayment(
  serviceId: number,
  amount_kurus: number,
  method: string,
  note: string,
  occurred_at?: string
) {
  return request<Finance>(`/api/services/${serviceId}/payments`, {
    method: "POST",
    body: JSON.stringify({ amount_kurus, method, note: note || null, occurred_at: occurred_at || null }),
  });
}

export function cancelPayment(paymentId: number) {
  return request<PaymentRecord>(`/api/payments/${paymentId}/cancel`, { method: "POST" });
}

export function refundPayment(paymentId: number, amount_kurus: number, note: string) {
  return request<PaymentRecord>(`/api/payments/${paymentId}/refunds`, {
    method: "POST",
    body: JSON.stringify({ amount_kurus, note: note || null }),
  });
}

export function listPayments(params: {
  q?: string;
  method?: string;
  date_from?: string;
  date_to?: string;
}) {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v) as [string, string][]
  );
  return request<PaymentRecord[]>(`/api/payments?${search}`);
}

export interface ServicesReport {
  rows: Array<{ service_no: string; customer: string; device: string; status: string; created: string }>;
  total: number;
  distribution: Record<string, number>;
}

export interface StockReport {
  parts: Array<{ code: string; name: string; category: string; quantity: number; min_quantity: number; level: string; unit: string }>;
  movements: Array<{ date: string; part: string; type: string; quantity: number; before: number; after: number }>;
  low_count: number;
  out_count: number;
}

export interface PaymentsReport {
  rows: Array<{ payment_no: string; service_no: string; customer: string; amount: number; method: string; created: string; status: string; refunded: number }>;
  total: number;
  refunded_total: number;
  cancelled_count: number;
  by_method: Record<string, number>;
}

function reportUrl(kind: string, params: Record<string, string>, format: "json" | "csv") {
  const search = new URLSearchParams(
    Object.entries({ ...params, format }).filter(([, v]) => v) as [string, string][]
  );
  return `/api/reports/${kind}?${search}`;
}

export async function fetchReport<T>(kind: string, params: Record<string, string>) {
  const response = await fetch(reportUrl(kind, params, "json"));
  if (!response.ok) throw new Error("Rapor alınamadı");
  return response.json() as Promise<T>;
}

export function exportReportCsv(kind: string, params: Record<string, string>) {
  window.open(reportUrl(kind, params, "csv"), "_blank");
}

export interface Dashboard {
  active_services: number;
  by_status: Record<string, number>;
  low_stock_count: number;
  out_of_stock_count: number;
  collected_kurus: number;
  collection_range: { from: string; to: string };
  unpaid_services: number;
  total_receivable_kurus: number;
  low_stock_parts: Array<{ code: string; name: string; quantity: number; min_quantity: number; unit: string; level: string }>;
  recent_services: Array<{ id: number; service_no: string; customer: string; device: string; status: string; created_at: string }>;
}

export function getDashboard(dateFrom?: string, dateTo?: string) {
  const search = new URLSearchParams(
    Object.entries({ date_from: dateFrom ?? "", date_to: dateTo ?? "" }).filter(([, v]) => v) as [string, string][]
  );
  return request<Dashboard>(`/api/dashboard?${search}`);
}

export interface AuditEntry {
  id: number;
  action: string;
  entity_type: string;
  entity_id: number | null;
  description: string;
  source: string;
  created_at: string;
}

export function listAudit(params: { q?: string; action?: string; date_from?: string; date_to?: string }) {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v) as [string, string][]
  );
  return request<{ rows: AuditEntry[]; actions: string[] }>(`/api/audit?${search}`);
}

export function listCustomers(params: {
  q?: string;
  status?: string;
  sort?: string;
}) {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v) as [string, string][]
  );
  return request<Customer[]>(`/api/customers?${search}`);
}

export function getCustomer(id: number) {
  return request<Customer>(`/api/customers/${id}`);
}

export function createCustomer(data: Record<string, unknown>) {
  return request<Customer>("/api/customers", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateCustomer(id: number, data: Record<string, unknown>) {
  return request<Customer>(`/api/customers/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function listDevices(params: {
  q?: string;
  type?: string;
  status?: string;
  customer_id?: number;
}) {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== "") as [string, string][]
  );
  return request<Device[]>(`/api/devices?${search}`);
}

export function getDevice(id: number) {
  return request<Device>(`/api/devices/${id}`);
}

export function createDevice(data: Record<string, unknown>) {
  return request<Device>("/api/devices", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateDevice(id: number, data: Record<string, unknown>) {
  return request<Device>(`/api/devices/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}
