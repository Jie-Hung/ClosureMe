// token 驗證
const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
        return res.status(401).json({ message: "未提供授權憑證" });
    }

    const token = authHeader.split(" ")[1]; // 格式：Bearer <token>
    if (!token) {
        return res.status(401).json({ message: "Token 不存在" });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).json({ message: "Token 無效或已過期" });
        }
        req.user_id = decoded.user_id; 
        next();
    });
};

module.exports = authMiddleware;