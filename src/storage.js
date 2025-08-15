// storage.js
const AWS = require("aws-sdk");

const MODE = process.env.STORAGE_MODE || "local";

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
    };
    await s3.upload(params).promise();
    const base = process.env.AWS_S3_PUBLIC_BASE;
    return base ? `${base}/${key}` : key;
}

// S3 rename
async function renameFileOnS3(oldKey, newKey) {
    await s3.copyObject({
        Bucket: process.env.AWS_S3_BUCKET,
        CopySource: `${process.env.AWS_S3_BUCKET}/${oldKey}`,
        Key: newKey,
    }).promise();

    await s3.deleteObject({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: oldKey,
    }).promise();
}

// S3 delete
async function deleteFileOnS3(key) {
    await s3.deleteObject({
        Bucket: process.env.AWS_S3_BUCKET,
        Key: key,
    }).promise();
}

module.exports = {
    MODE,
    uploadBufferToS3,
    renameFileOnS3,
    deleteFileOnS3,
};

