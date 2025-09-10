import type { Response } from "express"
import type { AuthenticatedRequest } from "../types"
import prisma from "../config/database"
import { ReviewService } from "../services/review.service"
import { NotificationService } from "../services/notification.service"
import logger from "../utils/logger"

export class ReviewController {
  private reviewService = new ReviewService()
  private notificationService = new NotificationService()

  submitReview = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const {
        receiverId,
        bookingId,
        businessId,
        rating,
        comment,
        type,
        serviceRating,
        timelinessRating,
        cleanlinessRating,
        communicationRating,
      } = req.body

      // Validate that user can review this booking/business
      if (bookingId) {
        const booking = await prisma.booking.findUnique({
          where: { id: bookingId },
        })

        if (!booking || (booking.customerId !== userId && booking.providerId !== userId)) {
          return res.status(403).json({
            success: false,
            message: "You can only review bookings you were involved in",
          })
        }

        // Check if review already exists
        const existingReview = await prisma.review.findFirst({
          where: {
            giverId: userId,
            bookingId,
          },
        })

        if (existingReview) {
          return res.status(400).json({
            success: false,
            message: "You have already reviewed this booking",
          })
        }
      }

      // Create review
      const review = await prisma.review.create({
        data: {
          giverId: userId,
          receiverId,
          bookingId,
          businessId,
          rating,
          comment,
          type: type as any,
          serviceRating,
          timelinessRating,
          cleanlinessRating,
          communicationRating,
          isVerified: true, // Auto-verify for now
        },
        include: {
          giver: {
            select: {
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          receiver: {
            select: {
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          booking: {
            select: {
              serviceType: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
      })

      // Update receiver's rating
      if (receiverId) {
        await this.reviewService.updateUserRating(receiverId, type)
      }

      // Update business rating
      if (businessId) {
        await this.reviewService.updateBusinessRating(businessId)
      }

      // Send notification to receiver
      if (receiverId) {
        await this.notificationService.notifyCustomer(receiverId, {
          type: "NEW_REVIEW",
          title: "New Review Received",
          body: `You received a ${rating}-star review`,
          data: {
            reviewId: review.id,
            rating,
            reviewerName: `${review.giver.firstName} ${review.giver.lastName}`,
          },
          priority: "STANDARD",
        })
      }

      res.status(201).json({
        success: true,
        message: "Review submitted successfully",
        data: review,
      })
    } catch (error) {
      logger.error("Submit review error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to submit review",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  submitDriverRating = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const {
        driverId,
        bookingId,
        rating,
        comment,
        serviceRating,
        timelinessRating,
        cleanlinessRating,
        communicationRating,
      } = req.body

      // Validate required fields
      if (!driverId || !bookingId || !rating) {
        return res.status(400).json({
          success: false,
          message: "Driver ID, booking ID, and rating are required",
        })
      }

      // Validate that the user was the customer for this booking
      const booking = await prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
          customer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          provider: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      })

      if (!booking) {
        return res.status(404).json({
          success: false,
          message: "Booking not found",
        })
      }

      if (booking.customerId !== userId) {
        return res.status(403).json({
          success: false,
          message: "You can only rate drivers for your own bookings",
        })
      }

      if (booking.providerId !== driverId) {
        return res.status(400).json({
          success: false,
          message: "The specified driver is not associated with this booking",
        })
      }

      if (booking.status !== "COMPLETED") {
        return res.status(400).json({
          success: false,
          message: "You can only rate drivers after the trip is completed",
        })
      }

      // Check if user has already rated this driver for this booking
      const existingReview = await prisma.review.findFirst({
        where: {
          giverId: userId,
          receiverId: driverId,
          bookingId,
          type: "SERVICE_PROVIDER",
        },
      })

      if (existingReview) {
        return res.status(400).json({
          success: false,
          message: "You have already rated this driver for this booking",
        })
      }

      // Create driver rating review
      const review = await prisma.review.create({
        data: {
          giverId: userId,
          receiverId: driverId,
          bookingId,
          rating,
          comment,
          type: "SERVICE_PROVIDER",
          serviceRating,
          timelinessRating,
          cleanlinessRating,
          communicationRating,
          isVerified: true,
        },
        include: {
          giver: {
            select: {
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          receiver: {
            select: {
              firstName: true,
              lastName: true,
            },
          },
          booking: {
            select: {
              serviceType: {
                select: {
                  displayName: true,
                },
              },
            },
          },
        },
      })

      // Update driver's rating
      await this.reviewService.updateUserRating(driverId, "SERVICE_PROVIDER")

      // Send notification to driver
      await this.notificationService.notifyCustomer(driverId, {
        type: "NEW_REVIEW",
        title: "New Driver Rating",
        body: `You received a ${rating}-star rating from ${review.giver.firstName}`,
        data: {
          reviewId: review.id,
          rating,
          reviewerName: `${review.giver.firstName} ${review.giver.lastName}`,
          bookingId,
        },
        priority: "STANDARD",
      })

      res.status(201).json({
        success: true,
        message: "Driver rating submitted successfully",
        data: review,
      })
    } catch (error) {
      logger.error("Submit driver rating error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to submit driver rating",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getReviews = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const {
        receiverId,
        businessId,
        bookingId,
        type,
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "desc",
      } = req.query

      const reviews = await this.reviewService.getReviews({
        receiverId: receiverId as string,
        businessId: businessId as string,
        bookingId: bookingId as string,
        type: type as string,
        page: Number(page),
        limit: Number(limit),
        sortBy: sortBy as string,
        sortOrder: sortOrder as "asc" | "desc",
      })

      res.json({
        success: true,
        message: "Reviews retrieved successfully",
        data: reviews,
      })
    } catch (error) {
      logger.error("Get reviews error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve reviews",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getReviewById = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const reviewId = req.params.id

      const review = await prisma.review.findUnique({
        where: { id: reviewId },
        include: {
          giver: {
            select: {
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          receiver: {
            select: {
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          booking: {
            select: {
              serviceType: {
                select: {
                  displayName: true,
                },
              },
              bookingNumber: true,
              completedAt: true,
            },
          },
          business: {
            select: {
              name: true,
              category: true,
            },
          },
        },
      })

      if (!review) {
        return res.status(404).json({
          success: false,
          message: "Review not found",
        })
      }

      res.json({
        success: true,
        message: "Review retrieved successfully",
        data: review,
      })
    } catch (error) {
      logger.error("Get review by ID error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve review",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  updateReview = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const reviewId = req.params.id
      const userId = req.user!.id
      const updateData = req.body

      // Check if user owns this review
      const review = await prisma.review.findUnique({
        where: { id: reviewId },
      })

      if (!review || review.giverId !== userId) {
        return res.status(403).json({
          success: false,
          message: "You can only update your own reviews",
        })
      }

      // Check if review is within edit window (e.g., 24 hours)
      const editWindow = 24 * 60 * 60 * 1000 // 24 hours in milliseconds
      const reviewAge = Date.now() - review.createdAt.getTime()

      if (reviewAge > editWindow) {
        return res.status(400).json({
          success: false,
          message: "Review can only be edited within 24 hours of submission",
        })
      }

      const updatedReview = await prisma.review.update({
        where: { id: reviewId },
        data: {
          ...updateData,
          updatedAt: new Date(),
        },
        include: {
          giver: {
            select: {
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          receiver: {
            select: {
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
        },
      })

      // Update receiver's rating if rating changed
      if (updateData.rating && updateData.rating !== review.rating && review.receiverId) {
        await this.reviewService.updateUserRating(review.receiverId, review.type)
      }

      // Update business rating if rating changed
      if (updateData.rating && updateData.rating !== review.rating && review.businessId) {
        await this.reviewService.updateBusinessRating(review.businessId)
      }

      res.json({
        success: true,
        message: "Review updated successfully",
        data: updatedReview,
      })
    } catch (error) {
      logger.error("Update review error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to update review",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  deleteReview = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const reviewId = req.params.id
      const userId = req.user!.id

      // Check if user owns this review or is admin
      const review = await prisma.review.findUnique({
        where: { id: reviewId },
      })

      if (!review) {
        return res.status(404).json({
          success: false,
          message: "Review not found",
        })
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      })

      const canDelete = review.giverId === userId || ["SUPER_ADMIN", "CITY_ADMIN"].includes(user?.role || "")

      if (!canDelete) {
        return res.status(403).json({
          success: false,
          message: "You can only delete your own reviews",
        })
      }

      await prisma.review.delete({
        where: { id: reviewId },
      })

      // Update receiver's rating
      if (review.receiverId) {
        await this.reviewService.updateUserRating(review.receiverId, review.type)
      }

      // Update business rating
      if (review.businessId) {
        await this.reviewService.updateBusinessRating(review.businessId)
      }

      res.json({
        success: true,
        message: "Review deleted successfully",
      })
    } catch (error) {
      logger.error("Delete review error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to delete review",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getUserReviews = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const { type = "given", page = 1, limit = 10 } = req.query

      const where = type === "given" ? { giverId: userId } : { receiverId: userId }

      const reviews = await prisma.review.findMany({
        where,
        include: {
          giver: {
            select: {
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          receiver: {
            select: {
              firstName: true,
              lastName: true,
              avatar: true,
            },
          },
          booking: {
            select: {
              serviceType: {
                select: {
                  displayName: true,
                },
              },
              bookingNumber: true,
            },
          },
          business: {
            select: {
              name: true,
              category: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      })

      const total = await prisma.review.count({ where })

      res.json({
        success: true,
        message: "User reviews retrieved successfully",
        data: reviews,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      })
    } catch (error) {
      logger.error("Get user reviews error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve user reviews",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getReviewStats = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId, businessId } = req.query

      if (!userId && !businessId) {
        return res.status(400).json({
          success: false,
          message: "Either userId or businessId is required",
        })
      }

      const stats = await this.reviewService.getReviewStats({
        userId: userId as string,
        businessId: businessId as string,
      })

      res.json({
        success: true,
        message: "Review stats retrieved successfully",
        data: stats,
      })
    } catch (error) {
      logger.error("Get review stats error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve review stats",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  markReviewHelpful = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const reviewId = req.params.id
      const userId = req.user!.id

      // Check if user already marked this review as helpful
      // For simplicity, we'll just increment the helpful count
      const review = await prisma.review.update({
        where: { id: reviewId },
        data: {
          isHelpful: { increment: 1 },
        },
      })

      res.json({
        success: true,
        message: "Review marked as helpful",
        data: { helpfulCount: review.isHelpful },
      })
    } catch (error) {
      logger.error("Mark review helpful error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to mark review as helpful",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  reportReview = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const reviewId = req.params.id
      const userId = req.user!.id
      const { reason, description } = req.body

      // Create a support ticket for the reported review
      await prisma.supportTicket.create({
        data: {
          userId,
          subject: `Review Report - ${reviewId}`,
          description: `Review reported for: ${reason}\nDescription: ${description}`,
          category: "OTHER",
          priority: "MEDIUM",
          status: "OPEN",
        },
      })

      // Send notification to admins
      await this.notificationService.notifyAdmins({
        type: "REVIEW_REPORTED",
        title: "Review Reported",
        body: `A review has been reported for: ${reason}`,
        data: {
          reviewId,
          reportedBy: userId,
          reason,
        },
      })

      res.json({
        success: true,
        message: "Review reported successfully",
      })
    } catch (error) {
      logger.error("Report review error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to report review",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  // Admin functions
  getAllReviews = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { page = 1, limit = 20, type, rating, isVerified, startDate, endDate } = req.query

      const where: any = {}
      if (type) where.type = type
      if (rating) where.rating = Number(rating)
      if (isVerified !== undefined) where.isVerified = isVerified === "true"
      if (startDate || endDate) {
        where.createdAt = {}
        if (startDate) where.createdAt.gte = new Date(startDate as string)
        if (endDate) where.createdAt.lte = new Date(endDate as string)
      }

      const reviews = await prisma.review.findMany({
        where,
        include: {
          giver: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          receiver: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          booking: {
            select: {
              bookingNumber: true,
              serviceType: {
                select: {
                  displayName: true,
                },
              },
            },
          },
          business: {
            select: {
              name: true,
              category: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (Number(page) - 1) * Number(limit),
        take: Number(limit),
      })

      const total = await prisma.review.count({ where })

      res.json({
        success: true,
        message: "Reviews retrieved successfully",
        data: reviews,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total,
          totalPages: Math.ceil(total / Number(limit)),
        },
      })
    } catch (error) {
      logger.error("Get all reviews error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve reviews",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  moderateReview = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const reviewId = req.params.id
      const { action, reason } = req.body // action: 'approve', 'reject', 'flag'

      let updateData: any = {}

      switch (action) {
        case "approve":
          updateData = { isVerified: true }
          break
        case "reject":
          updateData = { isVerified: false }
          break
        case "flag":
          updateData = { isVerified: false }
          break
        default:
          return res.status(400).json({
            success: false,
            message: "Invalid moderation action",
          })
      }

      const review = await prisma.review.update({
        where: { id: reviewId },
        data: updateData,
        include: {
          giver: true,
          receiver: true,
        },
      })

      // Send notification to review giver
      await this.notificationService.notifyCustomer(review.giverId, {
        type: "REVIEW_MODERATED",
        title: "Review Moderated",
        body: `Your review has been ${action}ed${reason ? `. Reason: ${reason}` : ""}`,
        data: {
          reviewId,
          action,
          reason,
        },
        priority: "STANDARD",
      })

      res.json({
        success: true,
        message: `Review ${action}ed successfully`,
        data: review,
      })
    } catch (error) {
      logger.error("Moderate review error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to moderate review",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }

  getReviewAnalytics = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { startDate, endDate, type } = req.query

      const analytics = await this.reviewService.getReviewAnalytics({
        startDate: startDate as string,
        endDate: endDate as string,
        type: type as string,
      })

      res.json({
        success: true,
        message: "Review analytics retrieved successfully",
        data: analytics,
      })
    } catch (error) {
      logger.error("Get review analytics error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve review analytics",
        error: error instanceof Error ? error.message : "Unknown error",
      })
    }
  }
}
