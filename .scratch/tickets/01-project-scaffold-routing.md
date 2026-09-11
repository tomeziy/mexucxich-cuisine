# 01: Khởi tạo Project Vite + React + Tailwind & Cấu trúc Routing

**What to build:** Dự án React chạy được (`npm run dev`), routing 5 màn hình chính (POS, Quản lý Sản phẩm, Báo cáo, Khách hàng & Công nợ, Cài đặt Hóa đơn) với thanh menu chuyển trang. Layout theo Variant C (Mobile-First, danh sách compact, tab trạng thái phía trên, giỏ hàng Bottom Sheet trên mobile) với responsive desktop 2 cột. Bảng màu Vàng Mật Ong / Trắng, font Plus Jakarta Sans. Khởi tạo LocalStorage store wrapper với mock data (8 Sản phẩm, 4 Khách hàng bao gồm 1 KH có Dư nợ). Chạy `npm run build` tạo `dist/` deploy được.

**Blocked by:** None (can start immediately).

**Status:** completed

- [x] `npm create vite` + React + TypeScript + Tailwind CSS 4 + Lucide React icons
- [x] React Router v7 với 5 route: `/`, `/products`, `/reports`, `/customers`, `/settings`
- [x] Thanh menu sidebar (desktop) hoặc bottom tab bar (mobile) chuyển trang
- [x] Layout component Variant C responsive (Mobile-First compact list + Desktop 2-col split)
- [x] Bảng màu Vàng/Trắng (`#F59E0B`, `#D97706`, `#FFFFFF`, `#F8FAFC`), font Plus Jakarta Sans
- [x] LocalStorage wrapper: `useStore` hook cho products, customers, orders, settings
- [x] Mock data khởi tạo: 8 Sản phẩm (emoji thumbnail, giá, danh mục, tồn kho), 4 Khách hàng (1 có Dư nợ 250k, 1 có Dư nợ 1.45tr)
- [x] `npm run build` xuất `dist/` thành công, không lỗi TypeScript

