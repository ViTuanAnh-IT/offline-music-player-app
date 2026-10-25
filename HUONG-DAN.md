# Hướng dẫn cài "Nhạc của tôi" (từng bước)

Làm theo thứ tự trên **máy tính**. Tổng cộng khoảng 20–30 phút, chỉ làm một lần.

Cách app hoạt động: bạn upload mp3 trên máy tính → nhạc nằm trong kho riêng trên Supabase (có mật khẩu) → iPhone tự tải nhạc về máy → nghe offline, tắt màn hình vẫn phát.

> Lưu ý: giao diện Supabase và Cloudflare đôi khi đổi tên menu. Nếu không thấy đúng chữ trong hướng dẫn, hãy tìm mục có ý nghĩa tương tự hoặc nhắn mình, mình chỉnh lại.

---

## Bước 1. Tạo tài khoản và dự án Supabase

1. Vào **supabase.com** → **Start your project** → đăng ký (bằng GitHub hoặc email).
2. Bấm **New project**.
   - **Name:** `nhac-cua-toi` (tùy ý)
   - **Database password:** đặt một mật khẩu và lưu lại (app không dùng, nhưng Supabase bắt buộc)
   - **Region:** chọn **Southeast Asia (Singapore)** cho gần Việt Nam
   - Gói **Free**
3. Bấm **Create new project** rồi đợi 1–2 phút cho đến khi dự án sẵn sàng.

## Bước 2. Tạo kho nhạc (chạy đoạn SQL có sẵn)

1. Ở menu bên trái, chọn **SQL Editor** → **New query**.
2. Mở file **`setup.sql`** (nằm cạnh file hướng dẫn này) bằng Notepad, chọn hết, sao chép.
3. Dán vào ô SQL Editor rồi bấm **Run**.
4. Thấy thông báo **Success** là xong. (Nếu báo lỗi, chụp màn hình gửi mình.)

Bước này tạo sẵn bảng danh sách bài, bảng playlist, và kho chứa file mp3 riêng tư tên `music`.

## Bước 3. Lấy địa chỉ và khóa của dự án

1. Trong dự án Supabase, bấm nút **Connect** ở thanh trên cùng (hoặc vào **Project Settings** → **API Keys**).
2. Chép lại 2 thứ:
   - **Project URL**, dạng `https://abcdxyz.supabase.co`
   - **Publishable key**, dạng `sb_publishable_...`
     (Nếu chỉ thấy tab "Legacy API keys" thì chép khóa **anon** cũng dùng được.)
   - Nếu chưa có publishable key, bấm **Create new API Keys** để tạo.
3. Mở file **`web/config.js`** bằng Notepad, thay hai giá trị:

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://abcdxyz.supabase.co",
  SUPABASE_KEY: "sb_publishable_...."
};
```

4. Lưu file lại. **Không** dùng khóa `secret` hay `service_role` ở đây.

## Bước 4. Tạo tài khoản đăng nhập cho riêng bạn và khóa không cho người khác đăng ký

1. Menu trái chọn **Authentication** → **Users** → **Add user** → **Create new user**.
2. Nhập email và mật khẩu của bạn (đây là tài khoản bạn dùng để đăng nhập app).
3. Tick **Auto Confirm User** rồi bấm **Create user**.
4. Khóa đăng ký mới: vào **Authentication** → **Sign In / Providers** (hoặc **Configuration**) → tìm công tắc **Allow new users to sign up** và **tắt** nó → **Save**.

Làm xong bước 4 thì chỉ mình bạn vào được kho nhạc.

## Bước 5. Đưa app lên mạng (miễn phí) bằng Cloudflare Pages

App cần địa chỉ **https** để iPhone cài được và chạy offline. Chỉ phần giao diện app được đưa lên, **nhạc của bạn không nằm ở đây**.

1. Vào **dash.cloudflare.com** và đăng ký tài khoản miễn phí.
2. Menu trái chọn **Workers & Pages** → **Create application**.
3. Chọn **Get started** ở mục tải file trực tiếp (**Drag and drop your files**; nếu thấy tên **Pages** → **Direct Upload** thì chọn nó).
4. Đặt tên dự án, ví dụ `nhac-cua-toi-ten-ban` (tên này thành địa chỉ web của bạn, nên đặt khó đoán một chút).
5. Kéo cả thư mục **`web`** (đã sửa `config.js` ở bước 3) vào khung tải lên, rồi bấm **Deploy site**.
   - Chỉ kéo thư mục `web`. Hai file `setup.sql` và `HUONG-DAN.md` giữ lại trong máy bạn, không đưa lên mạng.
   - Quan trọng: `index.html` phải nằm ở **ngoài cùng** của danh sách file, không bị lồng trong một thư mục con. Nếu bị lồng, hãy mở thư mục `web`, chọn hết các file bên trong rồi kéo thả các file đó.
6. Xong sẽ có địa chỉ dạng `https://ten-du-an.pages.dev`. Mở thử trên máy tính.

> Muốn sửa gì sau này (ví dụ đổi `config.js`), vào lại dự án đó trên Cloudflare, tạo bản đưa lên mới (**Create deployment**) rồi kéo thư mục `web` mới vào.

