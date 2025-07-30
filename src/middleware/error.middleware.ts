import type { Request, Response, NextFunction } from "express"
import { Prisma } from "@prisma/client"
import logger from "../utils/logger"

export const errorHandler = (error: any, req: Request, res: Response, next: NextFunction) => {
  logger.error("Error occurred:", {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("User-Agent"),
    body: req.body,
  })

  // Prisma errors
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case "P2002":
        const field = error.meta?.target as string[]
        return res.status(400).json({
          success: false,
          message: `A record with this ${field?.join(", ") || "information"} already exists.`,
          error: "DUPLICATE_ENTRY",
          field: field,
        })
      case "P2025":
        return res.status(404).json({
          success: false,
          message: "Record not found.",
          error: "NOT_FOUND",
        })
      case "P2003":
        return res.status(400).json({
          success: false,
          message: "Foreign key constraint failed.",
          error: "FOREIGN_KEY_CONSTRAINT",
        })
      case "P2014":
        return res.status(400).json({
          success: false,
          message: "The change you are trying to make would violate the required relation.",
          error: "REQUIRED_RELATION_VIOLATION",
        })
      default:
        return res.status(400).json({
          success: false,
          message: "Database operation failed.",
          error: "DATABASE_ERROR",
          code: error.code,
        })
    }
  }

  // Prisma validation errors
  if (error instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      success: false,
      message: "Invalid data provided.",
      error: "VALIDATION_ERROR",
    })
  }

  // Validation errors
  if (error.name === "ValidationError" || error.isJoi) {
    return res.status(400).json({
      success: false,
      message: "Validation failed.",
      error: "VALIDATION_ERROR",
      details: error.details || error.message,
    })
  }

  // Multer errors (file upload)
  if (error.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({
      success: false,
      message: "File size too large.",
      error: "FILE_TOO_LARGE",
    })
  }

  if (error.code === "LIMIT_UNEXPECTED_FILE") {
    return res.status(400).json({
      success: false,
      message: "Unexpected file field.",
      error: "UNEXPECTED_FILE",
    })
  }

  // Rate limiting errors
  if (error.status === 429) {
    return res.status(429).json({
      success: false,
      message: "Too many requests. Please try again later.",
      error: "RATE_LIMIT_EXCEEDED",
    })
  }

  // Custom application errors
  if (error.name === "AppError") {
    return res.status(error.statusCode || 400).json({
      success: false,
      message: error.message,
      error: error.code || "APPLICATION_ERROR",
    })
  }

  // Default error
  const statusCode = error.status || error.statusCode || 500
  const message = error.message || "Internal server error"

  res.status(statusCode).json({
    success: false,
    message,
    error: process.env.NODE_ENV === "development" ? error.stack : "INTERNAL_ERROR",
    ...(process.env.NODE_ENV === "development" && {
      stack: error.stack,
      details: error,
    }),
  })
}
