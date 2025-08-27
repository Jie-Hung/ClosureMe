// 人物上傳 API
const router = require("express").Router();
const multer = require("multer");
const characterController = require("../../controllers/closureme/characterController");
const fileController = require("../../controllers/closureme/fileController");
const authMiddleware = require("../../middlewares/authMiddleware");

// Multer 設定
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 } 
});

router.post("/character-info", authMiddleware, upload.fields([{ name: "voice", maxCount: 1 }]), characterController.saveCharacterInfo);
router.post("/upload-model",  authMiddleware, upload.single("model"), characterController.uploadModel);
router.get("/download-character", authMiddleware, characterController.download);
router.get("/proxy-download", characterController.proxyDownload);
router.post("/split-character", authMiddleware, upload.fields([{ name: "main", maxCount: 1 }, { name: "head", maxCount:1 }, { name: "body", maxCount:1 }]), characterController.splitCharacter);
router.get("/main-images-for-binding", authMiddleware, fileController.getMainImagesForBinding);
router.get("/get-pending-images", characterController.getPendingImages);
router.post("/upload-complete", characterController.markFbxComplete);

// 舊流程
router.post("/upload-character", authMiddleware, upload.fields([{ name: "file" }, { name: "voice", maxCount:1 }]), characterController.upload);

module.exports = router;