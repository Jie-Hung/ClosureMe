// storage.js 
const AWS = require("aws-sdk");

const MODE = process.env.STORAGE_MODE || "local";

const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

const KEY_OK = /^uploads\/[A-Za-z0-9_\-]+(?:_(?:head|body|profile|memory|voice))?\.(?:png|jpg|jpeg|webp|gif|json|wav)$/i;
function assertSafeKey(key) {
  if (!KEY_OK.test(key)) {
    const err = new Error(
      `[S3 Key Rejected] Invalid key: "${key}". Expected pattern: ${KEY_OK}`
    );
    console.error(err.stack);
    throw err;
  }
}

async function uploadBufferToS3({ buffer, key, contentType }) {
  assertSafeKey(key);

  const result = await s3
    .upload({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      CacheControl: "public,max-age=31536000,immutable",
    })
    .promise();

  if (process.env.AWS_S3_PUBLIC_BASE) {
    return `${process.env.AWS_S3_PUBLIC_BASE}/${key}`;
  }
  return result.Location;
}

// S3 rename
async function renameFileOnS3(sourceKey, destinationKey) {
  assertSafeKey(sourceKey);
  assertSafeKey(destinationKey);

  await s3
    .copyObject({
      Bucket: process.env.AWS_S3_BUCKET,
      CopySource: `${process.env.AWS_S3_BUCKET}/${encodeURIComponent(sourceKey)}`,
      Key: destinationKey,
      CacheControl: "public,max-age=31536000,immutable",
    })
    .promise();

  await s3
    .deleteObject({
      Bucket: process.env.AWS_S3_BUCKET,
      Key: sourceKey,
    })
    .promise();
}

// S3 delete
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