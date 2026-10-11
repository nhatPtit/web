/**
 * Thuật toán tính Âm lịch Việt Nam (Múi giờ UTC+7) - Hồ Ngọc Đức
 */
const AmLichVN = (() => {
    const TIMEZONE = 7.0;

    function julianDayNumber(dd, mm, yy) {
        const a = Math.floor((14 - mm) / 12);
        const y = yy + 4800 - a;
        const m = mm + 12 * a - 3;
        return dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    }

    function getNewMoonDay(k, timeZone) {
        const T = k / 1236.85;
        const T2 = T * T;
        const T3 = T2 * T;
        const dr = Math.PI / 180;

        let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
        Jd1 += 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);

        const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
        const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
        const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;

        let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * M * dr);
        C1 -= 0.4068 * Math.sin(Mpr * dr) - 0.0161 * Math.sin(2 * Mpr * dr);
        C1 += 0.0104 * Math.sin(2 * F * dr) - 0.0051 * Math.sin((M + Mpr) * dr);

        const JdNew = Jd1 + C1;
        return Math.floor(JdNew + 0.5 + timeZone / 24);
    }

    function getSunLongitude(jdn, timeZone) {
        const T = (jdn - 2451545.0 + 0.5 - timeZone / 24) / 36525;
        const dr = Math.PI / 180;
        const M = 357.5291 + 35999.0503 * T - 0.0001559 * T * T - 0.00000048 * T * T * T;
        const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T * T;
        const DL = (1.9146 - 0.004817 * T) * Math.sin(M * dr) + (0.019993 - 0.000101 * T) * Math.sin(2 * M * dr);
        let L = L0 + DL;
        L = (L % 360 + 360) % 360;
        return Math.floor(L / 30);
    }

    function getLunarMonth11(lunarYear, timeZone) {
        const off = julianDayNumber(31, 12, lunarYear) - 2415021;
        const k = Math.floor(off / 29.53058868);
        let nm = getNewMoonDay(k, timeZone);
        let sunLong = getSunLongitude(nm, timeZone);
        if (sunLong >= 9) {
            nm = getNewMoonDay(k - 1, timeZone);
        }
        return nm;
    }

    // --- HÀM CHÍNH: Chuyển Dương Lịch -> Âm Lịch (kèm Tháng Nhuận) ---
    function convertSolar2Lunar(dd, mm, yy) {
        const dayNumber = julianDayNumber(dd, mm, yy);
        const k = Math.floor((dayNumber - 2415021.07699) / 29.53058868);
        let monthStart = getNewMoonDay(k + 1, TIMEZONE);

        if (monthStart > dayNumber) {
            monthStart = getNewMoonDay(k, TIMEZONE);
        }

        let a11 = getLunarMonth11(yy, TIMEZONE);
        let b11 = a11;
        let lunarYear = yy;

        if (a11 >= monthStart) {
            lunarYear = yy - 1;
            a11 = getLunarMonth11(yy - 1, TIMEZONE);
        } else {
            b11 = getLunarMonth11(yy + 1, TIMEZONE);
        }

        const lunarDay = dayNumber - monthStart + 1;
        const diff = Math.floor((monthStart - a11) / 29);

        let lunarMonth = diff + 11;
        let isLeap = false;

        // Logic kiểm tra năm nhuận & xác định tháng nhuận
        if (b11 - a11 > 365) {
            let leapMonthDiff = 0;
            let lastSunLong = -1;
            let isLeapFound = false;

            for (let i = 0; i <= diff; i++) {
                const currentNM = getNewMoonDay(Math.floor((a11 - 2415021.07699) / 29.53058868) + i, TIMEZONE);
                const sunLong = getSunLongitude(currentNM, TIMEZONE);

                if (sunLong === lastSunLong && !isLeapFound) {
                    leapMonthDiff = i;
                    isLeapFound = true;
                }
                lastSunLong = sunLong;
            }

            if (isLeapFound) {
                if (diff === leapMonthDiff) {
                    isLeap = true; // Chính là tháng nhuận
                    lunarMonth = leapMonthDiff + 10;
                } else if (diff > leapMonthDiff) {
                    lunarMonth = diff + 10; // Tháng sau tháng nhuận
                }
            }
        }

        if (lunarMonth > 12) lunarMonth -= 12;

        return {
            day: lunarDay,
            month: lunarMonth,
            year: lunarYear,
            isLeap: isLeap
        };
    }

    return { convertSolar2Lunar };
})();
if (typeof window !== 'undefined') {
    window.AmLichVN = AmLichVN;
}