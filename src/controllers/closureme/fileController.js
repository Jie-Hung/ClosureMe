// 後端檔案管理系統邏輯
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const pool = require("../../models/db");

// 顯示上傳的所有檔案資訊（圖、外觀、記憶），用於檔案管理頁
exports.getFiles = async (req, res) => {
    const userId = req.user_id;

    if (!userId) {
        return res.status(401).json({ message: "未授權存取" });
    }

    try {
        const result = await pool.query(`
            SELECT ci.file_name, ci.file_path AS image_path, 
                   ca.file_path AS profile_path, cm.file_path AS memory_path, ci.uploaded_at
            FROM char_images ci
            LEFT JOIN char_profile ca ON ci.id = ca.image_id
            LEFT JOIN char_memory cm ON ci.id = cm.image_id
            WHERE ci.user_id = $1
              AND NOT ci.file_name ~ '\\(\\d+\\)\\.[a-zA-Z0-9]+$'
            ORDER BY ci.uploaded_at DESC
        `, [req.user_id]);

        const files = result.rows.map(file => {
            const parsed = path.parse(file.file_name);
            const utcTime = new Date(file.uploaded_at);
            const taiwanTime = new Date(utcTime.getTime() + 8 * 60 * 60 * 1000);
            const formattedTime = taiwanTime.toISOString().replace("T", " ").substring(0, 19);

            return {
                image_id: file.image_id,
                file_name: parsed.name,
                image_path: file.image_path,
                profile_path: file.profile_path,
                memory_path: file.memory_path,
                uploaded_at: formattedTime
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
exports.getCharacters = async (req, res) => {
    try {
        const userId = req.user_id;
        const result = await pool.query(`
            SELECT ci.file_name, ci.file_path AS image_path, 
                   ca.file_path AS profile_path, cm.file_path AS memory_path, ci.uploaded_at
            FROM char_images ci
            LEFT JOIN char_profile ca ON ci.id = ca.image_id
            LEFT JOIN char_memory cm ON ci.id = cm.image_id
            WHERE ci.user_id = $1
              AND NOT ci.file_name ~ '\\(\\d+\\)\\.[a-zA-Z0-9]+$'
            ORDER BY ci.uploaded_at DESC
        `, [req.user_id]);

        const characters = result.rows.map(row => ({
            id: row.id,
            name: row.file_name.replace(/\.[^/.]+$/, ""),
            image_path: row.image_path,
            profile_path: row.profile_path,
            memory_path: row.memory_path
        }));

        res.json(characters);
    } catch (error) {
        console.error("Get Characters Error:", error);
        res.status(500).json({ message: "伺服器錯誤" });
    }
};

// 刪除角色資料
exports.deleteCharacter = async (req, res) => {
    const { fileName } = req.body;
    if (!fileName) {
        return res.status(400).json({ message: "請提供角色名稱" });
    }

    try {
        // 找出對應檔案（模糊比對）
        const pattern = `^${fileName}(\\(\\d+\\))?\\.[a-zA-Z0-9]+$`;
        const imageResult = await pool.query(
            `SELECT * FROM char_images WHERE LOWER(file_name) ~ LOWER($1)`,
            [pattern]
        );

        if (imageResult.rows.length === 0) {
            return res.status(404).json({ message: "查無對應角色" });
        }

        for (const image of imageResult.rows) {
            const imageId = image.id;
            const allPaths = [image.file_path];

            const profileRes = await pool.query("SELECT file_path FROM char_profile WHERE image_id = $1", [imageId]);
            const memoryRes = await pool.query("SELECT file_path FROM char_memory WHERE image_id = $1", [imageId]);
            const voiceRes = await pool.query("SELECT file_path FROM char_voice WHERE image_id = $1", [imageId]);

            if (profileRes.rows[0]) allPaths.push(profileRes.rows[0].file_path);
            if (memoryRes.rows[0]) allPaths.push(memoryRes.rows[0].file_path);
            if (voiceRes.rows[0]) allPaths.push(voiceRes.rows[0].file_path);

            // 刪除實體檔案
            for (const filePath of allPaths) {
                const fullPath = path.join(__dirname, "../../../public", filePath);
                if (fsSync.existsSync(fullPath)) {
                    fsSync.unlinkSync(fullPath);
                    console.log("✅ 已刪除檔案：", fullPath);
                } else {
                    console.warn("⚠️ 找不到實體檔案：", fullPath);
                }
            }

            // 刪除資料庫紀錄
            await pool.query("DELETE FROM char_images WHERE id = $1", [imageId]);
        }

        return res.status(200).json({ message: "刪除成功" });
    } catch (error) {
        console.error("❌ 刪除錯誤：", error);
        return res.status(500).json({ message: "伺服器錯誤" });
    }
};

// 重新命名
exports.renameCharacter = async (req, res) => {
    const { fileName, newName } = req.body;

    if (!fileName || !newName || /[<>:"/\\|?*]/.test(newName)) {
        return res.status(400).json({ message: "請提供合法的原始名稱與新名稱，且勿包含特殊字元" });
    }

    try {
        const pattern = `^${fileName}(\\(\\d+\\))?\\.[a-zA-Z0-9]+$`;
        const result = await pool.query(`
            SELECT ci.id, ci.file_name AS old_image_name, ci.file_path AS old_image_path,
                   ca.file_path AS old_profile_path, cm.file_path AS old_memory_path,
                   cv.file_path AS old_voice_path
            FROM char_images ci
            LEFT JOIN char_profile ca ON ci.id = ca.image_id
            LEFT JOIN char_memory cm ON ci.id = cm.image_id
            LEFT JOIN char_voice cv ON ci.id = cv.image_id
            WHERE LOWER(ci.file_name) ~ LOWER($1)
        `, [pattern]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "查無對應角色" });
        }

        const uploadDir = path.join(process.cwd(), "public", "uploads");

        for (const row of result.rows) {
            const ext = path.extname(row.old_image_name);
            const suffixMatch = row.old_image_name.match(/\(\d+\)/);
            const suffix = suffixMatch ? suffixMatch[0] : "";

            const newImageName = `${newName}${suffix}${ext}`;
            const newProfileName = `${newName}${suffix}_profile.json`;
            const newMemoryName = `${newName}${suffix}_memory.json`;
            const newVoiceName = `${newName}${suffix}.wav`;

            // 計算新路徑
            const newImagePath = path.join(uploadDir, newImageName);
            const newProfilePath = path.join(uploadDir, newProfileName);
            const newMemoryPath = path.join(uploadDir, newMemoryName);
            const newVoicePath = path.join(uploadDir, newVoiceName);

            // 移動檔案
            await fs.rename(path.join(process.cwd(), "public", row.old_image_path), newImagePath);
            if (row.old_profile_path) await fs.rename(path.join(process.cwd(), "public", row.old_profile_path), newProfilePath);
            if (row.old_memory_path) await fs.rename(path.join(process.cwd(), "public", row.old_memory_path), newMemoryPath);
            if (row.old_voice_path) await fs.rename(path.join(process.cwd(), "public", row.old_voice_path), newVoicePath);

            // 資料庫更新
            await pool.query(`UPDATE char_images SET file_name=$1, file_path=$2 WHERE id=$3`,
                [newImageName, `/uploads/${newImageName}`, row.id]);
            await pool.query(`UPDATE char_profile SET file_path=$1 WHERE image_id=$2`,
                [`/uploads/${newProfileName}`, row.id]);
            await pool.query(`UPDATE char_memory SET file_path=$1 WHERE image_id=$2`,
                [`/uploads/${newMemoryName}`, row.id]);
            await pool.query(`UPDATE char_voice SET file_path=$1 WHERE image_id=$2`,
                [`/uploads/${newVoiceName}`, row.id]);
        }

        return res.json({ message: "重新命名成功" });
    } catch (error) {
        console.error("Rename Error:", error);
        return res.status(500).json({
            status: "error",
            message: "重新命名失敗",
            detail: error.message
        });
    }
};







