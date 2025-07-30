import express from "express"
import cors from "cors"
import helmet from "helmet"
import compression from "compression"
import { createServer } from "http"
import { Server as SocketIOServer } from "socket.io"
import rateLimit from "express-rate-limit"

// Import routes
import userRoutes from "./routes/user.routes"
import authRoutes from "./routes/auth.routes"
import bookingRoutes from "./routes/booking.routes"
import driverRoutes from "./routes/driver.routes"
import taxiDriverRoutes from "./routes/taxi-driver.routes"
import emergencyRoutes from "./routes/emergency.routes"
import movingRoutes from "./routes/moving.routes"
import placeRoutes from "./routes/place.routes"
import reviewRoutes from "./routes/review.routes"
import serviceRoutes from "./routes/service.routes"
import storeRoutes from "./routes/store.routes"
import subscriptionRoutes from "./routes/subscription.routes"
import adminRoutes from "./routes/admin.routes"
import searchRoutes from "./routes/search.routes"
import dispatchRoutes from "./routes/dispatch-rider.routes"
// Import middleware
import { errorHandler } from "./middleware/error.middleware"
import logger from "./utils/logger"
import { detailedHealthCheck, healthCheck } from "./middleware/health.middleware"

const app = express()
const httpServer = createServer(app)

// Initialize Socket.IO
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: "*", // Allow all origins for development
    methods: ["GET", "POST"],
    credentials: true,
  },
})

// Export io for use in other modules
export { io }

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
})

// Middleware
app.use(helmet())
app.use(compression())
app.use(
  cors({
    origin: "*", // Allow all origins for development
    credentials: true,
  }),
)
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))
app.use(limiter)

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  })
})

// API routes
app.use("/api/auth", authRoutes)
app.use("/api/bookings", bookingRoutes)
app.use("/api/drivers", driverRoutes)
app.use("/api/taxi-drivers", taxiDriverRoutes)
app.use("/api/emergency", emergencyRoutes)
app.use("/api/moving", movingRoutes)
app.use("/api/places", placeRoutes)
app.use("/api/reviews", reviewRoutes)
app.use("/api/services", serviceRoutes)
app.use("/api/stores", storeRoutes)
app.use("/api/subscriptions", subscriptionRoutes)
app.use("/api/admin", adminRoutes)
app.use("/api/search", searchRoutes)
app.use("api/users",userRoutes)
app.use("api/dispatch",dispatchRoutes)

// Health check endpoints
app.get("/health", healthCheck)
app.get("/health/detailed", detailedHealthCheck)

// WebSocket connection handling
io.on("connection", (socket) => {
  logger.info(`Client connected: ${socket.id}`)

  socket.on("join_room", (roomId: string) => {
    socket.join(roomId)
    logger.info(`Socket ${socket.id} joined room ${roomId}`)
  })

  socket.on("leave_room", (roomId: string) => {
    socket.leave(roomId)
    logger.info(`Socket ${socket.id} left room ${roomId}`)
  })

  socket.on("disconnect", () => {
    logger.info(`Client disconnected: ${socket.id}`)
  })
})

// Error handling middleware
app.use(errorHandler)

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  })
})

const PORT = process.env.PORT || 5000

httpServer.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`)
  logger.info(`Environment: ${process.env.NODE_ENV || "development"}`)
})

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down gracefully")
  httpServer.close(() => {
    logger.info("Process terminated")
    process.exit(0)
  })
})

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down gracefully")
  httpServer.close(() => {
    logger.info("Process terminated")
    process.exit(0)
  })
})

export { app, httpServer }
export default app
