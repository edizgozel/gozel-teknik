import { useState } from "react";
import { Icon, type IconName } from "../icons/Icon";
import "./TopNav.css";

export interface NavItem {
  label: string;
  icon: IconName;
  /** Henüz geliştirilmemiş modüller için true; tıklanamaz ve "Planlandı" etiketi alır */
  planned?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Ana Sayfa", icon: "home" },
  { label: "Servisler", icon: "wrench" },
  { label: "Müşteriler", icon: "users" },
  { label: "Cihazlar", icon: "devices" },
  { label: "Stok", icon: "boxes" },
  { label: "Finans", icon: "wallet" },
  { label: "Raporlar", icon: "chart" },
  { label: "Ayarlar", icon: "settings" },
];

interface TopNavProps {
  active: string;
  onNavigate: (label: string) => void;
}

export function TopNav({ active, onNavigate }: TopNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  const handleNavClick = (item: NavItem) => {
    setMenuOpen(false);
    if (!item.planned) onNavigate(item.label);
  };

  return (
    <header className="topnav">
      <div className="topnav-inner">
        <div className="brand">
          <img src="/logo.png" alt="GOZEL TEKNİK logosu" className="brand-logo" />
          <span className="brand-text">
            <span className="brand-name">
              GOZEL <span className="brand-sub">TEKNİK</span>
            </span>
            <span className="brand-tag">Servis Yönetimi</span>
          </span>
        </div>

        <button
          className="nav-toggle"
          aria-label={menuOpen ? "Menüyü kapat" : "Menüyü aç"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
            {menuOpen ? (
              <path d="M6 6l12 12M18 6L6 18" fill="none" />
            ) : (
              <path d="M4 7h16M4 12h16M4 17h16" fill="none" />
            )}
          </svg>
        </button>

        <nav className={`nav-items${menuOpen ? " nav-items-open" : ""}`}>
          <ul className="nav-list">
            {NAV_ITEMS.map((item) => (
              <li key={item.label}>
                {item.planned ? (
                  <span
                    className="nav-link nav-link-planned"
                    title="Bu modül sonraki aşamalarda geliştirilecek"
                  >
                    <Icon name={item.icon} className="nav-icon" />
                    {item.label}
                    <span className="nav-dot" />
                  </span>
                ) : (
                  <a
                    href="#"
                    className={`nav-link${active === item.label ? " nav-link-active" : ""}`}
                    aria-current={active === item.label ? "page" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      handleNavClick(item);
                    }}
                  >
                    <Icon name={item.icon} className="nav-icon" />
                    {item.label}
                  </a>
                )}
              </li>
            ))}
          </ul>
        </nav>

        <div className="nav-side">
          <span className="nav-version">v0.3.0</span>
        </div>
      </div>
    </header>
  );
}
