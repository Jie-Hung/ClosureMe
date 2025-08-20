// characterController.js 
const pool = require("../../models/db");
const path = require("path");
const fs = require("fs").promises;
const { MODE, uploadBufferToS3 } = require("../../storage");
const https = require("https");
const http = require("http");
const { v4: uuidv4 } = require("uuid");

function toSafeBaseName(name) {
    let base = String(name || "")
        .replace(/\.[^.]+$/, "")
        .replace(/[^A-Za-z0-9_-]+/g, "_")
        .replace(/_+/g, "_")
        .replace(/^_+|_+$/g, "");
    return base || "file";
}

// 檔名不重複
async function getUniqueFileNameFromDB(baseName, ext) {
    const base = toSafeBaseName(baseName);
    const safeExt = (ext || ".png").toLowerCase();

    const pattern = `^${base}(?:\\([0-9]+\\))?\\.[A-Za-z0-9]+$`;
    const result = await pool.query(
        `SELECT file_name FROM char_images WHERE file_name ~ $1`,
        [pattern]
    );
    const existing = new Set(result.rows.map(r => r.file_name.toLowerCase()));

    let i = 0, candidate;
    do {
        candidate = i === 0 ? `${base}${safeExt}` : `${base}(${i}${safeExt})`;
        i++;
    } while (existing.has(candidate.toLowerCase()));

    return candidate;
}

