import { PrismaClient } from "@prisma/client"
import logger from "../utils/logger"

const prisma = new PrismaClient({
  log: [
    {
      emit: "event",
      level: "query",
    },
    {
      emit: "event",
      level: "error",
    },
    {
      emit: "event",
      level: "info",
    },
    {
      emit: "event",
      level: "warn",
    },
  ],
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})

// Log database queries in development
if (process.env.NODE_ENV === "development") {
  prisma.$on("query", (e) => {
    logger.debug(`Query: ${e.query}`)
    logger.debug(`Params: ${e.params}`)
    logger.debug(`Duration: ${e.duration}ms`)
  })
}

prisma.$on("error", (e) => {
  logger.error("Database error:", e)
})

prisma.$on("info", (e) => {
  logger.info("Database info:", e)
})

prisma.$on("warn", (e) => {
  logger.warn("Database warning:", e)
})

// Test database connection
async function connectDatabase() {
  try {
    await prisma.$connect()
    logger.info("✅ Database connected successfully")
    
    // Test query to ensure connection works
    await prisma.$queryRaw`SELECT 1`
    logger.info("✅ Database query test successful")
  } catch (error) {
    logger.error("❌ Database connection failed:", error)
    process.exit(1)
  }
}

// Graceful shutdown
async function disconnectDatabase() {
  try {
    await prisma.$disconnect()
    logger.info("✅ Database disconnected successfully")
  } catch (error) {
    logger.error("❌ Database disconnection failed:", error)
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  await disconnectDatabase()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await disconnectDatabase()
  process.exit(0)
})

connectDatabase()

export default prisma
export { disconnectDatabase }
