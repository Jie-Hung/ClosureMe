// fileController.js
const fs = require("fs").promises;
const pool = require("../../models/db");

const {
    renameFileOnS3,
    deleteFileOnS3,
} = require("../../storage");

// 顯示上傳的所有檔案資訊，用於檔案管理頁
exports.getFiles = async (req, res) => {
    const userId = req.user_id;

    if (!userId) {
        return res.status(401).json({ message: "未授權存取" })
    }

    try {
        const result = await pool.query(`
            SELECT ci.id AS image_id,
                   ci.upload_batch,
                   ci.file_name,
                   ci.file_path AS image_path,
                   ca.file_path AS profile_path,
                   cm.file_path AS memory_path,
                   cv.file_path AS voice_path,
                   ci.uploaded_at
            FROM char_images ci
            LEFT JOIN char_profile ca ON ci.id = ca.image_id
            LEFT JOIN char_memory cm ON ci.id = cm.image_id
            LEFT JOIN char_voice cv ON ci.id = cv.image_id  
            WHERE ci.user_id = $1
              AND ci.role_type = 'main'
            ORDER BY ci.uploaded_at DESC
        `, [userId]);

        const files = result.rows.map(file => {
            const utcTime = new Date(file.uploaded_at);
            const taiwanTime = new Date(utcTime.getTime() + 8 * 60 * 60 * 1000);
            const formattedTime = taiwanTime.toISOString().replace("T", " ").substring(0, 19);

            return {
                image_id: file.image_id,
                upload_batch: file.upload_batch,
                file_name: file.file_name,
                image_path: file.image_path,
                profile_path: file.profile_path,
                memory_path: file.memory_path,
                voice_path: file.voice_path,
                uploaded_at: formattedTime,
            };
        });

        return res.status(200).json({
            message: "取得成功",
            data: files
        });

    } catch (error) {
        console.error("Get Files Error:", error);
        return res.status(500).json({ message: "伺服器錯誤", error: error.message });
    }
};

// 取得人物卡片資料（圖片 + 描述檔案路徑），用於首頁
exports.getMainList = async (req, res) => {
    const userId = req.user_id;
    if (!userId) return res.status(401).json({ message: "未授權存取" });

    try {
        const result = await pool.query(`
            SELECT ci.file_name,
                   ci.file_path AS image_path,
                   ca.file_path AS profile_path,
                   cm.file_path AS memory_path,
                   cv.file_path AS voice_path,
                   ci.uploaded_at
            FROM char_images ci
            LEFT JOIN char_profile ca ON ci.id = ca.image_id
            LEFT JOIN char_memory  cm ON ci.id = cm.image_id
            LEFT JOIN char_voice   cv ON ci.id = cv.image_id
            WHERE ci.user_id = $1
              AND ci.role_type = 'main'
            ORDER BY ci.uploaded_at DESC
        `, [userId]);
        res.json({ message: "OK", data: result.rows });
    } catch (err) {
        console.error("getMainList error:", err);
        res.status(500).json({ message: "伺服器錯誤" });
    }
};

// 刪除角色資料
exports.deleteCharacter = async (req, res) => {
    const { fileName, uploadBatch } = req.body;
    const userId = req.user_id;
    if (!fileName && !uploadBatch) return res.status(400).json({ message: "缺少參數（需 fileName 或 uploadBatch）" });

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        let bases = [];
        if (fileName) {
            bases = [fileName];
        } else {
            const r0 = await client.query(`
                SELECT file_name, role_type
                FROM char_images
                WHERE user_id=$1 AND upload_batch=$2
                ORDER BY (role_type='main') DESC, uploaded_at DESC
                LIMIT 3
            `, [userId, uploadBatch]);

            if (!r0.rowCount) {
                await client.query("ROLLBACK");
                return res.status(404).json({ message: "查無此批次圖片" });
            }

            const toBase = (fn, rt) => rt && rt !== 'main' ? fn.split('_', 1)[0] : fn.split('.', 1)[0];
            bases = [...new Set(r0.rows.map(x => toBase(x.file_name, x.role_type)))];
        }

        const { rows: images } = await client.query(`
            SELECT id, file_path FROM char_images
            WHERE user_id=$1
              AND (split_part(file_name,'.',1) = ANY($2)
              OR split_part(file_name,'_',1) = ANY($2))
        `, [userId, bases]);

        if (!images.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "查無此角色圖片" });
        }
        const imageIds = images.map(i => i.id);

        const metaRes = await client.query(`
            SELECT file_path FROM char_profile WHERE image_id = ANY($1)
              UNION ALL
            SELECT file_path FROM char_memory WHERE image_id = ANY($1)
              UNION ALL
            SELECT file_path FROM char_voice   WHERE image_id = ANY($1)
        `, [imageIds]);

        for (const img of images) {
            const key = new URL(img.file_path).pathname.replace(/^\/+/, "");
            await deleteFileOnS3(key);
        }
        for (const m of metaRes.rows) {
            const key = new URL(m.file_path).pathname.replace(/^\/+/, "");
            await deleteFileOnS3(key);
        }

        await client.query(`DELETE FROM char_profile WHERE image_id = ANY($1)`, [imageIds]);
        await client.query(`DELETE FROM char_memory  WHERE image_id = ANY($1)`, [imageIds]);
        await client.query(`DELETE FROM char_voice   WHERE image_id = ANY($1)`, [imageIds]);
        await client.query(`DELETE FROM char_images  WHERE id       = ANY($1)`, [imageIds]);

        await client.query("COMMIT");
        res.json({ message: "刪除完成" });
    } catch (e) {
        await client.query("ROLLBACK");
        console.error("❌ deleteCharacter error:", e);
        res.status(500).json({ message: "刪除失敗", error: e.message });
    } finally {
        client.release();
    }
};

