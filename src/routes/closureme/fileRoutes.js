// 檔案管理系統 API（加入 JWT 驗證）
const express = require("express");
const router = express.Router();
const fileController = require("../../controllers/closureme/fileController");
const authMiddleware = require("../../middlewares/authMiddleware");

router.get("/files", authMiddleware, fileController.getFiles);
// router.delete("/files/:id", authMiddleware, fileController.deleteFile);
router.delete("/delete-character", authMiddleware, fileController.deleteCharacter);
// router.patch("/files/:id", authMiddleware, fileController.renameFile);
router.patch("/rename-character", authMiddleware, fileController.renameCharacter);
router.get("/characters", authMiddleware, fileController.getCharacters);

module.exports = router;
