# GOZEL TEKNİK

Teknik servis işletmeleri için yerel servis yönetim yazılımı.
GOZEL SOFTWARE tarafından geliştirilmektedir.

## Amaç

Bilgisayar, dizüstü, telefon ve tablet gibi elektronik cihazları tamir eden
işletmelerin müşteri, cihaz, servis, stok ve tahsilat süreçlerini tek yerden
yönetmesini sağlar. Girişsiz çalışır; yerel bilgisayar ve yerel ağ kullanımı
için tasarlanmıştır, internete açılmaz.

## Temel özellikler

- **Müşteri ve cihaz yönetimi:** benzersiz numaralar, arama/filtreleme,
  pasife alma (fiziksel silme yok), müşteri-cihaz ilişkileri.
- **Servis kabulü ve takip:** `GT-YYYY-NNNNN` numaralı servis kayıtları,
  8 durumlu iş akışı (kabul → teşhis → parça/onarım → teslim → kapatma),
  durum geçmişi, teşhis ve onarım işlem kayıtları.
- **Stok yönetimi:** yedek parça kataloğu, kuruş bazlı fiyatlar, stok
  hareketleri (alım/sayım/servis kullanımı/iade), düşük stok uyarıları.
- **Finans:** işçilik/parça/ek hizmet kalemleri, indirim, kuruş bazlı
  backend hesaplaması, kısmi/tam tahsilat, iade ve iptal izleme,
  alacak takibi.
- **Belgeler:** yazdırılabilir servis kabul/teslim belgeleri (A4),
  gerçek PDF indirme (fpdf2), CSV rapor dışa aktarma.
- **Raporlar:** servis, stok ve tahsilat raporları; tarih aralığı ve
  filtreler; PDF + CSV çıktı.
- **Dashboard:** gerçek verilerden hesaplanan aktif servis, stok uyarıları,
  dönem tahsilatı ve alacak özeti.
- **İşlem geçmişi (audit log):** önemli veri değişikliklerinin düzenlenemez
  kaydı.
- **Ayarlar, yedekleme, geri yükleme:** işletme bilgileri (belgelerde
  kullanılır), SQLite backup API ile tutarlı yedekler, doğrulamalı ve
  güvenlik yedekli geri yükleme.

## Teknoloji

| Katman     | Teknoloji                            |
| ---------- | ------------------------------------ |
| Frontend   | React 18, TypeScript, Vite          |
| Backend    | Python, FastAPI, SQLAlchemy         |
| Veritabanı | SQLite (yalnızca backend erişir)    |
| PDF        | fpdf2                                |
| Test       | pytest (backend), Vitest (frontend) |

## Kurulum (Windows)

Gereksinimler: **Python 3.12+**, **Node.js 20+**.

```bat
cd backend
python -m venv .venv
.venv\Scripts\pip install -r requirements.txt

cd ..\frontend
npm install
```

## Başlatma ve durdurma

```bat
start.bat
```

- Backend ve Vite'i **ayrı görünür CMD pencerelerinde** başlatır; loglar
  bu pencerelerde kalır. Arayüz: `http://127.0.0.1:5173` (Vite hazır
  olunca tarayıcı açılır), API: `http://127.0.0.1:8600`.
- Çalışan kopya varsa ikinci örnek başlatmaz.

```bat
stop.bat
```

- Yalnızca `start.bat`'ın kaydettiği süreçleri (PID dosyası + komut satırı
  doğrulaması ile) ağaç olarak durdurur; başka programlara dokunmaz.

## Yerel ağ erişimi

Ana bilgisayarın IP'sini (`ipconfig`) öğrenip aynı ağdaki diğer
bilgisayarlardan `http://<IP>:5173` ile erişilebilir. Uygulama internete
açılacak şekilde tasarlanmamıştır; router'da port yönlendirmesi yapmayın.

## Veritabanı yedekleme ve geri yükleme

Ayarlar → Yedekleme bölümünden:

- **Yeni Yedek Oluştur:** SQLite backup API ile tutarlı kopya alır
  (`backend/data/backups/`), bütünlük kontrolü yapar ve listeler.
- **İndir:** yedeği `.db` dosyası olarak indirir.
- **Geri Yükle:** yüklenen dosyayı doğrular (SQLite geçerliliği + şema
  uyumu), otomatik güvenlik yedeği alır ve atomik biçimde geri yükler.
  Veri kaybı riskine karşı açık uyarı gösterir.

## Testler

Testler **gerçek veritabanından tamamen ayrı** geçici SQLite dosyalarında
çalışır (bkz. `backend/tests/conftest.py`); gerçek veriler değişmez.

```bat
cd backend && pytest
cd frontend && npm test
```

## Bilinen kısıtlamalar

- Resmî fatura, e-Fatura/e-Arşiv ve GİB entegrasyonu yoktur; finans
  modülü iç takip amaçlıdır.
- Kullanıcı girişi/rol sistemi yoktur (yerel ağ kullanımı varsayılır).
- PDF yazı tipi Windows Segoe UI'ya bağlıdır; başka işletim sisteminde
  font yolu proje içine eklenmelidir.
- Fiziksel yazıcıda baskı testi yapılmamıştır.
- Veritabanı şema geçişi `create_all` + hafif kolon migration'ı ile yapılır
  (Alembic kullanılmaz).
