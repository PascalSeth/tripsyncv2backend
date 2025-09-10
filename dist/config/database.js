"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.disconnectDatabase = disconnectDatabase;
const client_1 = require("@prisma/client");
const logger_1 = __importDefault(require("../utils/logger"));
const prisma = new client_1.PrismaClient({
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
});
// Log database queries in development
if (process.env.NODE_ENV === "development") {
    prisma.$on("query", (e) => {
        logger_1.default.debug(`Query: ${e.query}`);
        logger_1.default.debug(`Params: ${e.params}`);
        logger_1.default.debug(`Duration: ${e.duration}ms`);
    });
}
prisma.$on("error", (e) => {
    logger_1.default.error("Database error:", e);
});
prisma.$on("info", (e) => {
    logger_1.default.info("Database info:", e);
});
prisma.$on("warn", (e) => {
    logger_1.default.warn("Database warning:", e);
});
// Test database connection
async function connectDatabase() {
    try {
        await prisma.$connect();
        logger_1.default.info("✅ Database connected successfully");
        // Test query to ensure connection works
        await prisma.$queryRaw `SELECT 1`;
        logger_1.default.info("✅ Database query test successful");
    }
    catch (error) {
        logger_1.default.error("❌ Database connection failed:", error);
        process.exit(1);
    }
}
// Graceful shutdown
async function disconnectDatabase() {
    try {
        await prisma.$disconnect();
        logger_1.default.info("✅ Database disconnected successfully");
    }
    catch (error) {
        logger_1.default.error("❌ Database disconnection failed:", error);
    }
}
// Handle process termination
process.on('SIGINT', async () => {
    await disconnectDatabase();
    process.exit(0);
});
process.on('SIGTERM', async () => {
    await disconnectDatabase();
    process.exit(0);
});
connectDatabase();
exports.default = prisma;
