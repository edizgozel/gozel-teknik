from datetime import datetime

from fpdf import FPDF

from app.core.config import settings

FONT_PATH = r"C:\Windows\Fonts\segoeui.ttf"
FONT_BOLD_PATH = r"C:\Windows\Fonts\segoeuib.ttf"
LOGO_PATH = settings.frontend_dist_dir.parent / "public" / "logo.png"

BRAND = (74, 14, 28)      # bordo
TEXT = (38, 34, 31)
MUTED = (92, 85, 81)
LINE = (222, 218, 216)


class DocPDF(FPDF):
    def __init__(self, title: str, business: dict | None = None):
        super().__init__(orientation="P", unit="mm", format="A4")
        self.business = business or {}
        self.add_font("seg", "", FONT_PATH)
        self.add_font("seg", "B", FONT_BOLD_PATH)
        self.set_title(title)
        self.set_auto_page_break(auto=True, margin=18)
        self.add_page()

    def header(self):
        if self.LOGO_PATH_exists():
            self.image(str(LOGO_PATH), x=14, y=10, w=12)
        self.set_font("seg", "B", 15)
        self.set_text_color(*BRAND)
        self.set_xy(30, 10)
        self.cell(0, 7, "GOZEL TEKNİK")
        self.set_font("seg", "", 8)
        self.set_text_color(*MUTED)
        self.set_xy(30, 17)
        self.cell(0, 4, "TEKNİK SERVİS YÖNETİMİ")
        biz = self.business
        info = " | ".join(
            v for v in (biz.get("business_phone"), biz.get("business_email"), biz.get("business_address"))
            if v
        )
        if info:
            self.set_font("seg", "", 8)
            self.set_xy(90, 10)
            self.multi_cell(106, 4, info, align="R")
        footer = biz.get("document_footer")
        self.set_draw_color(*BRAND)
        self.set_line_width(0.5)
        self.line(14, 24, 196, 24)
        self.set_y(27)
        if footer:
            self.set_page(1, 0)
            self.set_y(-22)
            self.set_font("seg", "", 8)
            self.set_text_color(*MUTED)
            self.multi_cell(0, 4, footer, align="C")
            self.set_y(27)

    @staticmethod
    def LOGO_PATH_exists() -> bool:
        return LOGO_PATH.is_file()

    def footer(self):
        self.set_y(-14)
        self.set_font("seg", "", 8)
        self.set_text_color(*MUTED)
        self.cell(0, 6, f"Sayfa {self.page_no()}/{{nb}}", align="R")

    def banner(self, text: str):
        self.set_font("seg", "B", 11)
        self.set_text_color(*BRAND)
        self.cell(0, 8, text, new_x="LMARGIN", new_y="NEXT")
        self.ln(1)

    def kv_table(self, rows: list[tuple[str, str]]):
        self.set_draw_color(*LINE)
        self.set_line_width(0.2)
        for label, value in rows:
            self.set_font("seg", "B", 9.5)
            self.set_text_color(*MUTED)
            self.set_fill_color(246, 245, 244)
            self.cell(55, 7, label, border=1, fill=True)
            self.set_font("seg", "", 9.5)
            self.set_text_color(*TEXT)
            self.multi_cell(0, 7, value if value else "—", border=1, new_x="LMARGIN", new_y="NEXT")

    def table(self, headers: list[str], rows: list[list[str]], widths: list[float] | None = None):
        if not rows:
            self.set_font("seg", "", 9)
            self.set_text_color(*MUTED)
            self.cell(0, 6, "Kayıt yok", new_x="LMARGIN", new_y="NEXT")
            return
        self.set_font("seg", "B", 9)
        self.set_fill_color(246, 245, 244)
        self.set_draw_color(*LINE)
        usable = 182
        w = widths or [usable / len(headers)] * len(headers)
        for h, cw in zip(headers, w):
            self.cell(cw, 7, h, border=1, fill=True)
        self.ln()
        self.set_font("seg", "", 9)
        self.set_text_color(*TEXT)
        for row in rows:
            if self.will_page_break(10):
                self.set_font("seg", "B", 9)
                for h, cw in zip(headers, w):
                    self.cell(cw, 7, h, border=1, fill=True)
                self.ln()
                self.set_font("seg", "", 9)
            for val, cw in zip(row, w):
                truncated = str(val)
                while self.get_string_width(truncated) > cw - 3 and len(truncated) > 1:
                    truncated = truncated[:-2] + "…"
                self.cell(cw, 7, truncated, border=1)
            self.ln()

    def totals(self, rows: list[tuple[str, str]], bold_last: bool = True):
        self.ln(2)
        for i, (label, value) in enumerate(rows):
            bold = bold_last and i == len(rows) - 1
            self.set_font("seg", "B" if bold else "", 9.5)
            self.set_text_color(*TEXT)
            self.cell(95, 6.5, label, align="R")
            self.cell(40, 6.5, value, align="R", new_x="LMARGIN", new_y="NEXT")


def tl(kurus: int | float | None) -> str:
    if kurus is None:
        return "—"
    value = kurus / 100
    s = f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{s} TL"


def tr_date(value: datetime) -> str:
    return value.strftime("%d.%m.%Y %H:%M")
