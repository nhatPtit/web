# web học mấy cái lệnh đã
### Thông tin đăng nhập cho Local
- git config --global user.email "email-cua-ban@gmail.com"
- git config --global user.name "Ten Cua Ban"
- git config --global user.email    : Kiểm tra emai
  
*cần các lệnh này để commit và push*
### git init
- *Tạo repo trên máy, ngay tại folder đang đứng.*
- *Nó sẽ tạo ra file .git để quản lý, tương đương với tạo repo bằng tay trên github.*
- *Gộp 2 repo khá khó hiểu nên chỉ chọn 1 trong 2 cách tạo repo: hoặc là github hoặc là git init.*
> nếu tạo repo trên github thì liên kết bằng lệnh: git clone <url>, lệnh này tải và liên kết tới repo


### Các bước đẩy code lên, hoặc gửi repo lên github
#### 1.git status
*Những file đã sửa và chưa add/commit*
#### 2.git add .
*Add tất cả file đã chỉnh sửa vào 'khu vực' chuẩn bị commit có thể add từng file thay cho dấu .*
#### 3.git commit -m "Mô tả cho lần commit đó"
*Gần giống gửi nhưng chưa gửi*
#### 4.git remote add origin <url>
*Kết nối đến repo trên github, nếu dùng lệnh git clone url bên trên rồi thì không cần*
#### 5. git push
*Đẩy code lên thật, bước cuối cùng rồi*



Các file liệt kê trong .gitignore sẽ không xuất hiện khi bạn gõ git status, không bị đưa vào git add, và sẽ không bao giờ bị push lên máy chủ (như GitHub).

git clone --depth 1 <url>: Nếu chỉ cần mã nguồn để làm việc hoặc chạy dự án mà không cần toàn bộ lịch sử quá khứ

git status  lịch sử thay đổi 

git pull



git stash $\rightarrow$ Cất toàn bộ code đang làm dở đi, đưa dự án về trạng thái sạch sẽ ban đầu.

git pull $\rightarrow$ Tải code mới nhất từ server về.

git stash pop $\rightarrow$ Lấy code dở dang trong tủ ra lại để làm tiếp.
