//集中掛載路由
const authRoutes = require('./src/routes/authRoutes');
const characterRoutes = require("./src/routes/closureme/characterRoutes");
const fileRoutes = require("./src/routes/closureme/fileRoutes");

module.exports = (app) => {
    app.use('/api', authRoutes);
    app.use("/api", characterRoutes);
    app.use("/api", fileRoutes);
};