import express from "express"
import cors from "cors"
import helmet from "helmet"
import compression from "compression"
import rateLimit from "express-rate-limit"
import { createServer } from "http"
import dotenv from "dotenv"
import morgan from "morgan"

// Import routes
import authRoutes from "./routes/auth.routes"
import userRoutes from "./routes/user.routes"
import driverRoutes from "./routes/driver.routes"
import taxiDriverRoutes from "./routes/taxi-driver.routes"
import bookingRoutes from "./routes/booking.routes"
import emergencyRoutes from "./routes/emergency.routes"
import movingRoutes from "./routes/moving.routes"
import placeRoutes from "./routes/place.routes"
import reviewRoutes from "./routes/review.routes"
import searchRoutes from "./routes/search.routes"
import serviceRoutes from "./routes/service.routes"
import storeRoutes from "./routes/store.routes"
import cartRoutes from "./routes/cart.routes"
import orderRoutes from "./routes/order.routes"
import subscriptionRoutes from "./routes/subscription.routes"
import adminRoutes from "./routes/admin.routes"
import dispatchRiderRoutes from "./routes/dispatch-rider.routes"
import deliveryRoutes from "./routes/delivery.routes"

// Import middleware
import { errorHandler } from "./middleware/error.middleware"
import { healthCheck } from "./middleware/health.middleware"

// Import services
import { WebSocketService } from "./services/websocket.service"
import logger from "./utils/logger"

// Load environment variables
dotenv.config()

const app = express()
const server = createServer(app)
const PORT = process.env.PORT || 5000

// Initialize WebSocket service
const webSocketService = new WebSocketService(server)

// Make WebSocket service available globally for other services
export const io = webSocketService

// Security middleware
app.use(helmet())
app.use(compression())

// CORS configuration
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "*",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
)

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // limit each IP to 1000 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
  standardHeaders: true,
  legacyHeaders: false,
})
app.use(limiter)

// Body parsing middleware - skip JSON parsing for multipart requests
app.use((req, res, next) => {
  const contentType = req.headers["content-type"] || ""
  if (contentType.includes("multipart/form-data")) {
    // Skip JSON parsing for multipart requests - let multer handle them
    return next()
  }
  // Apply JSON parsing for non-multipart requests
  express.json({ limit: "10mb" })(req, res, next)
})

app.use(express.urlencoded({ extended: true, limit: "10mb" }))

// Logging middleware
app.use(morgan("combined"))

// Health check endpoint
app.get("/health", healthCheck)

// API routes
app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/drivers", driverRoutes)
app.use("/api/taxi-drivers", taxiDriverRoutes)
app.use("/api/bookings", bookingRoutes)
app.use("/api/emergency", emergencyRoutes)
app.use("/api/moving", movingRoutes)
app.use("/api/places", placeRoutes)
app.use("/api/reviews", reviewRoutes)
app.use("/api/search", searchRoutes)
app.use("/api/services", serviceRoutes)
app.use("/api/stores", storeRoutes)
app.use("/api/cart", cartRoutes)
app.use("/api/orders", orderRoutes)
app.use("/api/subscriptions", subscriptionRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/dispatch-riders", dispatchRiderRoutes)
app.use("/api/delivery", deliveryRoutes)

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "TripSync Backend API",
    version: "1.0.0",
    status: "running",
    timestamp: new Date().toISOString(),
  })
})

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
    path: req.originalUrl,
  })
})

// Error handling middleware (must be last)
app.use(errorHandler)

// Start server
server.listen(PORT, () => {
  logger.info(`🚀 Server running on port ${PORT}`)
  logger.info(`🌍 Environment: ${process.env.NODE_ENV || "development"}`)
  logger.info(`🔌 WebSocket service initialized and ready`)
})

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully")
  server.close(() => {
    logger.info("Process terminated")
    process.exit(0)
  })
})

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully")
  server.close(() => {
    logger.info("Process terminated")
    process.exit(0)
  })
})

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error)
  process.exit(1)
})

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason)
  process.exit(1)
})

export default app