## Bước 6. Dùng trên máy tính

1. Mở địa chỉ `https://ten-du-an.pages.dev` bằng Chrome hoặc Edge.
2. Cửa sổ **Tài khoản** hiện ra → đăng nhập bằng email/mật khẩu ở bước 4.
3. Bấm dấu **+** (hoặc kéo thả file mp3 vào cửa sổ) để thêm nhạc. Chọn được nhiều file cùng lúc.
4. (Tùy chọn) Cài thành app: bấm biểu tượng cài đặt ở cuối thanh địa chỉ, chọn **Cài đặt**.

Gói Supabase miễn phí chứa khoảng **1 GB** nhạc và mỗi file tối đa **50 MB**.

## Bước 7. Cài lên điện thoại (Hướng dẫn này là cho Iphone)

1. Mở **Safari** (bắt buộc dùng Safari, không dùng Chrome) và vào địa chỉ `https://ten-du-an.pages.dev`.
2. **Cài ra màn hình chính trước, chưa cần đăng nhập:** bấm nút **Chia sẻ** (hình ô vuông có mũi tên lên) → kéo xuống chọn **Thêm vào Màn hình chính** → **Thêm**. (iPhone tách riêng dữ liệu của Safari và của app đã cài, nên làm bước này trước để nhạc không phải tải hai lần.)
3. Mở app bằng **biểu tượng mới trên màn hình chính**, đăng nhập bằng email/mật khẩu ở bước 4. Nhạc từ máy tính sẽ **tự tải về máy**. Nên dùng Wi-Fi vì dung lượng khá lớn, và đợi thanh tiến độ chạy xong.
4. **Từ giờ luôn mở app bằng biểu tượng này**, không mở bằng Safari nữa.
5. Thử nghe: bấm một bài, **khóa màn hình** → nhạc vẫn phát, và có nút bài trước / tạm dừng / bài sau ngay trên màn hình khóa.
6. Thử chế độ máy bay: bật chế độ máy bay rồi mở app, nhạc vẫn nghe bình thường.

## Cách dùng hằng ngày

| Việc | Cách làm |
|---|---|
| Thêm bài mới | Trên máy tính: dấu **+** hoặc kéo thả file |
| Lấy bài mới về iPhone | Mở app khi có mạng → tự đồng bộ. Hoặc bấm nút **↻** |
| Phát ngẫu nhiên | Nút hai mũi tên bắt chéo ở thanh phát (sáng màu cam là đang bật) |
| Tạo playlist | Tab **Playlist** → **Tạo playlist**, sau đó **Thêm bài** |
| Thêm 1 bài vào playlist | Bấm dấu **⋮** bên phải bài → **Thêm vào playlist** |
| Xóa bài khỏi kho | Bấm **⋮** → **Xóa khỏi kho nhạc** (xóa trên mọi thiết bị, cần có mạng) |
| Phím tắt (máy tính) | Space = phát/tạm dừng, mũi tên phải/trái = bài sau/trước |

## Một số lưu ý về iPhone

- Phát khi tắt màn hình chạy được, nhưng đây là app web chứ không phải app gốc của Apple. Đôi khi sau cuộc gọi hoặc khi một app khác chiếm loa, nhạc bị dừng và bạn cần bấm phát lại.
- Nên mở app bằng biểu tượng ở màn hình chính thỉnh thoảng cho chắc. App có xin iPhone giữ dữ liệu lâu dài, nhưng iPhone là bên quyết định cuối cùng.
- Trong **Cài đặt iPhone** nhớ **không** xóa dữ liệu website của app này. Xóa app khỏi màn hình chính cũng xóa hết nhạc đã tải trong máy (nhạc trên kho Supabase vẫn còn, đăng nhập lại là tải về).
- Muốn app tự cập nhật bản mới: sau khi bạn đưa bản mới lên Cloudflare, mở app **hai lần** là thấy bản mới.

## Nếu gặp lỗi

| Hiện tượng | Cách xử lý |
|---|---|
| "Could not find the table ..." | Chưa chạy `setup.sql` ở bước 2 (hoặc chạy lỗi). Chạy lại. |
| "Sai email hoặc mật khẩu" | Kiểm tra bước 4; mật khẩu phân biệt hoa thường. |
| Cửa sổ báo chưa điền config | Bước 3: sửa `config.js` rồi đưa lại lên Cloudflare (bước 5). |
| Upload báo lỗi "row-level security" | Chưa chạy hết `setup.sql`, hoặc chưa đăng nhập. |
| File quá lớn | Gói miễn phí tối đa 50 MB mỗi file. |
| iPhone không thấy bài mới | Có mạng không? Bấm **↻**. Nếu vẫn không, mở cửa sổ tài khoản (biểu tượng người) xem còn đăng nhập không. |
| Nhạc không phát khi tắt màn hình | Chắc chắn đang mở app từ **biểu tượng màn hình chính** (không phải Safari). Thử tăng âm lượng, và bấm phát lại một lần từ màn hình khóa. |


