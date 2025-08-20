// 註冊/登入 API
const express = require('express');
const router = express.Router();

const { register } = require('../controllers/auth/registerController.js');
const { login } = require('../controllers/auth/loginController.js');

router.post('/register', register);
router.post('/login', login);

module.exports = router;