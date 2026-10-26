// Cập nhật Lịch Dương & Lịch Âm
function updateHeaderDate() {
    const now = new Date();
    const d = now.getDate();
    const m = now.getMonth() + 1;
    const y = now.getFullYear();

    const format2Digits = (num) => String(num).padStart(2, '0');

    const solarStr = `${format2Digits(d)}/${format2Digits(m)}/${y}`;
    const solarEl = document.getElementById("solar-date");
    if (solarEl) solarEl.textContent = solarStr;

    if (typeof AmLichVN !== 'undefined') {
        const lunar = AmLichVN.convertSolar2Lunar(d, m, y);
        const lunarStr = `${format2Digits(lunar.day)}/${format2Digits(lunar.month)}/${lunar.year}${lunar.isLeap ? ' (N)' : ''}`;
        const lunarEl = document.getElementById("lunar-date");
        if (lunarEl) lunarEl.textContent = lunarStr;
    }
}

// Lấy thông tin thời tiết từ Backend API
async function fetchWeather(city = 'Hanoi') {
    const aqiEl = document.getElementById('weather-aqi') || document.getElementById('weather-desc');
    if (aqiEl) aqiEl.textContent = 'AQI: Đang tải...';

    try {
        const response = await fetch(`/api/thoi-tiet?tinh=${encodeURIComponent(city)}`);
        if (!response.ok) throw new Error('Không lấy được thời tiết');
        const data = await response.json();

        const iconEl = document.getElementById('weather-icon');
        const tempEl = document.getElementById('weather-temp');
        const humidityEl = document.getElementById('weather-humidity');

        if (iconEl && data.bieuTuong) {
            iconEl.src = data.bieuTuong.startsWith('//') ? 'https:' + data.bieuTuong : data.bieuTuong;
            iconEl.alt = data.moTa || 'Thời tiết';
            iconEl.title = data.moTa || 'Thời tiết';
            iconEl.style.display = 'block';
        }

        if (tempEl) {
            tempEl.textContent = `${Math.round(data.nhietDo)}°C`;
        }

        if (humidityEl) {
            humidityEl.textContent = `💧 ${data.doAm}%`;
            humidityEl.title = `Độ ẩm không khí: ${data.doAm}%`;
        }

        if (aqiEl) {
            aqiEl.textContent = `AQI: ${data.mucAqi || data.aqi}`;
            aqiEl.title = `Chỉ số AQI: ${data.aqi} (${data.mucAqi}) | PM2.5: ${data.pm25} | Thời tiết: ${data.moTa} | Cập nhật: ${data.capNhatLuc}`;
        }
    } catch (error) {
        console.error("Lỗi khi tải dữ liệu thời tiết:", error);
        if (aqiEl) aqiEl.textContent = 'AQI: Lỗi kết nối';
    }
}

function initWeatherWidget() {
    fetchWeather('Hanoi');
    const selectEl = document.getElementById('weather-select');
    if (selectEl) {
        selectEl.addEventListener('change', (e) => {
            fetchWeather(e.target.value);
        });
    }
}

function initSearch() {
    const searchInput = document.querySelector('.search-input');
    const searchIcon = document.querySelector('.search-icon');

    if (!searchInput) return;

    function handleSearch() {
        const query = searchInput.value.trim();
        if (query) {
            window.location.href = `tim-kiem.html?q=${encodeURIComponent(query)}`;
        }
    }

    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSearch();
        }
    });

    if (searchIcon) {
        searchIcon.style.cursor = 'pointer';
        searchIcon.style.pointerEvents = 'auto';
        searchIcon.addEventListener('click', () => {
            handleSearch();
        });
    }

    // Tự động điền lại từ khóa nếu đang ở trang tìm kiếm
    const urlParams = new URLSearchParams(window.location.search);
    const currentQ = urlParams.get('q');
    if (currentQ && window.location.pathname.includes('tim-kiem.html')) {
        searchInput.value = currentQ;
    }
}

// Tải danh mục thể loại động từ CSDL (dbo.categories) và render vào menu
async function loadSubHeaderCategories() {
    const menuList = document.getElementById('menuList');
    if (!menuList) return;

    try {
        const response = await fetch('/api/the-loai/danh-sach');
        if (!response.ok) throw new Error('Không thể tải danh sách thể loại');
        const result = await response.json();
        
        if (result.success && Array.isArray(result.data) && result.data.length > 0) {
            const currentParams = new URLSearchParams(window.location.search);
            const activeId = currentParams.get('id_tl');

            menuList.innerHTML = result.data.map(cat => {
                const isActive = (activeId && String(activeId) === String(cat.id)) ? ' style="color: var(--LinkColor); font-weight: bold;"' : '';
                return `<a href="the-loai.html?id_tl=${cat.id}"${isActive}>${cat.name}</a>`;
            }).join('');
        }
    } catch (err) {
        console.warn('Lỗi tải danh mục động, giữ nguyên danh mục mặc định:', err);
    }
}

function initHeader() {
    updateHeaderDate();
    initWeatherWidget();
    initSearch();
    loadSubHeaderCategories();
}

