const express = require('express');
const router = express.Router();
const sql = require('mssql');
const { connectDB } = require('../db');

// Route API: GET /api/chitietbaibao?id=...
router.get('/', async (req, res) => {
    try {
        // Láº¥y ID tá»« URL query
        const articleId = req.query.id;

        if (!articleId) {
            return res.status(400).json({ message: 'Thiáº¿u ID bÃ i viáº¿t!' });
        }

        const pool = await connectDB();

        // Cháº¡y Ä‘á»“ng thá»i 2 cÃ¢u lá»‡nh truy váº¥n Ä‘á»ƒ láº¥y BÃ i BÃ¡o vÃ  áº¢nh
        const result = await pool.request()
            .input('id_bb', sql.Int, articleId)
            .query(`
                -- Chá»‰ tÄƒng lÆ°á»£t xem khi bÃ i viáº¿t Ä‘Ã£ Ä‘Æ°á»£c xuáº¥t báº£n (dÃ nh cho Ä‘á»™c giáº£ Ä‘á»c tin)
                UPDATE dbo.BaiViet 
                SET views_count = COALESCE(views_count, 0) + 1 
                WHERE Id = @id_bb AND status IN ('published', 'daduyet');

                -- Ghi nhận lượt xem ngày hôm nay vào dbo.daily_views (nếu có bảng)
                IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'daily_views')
                BEGIN
                -- Ghi nháº­n lÆ°á»£t xem ngÃ y hÃ´m nay vÃ o dbo.daily_views
                IF EXISTS (SELECT 1 FROM dbo.BaiViet WHERE Id = @id_bb AND status IN ('published', 'daduyet'))
                BEGIN
                    MERGE dbo.daily_views AS target
                    USING (SELECT CAST(SYSDATETIME() AS DATE) AS today) AS source
                    ON (target.view_date = source.today)
                    WHEN MATCHED THEN
                        UPDATE SET target.views_count = target.views_count + 1
                    WHEN NOT MATCHED THEN
                        INSERT (view_date, views_count, articles_viewed)
                        VALUES (source.today, 1, 1);
                END

                END
                -- Truy váº¥n 1: Láº¥y chi tiáº¿t bÃ i bÃ¡o (Ä‘Ã£ Ä‘Æ°á»£c cá»™ng 1 lÆ°á»£t xem)
                SELECT 
                    b.Id AS ID_BB,
                    b.Id,
                    b.title AS TieuDe,
                    b.sapo AS TomTat,
                    b.Content AS NoiDung,
                    b.published_at AS NgayDang,
                    b.category_id AS ID_TL,
                    b.author_id AS ID_NhaBao_Viet,
                    b.editor_id AS ID_Nguoi_Duyet,
                    b.status,
                    b.views_count
                FROM dbo.BaiViet b
                WHERE b.Id = @id_bb;

                -- Truy váº¥n 2: Láº¥y táº¥t cáº£ áº£nh thuá»™c bÃ i bÃ¡o nÃ y
                SELECT 
                    a.Id AS ID_Anh, 
                    a.image_url AS [URL], 
                    a.caption AS [Caption], 
                    a.display_order AS [ViTriTrongBai]
                FROM dbo.AnhBaiViet a
                WHERE a.id_BB = @id_bb;
            `);

        // Truy váº¥n 1 sáº½ náº±m á»Ÿ result.recordsets[0]
        const baiBaoData = result.recordsets[0];

        if (!baiBaoData || baiBaoData.length === 0) {
            return res.status(404).json({ message: 'KhÃ´ng tÃ¬m tháº¥y bÃ i viáº¿t' });
        }

        // Láº¥y bÃ i bÃ¡o Ä‘áº§u tiÃªn
        const article = baiBaoData[0];

        // Truy váº¥n 2 (danh sÃ¡ch áº£nh) sáº½ náº±m á»Ÿ result.recordsets[1]
        const listAnh = result.recordsets[1];

        // Náº¿u cÃ³ áº£nh, láº·p qua máº£ng áº£nh vÃ  gÃ¡n URL vÃ o thuá»™c tÃ­nh AnhX (VD: Anh2, Anh3...)
        if (listAnh && listAnh.length > 0) {
            listAnh.forEach(anh => {
                if (anh.ViTriTrongBai) {
                    // Táº¡o ra cÃ¡c key Ä‘á»™ng nhÆ° article.Anh2 = '/Anh-BB/xxhaha4.webp'
                    article[`Anh${anh.ViTriTrongBai}`] = anh.URL;

                    // (TÃ¹y chá»n) GÃ¡n thÃªm cáº£ Caption náº¿u muá»‘n hiá»ƒn thá»‹ chÃº thÃ­ch áº£nh
                    if (anh.Caption) {
                        article[`Caption${anh.ViTriTrongBai}`] = anh.Caption;
                    }
                }
            });
        }

        // Tráº£ vá» object bÃ i bÃ¡o Ä‘Ã£ Ä‘Æ°á»£c Ä‘Ã­nh kÃ¨m toÃ n bá»™ link áº£nh
        res.status(200).json(article);

    } catch (error) {
        console.error('Lá»—i khi láº¥y chi tiáº¿t bÃ i bÃ¡o vÃ  áº£nh:', error);
        res.status(500).json({ message: 'Lá»—i server khi táº£i ná»™i dung bÃ i viáº¿t!' });
    }
});

module.exports = router;
