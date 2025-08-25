// storage.js
const AWS = require("aws-sdk");

const MODE = process.env.STORAGE_MODE || "local";

const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

// 允許 ()；加入 gltf
const KEY_OK =
  /^uploads\/[A-Za-z0-9_\-()]+(?:_(?:head|body|profile|memory|voice))?\.(?:png|jpg|jpeg|webp|gif|json|wav|fbx|glb|gltf)$/i;

function assertSafeKey(key) {
  if (!KEY_OK.test(key)) {
    const err = new Error(
      `[S3 Key Rejected] Invalid key: "${key}". Expected pattern: ${KEY_OK}`
    );
    console.error(err.stack);
    throw err;
  }
}

// 放在檔案上方 function 旁（任意位置都可）
function encodeS3KeyPreserveSlashes(key) {
  // 只編碼各段字元，保留路徑斜線
  return key.split('/').map(encodeURIComponent).join('/');
}


/**
 * 上傳 Buffer 到 S3（強制不快取，避免覆蓋後還拿到舊檔）
 */
async function uploadBufferToS3({ buffer, key, contentType, cacheControl }) {
  assertSafeKey(key);

  const result = await s3
    .upload({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType || "application/octet-stream",
      CacheControl: cacheControl || "no-cache, no-store, must-revalidate",
      Expires: new Date(0),
    })
    .promise();

  if (process.env.AWS_S3_PUBLIC_BASE) {
    return `${process.env.AWS_S3_PUBLIC_BASE}/${key}`;
  }
  return result.Location;
}

/**
 * 重新命名（copy + delete）
 * 一定要 MetadataDirective: 'REPLACE' 才會套用新的 Cache-Control。
 */
// 取代你的 renameFileOnS3（只差 CopySource 的寫法）
async function renameFileOnS3(sourceKey, destinationKey) {
  assertSafeKey(sourceKey);
  assertSafeKey(destinationKey);

  // ⛔ 別用 encodeURIComponent(sourceKey)
  // ✅ 改用分段編碼，保留 '/'
  const copySource = `${process.env.AWS_S3_BUCKET}/${encodeS3KeyPreserveSlashes(sourceKey)}`;

  await s3.copyObject({
    Bucket: process.env.AWS_S3_BUCKET,
    CopySource: copySource,
    Key: destinationKey,
    MetadataDirective: "REPLACE",
    CacheControl: "no-cache, no-store, must-revalidate",
    Expires: new Date(0),
  }).promise();

  await s3.deleteObject({
    Bucket: process.env.AWS_S3_BUCKET,
    Key: sourceKey,
  }).promise();
}


async function deleteFileOnS3(key) {
  assertSafeKey(key);
  await s3
    .deleteObject({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
    })
    .promise();
}

module.exports = {
  MODE,
  uploadBufferToS3,
  renameFileOnS3,
  deleteFileOnS3,
  __KEY_OK: KEY_OK,
};
