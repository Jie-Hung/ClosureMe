// 人物上傳 API
const router = require("express").Router();
const multer = require("multer");
const characterController = require("../../controllers/closureme/characterController");
const authMiddleware = require("../../middlewares/authMiddleware");

// Multer 設定
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 } 
});

// 多欄位上傳
router.post(
  "/upload-character",
  authMiddleware,
  upload.fields([
    { name: "file", maxCount: 10 },
    { name: "voice", maxCount: 1 }
  ]),
  characterController.upload
);

router.post(
  "/split-character",
  authMiddleware,
  upload.fields([
    { name: "head", maxCount: 1 },
    { name: "body", maxCount: 1 }
  ]),
  characterController.splitCharacter
);

router.get("/download-character", authMiddleware, characterController.download);
router.get("/proxy-download", characterController.proxyDownload);

module.exports = router;