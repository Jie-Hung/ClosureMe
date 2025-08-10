// 人物上傳 API（加入 authMiddleware）
const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const characterController = require("../../controllers/closureme/characterController");
const authMiddleware = require("../../middlewares/authMiddleware");

// ✅ Multer 設定
const upload = multer({ dest: path.join(process.cwd(), "public", "uploads") });

// ✅ 支援多欄位上傳
router.post(
  "/upload-character",
  authMiddleware,
  upload.fields([
    { name: "file", maxCount: 10 },
    { name: "voice", maxCount: 1 }
  ]),
  characterController.upload
);

router.get("/download-character", authMiddleware, characterController.download);

module.exports = router;

