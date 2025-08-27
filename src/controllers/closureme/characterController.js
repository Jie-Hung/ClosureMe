// characterController.js 
const pool = require("../../models/db");
const path = require("path");
const fs = require("fs").promises;
const { MODE, uploadBufferToS3 } = require("../../storage");
const https = require("https");
const http = require("http");
const { v4: uuidv4 } = require("uuid");

/** ---------------------------
 * 共用工具
 * -------------------------- */
function toSafeBaseName(name) {
  let base = String(name || "")
    .replace(/\.[^.]+$/, "")
    .replace(/[^A-Za-z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return base || "file";
}

// 檔名不重複（於資料庫中避免撞名）
async function getUniqueFileNameFromDB(baseName, ext) {
  const base = toSafeBaseName(baseName);
  const safeExt = (ext || ".png").toLowerCase();

  const pattern = `^${base}(?:\\([0-9]+\\))?\\.[A-Za-z0-9]+$`;
  const result = await pool.query(
    `SELECT file_name FROM char_images WHERE file_name ~ $1`,
    [pattern]
  );
  const existing = new Set(result.rows.map((r) => r.file_name.toLowerCase()));

  let i = 0,
    candidate;
  do {
    candidate = i === 0 ? `${base}${safeExt}` : `${base}(${i})${safeExt}`;
    i++;
  } while (existing.has(candidate.toLowerCase()));

  return candidate;
}

// 由 imageId 反推「角色基底名」：KD.png → KD、KD_head.png → KD
async function getBaseNameByImageId(imageId) {
  const r = await pool.query(
    `SELECT file_name, role_type FROM char_images WHERE id = $1`,
    [imageId]
  );
  if (!r.rowCount) throw new Error("找不到對應的主圖 (imageId)");
  const { file_name, role_type } = r.rows[0];
  const base =
    role_type && role_type !== "main"
      ? file_name.split("_", 1)[0] // KD_head.png → KD
      : file_name.split(".", 1)[0]; // KD.png → KD
  return toSafeBaseName(base);
}

const uploadDir = path.join(__dirname, "../../../public/uploads");

/** ---------------------------
 * （新）只儲存人物資訊：profile/memory/voice
 * 不處理任何圖片
 * POST /api/character-info   (multipart; fields: imageId, profile?, memory?, voice?)
 * -------------------------- */
// 以角色名為基底，統一命名：<base>_profile.json / _memory.json / _voice.wav
exports.saveCharacterInfo = async (req, res) => {
  try {
    const userId = req.user_id;
    const imageId = req.body.imageId; // 前端傳駝峰
    const profileRaw = (req.body.profile ?? "").toString();
    const memoryRaw = (req.body.memory ?? "").toString();
    const voice = (req.files?.voice && req.files.voice[0]) || null;

    if (!userId || !imageId) {
      return res.status(400).json({ message: "缺少 imageId" });
    }

    const base = await getBaseNameByImageId(imageId);

    // 轉漂亮 JSON（若不是 JSON 就包成 {text: "..."}）
    const toPrettyJsonBuffer = (text) => {
      let obj;
      try {
        obj = JSON.parse(text);
      } catch {
        obj = { text: text };
      }
      return Buffer.from(JSON.stringify(obj, null, 2), "utf-8");
    };

    // 先刪舊紀錄，避免多筆
    await pool.query(`DELETE FROM char_profile WHERE image_id=$1`, [imageId]);
    await pool.query(`DELETE FROM char_memory  WHERE image_id=$1`, [imageId]);
    await pool.query(`DELETE FROM char_voice   WHERE image_id=$1`, [imageId]);

    // profile.json
    const profileKey = `uploads/${base}_profile.json`;
    const profileUrl = await uploadBufferToS3({
      buffer: toPrettyJsonBuffer(profileRaw),
      key: profileKey,
      contentType: "application/json",
    });
    await pool.query(
      `INSERT INTO char_profile (image_id, file_path) VALUES ($1,$2)`,
      [imageId, profileUrl]
    );

    // memory.json
    const memoryKey = `uploads/${base}_memory.json`;
    const memoryUrl = await uploadBufferToS3({
      buffer: toPrettyJsonBuffer(memoryRaw),
      key: memoryKey,
      contentType: "application/json",
    });
    await pool.query(
      `INSERT INTO char_memory (image_id, file_path) VALUES ($1,$2)`,
      [imageId, memoryUrl]
    );

    // voice.wav（可選）
    if (voice) {
      const voiceKey = `uploads/${base}_voice.wav`;
      const voiceUrl = await uploadBufferToS3({
        buffer: voice.buffer,
        key: voiceKey,
        contentType: voice.mimetype || "audio/wav",
      });
      await pool.query(
        `INSERT INTO char_voice (image_id, file_path) VALUES ($1,$2)`,
        [imageId, voiceUrl]
      );
    }

    return res.json({ message: "人物資訊已保存（JSON 內容 & 防快取）" });
  } catch (err) {
    console.error("saveCharacterInfo error:", err);
    return res.status(500).json({ message: "保存失敗", error: err.message });
  }
};

/** ---------------------------
 * （新）上傳 3D 模型（與 imageId 綁定）
 * POST /api/upload-model   (multipart; fields: imageId, model)
 * -------------------------- */
// 模型統一命名：<base>.<fbx|glb|gltf>（例如 KD.fbx）
exports.uploadModel = async (req, res) => {
  try {
    const userId = req.user_id;
    const imageId = req.body.imageId || req.body.image_id; // 相容舊欄位
    const file = req.file;

    if (!userId || !imageId || !file) {
      return res.status(400).json({ message: "缺少 imageId 或模型檔" });
    }

    const base = await getBaseNameByImageId(imageId);
    const ext = (file.originalname?.split(".").pop() || "").toLowerCase();
    if (!["fbx", "glb", "gltf"].includes(ext)) {
      return res.status(400).json({ message: "僅支援 .fbx " });
    }

    await pool.query(`DELETE FROM char_model WHERE image_id=$1`, [imageId]);

    const key = `uploads/${base}.${ext}`;
    const fileUrl = await uploadBufferToS3({
      buffer: file.buffer,
      key,
      contentType: file.mimetype || "application/octet-stream",
    });

    await pool.query(
      `INSERT INTO char_model (image_id, file_path) VALUES ($1,$2)`,
      [imageId, fileUrl]
    );

    return res.json({ message: "模型已上傳（防快取）", file_path: fileUrl });
  } catch (err) {
    console.error("uploadModel error:", err);
    return res.status(500).json({ message: "模型上傳失敗", error: err.message });
  }
};

/** ---------------------------
 * （保留）伺服器端代理下載
 * GET /api/proxy-download?url=&filename=
 * -------------------------- */
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

/** ---------------------------
 * （保留）下載描述用資訊整包
 * GET /api/download?fileName=主圖檔名(含副檔名)
 * -------------------------- */
exports.download = async (req, res) => {
  const { fileName } = req.query;

  if (!req.user_id) {
    return res.status(401).json({ message: "未授權存取" });
  }
  if (!fileName) {
    return res.status(400).json({ message: "請提供角色名稱（含副檔名）" });
  }

  try {
    const result = await pool.query(
      `
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
      `,
      [fileName]
    );

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

/** ---------------------------
 * 圖片分割上傳（head/body）
 * POST /api/split-character   (multipart; fields: filename, head, body, upload_batch?)
 * -------------------------- */
exports.splitCharacter = async (req, res) => {
  try {
    const { head, body, main } = req.files;
    const filename = req.body.filename || `char_${uuidv4()}`;
    const userId = req.user_id;

    if (!head || !body) {
      return res.status(400).json({ message: "缺少圖片檔案" });
    }

    const headFile = head[0];
    const bodyFile = body[0];
    const mainFile = main?.[0] || null;

    headFile.originalname = `${filename}_001.png`;
    bodyFile.originalname = `${filename}_002.png`;
    if (mainFile && !mainFile.originalname)
      mainFile.originalname = `${filename}.png`;

    const safeBase = toSafeBaseName(filename);

    // 取得 / 建立同一個 upload_batch
    let uploadBatch = req.body.upload_batch || req.body.uploadBatch || null;
    if (!uploadBatch) {
      const anyQ = await pool.query(
        `
        SELECT upload_batch FROM char_images
        WHERE user_id = $1
          AND (split_part(file_name,'.',1) = $2 OR split_part(file_name,'_',1) = $2)
        ORDER BY uploaded_at DESC
        LIMIT 1
        `,
        [userId, safeBase]
      );
      uploadBatch = anyQ.rowCount ? anyQ.rows[0].upload_batch : uuidv4();
    }

    const uploadAndSave = async (file, roleType) => {
      const ext = ".png";
      let suffix = "000";
      if (roleType === "head") suffix = "001";
      else if (roleType === "body") suffix = "002";
      else if (roleType === "main") suffix = "000"; 

      const newFileName = await getUniqueFileNameFromDB(
        suffix === "000" ? safeBase : `${safeBase}_${suffix}`,
        ext
      );
      const key = `uploads/${newFileName}`;

      const fileUrl = await uploadBufferToS3({
        buffer: file.buffer,
        key,
        contentType: file.mimetype || "image/png",
      });

      const ins = await pool.query(
        `INSERT INTO char_images (user_id, file_name, file_path, upload_batch, role_type)
         VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [userId, newFileName, fileUrl, uploadBatch, roleType]
      );
      return {
        id: ins.rows[0].id,
        fileName: newFileName,
        filePath: fileUrl,
        roleType,
      };
    };

    const savedHead = await uploadAndSave(headFile, "head");
    const savedBody = await uploadAndSave(bodyFile, "body");

    let savedMain = null;
    if (mainFile) {
      savedMain = await uploadAndSave(mainFile, "main");
    } else {
      savedMain = await uploadAndSave(bodyFile, "main");
    }

    return res.json({
      message: "分割圖片上傳成功",
      head: savedHead,
      body: savedBody,
      main: savedMain,
      upload_batch: uploadBatch,
    });
  } catch (error) {
    console.error("❌ splitCharacter error:", error);
    return res
      .status(500)
      .json({ message: "分割上傳失敗", error: error.message });
  }
};

/** ---------------------------
 * （相容）舊的一次性上傳接口（圖片＋描述＋語音）
 * 仍保留，但新前端不再使用
 * -------------------------- */
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
      const q = await pool.query(
        `
        SELECT upload_batch
        FROM char_images
        WHERE user_id = $1
          AND (split_part(file_name, '.', 1) = $2 OR split_part(file_name, '_', 1) = $2)
        ORDER BY uploaded_at DESC
        LIMIT 1
        `,
        [user_id, cleanName]
      );
      upload_batch = q.rowCount ? q.rows[0].upload_batch : uuidv4();
    }

    let mainImageId = null;
    let mainImagePath = null;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext =
        path.extname(file.originalname || "").toLowerCase() || ".png";

      const isHead = /_head(\.[a-z0-9]+)?$/i.test(file.originalname || "");
      const isBody = /_body(\.[a-z0-9]+)?$/i.test(file.originalname || "");
      const isFull = !isHead && !isBody;

      const roleType = isHead
        ? "head"
        : isBody
          ? "body"
          : mainImageId
            ? "gallery"
            : "main";

      const base =
        toSafeBaseName(cleanName) + (isHead ? "_head" : isBody ? "_body" : "");
      const uniqueName = await getUniqueFileNameFromDB(base, ext);
      const s3Key = `uploads/${uniqueName}`;

      const buffer =
        file.buffer || (file.path ? await fs.readFile(file.path) : null);
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
          : (await fs.rename(file.path, path.join(uploadDir, uniqueName)),
            `/uploads/${uniqueName}`);

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
        `${toSafeBaseName(cleanName)}_${type}`,
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
      const voiceExt =
        path.extname(voice.originalname || "").toLowerCase() || ".wav";
      const voiceFileName = await getUniqueFileNameFromDB(
        `${toSafeBaseName(cleanName)}_voice`,
        voiceExt
      );
      const voiceBuffer =
        voice.buffer || (voice.path ? await fs.readFile(voice.path) : null);
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
      message: "上傳成功（舊流程）",
      data: {
        filename: toSafeBaseName(cleanName),
        imagePath: mainImagePath,
        profilePath,
        memoryPath,
        uploadBatch: req.body.uploadBatch || req.body.upload_batch,
      },
    });
  } catch (error) {
    console.error("❌ 上傳錯誤：", error);
    res.status(500).json({ message: "伺服器錯誤" });
  }
};

// 取得尚未處理為 .fbx 的主圖片清單
exports.getPendingImages = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ci.id, ci.file_name, ci.file_path, ci.upload_batch
      FROM char_images ci
      WHERE ci.role_type IN ('head', 'body')
        AND ci.upload_batch IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM char_model cm
          WHERE cm.image_id = ci.id
        )
      ORDER BY ci.uploaded_at ASC
    `);
    res.status(200).json(result.rows);
  } catch (err) {
    console.error("❌ getPendingImages error:", err);
    res.status(500).json({ message: "伺服器錯誤" });
  }
};