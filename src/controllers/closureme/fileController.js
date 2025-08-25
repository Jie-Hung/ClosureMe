// controllers/closureme/fileController.js
const fs = require("fs").promises;
const pool = require("../../models/db");
const { renameFileOnS3, deleteFileOnS3 } = require("../../storage");

// 只讓「有模型」的角色出現在清單（仍保留此條件）
exports.getFiles = async (req, res) => {
  const userId = req.user_id;
  const addV = (url, v) => (url ? `${url}${url.includes('?') ? '&' : '?'}v=${encodeURIComponent(v)}` : null);
  if (!userId) return res.status(401).json({ message: "未授權存取" });

  try {
    const { rows } = await pool.query(`
      SELECT
        ci.id            AS image_id,
        ci.upload_batch,
        ci.file_name,
        ci.file_path     AS image_path,
        cp.file_path     AS profile_path,
        cmem.file_path   AS memory_path,
        ci.uploaded_at
      FROM char_images ci
      LEFT JOIN LATERAL (
        SELECT p.file_path FROM char_profile p
        WHERE p.image_id = ci.id
        ORDER BY p.id DESC NULLS LAST
        LIMIT 1
      ) cp ON TRUE
      LEFT JOIN LATERAL (
        SELECT m.file_path FROM char_memory m
        WHERE m.image_id = ci.id
        ORDER BY m.id DESC NULLS LAST
        LIMIT 1
      ) cmem ON TRUE
      LEFT JOIN LATERAL (
        SELECT mo.file_path FROM char_model mo
        WHERE mo.image_id = ci.id
        ORDER BY mo.id DESC NULLS LAST
        LIMIT 1
      ) cmodel ON TRUE
      WHERE ci.user_id = $1
        AND ci.role_type = 'main'
        AND cmodel.file_path IS NOT NULL
      ORDER BY ci.uploaded_at DESC
    `, [userId]);

    const files = rows.map(r => ({
      image_id:     r.image_id,
      upload_batch: r.upload_batch,
      file_name:    r.file_name,
      image_path:   addV(r.image_path,  r.uploaded_at || Date.now()),
      profile_path: addV(r.profile_path, r.uploaded_at || Date.now()),
      memory_path:  addV(r.memory_path,  r.uploaded_at || Date.now()),
      uploaded_at:  r.uploaded_at,
    }));

    res.status(200).json({ message: "取得成功", data: files });
  } catch (err) {
    console.error("Get Files Error:", err);
    res.status(500).json({ message: "伺服器錯誤", error: err.message });
  }
};

// 首頁角色清單：同樣只顯示「有模型」的角色（不回傳 voice/model 欄位）
exports.getMainList = async (req, res) => {
  const userId = req.user_id;
  if (!userId) return res.status(401).json({ message: "未授權存取" });

  try {
    const { rows } = await pool.query(`
      SELECT
        ci.file_name,
        ci.file_path     AS image_path,
        cp.file_path     AS profile_path,
        cmem.file_path   AS memory_path,
        ci.uploaded_at
      FROM char_images ci
      LEFT JOIN LATERAL (
        SELECT p.file_path FROM char_profile p
        WHERE p.image_id = ci.id
        ORDER BY p.id DESC NULLS LAST
        LIMIT 1
      ) cp ON TRUE
      LEFT JOIN LATERAL (
        SELECT m.file_path FROM char_memory m
        WHERE m.image_id = ci.id
        ORDER BY m.id DESC NULLS LAST
        LIMIT 1
      ) cmem ON TRUE
      LEFT JOIN LATERAL (
        SELECT mo.file_path FROM char_model mo
        WHERE mo.image_id = ci.id
        ORDER BY mo.id DESC NULLS LAST
        LIMIT 1
      ) cmodel ON TRUE
      WHERE ci.user_id = $1
        AND ci.role_type = 'main'
        AND cmodel.file_path IS NOT NULL
      ORDER BY ci.uploaded_at DESC
    `, [userId]);

    res.json({ message: "OK", data: rows });
  } catch (err) {
    console.error("getMainList error:", err);
    res.status(500).json({ message: "伺服器錯誤" });
  }
};





// 取得所有主圖（供 1/5 綁定模型使用）
// - 回傳 has_model 旗標，前端可只顯示「尚未綁定」或灰掉已綁定
exports.getMainImagesForBinding = async (req, res) => {
  const userId = req.user_id;
  if (!userId) return res.status(401).json({ message: "未授權存取" });

  try {
    const { rows } = await pool.query(`
      SELECT
        ci.id               AS image_id,
        ci.file_name,
        ci.file_path        AS image_path,
        ci.upload_batch,
        ci.uploaded_at,
        EXISTS (
          SELECT 1 FROM char_model m WHERE m.image_id = ci.id
        ) AS has_model
      FROM char_images ci
      WHERE ci.user_id = $1
        AND ci.role_type = 'main'
      ORDER BY has_model ASC, ci.uploaded_at DESC
    `, [userId]);

    res.json({ message: "OK", data: rows });
  } catch (err) {
    console.error("getMainImagesForBinding error:", err);
    res.status(500).json({ message: "伺服器錯誤" });
  }
};

