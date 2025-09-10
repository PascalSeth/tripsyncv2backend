"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.io = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const compression_1 = __importDefault(require("compression"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
const http_1 = require("http");
const dotenv_1 = __importDefault(require("dotenv"));
const morgan_1 = __importDefault(require("morgan"));
// Import routes
const auth_routes_1 = __importDefault(require("./routes/auth.routes"));
const user_routes_1 = __importDefault(require("./routes/user.routes"));
const driver_routes_1 = __importDefault(require("./routes/driver.routes"));
const taxi_driver_routes_1 = __importDefault(require("./routes/taxi-driver.routes"));
const booking_routes_1 = __importDefault(require("./routes/booking.routes"));
const emergency_routes_1 = __importDefault(require("./routes/emergency.routes"));
const moving_routes_1 = __importDefault(require("./routes/moving.routes"));
const place_routes_1 = __importDefault(require("./routes/place.routes"));
const review_routes_1 = __importDefault(require("./routes/review.routes"));
const search_routes_1 = __importDefault(require("./routes/search.routes"));
const service_routes_1 = __importDefault(require("./routes/service.routes"));
const store_routes_1 = __importDefault(require("./routes/store.routes"));
const cart_routes_1 = __importDefault(require("./routes/cart.routes"));
const order_routes_1 = __importDefault(require("./routes/order.routes"));
const subscription_routes_1 = __importDefault(require("./routes/subscription.routes"));
const admin_routes_1 = __importDefault(require("./routes/admin.routes"));
const dispatch_rider_routes_1 = __importDefault(require("./routes/dispatch-rider.routes"));
const delivery_routes_1 = __importDefault(require("./routes/delivery.routes"));
// Import middleware
const error_middleware_1 = require("./middleware/error.middleware");
const health_middleware_1 = require("./middleware/health.middleware");
// Import services
const websocket_service_1 = require("./services/websocket.service");
const logger_1 = __importDefault(require("./utils/logger"));
// Load environment variables
dotenv_1.default.config();
const app = (0, express_1.default)();
const server = (0, http_1.createServer)(app);
const PORT = process.env.PORT || 5000;
// Initialize WebSocket service
const webSocketService = new websocket_service_1.WebSocketService(server);
// Make WebSocket service available globally for other services
exports.io = webSocketService;
// Security middleware
app.use((0, helmet_1.default)());
app.use((0, compression_1.default)());
// CORS configuration
app.use((0, cors_1.default)({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
}));
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);
// Body parsing middleware - skip JSON parsing for multipart requests
app.use((req, res, next) => {
    const contentType = req.headers["content-type"] || "";
    if (contentType.includes("multipart/form-data")) {
        // Skip JSON parsing for multipart requests - let multer handle them
        return next();
    }
    // Apply JSON parsing for non-multipart requests
    express_1.default.json({ limit: "10mb" })(req, res, next);
});
app.use(express_1.default.urlencoded({ extended: true, limit: "10mb" }));
// Logging middleware
app.use((0, morgan_1.default)("combined"));
// Health check endpoint
app.get("/health", health_middleware_1.healthCheck);
// API routes
app.use("/api/auth", auth_routes_1.default);
app.use("/api/users", user_routes_1.default);
app.use("/api/drivers", driver_routes_1.default);
app.use("/api/taxi-drivers", taxi_driver_routes_1.default);
app.use("/api/bookings", booking_routes_1.default);
app.use("/api/emergency", emergency_routes_1.default);
app.use("/api/moving", moving_routes_1.default);
app.use("/api/places", place_routes_1.default);
app.use("/api/reviews", review_routes_1.default);
app.use("/api/search", search_routes_1.default);
app.use("/api/services", service_routes_1.default);
app.use("/api/stores", store_routes_1.default);
app.use("/api/cart", cart_routes_1.default);
app.use("/api/orders", order_routes_1.default);
app.use("/api/subscriptions", subscription_routes_1.default);
app.use("/api/admin", admin_routes_1.default);
app.use("/api/dispatch-riders", dispatch_rider_routes_1.default);
app.use("/api/delivery", delivery_routes_1.default);
// Root endpoint
app.get("/", (req, res) => {
    res.json({
        message: "TripSync Backend API",
        version: "1.0.0",
        status: "running",
        timestamp: new Date().toISOString(),
    });
});
// 404 handler
app.use("*", (req, res) => {
    res.status(404).json({
        success: false,
        message: "Route not found",
        path: req.originalUrl,
    });
});
// Error handling middleware (must be last)
app.use(error_middleware_1.errorHandler);
// Start server
server.listen(PORT, () => {
    logger_1.default.info(`🚀 Server running on port ${PORT}`);
    logger_1.default.info(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
    logger_1.default.info(`🔌 WebSocket service initialized and ready`);
});
// Graceful shutdown
process.on("SIGTERM", () => {
    logger_1.default.info("SIGTERM received, shutting down gracefully");
    server.close(() => {
        logger_1.default.info("Process terminated");
        process.exit(0);
    });
});
process.on("SIGINT", () => {
    logger_1.default.info("SIGINT received, shutting down gracefully");
    server.close(() => {
        logger_1.default.info("Process terminated");
        process.exit(0);
    });
});
// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
    logger_1.default.error("Uncaught Exception:", error);
    process.exit(1);
});
// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
    logger_1.default.error("Unhandled Rejection at:", promise, "reason:", reason);
    process.exit(1);
});
exports.default = app;
