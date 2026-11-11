# BINGO PARTY ONLINE

Game Bingo 25 / Bingo 75 cho 2–4 người, song ngữ Việt/Trung, phòng chơi riêng và đồng bộ Socket.IO.

## Chạy trên máy

Cài Node.js 18+ rồi chạy:

```bash
npm install
npm start
```

Mở http://localhost:3000. Để kiểm tra nhiều người, mở nhiều cửa sổ hoặc nhiều thiết bị truy cập cùng địa chỉ máy chủ.

## Đưa lên GitHub và Render

1. Tạo GitHub repository mới, sau đó trong thư mục dự án chạy:

```bash
git init
git add .
git commit -m "Bingo Party Online V1"
git branch -M main
git remote add origin https://github.com/USERNAME/REPOSITORY.git
git push -u origin main
```

2. Trên Render chọn **New > Web Service**, kết nối repository.
3. Runtime **Node**, Build Command `npm install`, Start Command `npm start`.
4. Chờ Render cung cấp đường link `.onrender.com`, mở link trên các thiết bị để chơi cùng nhau.

Lưu ý: bản V1 lưu phòng trong RAM; khi server restart sẽ mất phòng và trận hiện tại. Nên dùng một instance Render; nếu scale nhiều instance cần Redis adapter và lưu trạng thái chung. Render miễn phí có thể ngủ khi không hoạt động.

## Quy tắc

- Bingo 25: người chơi lần lượt gọi số, mỗi lượt 10 giây, quá hạn server tự chọn. Số gọi được tự đánh dấu trên tất cả bảng. 5 đường thắng.
- Bingo 75: server quay số mỗi 10 giây, người chơi tự đánh dấu số đã quay, một đường thắng.
- Cả hai: 2–4 người, tất cả sẵn sàng mới bắt đầu; rời phòng khi còn 1 người thì người đó thắng; khi còn ít nhất 2 người, game tạm dừng và tất cả phải chọn tiếp tục.
- Mất kết nối có 30 giây để quay lại bằng cùng tab; sau đó được tính là rời phòng.