// 重新命名
exports.renameCharacter = async (req, res) => {
    const { uploadBatch, newName, fileName } = req.body;
    const userId = req.user_id;
    if ((!uploadBatch && !fileName) || !newName) {
        return res.status(400).json({ message: "缺少參數（需 uploadBatch 或 fileName，且需 newName）" });
    }

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        let bases = [];
        if (fileName) {
            bases = [fileName];
        } else {
            const r0 = await client.query(`
                SELECT file_name, role_type
                FROM char_images
                WHERE user_id=$1 AND upload_batch=$2
                ORDER BY (role_type='main') DESC, uploaded_at DESC
                LIMIT 3
            `, [userId, uploadBatch]);

            if (!r0.rowCount) {
                await client.query("ROLLBACK");
                return res.status(404).json({ message: "找不到此批次圖片" });
            }

            const toBase = (fn, rt) => rt && rt !== 'main'
                ? fn.split('_', 1)[0]
                : fn.split('.', 1)[0];
            bases = [...new Set(r0.rows.map(x => toBase(x.file_name, x.role_type)))];
        }

        const { rows: images } = await client.query(`
            SELECT id, file_name, file_path, role_type
            FROM char_images
            WHERE user_id=$1
              AND (split_part(file_name,'.',1) = ANY($2)
              OR split_part(file_name,'_',1) = ANY($2))
        `, [userId, bases]);

        if (!images.length) {
            await client.query("ROLLBACK");
            return res.status(404).json({ message: "找不到要重新命名的圖片" });
        }

        for (const img of images) {
            const oldKey = new URL(img.file_path).pathname.replace(/^\/+/, "");
            const ext = oldKey.match(/\.[a-zA-Z0-9]+$/)?.[0] || ".png";
            const newFileName = (img.role_type && img.role_type !== "main")
                ? `${newName}_${img.role_type}${ext}`
                : `${newName}${ext}`;
            const newKey = `uploads/${newFileName}`;

            await renameFileOnS3(oldKey, newKey);

            const publicBase = process.env.AWS_S3_PUBLIC_BASE;
            const newUrl = publicBase ? `${publicBase}/${newKey}` : img.file_path.replace(/\/uploads\/.+$/, `/${newKey}`);

            await client.query(
                `UPDATE char_images SET file_name=$1, file_path=$2 WHERE id=$3`,
                [newFileName, newUrl, img.id]
            );
        }

        const imageIds = images.map(i => i.id);
        const metaRes = await client.query(`
            SELECT 'profile' AS kind, id, file_path FROM char_profile WHERE image_id = ANY($1)
              UNION ALL
            SELECT 'memory' AS kind, id, file_path FROM char_memory WHERE image_id = ANY($1)
              UNION ALL
            SELECT 'voice'   AS kind, id, file_path FROM char_voice   WHERE image_id = ANY($1)
        `, [imageIds]);

        for (const m of metaRes.rows) {
            const oldKey = new URL(m.file_path).pathname.replace(/^\/+/, "");
            const ext = oldKey.match(/\.[a-zA-Z0-9]+$/)?.[0] || (m.kind === "voice" ? ".wav" : ".json");
            const newKey = `uploads/${newName}_${m.kind}${ext}`;

            await renameFileOnS3(oldKey, newKey);

            const publicBase = process.env.AWS_S3_PUBLIC_BASE;
            const newUrl = publicBase ? `${publicBase}/${newKey}` : m.file_path.replace(/\/uploads\/.+$/, `/${newKey}`);

            if (m.kind === "profile") {
                await client.query(`UPDATE char_profile SET file_path=$1 WHERE id=$2`, [newUrl, m.id]);
            } else if (m.kind === "memory") {
                await client.query(`UPDATE char_memory  SET file_path=$1 WHERE id=$2`, [newUrl, m.id]);
            } else {
                await client.query(`UPDATE char_voice   SET file_path=$1 WHERE id=$2`, [newUrl, m.id]);
            }
        }

        await client.query("COMMIT");
        res.json({ message: "重新命名完成" });
    } catch (e) {
        await client.query("ROLLBACK");
        console.error("❌ renameCharacter error:", e);
        res.status(500).json({ message: "重新命名失敗", error: e.message });
    } finally {
        client.release();
    }
};