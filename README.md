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
7. Deploy → New deployment → Web app, chọn **Execute as me**. Quyền truy cập cần phù hợp với tài khoản công ty.

## 3. Thiết lập Vercel

Tạo biến môi trường:

```env
APPS_SCRIPT_URL=https://script.google.com/macros/s/DEPLOYMENT_ID/exec
```

Sau đó deploy thư mục này lên Vercel. Frontend gọi `/api/apps-script`, còn Vercel proxy chuyển request đến Apps Script; vì vậy URL Apps Script không cần đưa vào bundle trình duyệt.

## 4. Quyền và dữ liệu

- Đưa email nhân viên vào tab `USERS` để kiểm soát quyền.
- Các tab nghiệp vụ gồm `SHOPS`, `VISITS`, `ORDERS`, `PAYMENTS`, `KPI_DEFINITIONS`, `KPI_TARGETS`, `KPI_RECORDS`.
- KPI có thể tạo mới và giao cho từng Sales theo chu kỳ ngày/tuần/tháng, với phép tính `SUM`, `COUNT`, `AVG`, `DISTINCT_COUNT` hoặc `MANUAL`.
- Hình ảnh visit được lưu trong thư mục Drive gốc theo thư mục con `[MA_QUAN]_[TEN_QUAN]`.
- Tên ảnh theo dạng `[MA_QUAN]_[TEN_QUAN_KHONG_DAU]_[YYYYMMDD]_[HHmm]_Visit.jpg`.
- Các thông tin nhạy cảm không được đặt trong frontend hoặc commit vào Git.

## 5. Phân quyền an toàn

Sau khi có người dùng trong `USERS`, Apps Script kiểm tra email tài khoản đang gọi API và vai trò `Admin`, `Sales` hoặc `Accountant`. Vì vậy không nên deploy API ở chế độ công khai rồi bỏ qua xác thực. Với công ty dùng Google Workspace, ưu tiên deploy Web App cho người dùng trong domain và cấu hình frontend gọi trực tiếp bằng `VITE_APPS_SCRIPT_URL` để Apps Script nhận diện `Session.getActiveUser()`.

## 6. Kiểm tra

```bash
npm run build
```

Trước khi sử dụng thật, kiểm tra quyền GPS/camera trên điện thoại, quyền Apps Script đối với Sheet/Drive và hạn mức miễn phí của Google Apps Script/Vercel.
