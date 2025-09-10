"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewController = void 0;
const database_1 = __importDefault(require("../config/database"));
const review_service_1 = require("../services/review.service");
const notification_service_1 = require("../services/notification.service");
const logger_1 = __importDefault(require("../utils/logger"));
class ReviewController {
    constructor() {
        this.reviewService = new review_service_1.ReviewService();
        this.notificationService = new notification_service_1.NotificationService();
        this.submitReview = async (req, res) => {
            try {
                const userId = req.user.id;
                const { receiverId, bookingId, businessId, rating, comment, type, serviceRating, timelinessRating, cleanlinessRating, communicationRating, } = req.body;
                // Validate that user can review this booking/business
                if (bookingId) {
                    const booking = await database_1.default.booking.findUnique({
                        where: { id: bookingId },
                    });
                    if (!booking || (booking.customerId !== userId && booking.providerId !== userId)) {
                        return res.status(403).json({
                            success: false,
                            message: "You can only review bookings you were involved in",
                        });
                    }
                    // Check if review already exists
                    const existingReview = await database_1.default.review.findFirst({
                        where: {
                            giverId: userId,
                            bookingId,
                        },
                    });
                    if (existingReview) {
                        return res.status(400).json({
                            success: false,
                            message: "You have already reviewed this booking",
                        });
                    }
                }
                // Create review
                const review = await database_1.default.review.create({
                    data: {
                        giverId: userId,
                        receiverId,
                        bookingId,
                        businessId,
                        rating,
                        comment,
                        type: type,
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
                });
                // Update receiver's rating
                if (receiverId) {
                    await this.reviewService.updateUserRating(receiverId, type);
                }
                // Update business rating
                if (businessId) {
                    await this.reviewService.updateBusinessRating(businessId);
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
                    });
                }
                res.status(201).json({
                    success: true,
                    message: "Review submitted successfully",
                    data: review,
                });
            }
            catch (error) {
                logger_1.default.error("Submit review error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to submit review",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getReviews = async (req, res) => {
            try {
                const { receiverId, businessId, bookingId, type, page = 1, limit = 10, sortBy = "createdAt", sortOrder = "desc", } = req.query;
                const reviews = await this.reviewService.getReviews({
                    receiverId: receiverId,
                    businessId: businessId,
                    bookingId: bookingId,
                    type: type,
                    page: Number(page),
                    limit: Number(limit),
                    sortBy: sortBy,
                    sortOrder: sortOrder,
                });
                res.json({
                    success: true,
                    message: "Reviews retrieved successfully",
                    data: reviews,
                });
            }
            catch (error) {
                logger_1.default.error("Get reviews error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve reviews",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getReviewById = async (req, res) => {
            try {
                const reviewId = req.params.id;
                const review = await database_1.default.review.findUnique({
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
                });
                if (!review) {
                    return res.status(404).json({
                        success: false,
                        message: "Review not found",
                    });
                }
                res.json({
                    success: true,
                    message: "Review retrieved successfully",
                    data: review,
                });
            }
            catch (error) {
                logger_1.default.error("Get review by ID error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve review",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.updateReview = async (req, res) => {
            try {
                const reviewId = req.params.id;
                const userId = req.user.id;
                const updateData = req.body;
                // Check if user owns this review
                const review = await database_1.default.review.findUnique({
                    where: { id: reviewId },
                });
                if (!review || review.giverId !== userId) {
                    return res.status(403).json({
                        success: false,
                        message: "You can only update your own reviews",
                    });
                }
                // Check if review is within edit window (e.g., 24 hours)
                const editWindow = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
                const reviewAge = Date.now() - review.createdAt.getTime();
                if (reviewAge > editWindow) {
                    return res.status(400).json({
                        success: false,
                        message: "Review can only be edited within 24 hours of submission",
                    });
                }
                const updatedReview = await database_1.default.review.update({
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
                });
                // Update receiver's rating if rating changed
                if (updateData.rating && updateData.rating !== review.rating && review.receiverId) {
                    await this.reviewService.updateUserRating(review.receiverId, review.type);
                }
                // Update business rating if rating changed
                if (updateData.rating && updateData.rating !== review.rating && review.businessId) {
                    await this.reviewService.updateBusinessRating(review.businessId);
                }
                res.json({
                    success: true,
                    message: "Review updated successfully",
                    data: updatedReview,
                });
            }
            catch (error) {
                logger_1.default.error("Update review error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to update review",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.deleteReview = async (req, res) => {
            try {
                const reviewId = req.params.id;
                const userId = req.user.id;
                // Check if user owns this review or is admin
                const review = await database_1.default.review.findUnique({
                    where: { id: reviewId },
                });
                if (!review) {
                    return res.status(404).json({
                        success: false,
                        message: "Review not found",
                    });
                }
                const user = await database_1.default.user.findUnique({
                    where: { id: userId },
                });
                const canDelete = review.giverId === userId || ["SUPER_ADMIN", "CITY_ADMIN"].includes(user?.role || "");
                if (!canDelete) {
                    return res.status(403).json({
                        success: false,
                        message: "You can only delete your own reviews",
                    });
                }
                await database_1.default.review.delete({
                    where: { id: reviewId },
                });
                // Update receiver's rating
                if (review.receiverId) {
                    await this.reviewService.updateUserRating(review.receiverId, review.type);
                }
                // Update business rating
                if (review.businessId) {
                    await this.reviewService.updateBusinessRating(review.businessId);
                }
                res.json({
                    success: true,
                    message: "Review deleted successfully",
                });
            }
            catch (error) {
                logger_1.default.error("Delete review error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to delete review",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getUserReviews = async (req, res) => {
            try {
                const userId = req.user.id;
                const { type = "given", page = 1, limit = 10 } = req.query;
                const where = type === "given" ? { giverId: userId } : { receiverId: userId };
                const reviews = await database_1.default.review.findMany({
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
                });
                const total = await database_1.default.review.count({ where });
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
                });
            }
            catch (error) {
                logger_1.default.error("Get user reviews error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve user reviews",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getReviewStats = async (req, res) => {
            try {
                const { userId, businessId } = req.query;
                if (!userId && !businessId) {
                    return res.status(400).json({
                        success: false,
                        message: "Either userId or businessId is required",
                    });
                }
                const stats = await this.reviewService.getReviewStats({
                    userId: userId,
                    businessId: businessId,
                });
                res.json({
                    success: true,
                    message: "Review stats retrieved successfully",
                    data: stats,
                });
            }
            catch (error) {
                logger_1.default.error("Get review stats error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve review stats",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.markReviewHelpful = async (req, res) => {
            try {
                const reviewId = req.params.id;
                const userId = req.user.id;
                // Check if user already marked this review as helpful
                // For simplicity, we'll just increment the helpful count
                const review = await database_1.default.review.update({
                    where: { id: reviewId },
                    data: {
                        isHelpful: { increment: 1 },
                    },
                });
                res.json({
                    success: true,
                    message: "Review marked as helpful",
                    data: { helpfulCount: review.isHelpful },
                });
            }
            catch (error) {
                logger_1.default.error("Mark review helpful error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to mark review as helpful",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.reportReview = async (req, res) => {
            try {
                const reviewId = req.params.id;
                const userId = req.user.id;
                const { reason, description } = req.body;
                // Create a support ticket for the reported review
                await database_1.default.supportTicket.create({
                    data: {
                        userId,
                        subject: `Review Report - ${reviewId}`,
                        description: `Review reported for: ${reason}\nDescription: ${description}`,
                        category: "OTHER",
                        priority: "MEDIUM",
                        status: "OPEN",
                    },
                });
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
                });
                res.json({
                    success: true,
                    message: "Review reported successfully",
                });
            }
            catch (error) {
                logger_1.default.error("Report review error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to report review",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        // Admin functions
        this.getAllReviews = async (req, res) => {
            try {
                const { page = 1, limit = 20, type, rating, isVerified, startDate, endDate } = req.query;
                const where = {};
                if (type)
                    where.type = type;
                if (rating)
                    where.rating = Number(rating);
                if (isVerified !== undefined)
                    where.isVerified = isVerified === "true";
                if (startDate || endDate) {
                    where.createdAt = {};
                    if (startDate)
                        where.createdAt.gte = new Date(startDate);
                    if (endDate)
                        where.createdAt.lte = new Date(endDate);
                }
                const reviews = await database_1.default.review.findMany({
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
                });
                const total = await database_1.default.review.count({ where });
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
                });
            }
            catch (error) {
                logger_1.default.error("Get all reviews error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve reviews",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.moderateReview = async (req, res) => {
            try {
                const reviewId = req.params.id;
                const { action, reason } = req.body; // action: 'approve', 'reject', 'flag'
                let updateData = {};
                switch (action) {
                    case "approve":
                        updateData = { isVerified: true };
                        break;
                    case "reject":
                        updateData = { isVerified: false };
                        break;
                    case "flag":
                        updateData = { isVerified: false };
                        break;
                    default:
                        return res.status(400).json({
                            success: false,
                            message: "Invalid moderation action",
                        });
                }
                const review = await database_1.default.review.update({
                    where: { id: reviewId },
                    data: updateData,
                    include: {
                        giver: true,
                        receiver: true,
                    },
                });
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
                });
                res.json({
                    success: true,
                    message: `Review ${action}ed successfully`,
                    data: review,
                });
            }
            catch (error) {
                logger_1.default.error("Moderate review error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to moderate review",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getReviewAnalytics = async (req, res) => {
            try {
                const { startDate, endDate, type } = req.query;
                const analytics = await this.reviewService.getReviewAnalytics({
                    startDate: startDate,
                    endDate: endDate,
                    type: type,
                });
                res.json({
                    success: true,
                    message: "Review analytics retrieved successfully",
                    data: analytics,
                });
            }
            catch (error) {
                logger_1.default.error("Get review analytics error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve review analytics",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
    }
}
exports.ReviewController = ReviewController;
