// characterController.js
const pool = require("../../models/db");
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");

function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function getUniqueFileNameFromDB(baseName, ext) {
    let counter = 0;
    let fileName;

    const escapedBase = escapeRegex(baseName);
    const pattern = `^${escapedBase}(\\(\\d+\\))?\\.[a-zA-Z0-9]+$`; // ✅ 改這裡：允許任意副檔名

    const result = await pool.query(
        `SELECT file_name FROM char_images WHERE file_name ~ $1`,
        [pattern]
    );

    const existingNames = result.rows.map(row => row.file_name.toLowerCase());

    do {
        fileName = counter === 0
            ? `${baseName}${ext}`
            : `${baseName}(${counter})${ext}`;
        counter++;
    } while (existingNames.includes(fileName.toLowerCase()));

    return fileName;
}

// 上傳
exports.upload = async (req, res) => {
    try {
        const { profile, memory, filename } = req.body;
        const user_id = req.user_id;
        const files = req.files?.file || [];
        const imageIds = [];
        const voice = req.files && req.files.voice ? req.files.voice[0] : null;

        let mainImageId = null;
        let mainImagePath = null;

        if (!user_id) return res.status(401).json({ message: "未授權存取" });
        if (!files || !profile || !memory || !filename)
            return res.status(400).json({ message: "缺少必要資料" });

        const cleanName = filename.replace(/[<>:"/\\|?*]+/g, "");
        const uploadDir = path.join(__dirname, "../../../public/uploads");

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const ext = path.extname(file.originalname).toLowerCase();
            const originalName = path.basename(file.originalname, ext);
            const baseName = cleanName || originalName;
            const base = i === 0 ? baseName : `${baseName}(${i})`;
            const uniqueName = await getUniqueFileNameFromDB(base, ext);
            const s3Key = `uploads/${uniqueName}`;
            const filePath = `/uploads/${uniqueName}`;

            let finalPath;

            if (MODE === "s3") {
                finalPath = await uploadBufferToS3({
                    buffer: file.buffer || await fs.readFile(file.path),
                    key: s3Key,
                    contentType: file.mimetype || "application/octet-stream"
                });
            } else {
                const savePath = path.join(uploadDir, uniqueName);
                await fs.rename(file.path, savePath);
                finalPath = filePath;
            }

            const imgResult = await pool.query(
                `INSERT INTO char_images (user_id, file_name, file_path) VALUES ($1, $2, $3) RETURNING id`,
                [user_id, uniqueName, finalPath]
            );

            const imageId = imgResult.rows[0].id;
            imageIds.push(imageId);

            if (i === 0) {
                mainImageId = imageId;
                mainImagePath = finalPath;
            }
        }

        const profileJson = { type: "profile", content: profile };
        const memoryJson = { type: "memory", content: memory };

        const profileFileName = await getUniqueFileNameFromDB(`${cleanName}_profile`, ".json");
        const memoryFileName = await getUniqueFileNameFromDB(`${cleanName}_memory`, ".json");

        const profileBuffer = Buffer.from(JSON.stringify(profileJson, null, 2));
        const memoryBuffer = Buffer.from(JSON.stringify(memoryJson, null, 2));

        let profileFilePath, memoryFilePath;

        if (MODE === "s3") {
            profileFilePath = await uploadBufferToS3({
                buffer: profileBuffer,
                key: `uploads/${profileFileName}`,
                contentType: "application/json"
            });
            memoryFilePath = await uploadBufferToS3({
                buffer: memoryBuffer,
                key: `uploads/${memoryFileName}`,
                contentType: "application/json"
            });
        } else {
            const profilePath = path.join(uploadDir, profileFileName);
            const memoryPath = path.join(uploadDir, memoryFileName);
            await fs.writeFile(profilePath, profileBuffer);
            await fs.writeFile(memoryPath, memoryBuffer);
            profileFilePath = `/uploads/${profileFileName}`;
            memoryFilePath = `/uploads/${memoryFileName}`;
        }

        await pool.query(`INSERT INTO char_profile (image_id, file_path) VALUES ($1, $2)`, [mainImageId, profileFilePath]);
        await pool.query(`INSERT INTO char_memory (image_id, file_path) VALUES ($1, $2)`, [mainImageId, memoryFilePath]);

        if (voice) {
            const voiceExt = path.extname(voice.originalname).toLowerCase();
            const voiceFileName = await getUniqueFileNameFromDB(`${cleanName}_voice`, voiceExt);
            const voiceBuffer = voice.buffer || await fs.readFile(voice.path);

            let voiceFilePath;

            if (MODE === "s3") {
                voiceFilePath = await uploadBufferToS3({
                    buffer: voiceBuffer,
                    key: `uploads/${voiceFileName}`,
                    contentType: voice.mimetype || "audio/wav"
                });
            } else {
                const voicePath = path.join(uploadDir, voiceFileName);
                await fs.rename(voice.path, voicePath);
                voiceFilePath = `/uploads/${voiceFileName}`;
            }

            await pool.query(
                `INSERT INTO char_voice (image_id, file_path) VALUES ($1, $2)`,
                [mainImageId, voiceFilePath]
            );
        }

        return res.status(200).json({
            message: "上傳成功",
            data: {
                filename: cleanName,
                imagePath: mainImagePath,
                profilePath: profileFilePath,
                memoryPath: memoryFilePath
            }
        });

    } catch (error) {
        console.error("上傳錯誤：", error);
        return res.status(500).json({ message: "伺服器錯誤" });
    }
};

// 下載
exports.download = async (req, res) => {
    const { fileName } = req.query;

    if (!req.user_id) {
        return res.status(401).json({ message: "未授權存取" });
    }

    if (!fileName) {
        return res.status(400).json({ message: "請提供角色名稱" });
    }

    try {
        const result = await pool.query(`
            SELECT 
                i.file_name,
                i.file_path AS image_path,
                p.file_path AS profile_path,
                m.file_path AS memory_path,
                v.file_path AS voice_path
            FROM char_images i
            LEFT JOIN char_profile p ON i.id = p.image_id
            LEFT JOIN char_memory m ON i.id = m.image_id
            LEFT JOIN char_voice v ON i.id = v.image_id
            WHERE LEFT(i.file_name, POSITION('.' IN i.file_name) - 1) = $1
        `, [fileName]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "查無對應角色" });
        }

        const character = result.rows[0];
        return res.status(200).json({
            message: "下載成功",
            data: {
                filename: character.file_name,
                imagePath: character.image_path,
                profilePath: character.profile_path,
                memoryPath: character.memory_path,
                voicePath: character.voice_path
            }
        });

    } catch (error) {
        console.error("下載錯誤：", error);
        return res.status(500).json({ message: "伺服器錯誤" });
    }
};








