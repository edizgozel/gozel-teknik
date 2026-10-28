import { useState } from "react";
import type { Customer } from "../api";

export interface CustomerFormValues {
  name: string;
  phone: string;
  email: string;
  address: string;
  note: string;
  is_active: boolean;
}

export const EMPTY_CUSTOMER: CustomerFormValues = {
  name: "",
  phone: "",
  email: "",
  address: "",
  note: "",
  is_active: true,
};

export function toCustomerForm(customer: Customer): CustomerFormValues {
  return {
    name: customer.name,
    phone: customer.phone,
    email: customer.email ?? "",
    address: customer.address ?? "",
    note: customer.note ?? "",
    is_active: customer.is_active,
  };
}

interface CustomerFormFieldsProps {
  values: CustomerFormValues;
  onChange: (values: CustomerFormValues) => void;
}

export function CustomerFormFields({ values, onChange }: CustomerFormFieldsProps) {
  const set = (patch: Partial<CustomerFormValues>) => onChange({ ...values, ...patch });

  return (
    <div className="form-grid">
      <div className="form-field">
        <label htmlFor="cust-name">Ad Soyad / İşletme Adı *</label>
        <input
          id="cust-name"
          type="text"
          value={values.name}
          maxLength={120}
          onChange={(e) => set({ name: e.target.value })}
        />
      </div>
      <div className="form-field">
        <label htmlFor="cust-phone">Telefon *</label>
        <input
          id="cust-phone"
          type="tel"
          value={values.phone}
          maxLength={24}
          onChange={(e) => set({ phone: e.target.value })}
        />
      </div>
      <div className="form-field">
        <label htmlFor="cust-email">E-posta (isteğe bağlı)</label>
        <input
          id="cust-email"
          type="email"
          value={values.email}
          onChange={(e) => set({ email: e.target.value })}
        />
      </div>
      <div className="form-field">
        <label htmlFor="cust-status">Durum</label>
        <select
          id="cust-status"
          value={values.is_active ? "active" : "passive"}
          onChange={(e) => set({ is_active: e.target.value === "active" })}
        >
          <option value="active">Aktif</option>
          <option value="passive">Pasif</option>
        </select>
      </div>
      <div className="form-field form-field-wide">
        <label htmlFor="cust-address">Adres (isteğe bağlı)</label>
        <input
          id="cust-address"
          type="text"
          value={values.address}
          maxLength={300}
          onChange={(e) => set({ address: e.target.value })}
        />
      </div>
      <div className="form-field form-field-wide">
        <label htmlFor="cust-note">Açıklama / Not (isteğe bağlı)</label>
        <textarea
          id="cust-note"
          value={values.note}
          maxLength={500}
          onChange={(e) => set({ note: e.target.value })}
        />
      </div>
    </div>
  );
}

export function useFormError() {
  const [error, setError] = useState<string | null>(null);
  return { error, setError, clear: () => setError(null) };
}
