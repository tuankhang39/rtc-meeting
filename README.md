# RTC — Zoom mini FREE (2–3 người)

Chế độ **0đ**: chỉ STUN + Firebase Spark + WebRTC P2P. **Không TURN**, không Blaze.

## 1) Firebase — giữ gói miễn phí

1. Vào [console.firebase.google.com](https://console.firebase.google.com/) → **Add project**
2. Tắt Google Analytics nếu muốn (không bắt buộc)
3. **Quan trọng:** ở phần Billing / Upgrade, **đừng** nâng lên **Blaze (trả phí)**. Giữ **Spark (free)**
4. Vào **Build → Realtime Database → Create Database**
   - Region gần VN: `asia-southeast1` (Singapore) nếu có
   - Chọn **Start in test mode** (chỉ để demo local)
5. Tab **Rules** → paste nội dung file `database.rules.json` → **Publish**
6. **Project settings** (bánh răng) → **Your apps** → icon **Web** `</>`
   - Nickname: `rtc`
   - Không cần Firebase Hosting lúc này
   - Copy các field config

## 2) File `.env`

Trong thư mục project:

```bash
cp .env.example .env
```

Điền (ví dụ):

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=ten-project.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://ten-project-default-rtdb.asia-southeast1.firebasedatabase.app
VITE_FIREBASE_PROJECT_ID=ten-project
VITE_FIREBASE_STORAGE_BUCKET=ten-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abcdef
```

`DATABASE_URL` lấy đúng từ trang Realtime Database (có `-default-rtdb...`).

## 3) Chạy app

```bash
npm install
npm run dev
```

Mở URL Vite (thường `http://localhost:5173`):

1. Nhập tên → **Tạo phòng**
2. **Copy link** → mở tab/máy 2 → cho phép camera/mic
3. Tối đa 3 người

Dùng **WiFi nhà** là ổn nhất.

## 4) Đã tắt những gì có thể tốn tiền

| Thứ | Trạng thái |
|---|---|
| TURN server | **Không có** trong code |
| Firebase Blaze | **Bạn không nâng cấp** |
| Video qua Firebase | **Không** — chỉ signaling nhỏ |
| Cloud Functions / Storage upload video | **Không dùng** |

App chỉ dùng STUN Google free. Không P2P được → cuộc gọi fail, **không** tự trả phí relay.

## 5) Kiểm tra đang free

- Firebase Console → góc trái: plan phải là **Spark** / không thấy billing card
- Code: `src/lib/webrtc.ts` chỉ có `stun:` — không có `turn:` / `turns:`
- Chrome: mở `chrome://webrtc-internals` lúc đang gọi → candidate thường là `host` hoặc `srflx` (P2P), không có `relay`

## 6) Deploy Vercel (CI/CD free)

Luồng: **GitHub ↔ Vercel** — mỗi lần `git push` lên `main` là Vercel tự build + deploy.

### Bước A — Đẩy code lên GitHub

Trong thư mục project:

```bash
git init
git add .
git commit -m "Initial RTC pink call app"
```

Tạo repo trống trên [github.com/new](https://github.com/new) (Public hoặc Private).

Rồi nối remote (đổi `YOUR_USER` / `rtc`):

```bash
git branch -M main
git remote add origin https://github.com/YOUR_USER/rtc.git
git push -u origin main
```

> `.env` đã nằm trong `.gitignore` — **không** đẩy secret lên GitHub.

### Bước B — Import project vào Vercel

1. Vào [vercel.com](https://vercel.com) → đăng nhập bằng **GitHub**
2. **Add New… → Project** → chọn repo `rtc` → **Import**
3. Framework: Vite (hoặc để auto). Build:
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. **Environment Variables** → thêm từng dòng từ file `.env` local:

| Name | Value |
|---|---|
| `VITE_FIREBASE_API_KEY` | (từ `.env`) |
| `VITE_FIREBASE_AUTH_DOMAIN` | … |
| `VITE_FIREBASE_DATABASE_URL` | … |
| `VITE_FIREBASE_PROJECT_ID` | … |
| `VITE_FIREBASE_STORAGE_BUCKET` | … |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | … |
| `VITE_FIREBASE_APP_ID` | … |

Chọn môi trường **Production** (và Preview nếu muốn).

5. **Deploy**

Xong sẽ có URL kiểu: `https://rtc-xxxx.vercel.app`

### Bước C — CI/CD hoạt động thế nào

```
code đổi → git push origin main
              ↓
         GitHub webhook
              ↓
         Vercel build (npm run build)
              ↓
         Deploy Production (tự động)
```

- Push `main` → deploy production
- Mở Pull Request → Vercel tạo **Preview URL** (free)

### Sau khi deploy

1. Mở URL Vercel → tạo phòng (login `admin` / `110422`)
2. Copy link share cho người khác
3. HTTPS của Vercel → camera / mic / share screen chạy được

### Lưu ý free

- Vercel Hobby: free
- Firebase Spark: free (signaling)
- Không cần Blaze / TURN cho demo nhà

## Lưu ý

- Test mode rules **mở** — chỉ dùng demo, đừng share link công khai lâu dài
- Mạng công ty / VPN có thể không nối được (vì không có TURN) — đó là trade-off để **0đ**
- Họp bao lâu cũng được; Firebase không cắt kiểu Zoom 40 phút
- Host login nằm trong frontend (demo) — không phải bảo mật production
