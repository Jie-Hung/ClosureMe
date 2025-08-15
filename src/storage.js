// src/storage.js
const AWS = require('aws-sdk');

const MODE = process.env.STORAGE_MODE || 'local';

const s3 = new AWS.S3({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
});

async function uploadBufferToS3({ buffer, key, contentType }) {
  const params = {
    Bucket: process.env.AWS_S3_BUCKET,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    ACL: 'public-read', // 若不要公開就改成 private
  };
  await s3.upload(params).promise();

  if (process.env.AWS_S3_PUBLIC_BASE) {
    return `${process.env.AWS_S3_PUBLIC_BASE}/${key}`;
  }
  return key; // 存 key，之後用簽名 URL 顯示
}

module.exports = {
  MODE,
  uploadBufferToS3,
};
