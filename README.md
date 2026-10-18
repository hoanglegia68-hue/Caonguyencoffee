# Cao Nguyên Vina Coffee ERP

Giao diện quản lý quán, đi tuyến, đơn hàng, thanh toán, KPI và báo cáo. Frontend dùng React/Vite; Google Sheets là database; Google Apps Script là API và xử lý Google Drive; Vercel cung cấp hosting và proxy API.

## 1. Chạy frontend

```bash
npm install
npm run dev
```

Nếu chạy local trực tiếp với Apps Script, tạo `.env.local`:

```env
VITE_APPS_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

Nếu không thiết lập URL, giao diện vẫn chạy với trạng thái rỗng và không tự tạo dữ liệu giả.

## 2. Thiết lập Google Apps Script

1. Mở Google Sheets database đã được cung cấp.
2. Vào **Extensions → Apps Script** hoặc tạo một Apps Script độc lập.
3. Chép nội dung `apps-script/Code.gs` vào dự án Apps Script.
4. Đặt timezone dự án là `Asia/Ho_Chi_Minh`.
5. Chạy hàm `initializeSchema` một lần để tạo các tab và hàng tiêu đề. Hàm này không tạo dữ liệu mẫu.
6. Cấp quyền cho Google Sheets và thư mục Google Drive.
7. Deploy → New deployment → Web app, chọn **Execute as me** và **Who has access: Anyone** để proxy Vercel gọi được API. Sao chép URL kết thúc bằng `/exec`, không dùng URL `/dev`.

### Tạo tài khoản đăng nhập trong tab `USERS`

Sau khi chạy `initializeSchema`, nhập một dòng cho mỗi người dùng. Các cột chính:

```text
user_id | email | full_name | role | phone | active | username | password | password_hash | password_salt
```

Ví dụ:

```text
U001 | admin@caonguyen.vn | Quản trị hệ thống | admin | | TRUE | admin | matkhau-admin |
U002 | sales01@caonguyen.vn | Nguyễn Văn A | sales | | TRUE | sales01 | matkhau-sales |
U003 | ketoan@caonguyen.vn | Kế toán | accountant | | TRUE | ketoan01 | matkhau-ketoan |
```

`role` nhận `admin`, `sales` hoặc `accountant`/`kế toán`. Tài khoản Sales chỉ thấy dữ liệu quán, đơn hàng, KPI và tuyến của chính mình. Tài khoản Kế toán chỉ thấy Menu Thanh toán. Không gửi mật khẩu lên GitHub; chỉ người quản trị được quyền xem tab `USERS`.

Tài khoản cũ có thể nhập mật khẩu tạm thời ở cột `password` để đăng nhập lần đầu. Sau khi đăng nhập thành công, hệ thống tự chuyển sang `password_hash` + `password_salt` và xóa mật khẩu rõ trong sheet. Từ lần sau không cần nhập lại cột `password`.

## 3. Thiết lập Vercel

Tạo biến môi trường Production:

```env
APPS_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

Sau đó redeploy. Frontend gọi `/api/apps-script`, còn Vercel proxy chuyển request đến Apps Script; vì vậy URL Apps Script không cần đưa vào bundle trình duyệt.

## 4. Quyền và dữ liệu

- Đăng nhập dùng `username` hoặc `email` và `password` trong tab `USERS`.
- Phiên đăng nhập chỉ lưu trong tab trình duyệt hiện tại và tự hết hạn sau 2 giờ; không lưu token vào Git, URL hoặc log nghiệp vụ.
- Giá trị đơn hàng, quyền người dùng và trạng thái thanh toán được Apps Script kiểm tra/tính lại ở backend; không tin dữ liệu quyết định từ frontend.
- Các tab nghiệp vụ gồm `SHOPS`, `VISITS`, `ORDERS`, `PAYMENTS`, `KPI_DEFINITIONS`, `KPI_TARGETS`, `KPI_RECORDS`.
- KPI có thể tạo mới và giao cho từng Sales theo chu kỳ ngày/tuần/tháng, với phép tính `SUM`, `COUNT`, `AVG`, `DISTINCT_COUNT` hoặc `MANUAL`.
- Ảnh quán được lưu trong thư mục Drive gốc theo thư mục con `[MA_QUAN]_[TEN_QUAN]`; Menu Danh sách quán hiển thị thumbnail nhỏ và liên kết mở ảnh thật sau khi lưu.
- Thư mục Drive gốc đang dùng là thư mục đã cấu hình trong `apps-script/Code.gs`; không cần mở thư mục từ giao diện.
- GPS dạng `10.989.025` được chuẩn hóa thành `10.989025` trước khi tính khoảng cách và tạo liên kết Google Maps.
- GPS được lấy tại Menu Danh sách quán và khóa sau khi lưu. Admin có nút **Cấp sửa GPS**; quyền chỉ dùng được cho một lần cập nhật rồi tự khóa lại.
- Sales có nút **Xin sửa GPS** khi GPS đã khóa; Admin phê duyệt yêu cầu tại Danh sách quán. Sau khi Sales lưu GPS mới, quyền tự khóa lại.
- Ảnh quán mới được cấp quyền xem bằng liên kết để thumbnail hiển thị được trên điện thoại; người dùng cần triển khai lại Apps Script sau khi cập nhật mã.
- Ảnh chỉ nhận JPG/PNG/WebP và phải được nén trước khi gửi; Apps Script từ chối data URL không hợp lệ hoặc quá lớn.
- Menu Đi tuyến chỉ có check-in. Check-in hợp lệ khi khoảng cách tới GPS quán không quá 50 m và được dùng để tính KPI tuyến.
- Các thông tin nhạy cảm không được đặt trong frontend hoặc commit vào Git.

## 5. Phân quyền an toàn

Apps Script cấp token phiên sau khi đăng nhập và kiểm tra quyền ở backend; frontend chỉ ẩn menu, không phải lớp bảo mật duy nhất. Nếu thay đổi mã Apps Script, phải cập nhật deployment Web App và giữ URL `/exec` trong biến bí mật `APPS_SCRIPT_URL` trên Vercel.

## 6. Kiểm tra

```bash
npm run build
```

Trước khi sử dụng thật, kiểm tra quyền GPS/camera trên điện thoại, quyền Apps Script đối với Sheet/Drive và hạn mức miễn phí của Google Apps Script/Vercel.

Sau mỗi lần cập nhật `apps-script/Code.gs`, cần tạo deployment version mới của Web app rồi kiểm tra lại một lần đăng nhập, tạo đơn, xác nhận thanh toán, check-in và tải ảnh. Biến `APPS_SCRIPT_URL` chỉ đặt trong Vercel Environment Variables, không commit vào GitHub.
