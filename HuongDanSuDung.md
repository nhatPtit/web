
> ### Thông tin đăng nhập cho Local
- `git config --global user.email "email-cua-ban@gmail.com"`
- `git config --global user.name "Ten Cua Ban"`
- `git config --global user.email    : Kiểm tra emai`

#### Link URL
- `git remote -v` Hiện  URL của repo.
- `git remote remove origin` Xóa liên kết hiện tại
- `git remote add origin URL` Liên kết lần đầu, chưa có origin
- `git remote set-url origin <URL_MOI>` Đổi liên kết

### Khái niệm
- `origin`: Tên mặc định của kho lưu trữ từ xa trên GitHub mà bạn đã kết nối.
*cần các lệnh này để commit và push*

> ### `git init`
- *Tạo repo trên máy, ngay tại folder đang đứng.*
- *Nó sẽ tạo ra file .git để quản lý, tương đương với tạo repo bằng tay trên github.*
- *Gộp 2 repo khá khó hiểu nên chỉ chọn 1 trong 2 cách tạo repo: hoặc là github hoặc là git init.*
- **nếu tạo repo trên github thì liên kết bằng lệnh: git clone url, lệnh này tải và liên kết tới repo**


> ## Các bước đẩy code lên, hoặc gửi repo lên github:
#### `1.git status`
*Những file đã sửa và chưa add/commit*
#### `2.git add .`
*Add tất cả file đã chỉnh sửa vào 'khu vực' chuẩn bị commit có thể add từng file thay cho dấu .*
#### `3.git commit -m "Mô tả cho lần commit đó"`
*Gần giống gửi nhưng chưa gửi*
#### `4.git remote add origin url`
*Kết nối đến repo trên github, nếu dùng lệnh git clone url bên trên rồi thì không cần*
#### `5. git push`
*Đẩy code lên thật, bước cuối cùng rồi*
- *Lệnh đầy đủ: git push origin brand_name  (origin là link repo, brand_name là tên nhánh)*
- *`git push -u origin main` Nếu lần đầu push*
### Trường hợp máy bị thiếu commit so với github
- `git stash` Đưa code chưa commit vào vùng an toàn.
- `git pull --rebase origin main`  Đặt commit sắp tới lưu trên máy sau commit thằng mới nhất trên github.
- `git stash pop` Lấy code ra khỏi vùng an toàn sau đó chạy thử xem có xung đột không.

Nếu tự tin code an toàn thì có thể:
- `git add .`
- `git commit -m ""` commit đã an toàn cho code của mình rồi.
- `git pull --rebase origin main` tải về sau đó gộp và nối lịch sử commit trên máy sau lịch sử repo
- `git push`
> ## Các bước tải code về:

#### `1.git pull`
- *Chỉ tải những chỗ thay đổi rồi đồng bộ với máy*
- Tương đương với `git fetch` và `git merge`
- *`git pull origin main --allow-unrelated-histories`* Tải code về không gộp lịch sử.


> # Một số lệnh khác:
### `git clone url`
- Tải tất cả file trong repo về máy, các file trong .gitignore sẽ không tải về.
- Nguyên một dự án hoàn toàn mới, chỉ nên dùng lần đầu vì nó không đồng bộ dự án đang chạy.

### Xóa trên git
`git rm -r --cached Ten_Folder` xóa mạnh hơn: git rm -r --cached -f node_modules
`git commit -m "Remove folder"` 
`git push origin <ten_branch>`

### `git reflog`
Xem lịch sử commit, thoát nhấn q
### git bracnh
- Liệt kê các nhánh, nhánh đang đứng màu xanh.
- Học tiếp về branch:
    - https://youtu.be/GuVpL2NtLoU?si=D5bZTwtowH9xAqed
    - https://youtu.be/PtQCEZFk7OE?si=26Ui0h0XKK-jVSUY
    - https://youtu.be/2kXtUnsjuVw?si=8W39X44WWU-fdoRK




