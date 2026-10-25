// Logic điều khiển giao diện Admin trên UploadPage (admin.html)
document.addEventListener('DOMContentLoaded', () => {
    // 1. Kiểm tra phiên đăng nhập và quyền Admin (Auth Guard)
    const savedUser = sessionStorage.getItem('current_user') || sessionStorage.getItem('admin_user') || localStorage.getItem('ptews_user');
    if (!savedUser) {
        window.location.href = 'index.html';
        return;
    }

    let currentUser;
    try {
        currentUser = JSON.parse(savedUser);
    } catch (e) {
        sessionStorage.removeItem('current_user');
        sessionStorage.removeItem('admin_user');
        window.location.href = 'index.html';
        return;
    }

    if (!currentUser || currentUser.VaiTro !== 'AD') {
        alert('Quyền truy cập bị từ chối: Bạn không có quyền truy cập phân hệ Quản trị Admin!');
        window.location.href = 'index.html';
        return;
    }

    // 2. Hiển thị thông tin Admin và xử lý Đăng xuất
    const adminUserName = document.getElementById('admin-user-name');
    if (adminUserName) {
        adminUserName.textContent = currentUser.full_name || currentUser.username || 'Quản trị viên';
    }

    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            sessionStorage.removeItem('current_user');
            sessionStorage.removeItem('admin_user');
            sessionStorage.removeItem('ptews_user');
            try {
                localStorage.removeItem('ptews_user');
            } catch (e) { }
            window.location.href = 'login.html';
        });
    }

    // 3. Khai báo các phần tử trong Admin Dashboard
    const searchInput = document.getElementById('admin-search-input');
    const roleFilter = document.getElementById('admin-role-filter');
    const statusFilter = document.getElementById('admin-status-filter');
    const btnRefresh = document.getElementById('btn-refresh-users');
    const usersListContainer = document.getElementById('users-list-container');
    const usersCountBadge = document.getElementById('users-count-badge');

    // Biến lưu danh sách tài khoản hiện tại đang hiển thị
    let currentLoadedUsers = [];

    // 4. Tải danh sách tài khoản ngay khi vào trang
    loadUsersList();

    // 5. Hàm tải và hiển thị danh sách tài khoản Nhà báo, Kiểm duyệt & Doanh nghiệp
    async function loadUsersList() {
        if (!usersListContainer) return;

        const keyword = searchInput ? searchInput.value.trim() : '';
        const role = roleFilter ? roleFilter.value : 'ALL';
        const status = statusFilter ? statusFilter.value : 'ALL';

        usersListContainer.innerHTML = `
            <div class="state-placeholder">
                <div class="spinner"></div>
                <p>Đang tải danh sách tài khoản...</p>
            </div>
        `;

        try {
            const params = new URLSearchParams();
            if (keyword) params.set('q', keyword);
            if (role && role !== 'ALL') params.set('role', role);
            if (status && status !== 'ALL') params.set('status', status);

            const res = await fetch(`/api/admin/users?${params.toString()}`);
            const result = await res.json();

            if (!res.ok || !result.success) {
                usersListContainer.innerHTML = `
                    <div class="state-placeholder error">
                        <p>⚠️ Không thể tải danh sách tài khoản: ${escapeHtml(result.message || 'Lỗi server')}</p>
                    </div>
                `;
                return;
            }

            const users = result.data || [];
            currentLoadedUsers = users;

            if (usersCountBadge) {
                usersCountBadge.textContent = `${users.length} tài khoản`;
            }

            if (users.length === 0) {
                usersListContainer.innerHTML = `
                    <div class="state-placeholder empty">
                        <p>🔍 Không tìm thấy tài khoản nào phù hợp với bộ lọc hiện tại.</p>
                    </div>
                `;
                return;
            }

            // Render từng hàng
            usersListContainer.innerHTML = users.map(user => renderUserRow(user)).join('');

            // Gắn sự kiện cho các nút hành động
            attachRowActionListeners();

        } catch (err) {
            console.error('Lỗi khi tải danh sách users:', err);
            usersListContainer.innerHTML = `
                <div class="state-placeholder error">
                    <p>⚠️ Lỗi kết nối khi tải dữ liệu từ máy chủ.</p>
                </div>
            `;
        }
    }

    // 6. Hàm render từng dòng tài khoản
    function renderUserRow(u) {
        let roleBadge = '';
        let roleDetail = '';
        let violationInfo = '';

        if (u.VaiTro === 'NB') {
            roleBadge = '<span class="badge-role nb">Nhà báo</span>';
            roleDetail = `<strong>Bút danh:</strong> <span style="color:#0369a1; font-weight:600;">${escapeHtml(u.ButDanh || 'Chưa đặt')}</span>`;
        } else if (u.VaiTro === 'BT') {
            roleBadge = '<span class="badge-role bt">Người kiểm duyệt</span>';
            roleDetail = `<strong>Bộ phận:</strong> Ban Biên tập & Kiểm duyệt nội dung | <strong>Họ tên:</strong> ${escapeHtml(u.full_name || '—')}`;
        } else if (u.VaiTro === 'DN') {
            roleBadge = '<span class="badge-role dn">Doanh nghiệp</span>';
            roleDetail = `<strong>Doanh nghiệp:</strong> <span style="font-weight:600;">${escapeHtml(u.company_name || '—')}</span>`;
            if (u.violation_count > 0) {
                violationInfo = `<span class="violation-tag">⚠️ Vi phạm: ${u.violation_count} lần</span>`;
            } else {
                violationInfo = `<span class="violation-tag" style="color:#15803d; background:#f0fdf4; border-color:#bbf7d0;">✓ Vi phạm: 0</span>`;
            }
        }

        let statusBadge = '';
        if (u.TrangThai === 'HoatDong') {
            statusBadge = '<span class="badge-status active">Hoạt động</span>';
        } else if (u.TrangThai === 'CanhCao' || u.TrangThai === 'HanChe') {
            statusBadge = '<span class="badge-status restricted" style="background:#fff7ed;color:#ea580c;border:1px solid #fdba74;">Cảnh cáo</span>';
        } else {
            statusBadge = '<span class="badge-status banned">Bị cấm</span>';
        }

        const createdDate = u.created_at ? new Date(u.created_at).toLocaleDateString('vi-VN') : '—';

        return `
            <div class="user-row-card" data-user-id="${u.id}">
                <div class="user-info-main">
                    <div class="user-header-line">
                        <span class="user-id">#${u.id}</span>
                        <h4 class="user-fullname">${escapeHtml(u.full_name || 'Chưa cập nhật')}</h4>
                        <span class="user-username">(@${escapeHtml(u.username)})</span>
                        ${roleBadge}
                        ${statusBadge}
                        ${violationInfo}
                    </div>
                    <div class="user-detail-line">
                        <span>${roleDetail}</span>
                    </div>
                    <div class="user-contact-line">
                        <span>📧 ${escapeHtml(u.email || '—')}</span>
                        <span>📞 ${escapeHtml(u.phone || '—')}</span>
                        <span style="color: #94a3b8;">📅 Tạo ngày: ${createdDate}</span>
                    </div>
                </div>
                <div class="user-actions-col">
                    <div class="actions-row-wrap">
                        <button type="button" class="btn-action-sm btn-action-edit" data-id="${u.id}" title="Chỉnh sửa thông tin cá nhân và liên hệ">
                            ✏️ Sửa
                        </button>
                        <button type="button" class="btn-action-sm btn-action-status" data-id="${u.id}" title="Khóa / Mở khóa tài khoản">
                            🔒 Trạng thái
                        </button>
                    </div>
                    <div class="actions-row-wrap">
                        ${u.VaiTro === 'DN' ? `
                        <button type="button" class="btn-action-sm btn-action-violation" data-id="${u.id}" title="Theo dõi và ghi nhận vi phạm quảng cáo">
                            ⚠️ Vi phạm (${u.violation_count})
                        </button>` : ''}
                        <button type="button" class="btn-action-sm btn-action-delete" data-id="${u.id}" data-name="${escapeHtml(u.full_name || u.username)}" title="Xóa tài khoản an toàn theo quy tắc bảo toàn dữ liệu">
                            🗑️ Xóa
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // 7. Gắn sự kiện cho các nút hành động trên từng dòng
    function attachRowActionListeners() {
        // Nút SỬA
        document.querySelectorAll('.btn-action-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.getAttribute('data-id'), 10);
                const user = currentLoadedUsers.find(u => u.id === id);
                if (user) openEditUserModal(user);
            });
        });

        // Nút KHÓA / ĐỔI TRẠNG THÁI
        document.querySelectorAll('.btn-action-status').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.getAttribute('data-id'), 10);
                const user = currentLoadedUsers.find(u => u.id === id);
                if (user) openStatusModal(user);
            });
        });

        // Nút VI PHẠM (chỉ có ở DN)
        document.querySelectorAll('.btn-action-violation').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = parseInt(e.currentTarget.getAttribute('data-id'), 10);
                const user = currentLoadedUsers.find(u => u.id === id);
                if (user) openViolationModal(user);
            });
        });

        // Nút XÓA AN TOÀN
        document.querySelectorAll('.btn-action-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const id = parseInt(e.currentTarget.getAttribute('data-id'), 10);
                const userName = e.currentTarget.getAttribute('data-name');
                await handleDeleteUser(id, userName);
            });
        });
    }

    // 8. Bắt sự kiện tìm kiếm và lọc
    let debounceTimer = null;
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                loadUsersList();
            }, 300);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(debounceTimer);
                loadUsersList();
            }
        });
    }

    if (roleFilter) {
        roleFilter.addEventListener('change', () => loadUsersList());
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', () => loadUsersList());
    }

    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => loadUsersList());
    }

    // =========================================================================
    // 9. XỬ LÝ CHUYỂN ĐỔI TAB & TẠO TÀI KHOẢN MỚI TRỰC TIẾP TRÊN MÀN HÌNH
    // =========================================================================
    const tabListUsers = document.getElementById('tab-list-users');
    const tabCreateUser = document.getElementById('tab-create-user');
    const usersViewList = document.getElementById('users-view-list');
    const usersViewCreate = document.getElementById('users-view-create');
    const btnCancelCreate = document.getElementById('btn-cancel-create');
    const createUserForm = document.getElementById('create-user-form');
    const createRoleSelect = document.getElementById('create-role');
    const fieldGroupNB = document.getElementById('field-group-nb');
    const fieldGroupBT = document.getElementById('field-group-bt');
    const fieldGroupDN = document.getElementById('field-group-dn');
    const createErrorMsg = document.getElementById('create-error-msg');
    const btnSubmitCreate = document.getElementById('btn-submit-create');

    const inputButDanh = document.getElementById('create-butdanh');
    const inputCompany = document.getElementById('create-company');

    function showUsersListView() {
        if (usersViewList) usersViewList.style.display = 'flex';
        if (usersViewCreate) usersViewCreate.style.display = 'none';
        if (tabListUsers) {
            tabListUsers.classList.add('active');
        }
        if (tabCreateUser) {
            tabCreateUser.classList.remove('active');
        }
        if (createErrorMsg) {
            createErrorMsg.style.display = 'none';
            createErrorMsg.textContent = '';
        }
    }

    function showCreateUserView() {
        if (usersViewList) usersViewList.style.display = 'none';
        if (usersViewCreate) usersViewCreate.style.display = 'block';
        if (tabCreateUser) {
            tabCreateUser.classList.add('active');
        }
        if (tabListUsers) {
            tabListUsers.classList.remove('active');
        }
        if (createErrorMsg) {
            createErrorMsg.style.display = 'none';
            createErrorMsg.textContent = '';
        }
        updateRoleFields();
        document.getElementById('create-fullname')?.focus();
    }

    if (tabListUsers) {
        tabListUsers.addEventListener('click', showUsersListView);
    }

    if (tabCreateUser) {
        tabCreateUser.addEventListener('click', showCreateUserView);
    }

    if (btnCancelCreate) {
        btnCancelCreate.addEventListener('click', showUsersListView);
    }

    function updateRoleFields() {
        if (!createRoleSelect) return;
        const role = createRoleSelect.value;

        if (role === 'NB') {
            if (fieldGroupNB) fieldGroupNB.style.display = 'block';
            if (fieldGroupBT) fieldGroupBT.style.display = 'none';
            if (fieldGroupDN) fieldGroupDN.style.display = 'none';
            if (inputButDanh) inputButDanh.required = true;
            if (inputCompany) inputCompany.required = false;
        } else if (role === 'BT') {
            if (fieldGroupNB) fieldGroupNB.style.display = 'none';
            if (fieldGroupBT) fieldGroupBT.style.display = 'block';
            if (fieldGroupDN) fieldGroupDN.style.display = 'none';
            if (inputButDanh) inputButDanh.required = false;
            if (inputCompany) inputCompany.required = false;
        } else if (role === 'DN') {
            if (fieldGroupNB) fieldGroupNB.style.display = 'none';
            if (fieldGroupBT) fieldGroupBT.style.display = 'none';
            if (fieldGroupDN) fieldGroupDN.style.display = 'block';
            if (inputButDanh) inputButDanh.required = false;
            if (inputCompany) inputCompany.required = true;
        }
    }

    if (createRoleSelect) {
        createRoleSelect.addEventListener('change', updateRoleFields);
    }

    if (createUserForm) {
        createUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            if (createErrorMsg) {
                createErrorMsg.style.display = 'none';
                createErrorMsg.textContent = '';
            }

            const role = createRoleSelect ? createRoleSelect.value : 'NB';
            const fullName = document.getElementById('create-fullname')?.value.trim() || '';
            const username = document.getElementById('create-username')?.value.trim() || '';
            const password = document.getElementById('create-password')?.value || '';
            const email = document.getElementById('create-email')?.value.trim() || '';
            const phone = document.getElementById('create-phone')?.value.trim() || '';
            const butDanh = inputButDanh ? inputButDanh.value.trim() : '';
            const companyName = inputCompany ? inputCompany.value.trim() : '';

            if (!fullName || !username || !password || !email || !phone) {
                showCreateError('Vui lòng điền đầy đủ các thông tin bắt buộc (*)!');
                return;
            }

            if (!/^[a-zA-Z0-9_]{3,50}$/.test(username)) {
                showCreateError('Tên đăng nhập chỉ được chứa chữ cái, chữ số, gạch dưới và từ 3 đến 50 ký tự!');
                return;
            }

            if (password.length < 6) {
                showCreateError('Mật khẩu ban đầu phải có tối thiểu 6 ký tự!');
                return;
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
                showCreateError('Địa chỉ email không đúng định dạng!');
                return;
            }

            if (!/^[0-9+()\-.\s]{9,20}$/.test(phone)) {
                showCreateError('Số điện thoại không hợp lệ (tối thiểu 9 ký tự số)!');
                return;
            }

            if (role === 'NB' && !butDanh) {
                showCreateError('Tài khoản Nhà báo bắt buộc phải nhập Bút danh tác nghiệp!');
                return;
            }

            if (role === 'DN') {
                if (!companyName) {
                    showCreateError('Tài khoản Doanh nghiệp bắt buộc phải nhập Tên công ty / Doanh nghiệp!');
                    return;
                }
            }

            if (btnSubmitCreate) {
                btnSubmitCreate.disabled = true;
                btnSubmitCreate.textContent = 'Đang lưu tài khoản...';
            }

            try {
                const payload = {
                    role,
                    full_name: fullName,
                    username,
                    password,
                    email,
                    phone,
                    but_danh: role === 'NB' ? butDanh : null,
                    company_name: role === 'DN' ? companyName : null
                };

                const res = await fetch('/api/admin/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                const data = await res.json();

                if (!res.ok || !data.success) {
                    showCreateError(data.message || 'Lỗi khi tạo tài khoản!');
                    return;
                }

                alert(`✓ ${data.message}\nTài khoản "${data.data?.username}" đã được tạo thành công.`);
                createUserForm.reset();
                showUsersListView();
                loadUsersList();

            } catch (err) {
                console.error('Lỗi khi gọi API tạo user:', err);
                showCreateError('Lỗi kết nối máy chủ khi tạo tài khoản!');
            } finally {
                if (btnSubmitCreate) {
                    btnSubmitCreate.disabled = false;
                    btnSubmitCreate.textContent = 'Lưu tài khoản';
                }
            }
        });
    }

    function showCreateError(msg) {
        if (!createErrorMsg) return;
        createErrorMsg.textContent = `⚠️ ${msg}`;
        createErrorMsg.style.display = 'block';
    }

    // =========================================================================
    // 10. XỬ LÝ CHỨC NĂNG CHỈNH SỬA THÔNG TIN TÀI KHOẢN (SỬA)
    // =========================================================================
    const editUserModal = document.getElementById('edit-user-modal');
    const editUserForm = document.getElementById('edit-user-form');
    const btnCancelEdit = document.getElementById('btn-cancel-edit');
    const btnSubmitEdit = document.getElementById('btn-submit-edit');
    const editErrorMsg = document.getElementById('edit-error-msg');

    const editUserId = document.getElementById('edit-user-id');
    const editUserRole = document.getElementById('edit-user-role');
    const editUsernameDisplay = document.getElementById('edit-username-display');
    const editRoleDisplay = document.getElementById('edit-role-display');
    const editFullname = document.getElementById('edit-fullname');
    const editEmail = document.getElementById('edit-email');
    const editPhone = document.getElementById('edit-phone');

    const editGroupNB = document.getElementById('edit-group-nb');
    const editButdanh = document.getElementById('edit-butdanh');
    const editGroupDN = document.getElementById('edit-group-dn');
    const editCompany = document.getElementById('edit-company');

    function openEditUserModal(u) {
        if (!editUserModal) return;
        if (editErrorMsg) {
            editErrorMsg.style.display = 'none';
            editErrorMsg.textContent = '';
        }

        editUserId.value = u.id;
        editUserRole.value = u.VaiTro;
        editUsernameDisplay.textContent = `@${u.username}`;

        let roleText = '';
        if (u.VaiTro === 'NB') roleText = '<span class="badge-role nb">Nhà báo (NB)</span>';
        else if (u.VaiTro === 'BT') roleText = '<span class="badge-role bt">Người kiểm duyệt (BT)</span>';
        else if (u.VaiTro === 'DN') roleText = '<span class="badge-role dn">Doanh nghiệp (DN)</span>';
        editRoleDisplay.innerHTML = roleText;

        editFullname.value = u.full_name || '';
        editEmail.value = u.email || '';
        editPhone.value = u.phone || '';

        // Hiển thị trường riêng theo vai trò
        if (u.VaiTro === 'NB') {
            if (editGroupNB) editGroupNB.style.display = 'block';
            if (editGroupDN) editGroupDN.style.display = 'none';
            if (editButdanh) {
                editButdanh.value = u.ButDanh || '';
                editButdanh.required = true;
            }
        } else if (u.VaiTro === 'DN') {
            if (editGroupNB) editGroupNB.style.display = 'none';
            if (editGroupDN) editGroupDN.style.display = 'block';
            if (editCompany) {
                editCompany.value = u.company_name || '';
                editCompany.required = true;
            }
        } else {
            if (editGroupNB) editGroupNB.style.display = 'none';
            if (editGroupDN) editGroupDN.style.display = 'none';
        }

        editUserModal.style.display = 'flex';
        editFullname.focus();
    }

    function closeEditUserModal() {
        if (!editUserModal) return;
        editUserModal.style.display = 'none';
        if (editErrorMsg) {
            editErrorMsg.style.display = 'none';
            editErrorMsg.textContent = '';
        }
    }

    if (btnCancelEdit) btnCancelEdit.addEventListener('click', closeEditUserModal);

    if (editUserForm) {
        editUserForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (editErrorMsg) {
                editErrorMsg.style.display = 'none';
                editErrorMsg.textContent = '';
            }

            const id = editUserId.value;
            const role = editUserRole.value;
            const fullName = editFullname.value.trim();
            const email = editEmail.value.trim();
            const phone = editPhone.value.trim();
            const butDanh = editButdanh ? editButdanh.value.trim() : '';
            const company = editCompany ? editCompany.value.trim() : '';

            if (!fullName || !email || !phone) {
                showEditError('Vui lòng điền đầy đủ họ tên, email và số điện thoại!');
                return;
            }

            if (role === 'NB' && !butDanh) {
                showEditError('Tài khoản Nhà báo bắt buộc phải có Bút danh tác nghiệp!');
                return;
            }

            if (role === 'DN' && !company) {
                showEditError('Tài khoản Doanh nghiệp bắt buộc phải có Tên công ty / Doanh nghiệp!');
                return;
            }

            if (btnSubmitEdit) {
                btnSubmitEdit.disabled = true;
                btnSubmitEdit.textContent = 'Đang lưu thay đổi...';
            }

            try {
                const res = await fetch(`/api/admin/users/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        full_name: fullName,
                        email,
                        phone,
                        but_danh: role === 'NB' ? butDanh : null,
                        company_name: role === 'DN' ? company : null
                    })
                });

                const data = await res.json();
                if (!res.ok || !data.success) {
                    showEditError(data.message || 'Lỗi khi cập nhật thông tin!');
                    return;
                }

                alert(`✓ ${data.message}`);
                closeEditUserModal();
                loadUsersList();

            } catch (err) {
                console.error('Lỗi khi cập nhật user:', err);
                showEditError('Lỗi kết nối máy chủ backend!');
            } finally {
                if (btnSubmitEdit) {
                    btnSubmitEdit.disabled = false;
                    btnSubmitEdit.textContent = 'Lưu thay đổi';
                }
            }
        });
    }

    function showEditError(msg) {
        if (!editErrorMsg) return;
        editErrorMsg.textContent = `⚠️ ${msg}`;
        editErrorMsg.style.display = 'block';
    }

    // =========================================================================
    // 11. XỬ LÝ CHỨC NĂNG KHÓA / MỞ KHÓA TÀI KHOẢN (TRẠNG THÁI)
    // =========================================================================
    const statusModal = document.getElementById('status-modal');
    const statusForm = document.getElementById('status-form');
    const btnCancelStatus = document.getElementById('btn-cancel-status');
    const btnSubmitStatus = document.getElementById('btn-submit-status');
    const statusErrorMsg = document.getElementById('status-error-msg');
    const statusUserId = document.getElementById('status-user-id');
    const statusUsernameDisplay = document.getElementById('status-username-display');
    const statusSelect = document.getElementById('status-select');

    function openStatusModal(u) {
        if (!statusModal) return;
        if (statusErrorMsg) {
            statusErrorMsg.style.display = 'none';
            statusErrorMsg.textContent = '';
        }

        statusUserId.value = u.id;
        statusUsernameDisplay.textContent = `${u.full_name || u.username} (@${u.username})`;
        statusSelect.value = u.TrangThai || 'HoatDong';

        statusModal.style.display = 'flex';
    }

    function closeStatusModal() {
        if (!statusModal) return;
        statusModal.style.display = 'none';
        if (statusErrorMsg) {
            statusErrorMsg.style.display = 'none';
            statusErrorMsg.textContent = '';
        }
    }

    if (btnCancelStatus) btnCancelStatus.addEventListener('click', closeStatusModal);

    if (statusForm) {
        statusForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = statusUserId.value;
            const newStatus = statusSelect.value;

            if (btnSubmitStatus) {
                btnSubmitStatus.disabled = true;
                btnSubmitStatus.textContent = 'Đang cập nhật...';
            }

            try {
                const res = await fetch(`/api/admin/users/${id}/status`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: newStatus })
                });

                const data = await res.json();
                if (!res.ok || !data.success) {
                    if (statusErrorMsg) {
                        statusErrorMsg.textContent = `⚠️ ${data.message || 'Lỗi khi đổi trạng thái!'}`;
                        statusErrorMsg.style.display = 'block';
                    }
                    return;
                }

                alert(`✓ ${data.message}`);
                closeStatusModal();
                loadUsersList();

            } catch (err) {
                console.error('Lỗi API status:', err);
                if (statusErrorMsg) {
                    statusErrorMsg.textContent = '⚠️ Lỗi kết nối máy chủ backend!';
                    statusErrorMsg.style.display = 'block';
                }
            } finally {
                if (btnSubmitStatus) {
                    btnSubmitStatus.disabled = false;
                    btnSubmitStatus.textContent = 'Cập nhật trạng thái';
                }
            }
        });
    }

    // =========================================================================
    // 12. XỬ LÝ CHỨC NĂNG THEO DÕI VI PHẠM DOANH NGHIỆP
    // =========================================================================
    const violationModal = document.getElementById('violation-modal');
    const violationForm = document.getElementById('violation-form');
    const btnCancelViolation = document.getElementById('btn-cancel-violation');
    const btnSubmitViolation = document.getElementById('btn-submit-violation');
    const violationErrorMsg = document.getElementById('violation-error-msg');
    const violationUserId = document.getElementById('violation-user-id');
    const violationCompanyDisplay = document.getElementById('violation-company-display');
    const violationCurrentCount = document.getElementById('violation-current-count');
    const violationCustomCount = document.getElementById('violation-custom-count');

    // Chuyển đổi hiển thị ô nhập số lần tùy chỉnh
    document.querySelectorAll('input[name="violation-action"]').forEach(radio => {
        radio.addEventListener('change', (e) => {
            if (violationCustomCount) {
                violationCustomCount.style.display = e.target.value === 'set' ? 'block' : 'none';
                if (e.target.value === 'set') violationCustomCount.focus();
            }
        });
    });

    function openViolationModal(u) {
        if (!violationModal) return;
        if (violationErrorMsg) {
            violationErrorMsg.style.display = 'none';
            violationErrorMsg.textContent = '';
        }

        violationUserId.value = u.id;
        violationCompanyDisplay.textContent = `${u.company_name || u.full_name} (@${u.username})`;
        violationCurrentCount.textContent = u.violation_count || 0;

        // Reset radio về mặc định (+1)
        const firstRadio = document.querySelector('input[name="violation-action"][value="increment"]');
        if (firstRadio) firstRadio.checked = true;
        if (violationCustomCount) {
            violationCustomCount.style.display = 'none';
            violationCustomCount.value = u.violation_count || 0;
        }

        violationModal.style.display = 'flex';
    }

    function closeViolationModal() {
        if (!violationModal) return;
        violationModal.style.display = 'none';
        if (violationErrorMsg) {
            violationErrorMsg.style.display = 'none';
            violationErrorMsg.textContent = '';
        }
    }

    if (btnCancelViolation) btnCancelViolation.addEventListener('click', closeViolationModal);

    if (violationForm) {
        violationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const id = violationUserId.value;
            const actionRadio = document.querySelector('input[name="violation-action"]:checked');
            const action = actionRadio ? actionRadio.value : 'increment';
            const count = violationCustomCount ? parseInt(violationCustomCount.value, 10) : 0;

            if (btnSubmitViolation) {
                btnSubmitViolation.disabled = true;
                btnSubmitViolation.textContent = 'Đang lưu...';
            }

            try {
                const res = await fetch(`/api/admin/users/${id}/violations`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action, count })
                });

                const data = await res.json();
                if (!res.ok || !data.success) {
                    if (violationErrorMsg) {
                        violationErrorMsg.textContent = `⚠️ ${data.message || 'Lỗi khi cập nhật vi phạm!'}`;
                        violationErrorMsg.style.display = 'block';
                    }
                    return;
                }

                alert(`✓ ${data.message}`);
                closeViolationModal();
                loadUsersList();

            } catch (err) {
                console.error('Lỗi API vi phạm:', err);
                if (violationErrorMsg) {
                    violationErrorMsg.textContent = '⚠️ Lỗi kết nối máy chủ backend!';
                    violationErrorMsg.style.display = 'block';
                }
            } finally {
                if (btnSubmitViolation) {
                    btnSubmitViolation.disabled = false;
                    btnSubmitViolation.textContent = 'Lưu vi phạm';
                }
            }
        });
    }

    // =========================================================================
    // 13. XỬ LÝ CHỨC NĂNG XÓA AN TOÀN (BẢO TOÀN DỮ LIỆU)
    // =========================================================================
    async function handleDeleteUser(id, userName) {
        const confirmMsg = `Bạn có chắc chắn muốn xóa tài khoản "${userName}"?\n\n` +
            `• NGUYÊN TẮC BẢO TOÀN DỮ LIỆU TÒA SOẠN:\n` +
            `- Nếu tài khoản đã có bài viết hoặc quảng cáo liên kết: Hệ thống sẽ CHẶN xóa hoàn toàn và tự động chuyển sang trạng thái [Bị cấm] để bảo tồn lịch sử dữ liệu.\n` +
            `- Chỉ xóa vĩnh viễn khi tài khoản hoàn toàn chưa phát sinh dữ liệu trong hệ thống.\n\n` +
            `Bạn có muốn tiếp tục thực hiện?`;

        if (!confirm(confirmMsg)) return;

        try {
            const res = await fetch(`/api/admin/users/${id}`, {
                method: 'DELETE'
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                alert(`⚠️ Không thể xóa: ${data.message || 'Lỗi từ máy chủ!'}`);
                return;
            }

            if (data.softDeleted) {
                alert(`ℹ️ [BẢO TOÀN DỮ LIỆU]:\n${data.message}`);
            } else {
                alert(`✓ ${data.message}`);
            }

            loadUsersList();

        } catch (err) {
            console.error('Lỗi khi gọi API xóa user:', err);
            alert('⚠️ Lỗi kết nối máy chủ khi thực hiện xóa tài khoản!');
        }
    }

    // =========================================================================
    // 14. ĐIỀU HƯỚNG CHUYỂN TAB TRÊN SIDEBAR (TÀI KHOẢN <-> BÁO GIÁ QUẢNG CÁO)
    // =========================================================================
    const menuBtnUsers = document.getElementById('menu-btn-users');
    const menuBtnAds = document.getElementById('menu-btn-ads');
    const usersMainCol = document.getElementById('users-main-col');
    const usersActionsCol = document.getElementById('users-actions-col');
    const adsMainCol = document.getElementById('ads-main-col');
    const adsActionsCol = document.getElementById('ads-actions-col');
    const btnRefreshAds = document.getElementById('btn-refresh-ads');

    const menuBtnBackup = document.getElementById('menu-btn-backup');
    const backupMainCol = document.getElementById('backup-main-col');
    const backupActionsCol = document.getElementById('backup-actions-col');
    const btnCreateBackup = document.getElementById('btn-create-backup');
    const btnRefreshBackups = document.getElementById('btn-refresh-backups');

    function switchAdminTab(tabName) {
        // Tắt active tất cả các nút
        [menuBtnUsers, menuBtnAds, menuBtnBackup].forEach(btn => btn && btn.classList.remove('active'));

        // Ẩn tất cả các cột
        [usersMainCol, adsMainCol, backupMainCol].forEach(col => col && (col.style.display = 'none'));
        [usersActionsCol, adsActionsCol, backupActionsCol].forEach(col => col && (col.style.display = 'none'));

        if (tabName === 'ads') {
            if (menuBtnAds) menuBtnAds.classList.add('active');
            if (adsMainCol) adsMainCol.style.display = 'block';
            if (adsActionsCol) adsActionsCol.style.display = 'flex';
            loadAdPositions();
            loadAdRequests();
        } else if (tabName === 'backup') {
            if (menuBtnBackup) menuBtnBackup.classList.add('active');
            if (backupMainCol) backupMainCol.style.display = 'block';
            if (backupActionsCol) backupActionsCol.style.display = 'flex';
            loadBackupsList();
        } else {
            if (menuBtnUsers) menuBtnUsers.classList.add('active');
            if (usersMainCol) usersMainCol.style.display = 'block';
            if (usersActionsCol) usersActionsCol.style.display = 'flex';
            showUsersListView();
        }
    }

    if (menuBtnUsers) {
        menuBtnUsers.addEventListener('click', () => switchAdminTab('users'));
    }

    if (menuBtnAds) {
        menuBtnAds.addEventListener('click', () => switchAdminTab('ads'));
    }

    if (menuBtnBackup) {
        menuBtnBackup.addEventListener('click', () => switchAdminTab('backup'));
    }

    if (btnRefreshAds) {
        btnRefreshAds.addEventListener('click', () => {
            loadAdPositions();
            loadAdRequests();
        });
    }

    // =========================================================================
    // 15. TẢI VÀ HIỂN THỊ 3 VỊ TRÍ QUẢNG CÁO (BANNER TOP, SIDEBAR, TRONG BÀI)
    // =========================================================================
    const adPositionsGrid = document.getElementById('ad-positions-grid');
    let loadedAdPositions = [];

    async function loadAdPositions() {
        if (!adPositionsGrid) return;

        adPositionsGrid.innerHTML = `
            <div class="state-placeholder" style="grid-column: 1 / -1;">
                <div class="spinner"></div>
                <p>Đang tải danh sách vị trí và báo giá quảng cáo...</p>
            </div>
        `;

        try {
            const res = await fetch('/api/admin/ads/positions');
            const result = await res.json();

            if (!res.ok || !result.success) {
                adPositionsGrid.innerHTML = `
                    <div class="state-placeholder error" style="grid-column: 1 / -1;">
                        <p>⚠️ Không thể tải danh sách vị trí: ${escapeHtml(result.message || 'Lỗi server')}</p>
                    </div>
                `;
                return;
            }

            const positions = result.data || [];
            loadedAdPositions = positions;

            if (positions.length === 0) {
                adPositionsGrid.innerHTML = `
                    <div class="state-placeholder empty" style="grid-column: 1 / -1;">
                        <p>🔍 Chưa có dữ liệu vị trí quảng cáo nào trong hệ thống.</p>
                    </div>
                `;
                return;
            }

            adPositionsGrid.innerHTML = positions.map(pos => renderAdPositionCard(pos)).join('');

            // Gắn sự kiện cho các nút Cập nhật báo giá
            document.querySelectorAll('.btn-update-price').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = parseInt(e.currentTarget.getAttribute('data-id'), 10);
                    const pos = loadedAdPositions.find(p => p.Id === id);
                    if (pos) openEditAdPriceModal(pos);
                });
            });

        } catch (err) {
            console.error('Lỗi khi tải vị trí quảng cáo:', err);
            adPositionsGrid.innerHTML = `
                <div class="state-placeholder error" style="grid-column: 1 / -1;">
                    <p>⚠️ Lỗi kết nối khi tải danh mục vị trí quảng cáo.</p>
                </div>
            `;
        }
    }

    function renderAdPositionCard(pos) {
        let icon = '📢';
        let badgeColor = '#e0f2fe';
        let textColor = '#0369a1';

        if (pos.Name.includes('Top')) {
            icon = '🔝';
            badgeColor = '#fef3c7';
            textColor = '#b45309';
        } else if (pos.Name.includes('Sidebar')) {
            icon = '📑';
            badgeColor = '#eff6ff';
            textColor = '#1d4ed8';
        } else if (pos.Name.includes('bài')) {
            icon = '📰';
            badgeColor = '#f0fdf4';
            textColor = '#15803d';
        }

        const formattedPrice = new Intl.NumberFormat('vi-VN').format(pos.price_per_day);
        const formattedRevenue = new Intl.NumberFormat('vi-VN').format(pos.total_revenue_recorded || 0);

        return `
            <div class="ad-pos-card">
                <div class="pos-card-top">
                    <div class="pos-icon-wrap" style="background:${badgeColor}; color:${textColor};">${icon}</div>
                    <div>
                        <h4 class="pos-name-title">${escapeHtml(pos.Name)}</h4>
                        <span style="font-size: 11.5px; color: #64748b;">Mã vị trí: #${pos.Id}</span>
                    </div>
                </div>

                <div class="pos-price-display">
                    <div class="pos-price-val">${formattedPrice} đ</div>
                    <div class="pos-price-unit">Đơn giá niêm yết / ngày</div>
                </div>

                <p class="pos-desc-text">${escapeHtml(pos.description || 'Chưa cập nhật mô tả quy chuẩn.')}</p>

                <div class="pos-stats-line">
                    <span>Đơn đã duyệt: <strong>${pos.total_requests || 0}</strong></span>
                    <span>Doanh thu: <strong>${formattedRevenue} đ</strong></span>
                </div>

                <button type="button" class="btn-update-price" data-id="${pos.Id}">
                    ✏️ Cập nhật báo giá
                </button>
            </div>
        `;
    }

    // =========================================================================
    // 16. TẢI VÀ ĐỐI SOÁT YÊU CẦU QUẢNG CÁO LỊCH SỬ (MINH CHỨNG BẢO TOÀN GIÁ)
    // =========================================================================
    const adRequestsTableWrap = document.getElementById('ad-requests-table-wrap');
    const adRequestsCountBadge = document.getElementById('ad-requests-count-badge');

    async function loadAdRequests() {
        if (!adRequestsTableWrap) return;

        adRequestsTableWrap.innerHTML = `
            <div class="state-placeholder" style="padding: 24px;">
                <div class="spinner"></div>
                <p>Đang tải danh sách yêu cầu quảng cáo đối soát...</p>
            </div>
        `;

        try {
            const res = await fetch('/api/admin/ads/requests');
            const result = await res.json();

            if (!res.ok || !result.success) {
                adRequestsTableWrap.innerHTML = `
                    <div class="state-placeholder error">
                        <p>⚠️ Không thể tải danh sách yêu cầu: ${escapeHtml(result.message || 'Lỗi server')}</p>
                    </div>
                `;
                return;
            }

            const requests = result.data || [];

            if (adRequestsCountBadge) {
                adRequestsCountBadge.textContent = `${requests.length} yêu cầu`;
            }

            if (requests.length === 0) {
                adRequestsTableWrap.innerHTML = `
                    <div style="text-align: center; padding: 28px 16px; color: #64748b; font-size: 13.5px;">
                        📄 Hiện tại chưa phát sinh yêu cầu quảng cáo nào từ các đối tác doanh nghiệp.
                    </div>
                `;
                return;
            }

            adRequestsTableWrap.innerHTML = `
                <table class="ad-data-table">
                    <thead>
                        <tr>
                            <th>#ID</th>
                            <th>Doanh nghiệp đặt</th>
                            <th>Vị trí</th>
                            <th>Thời gian chiến dịch</th>
                            <th>Chi phí hợp đồng (Bảo toàn)</th>
                            <th>Trạng thái</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${requests.map(r => renderAdRequestRow(r)).join('')}
                    </tbody>
                </table>
            `;

        } catch (err) {
            console.error('Lỗi khi tải yêu cầu quảng cáo:', err);
            adRequestsTableWrap.innerHTML = `
                <div class="state-placeholder error">
                    <p>⚠️ Lỗi kết nối khi tải danh sách yêu cầu quảng cáo.</p>
                </div>
            `;
        }
    }

    function renderAdRequestRow(r) {
        const formattedAmount = new Intl.NumberFormat('vi-VN').format(r.total_amount);
        const startDate = r.start_date ? new Date(r.start_date).toLocaleDateString('vi-VN') : '—';
        const endDate = r.end_date ? new Date(r.end_date).toLocaleDateString('vi-VN') : '—';

        let statusTag = '';
        if (r.status === 'Active') {
            statusTag = '<span class="badge-status active">Đang chạy</span>';
        } else if (r.status === 'Paid') {
            statusTag = '<span class="badge-status" style="background:#e0f2fe; color:#0369a1; border-color:#bae6fd;">Đã thanh toán</span>';
        } else if (r.status === 'Pending') {
            statusTag = '<span class="badge-status restricted">Chờ duyệt</span>';
        } else if (r.status === 'Expired') {
            statusTag = '<span class="badge-status" style="background:#f1f5f9; color:#475569; border-color:#cbd5e1;">Hết hạn</span>';
        } else {
            statusTag = `<span class="badge-status banned">${escapeHtml(r.status)}</span>`;
        }

        return `
            <tr>
                <td><strong>#${r.Id}</strong></td>
                <td>
                    <div style="font-weight: 600; color: #1e293b;">${escapeHtml(r.company_name || 'Doanh nghiệp')}</div>
                    <div style="font-size: 11.5px; color: #64748b;">SĐT: ${escapeHtml(r.advertiser_phone || '—')} | Email: ${escapeHtml(r.advertiser_email || '—')}</div>
                </td>
                <td><span class="badge-role dn">${escapeHtml(r.position_name)}</span></td>
                <td>
                    <div>${startDate} → ${endDate}</div>
                    <small style="color: #64748b;">(${r.total_days || 1} ngày)</small>
                </td>
                <td>
                    <div style="font-weight: 700; color: #15803d; font-size: 14px;">${formattedAmount} đ</div>
                    <small style="color: #166534; font-size: 11px;">✓ Đã chốt cố định</small>
                </td>
                <td>${statusTag}</td>
            </tr>
        `;
    }

    // =========================================================================
    // 17. XỬ LÝ MODAL CẬP NHẬT BÁO GIÁ QUẢNG CÁO (ADMIN)
    // =========================================================================
    const editAdPriceModal = document.getElementById('edit-ad-price-modal');
    const editAdPriceForm = document.getElementById('edit-ad-price-form');
    const btnCancelAdPrice = document.getElementById('btn-cancel-ad-price');
    const btnSubmitAdPrice = document.getElementById('btn-submit-ad-price');
    const adEditErrorMsg = document.getElementById('ad-edit-error-msg');

    const adPositionId = document.getElementById('ad-position-id');
    const adPositionNameDisplay = document.getElementById('ad-position-name-display');
    const adCurrentPriceDisplay = document.getElementById('ad-current-price-display');
    const adNewPrice = document.getElementById('ad-new-price');
    const adEditDesc = document.getElementById('ad-edit-desc');

    function openEditAdPriceModal(pos) {
        if (!editAdPriceModal) return;
        if (adEditErrorMsg) {
            adEditErrorMsg.style.display = 'none';
            adEditErrorMsg.textContent = '';
        }

        adPositionId.value = pos.Id;
        adPositionNameDisplay.textContent = `${pos.Name} (Mã vị trí: #${pos.Id})`;
        const formattedCurPrice = new Intl.NumberFormat('vi-VN').format(pos.price_per_day);
        adCurrentPriceDisplay.textContent = `${formattedCurPrice} đ/ngày`;
        adNewPrice.value = Math.round(pos.price_per_day);
        adEditDesc.value = pos.description || '';

        editAdPriceModal.style.display = 'flex';
        adNewPrice.focus();
    }

    function closeEditAdPriceModal() {
        if (!editAdPriceModal) return;
        editAdPriceModal.style.display = 'none';
        if (adEditErrorMsg) {
            adEditErrorMsg.style.display = 'none';
            adEditErrorMsg.textContent = '';
        }
    }

    if (btnCancelAdPrice) btnCancelAdPrice.addEventListener('click', closeEditAdPriceModal);

    if (editAdPriceForm) {
        editAdPriceForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (adEditErrorMsg) {
                adEditErrorMsg.style.display = 'none';
                adEditErrorMsg.textContent = '';
            }

            const id = adPositionId.value;
            const price = parseFloat(adNewPrice.value);
            const desc = adEditDesc.value.trim();

            if (isNaN(price) || price <= 0) {
                showAdEditError('Vui lòng nhập đơn giá ngày hợp lệ lớn hơn 0 VNĐ!');
                return;
            }

            if (btnSubmitAdPrice) {
                btnSubmitAdPrice.disabled = true;
                btnSubmitAdPrice.textContent = 'Đang lưu báo giá...';
            }

            try {
                const res = await fetch(`/api/admin/ads/positions/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        price_per_day: price,
                        description: desc
                    })
                });

                const data = await res.json();
                if (!res.ok || !data.success) {
                    showAdEditError(data.message || 'Lỗi khi cập nhật báo giá!');
                    return;
                }

                alert(`✓ ${data.message}\n\n🛡️ NGUYÊN TẮC BẢO TOÀN DỮ LIỆU:\n${data.note}\n(${data.past_requests_protected} hợp đồng quá khứ được giữ nguyên chi phí).`);
                closeEditAdPriceModal();
                loadAdPositions();

            } catch (err) {
                console.error('Lỗi khi gọi API cập nhật báo giá:', err);
                showAdEditError('Lỗi kết nối máy chủ backend!');
            } finally {
                if (btnSubmitAdPrice) {
                    btnSubmitAdPrice.disabled = false;
                    btnSubmitAdPrice.textContent = 'Lưu báo giá mới';
                }
            }
        });
    }

    // =========================================================================
    // 18. QUẢN LÝ SAO LƯU & KHÔI PHỤC DỮ LIỆU DATABASE (BACKUP & RESTORE)
    // =========================================================================
    const backupsTableWrap = document.getElementById('backups-table-wrap');
    const backupsCountBadge = document.getElementById('backups-count-badge');
    const restoreConfirmModal = document.getElementById('restore-confirm-modal');
    const restoreConfirmForm = document.getElementById('restore-confirm-form');
    const btnCancelRestore = document.getElementById('btn-cancel-restore');
    const btnSubmitRestore = document.getElementById('btn-submit-restore');
    const restoreTargetFilename = document.getElementById('restore-target-filename');
    const restoreFilenameDisplay = document.getElementById('restore-filename-display');
    const restoreAdminPassword = document.getElementById('restore-admin-password');
    const restoreErrorMsg = document.getElementById('restore-error-msg');

    let loadedBackupFiles = [];

    // Tải danh sách bản sao lưu .bak
    async function loadBackupsList() {
        if (!backupsTableWrap) return;

        backupsTableWrap.innerHTML = `
            <div class="state-placeholder" style="padding: 24px;">
                <div class="spinner"></div>
                <p>Đang quét danh sách các bản sao lưu trên máy chủ...</p>
            </div>
        `;

        try {
            const res = await fetch('/api/admin/backup/list');
            const result = await res.json();

            if (!res.ok || !result.success) {
                backupsTableWrap.innerHTML = `
                    <div class="state-placeholder error">
                        <p>⚠️ Không thể tải danh sách bản sao lưu: ${escapeHtml(result.message || 'Lỗi máy chủ')}</p>
                    </div>
                `;
                return;
            }

            const backups = result.data || [];
            loadedBackupFiles = backups;

            if (backupsCountBadge) {
                backupsCountBadge.textContent = `${backups.length} bản sao lưu`;
            }

            if (backups.length === 0) {
                backupsTableWrap.innerHTML = `
                    <div style="text-align: center; padding: 36px 16px; color: #64748b;">
                        <div style="font-size: 32px; margin-bottom: 8px;">💾</div>
                        <p style="font-size: 14px; font-weight: 600; color: #334155;">Chưa có bản sao lưu cơ sở dữ liệu nào.</p>
                        <p style="font-size: 13px; margin-top: 4px;">Nhấn nút <strong>"Tạo bản sao lưu ngay"</strong> ở trên để tạo bản lưu trữ đầu tiên.</p>
                    </div>
                `;
                return;
            }

            backupsTableWrap.innerHTML = `
                <table class="ad-data-table">
                    <thead>
                        <tr>
                            <th style="width: 50px;">#</th>
                            <th>Tên file bản sao lưu (.bak)</th>
                            <th>Ngày giờ tạo</th>
                            <th>Dung lượng</th>
                            <th style="text-align: right;">Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${backups.map((b, idx) => renderBackupRow(b, idx + 1)).join('')}
                    </tbody>
                </table>
            `;

            // Gắn sự kiện cho các nút Khôi phục và Xóa
            document.querySelectorAll('.btn-restore-item').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const fname = e.currentTarget.getAttribute('data-filename');
                    openRestoreModal(fname);
                });
            });

            document.querySelectorAll('.btn-delete-backup-item').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const fname = e.currentTarget.getAttribute('data-filename');
                    await handleDeleteBackup(fname);
                });
            });

        } catch (err) {
            console.error('Lỗi khi tải danh sách backup:', err);
            backupsTableWrap.innerHTML = `
                <div class="state-placeholder error">
                    <p>⚠️ Lỗi kết nối máy chủ khi đọc danh sách bản sao lưu.</p>
                </div>
            `;
        }
    }

    function renderBackupRow(b, stt) {
        const createdDate = b.created_at ? new Date(b.created_at).toLocaleString('vi-VN') : '—';

        return `
            <tr>
                <td><strong>${stt}</strong></td>
                <td>
                    <div style="font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 6px;">
                        <span>💾</span>
                        <code>${escapeHtml(b.filename)}</code>
                    </div>
                    <small style="color: #64748b;">Định dạng chuẩn SQL Server Full Backup</small>
                </td>
                <td>
                    <div style="font-weight: 500;">${createdDate}</div>
                </td>
                <td>
                    <span class="users-count-badge" style="background:#f0fdf4; color:#15803d; border-color:#bbf7d0;">
                        ${escapeHtml(b.size_formatted)}
                    </span>
                </td>
                <td>
                    <div style="display: flex; gap: 6px; justify-content: flex-end;">
                        <button type="button" class="btn-action-sm btn-restore-item" data-filename="${escapeHtml(b.filename)}" title="Khôi phục database từ file này" style="background:#fef2f2; border-color:#fecaca; color:#b91c1c;">
                            🔄 Khôi phục
                        </button>
                        <button type="button" class="btn-action-sm btn-delete-backup-item" data-filename="${escapeHtml(b.filename)}" title="Xóa bản sao lưu này" style="background:#f8fafc; border-color:#cbd5e1; color:#475569;">
                            🗑️ Xóa file
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }

    // Nút Tạo bản sao lưu ngay
    if (btnCreateBackup) {
        btnCreateBackup.addEventListener('click', async () => {
            if (!confirm('Bạn có muốn tạo bản sao lưu toàn diện cho cơ sở dữ liệu WebBao ngay bây giờ?')) return;

            btnCreateBackup.disabled = true;
            btnCreateBackup.innerHTML = '⏳ Đang sao lưu cơ sở dữ liệu...';

            try {
                const res = await fetch('/api/admin/backup/create', { method: 'POST' });
                const data = await res.json();

                if (!res.ok || !data.success) {
                    alert(`⚠️ Lỗi khi tạo bản sao lưu: ${data.message || 'Lỗi server'}`);
                    return;
                }

                alert(`✓ ${data.message}\nDung lượng: ${data.data?.size_formatted}`);
                loadBackupsList();

            } catch (err) {
                console.error('Lỗi khi gọi API tạo backup:', err);
                alert('⚠️ Lỗi kết nối máy chủ khi sao lưu dữ liệu!');
            } finally {
                btnCreateBackup.disabled = false;
                btnCreateBackup.innerHTML = '💾 Tạo bản sao lưu ngay';
            }
        });
    }

    if (btnRefreshBackups) {
        btnRefreshBackups.addEventListener('click', () => loadBackupsList());
    }

    // Modal Khôi phục dữ liệu
    function openRestoreModal(filename) {
        if (!restoreConfirmModal) return;
        if (restoreErrorMsg) {
            restoreErrorMsg.style.display = 'none';
            restoreErrorMsg.textContent = '';
        }
        if (restoreAdminPassword) {
            restoreAdminPassword.value = '';
        }

        restoreTargetFilename.value = filename;
        restoreFilenameDisplay.textContent = filename;

        restoreConfirmModal.style.display = 'flex';
        restoreAdminPassword?.focus();
    }

    function closeRestoreModal() {
        if (!restoreConfirmModal) return;
        restoreConfirmModal.style.display = 'none';
        if (restoreErrorMsg) {
            restoreErrorMsg.style.display = 'none';
            restoreErrorMsg.textContent = '';
        }
    }

    if (btnCancelRestore) btnCancelRestore.addEventListener('click', closeRestoreModal);

    if (restoreConfirmForm) {
        restoreConfirmForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (restoreErrorMsg) {
                restoreErrorMsg.style.display = 'none';
                restoreErrorMsg.textContent = '';
            }

            const filename = restoreTargetFilename.value;
            const password = restoreAdminPassword.value;

            if (!password) {
                showRestoreError('Vui lòng nhập mật khẩu Quản trị viên để xác thực quyền khôi phục!');
                return;
            }

            if (btnSubmitRestore) {
                btnSubmitRestore.disabled = true;
                btnSubmitRestore.innerHTML = '⏳ Đang khôi phục cơ sở dữ liệu...';
            }

            try {
                const res = await fetch('/api/admin/backup/restore', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        filename,
                        admin_password: password
                    })
                });

                const data = await res.json();
                if (!res.ok || !data.success) {
                    showRestoreError(data.message || 'Lỗi khi khôi phục dữ liệu!');
                    return;
                }

                alert(`✓ THÀNH CÔNG RỰC RỠ!\n\n${data.message}\n\nHệ thống sẽ tự động làm mới trang sau 1.5 giây để nạp lại dữ liệu đã khôi phục.`);
                closeRestoreModal();
                setTimeout(() => window.location.reload(), 1500);

            } catch (err) {
                console.error('Lỗi khi khôi phục database:', err);
                showRestoreError('Lỗi kết nối máy chủ trong quá trình khôi phục!');
            } finally {
                if (btnSubmitRestore) {
                    btnSubmitRestore.disabled = false;
                    btnSubmitRestore.innerHTML = 'Tiến hành Khôi phục';
                }
            }
        });
    }

    function showRestoreError(msg) {
        if (!restoreErrorMsg) return;
        restoreErrorMsg.textContent = `⚠️ ${msg}`;
        restoreErrorMsg.style.display = 'block';
    }

    // Xóa file bản sao lưu
    async function handleDeleteBackup(filename) {
        if (!confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn file bản sao lưu "${filename}" khỏi máy chủ?\n\nThao tác này sẽ giải phóng dung lượng ổ đĩa và không thể hoàn tác.`)) {
            return;
        }

        try {
            const res = await fetch(`/api/admin/backup/${encodeURIComponent(filename)}`, {
                method: 'DELETE'
            });

            const data = await res.json();
            if (!res.ok || !data.success) {
                alert(`⚠️ Không thể xóa: ${data.message || 'Lỗi server'}`);
                return;
            }

            alert(`✓ ${data.message}`);
            loadBackupsList();

        } catch (err) {
            console.error('Lỗi khi xóa file backup:', err);
            alert('⚠️ Lỗi kết nối khi xóa file bản sao lưu!');
        }
    }

    function showAdEditError(msg) {
        if (!adEditErrorMsg) return;
        adEditErrorMsg.textContent = `⚠️ ${msg}`;
        adEditErrorMsg.style.display = 'block';
    }

    // Đóng các modal khi click ra ngoài vùng nền mờ
    window.addEventListener('click', (e) => {
        if (e.target === editUserModal) closeEditUserModal();
        if (e.target === statusModal) closeStatusModal();
        if (e.target === violationModal) closeViolationModal();
        if (e.target === editAdPriceModal) closeEditAdPriceModal();
        if (e.target === restoreConfirmModal) closeRestoreModal();
    });

    // Tiện ích escape HTML chống XSS
    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
});
