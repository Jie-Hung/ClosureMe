// 後端檔案管理系統邏輯
const fs = require("fs").promises;
const fsSync = require("fs");
const path = require("path");
const pool = require("../../models/db");
const { deleteFileOnS3 } = require("../../storage");
const { MODE, renameFileOnS3 } = require("../../storage");

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
    const fileName = req.body.fileName;
    try {
        const imageResult = await pool.query(
            "SELECT * FROM char_images WHERE file_name ILIKE $1",
            [`${fileName}.%`]
        );
        if (imageResult.rows.length === 0) {
            return res.status(404).json({ message: "找不到該角色" });
        }

        const image = imageResult.rows[0];

        if (MODE === "s3") {
            const deleteKey = (url) => {
                return url.replace(process.env.AWS_S3_PUBLIC_BASE + "/", "");
            };

            await Promise.all([
                deleteFileOnS3(deleteKey(image.file_path)),
                pool.query("DELETE FROM char_profile WHERE image_id = $1", [image.id]),
                pool.query("DELETE FROM char_memory WHERE image_id = $1", [image.id]),
                pool.query("DELETE FROM char_voice WHERE image_id = $1", [image.id]),
            ]);
        } else {
            const localPath = path.join(__dirname, "../../../public", image.file_path);
            if (fsSync.existsSync(localPath)) await fs.unlink(localPath);
            await pool.query("DELETE FROM char_profile WHERE image_id = $1", [image.id]);
            await pool.query("DELETE FROM char_memory WHERE image_id = $1", [image.id]);
            await pool.query("DELETE FROM char_voice WHERE image_id = $1", [image.id]);
        }

        await pool.query("DELETE FROM char_images WHERE id = $1", [image.id]);

        res.json({ message: "角色已刪除" });
    } catch (err) {
        console.error("刪除錯誤：", err);
        res.status(500).json({ message: "伺服器錯誤" });
    }
};

// 重新命名
exports.renameCharacter = async (req, res) => {
    const { oldName, newName } = req.body;
    try {
        const result = await pool.query(
            "SELECT * FROM char_images WHERE file_name ILIKE $1",
            [`${oldName}.%`]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "找不到該角色" });
        }

        const image = result.rows[0];
        const ext = path.extname(image.file_name);
        const newFileName = `${newName}${ext}`;
        const newFilePath = image.file_path.replace(oldName, newName);

        if (MODE === "s3") {
            const oldKey = `uploads/${image.file_name}`;
            const newKey = `uploads/${newFileName}`;
            await renameFileOnS3(oldKey, newKey);
        } else {
            const oldPath = path.join(__dirname, "../../../public", image.file_path);
            const newPath = path.join(__dirname, "../../../public/uploads", newFileName);
            await fs.rename(oldPath, newPath);
        }

        await pool.query(
            "UPDATE char_images SET file_name = $1, file_path = $2 WHERE id = $3",
            [newFileName, newFilePath, image.id]
        );

        res.json({ message: "角色已重新命名", newFileName });
    } catch (err) {
        console.error("重新命名錯誤：", err);
        res.status(500).json({ message: "伺服器錯誤" });
    }
};