// 上傳
exports.upload = async (req, res) => {
    try {
        const { profile, memory, filename } = req.body;
        const user_id = req.user_id;
        const files = req.files?.file || [];
        const voice = req.files?.voice?.[0] || null;

        if (!user_id) return res.status(401).json({ message: "未授權存取" });
        if (!files.length || profile == null || memory == null || !filename) {
            return res.status(400).json({ message: "缺少必要資料" });
        }

        const cleanName = String(filename).replace(/[<>:"/\\|?*]+/g, "");

        let upload_batch = req.body.uploadBatch || req.body.upload_batch || null;

        if (!upload_batch) {
            const q = await pool.query(`
                SELECT upload_batch
                FROM char_images
                WHERE user_id = $1
                  AND (split_part(file_name, '.', 1) = $2 OR split_part(file_name, '_', 1) = $2)
                ORDER BY uploaded_at DESC
                LIMIT 1
            `, [user_id, cleanName]);
            if (q.rowCount) {
                upload_batch = q.rows[0].upload_batch;
            } else {
                upload_batch = uuidv4();
            }
        }

        const uploadDir = path.join(__dirname, "../../../public/uploads");

        let mainImageId = null;
        let mainImagePath = null;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const ext = path.extname(file.originalname || "").toLowerCase() || ".png";

            const isHead = /_head(\.[a-z0-9]+)?$/i.test(file.originalname || "");
            const isBody = /_body(\.[a-z0-9]+)?$/i.test(file.originalname || "");
            const isFull = !isHead && !isBody;

            const roleType = isHead ? "head" : isBody ? "body" : (mainImageId ? "gallery" : "main");

            const base = cleanName + (isHead ? "_head" : isBody ? "_body" : "");
            const uniqueName = await getUniqueFileNameFromDB(base, ext);
            const s3Key = `uploads/${uniqueName}`;
            const filePath = `/uploads/${uniqueName}`;

            const buffer =
                file.buffer ||
                (file.path ? await fs.readFile(file.path) : null);
            if (!buffer) {
                return res.status(400).json({ message: "檔案內容為空" });
            }

            const finalPath =
                MODE === "s3"
                    ? await uploadBufferToS3({
                        buffer,
                        key: s3Key,
                        contentType: file.mimetype || "application/octet-stream",
                    })
                    : (await fs.rename(
                        file.path,
                        path.join(uploadDir, uniqueName)
                    ),
                        filePath);

            const imgResult = await pool.query(
                `INSERT INTO char_images (user_id, file_name, file_path, upload_batch, role_type) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
                [user_id, uniqueName, finalPath, upload_batch, roleType]
            );

            const imageId = imgResult.rows[0].id;
            if (isFull && !mainImageId) {
                mainImageId = imageId;
                mainImagePath = finalPath;
            }
        }

        const saveJsonFile = async (type, content) => {
            const json = { type, content };
            const fileName = await getUniqueFileNameFromDB(
                `${cleanName}_${type}`,
                ".json"
            );
            const buffer = Buffer.from(JSON.stringify(json, null, 2));
            const key = `uploads/${fileName}`;

            return MODE === "s3"
                ? await uploadBufferToS3({
                    buffer,
                    key,
                    contentType: "application/json",
                })
                : (await fs.writeFile(path.join(uploadDir, fileName), buffer),
                    `/uploads/${fileName}`);
        };

        const profilePath = await saveJsonFile("profile", profile);
        const memoryPath = await saveJsonFile("memory", memory);

        await pool.query(
            `INSERT INTO char_profile (image_id, file_path) VALUES ($1, $2)`,
            [mainImageId, profilePath]
        );
        await pool.query(
            `INSERT INTO char_memory (image_id, file_path) VALUES ($1, $2)`,
            [mainImageId, memoryPath]
        );

        if (voice) {
            const voiceExt = path.extname(voice.originalname || "").toLowerCase() || ".wav";
            const voiceFileName = await getUniqueFileNameFromDB(
                `${cleanName}_voice`,
                voiceExt
            );
            const voiceBuffer =
                voice.buffer ||
                (voice.path ? await fs.readFile(voice.path) : null);
            if (voiceBuffer) {
                const voiceKey = `uploads/${voiceFileName}`;
                const voicePath =
                    MODE === "s3"
                        ? await uploadBufferToS3({
                            buffer: voiceBuffer,
                            key: voiceKey,
                            contentType: voice.mimetype || "audio/wav",
                        })
                        : (await fs.rename(
                            voice.path,
                            path.join(uploadDir, voiceFileName)
                        ),
                            `/uploads/${voiceFileName}`);

                await pool.query(
                    `INSERT INTO char_voice (image_id, file_path) VALUES ($1, $2)`,
                    [mainImageId, voicePath]
                );
            }
        }

        res.status(200).json({
            message: "上傳成功",
            data: {
                filename: cleanName,
                imagePath: mainImagePath,
                profilePath,
                memoryPath,
                uploadBatch: upload_batch,
            },
        });
    } catch (error) {
        console.error("❌ 上傳錯誤：", error);
        res.status(500).json({ message: "伺服器錯誤" });
    }
};

// 伺服器端代理下載
exports.proxyDownload = async (req, res) => {
    const { url, filename } = req.query;

    if (!url || !filename) {
        return res.status(400).json({ message: "缺少參數 url 或 filename" });
    }

    try {
        const client = url.startsWith("https") ? https : http;

        client
            .get(url, (fileRes) => {
                if (fileRes.statusCode !== 200) {
                    return res
                        .status(fileRes.statusCode)
                        .json({ message: "遠端資源無法存取" });
                }

                res.setHeader(
                    "Content-Type",
                    fileRes.headers["content-type"] || "application/octet-stream"
                );
                res.setHeader(
                    "Content-Disposition",
                    `attachment; filename="${filename}"`
                );

                fileRes.pipe(res);
            })
            .on("error", (err) => {
                console.error("代理下載錯誤：", err);
                res.status(500).json({ message: "代理下載失敗" });
            });
    } catch (error) {
        console.error("proxyDownload 錯誤：", error);
        res.status(500).json({ message: "伺服器錯誤" });
    }
};

// 下載
exports.download = async (req, res) => {
    const { fileName } = req.query;

    if (!req.user_id) {
        return res.status(401).json({ message: "未授權存取" });
    }

    if (!fileName) {
        return res.status(400).json({ message: "請提供角色名稱（含副檔名）" });
    }

    try {
        const result = await pool.query(`
            SELECT i.file_name,
                   i.file_path AS image_path,
                   p.file_path AS profile_path,
                   m.file_path AS memory_path,
                   v.file_path AS voice_path
            FROM char_images i
            LEFT JOIN char_profile p ON i.id = p.image_id
            LEFT JOIN char_memory  m ON i.id = m.image_id
            LEFT JOIN char_voice   v ON i.id = v.image_id
            WHERE i.file_name = $1
              AND i.role_type = 'main'
        `, [fileName]);

        if (result.rows.length === 0) {
            return res.status(404).json({ message: "查無對應角色主圖" });
        }

        const character = result.rows[0];
        return res.status(200).json({
            message: "下載成功",
            data: {
                filename: character.file_name,
                imagePath: character.image_path,
                profilePath: character.profile_path,
                memoryPath: character.memory_path,
                voicePath: character.voice_path,
            },
        });
    } catch (error) {
        console.error("下載錯誤：", error);
        return res.status(500).json({ message: "伺服器錯誤" });
    }
};

// 分割圖片上傳
exports.splitCharacter = async (req, res) => {
    try {
        const { head, body } = req.files;
        const filename = req.body.filename || `char_${uuidv4()}`;
        const clientBatch = req.body.upload_batch;
        const userId = req.user_id;

        if (!head || !body) {
            return res.status(400).json({ message: "缺少圖片檔案" });
        }

        const headFile = req.files.head[0];
        const bodyFile = req.files.body[0];

        headFile.originalname = `${filename}_head.png`;
        bodyFile.originalname = `${filename}_body.png`;

        const safeBase = String(filename).replace(/[<>:"/\\|?*]+/g, "");
        let uploadBatch = req.body.upload_batch || req.body.uploadBatch || null;
        if (!uploadBatch) {
            const anyQ = await pool.query(`
                SELECT upload_batch FROM char_images
                WHERE user_id = $1
                  AND (split_part(file_name,'.',1) = $2 OR split_part(file_name,'_',1) = $2)
                ORDER BY uploaded_at DESC
                LIMIT 1
            `, [req.user_id, safeBase]);
            uploadBatch = anyQ.rowCount ? anyQ.rows[0].upload_batch : uuidv4();
        }

        const uploadAndSave = async (file, roleType) => {
            const ext = ".png";
            const safeBase = toSafeBaseName(filename);
            const newFileName = `${safeBase}_${roleType}${ext}`;
            const key = `uploads/${newFileName}`;
            const fileUrl = await uploadBufferToS3({
                buffer: file.buffer,
                key,
                contentType: file.mimetype || "image/png",
            });

            await pool.query(
                `INSERT INTO char_images (user_id, file_name, file_path, upload_batch, role_type) VALUES ($1, $2, $3, $4, $5)`,
                [userId, newFileName, fileUrl, uploadBatch, roleType]
            );
            return { fileName: newFileName, filePath: fileUrl, roleType };
        };

        const savedHead = await uploadAndSave(headFile, "head");
        const savedBody = await uploadAndSave(bodyFile, "body");

        return res.json({
            message: "分割圖片上傳成功",
            head: savedHead,
            body: savedBody,
            upload_batch: uploadBatch
        });
    } catch (error) {
        console.error("❌ splitCharacter error:", error);
        return res.status(500).json({ message: "分割上傳失敗", error: error.message });
    }
};