// 刪除角色（保留原有行為：會把 profile/memory/voice/model 一起刪）
// 刪除角色（會把 profile/memory/voice/model + main/head/body 一併刪）
exports.deleteCharacter = async (req, res) => {
  const { fileName, uploadBatch } = req.body;
  const userId = req.user_id;
  if (!fileName && !uploadBatch) {
    return res.status(400).json({ message: "缺少參數（需 fileName 或 uploadBatch）" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 取得要刪的「基底名」列表（不含副檔名）
    let bases = [];
    if (fileName) {
      bases = [fileName.replace(/\.[^.]+$/, "")];
    } else {
      const r0 = await client.query(`
        SELECT file_name, role_type
        FROM char_images
        WHERE user_id=$1 AND upload_batch=$2
      `, [userId, uploadBatch]);

      if (!r0.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "查無此批次圖片" });
      }
      // 取每張圖片的「去尾綴」基底
      bases = [...new Set(
        r0.rows.map(({ file_name }) =>
          file_name.replace(/\.[^.]+$/, "").replace(/_(head|body)$/i, "")
        )
      )];
    }

    // 把 main/head/body 都一起抓出來（去掉 _head/_body 後比對）
    const { rows: images } = await client.query(`
      SELECT id, file_path
      FROM char_images
      WHERE user_id = $1
        AND regexp_replace(split_part(file_name,'.',1), '_(head|body)$', '', 'i') = ANY($2)
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
        UNION ALL
      SELECT file_path FROM char_model   WHERE image_id = ANY($1)
    `, [imageIds]);

    // 先刪 S3 檔案
    for (const img of images) {
      const key = new URL(img.file_path).pathname.replace(/^\/+/, "");
      await deleteFileOnS3(key);
    }
    for (const m of metaRes.rows) {
      const key = new URL(m.file_path).pathname.replace(/^\/+/, "");
      await deleteFileOnS3(key);
    }

    // 再刪 DB
    await client.query(`DELETE FROM char_profile WHERE image_id = ANY($1)`, [imageIds]);
    await client.query(`DELETE FROM char_memory  WHERE image_id = ANY($1)`, [imageIds]);
    await client.query(`DELETE FROM char_voice   WHERE image_id = ANY($1)`, [imageIds]);
    await client.query(`DELETE FROM char_model   WHERE image_id = ANY($1)`, [imageIds]);
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

// 重新命名（維持原有行為；如需連動模型檔名，可再加）
// 重新命名（連同 model 一起）
exports.renameCharacter = async (req, res) => {
  const { uploadBatch, newName, fileName } = req.body;
  const userId = req.user_id;
  if ((!uploadBatch && !fileName) || !newName) {
    return res.status(400).json({ message: "缺少參數（需 uploadBatch 或 fileName，且需 newName）" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 取得「基底名」列表
    let bases = [];
    if (fileName) {
      bases = [fileName.replace(/\.[^.]+$/, "")];
    } else {
      const r0 = await client.query(`
        SELECT file_name
        FROM char_images
        WHERE user_id=$1 AND upload_batch=$2
      `, [userId, uploadBatch]);

      if (!r0.rowCount) {
        await client.query("ROLLBACK");
        return res.status(404).json({ message: "找不到此批次圖片" });
      }

      bases = [...new Set(
        r0.rows.map(({ file_name }) =>
          file_name.replace(/\.[^.]+$/, "").replace(/_(head|body)$/i, "")
        )
      )];
    }

    // 先找出所有 main/head/body
    const { rows: images } = await client.query(`
      SELECT id, file_name, file_path, role_type
      FROM char_images
      WHERE user_id=$1
        AND regexp_replace(split_part(file_name,'.',1), '_(head|body)$', '', 'i') = ANY($2)
    `, [userId, bases]);

    if (!images.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ message: "找不到要重新命名的圖片" });
    }

    // 逐一改 S3 + DB
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

    // 找出這些圖片對應的 meta（含 model），一併改名
    const imageIds = images.map(i => i.id);
    const metaRes = await client.query(`
      SELECT 'profile' AS kind, id, file_path FROM char_profile WHERE image_id = ANY($1)
        UNION ALL
      SELECT 'memory'  AS kind, id, file_path FROM char_memory WHERE image_id = ANY($1)
        UNION ALL
      SELECT 'voice'   AS kind, id, file_path FROM char_voice   WHERE image_id = ANY($1)
        UNION ALL
      SELECT 'model'   AS kind, id, file_path FROM char_model   WHERE image_id = ANY($1)
    `, [imageIds]);

    for (const m of metaRes.rows) {
      const oldKey = new URL(m.file_path).pathname.replace(/^\/+/, "");
      const ext = oldKey.match(/\.[a-zA-Z0-9]+$/)?.[0] ||
        (m.kind === "voice" ? ".wav" :
         m.kind === "profile" || m.kind === "memory" ? ".json" : ".fbx");

      const newKey = (m.kind === "model")
        ? `uploads/${newName}${ext}`                // 模型：newName.fbx|glb|gltf
        : `uploads/${newName}_${m.kind}${ext}`;    // 其他：newName_profile.json 等

      await renameFileOnS3(oldKey, newKey);

      const publicBase = process.env.AWS_S3_PUBLIC_BASE;
      const newUrl = publicBase ? `${publicBase}/${newKey}` : m.file_path.replace(/\/uploads\/.+$/, `/${newKey}`);

      if (m.kind === "profile") {
        await client.query(`UPDATE char_profile SET file_path=$1 WHERE id=$2`, [newUrl, m.id]);
      } else if (m.kind === "memory") {
        await client.query(`UPDATE char_memory  SET file_path=$1 WHERE id=$2`, [newUrl, m.id]);
      } else if (m.kind === "voice") {
        await client.query(`UPDATE char_voice   SET file_path=$1 WHERE id=$2`, [newUrl, m.id]);
      } else if (m.kind === "model") {
        await client.query(`UPDATE char_model   SET file_path=$1 WHERE id=$2`, [newUrl, m.id]);
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

