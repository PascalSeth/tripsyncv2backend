"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReviewService = void 0;
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../utils/logger"));
class ReviewService {
    async getReviews(params) {
        try {
            const { page, limit, sortBy, sortOrder } = params;
            const skip = (page - 1) * limit;
            const where = {};
            if (params.receiverId)
                where.receiverId = params.receiverId;
            if (params.businessId)
                where.businessId = params.businessId;
            if (params.bookingId)
                where.bookingId = params.bookingId;
            if (params.type)
                where.type = params.type;
            const orderBy = {};
            orderBy[sortBy] = sortOrder;
            const [reviews, total] = await Promise.all([
                database_1.default.review.findMany({
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
                    orderBy,
                    skip,
                    take: limit,
                }),
                database_1.default.review.count({ where }),
            ]);
            return {
                reviews,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            };
        }
        catch (error) {
            logger_1.default.error("Get reviews error:", error);
            throw error;
        }
    }
    async updateUserRating(userId, reviewType) {
        try {
            // Get all reviews for this user
            const reviews = await database_1.default.review.findMany({
                where: {
                    receiverId: userId,
                    type: reviewType,
                    isVerified: true,
                },
            });
            if (reviews.length === 0)
                return;
            // Calculate average ratings
            const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
            const averageRating = totalRating / reviews.length;
            const totalServiceRating = reviews
                .filter((r) => r.serviceRating !== null)
                .reduce((sum, review) => sum + (review.serviceRating || 0), 0);
            const averageServiceRating = reviews.filter((r) => r.serviceRating !== null).length > 0
                ? totalServiceRating / reviews.filter((r) => r.serviceRating !== null).length
                : null;
            const totalTimelinessRating = reviews
                .filter((r) => r.timelinessRating !== null)
                .reduce((sum, review) => sum + (review.timelinessRating || 0), 0);
            const averageTimelinessRating = reviews.filter((r) => r.timelinessRating !== null).length > 0
                ? totalTimelinessRating / reviews.filter((r) => r.timelinessRating !== null).length
                : null;
            const totalCleanlinessRating = reviews
                .filter((r) => r.cleanlinessRating !== null)
                .reduce((sum, review) => sum + (review.cleanlinessRating || 0), 0);
            const averageCleanlinessRating = reviews.filter((r) => r.cleanlinessRating !== null).length > 0
                ? totalCleanlinessRating / reviews.filter((r) => r.cleanlinessRating !== null).length
                : null;
            const totalCommunicationRating = reviews
                .filter((r) => r.communicationRating !== null)
                .reduce((sum, review) => sum + (review.communicationRating || 0), 0);
            const averageCommunicationRating = reviews.filter((r) => r.communicationRating !== null).length > 0
                ? totalCommunicationRating / reviews.filter((r) => r.communicationRating !== null).length
                : null;
            // Update user rating based on review type
            if (reviewType === "DRIVER") {
                await database_1.default.driverProfile.updateMany({
                    where: { userId },
                    data: {
                        rating: averageRating,
                        totalRides: reviews.length,
                    },
                });
            }
            else if (reviewType === "MOVER") {
                await database_1.default.moverProfile.updateMany({
                    where: { userId },
                    data: {
                        rating: averageRating,
                        totalMoves: reviews.length,
                    },
                });
            }
            else if (reviewType === "EMERGENCY_RESPONDER") {
                await database_1.default.emergencyProfile.updateMany({
                    where: { userId },
                    data: {
                    // Add rating fields to emergency profile if needed
                    },
                });
            }
            // Update user's overall rating
            await database_1.default.user.update({
                where: { id: userId },
                data: {
                // rating: averageRating, // Remove this line
                // totalReviews: reviews.length, // Remove this line
                },
            });
            return {
                averageRating,
                totalReviews: reviews.length,
                averageServiceRating,
                averageTimelinessRating,
                averageCleanlinessRating,
                averageCommunicationRating,
            };
        }
        catch (error) {
            logger_1.default.error("Update user rating error:", error);
            throw error;
        }
    }
    async updateBusinessRating(businessId) {
        try {
            // Get all reviews for this business
            const reviews = await database_1.default.review.findMany({
                where: {
                    businessId,
                    isVerified: true,
                },
            });
            if (reviews.length === 0)
                return;
            // Calculate average rating
            const totalRating = reviews.reduce((sum, review) => sum + review.rating, 0);
            const averageRating = totalRating / reviews.length;
            // Update business rating (assuming Store model for now)
            await database_1.default.store.updateMany({
                where: { id: businessId },
                data: {
                // Add rating fields to store model if needed
                },
            });
            return {
                averageRating,
                totalReviews: reviews.length,
            };
        }
        catch (error) {
            logger_1.default.error("Update business rating error:", error);
            throw error;
        }
    }
    async getReviewStats(params) {
        try {
            const where = { isVerified: true };
            if (params.userId)
                where.receiverId = params.userId;
            if (params.businessId)
                where.businessId = params.businessId;
            const [totalReviews, averageRating, ratingDistribution, recentReviews] = await Promise.all([
                database_1.default.review.count({ where }),
                this.calculateAverageRating(where),
                this.getRatingDistribution(where),
                database_1.default.review.findMany({
                    where,
                    include: {
                        giver: {
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
                    orderBy: { createdAt: "desc" },
                    take: 5,
                }),
            ]);
            return {
                totalReviews,
                averageRating,
                ratingDistribution,
                recentReviews,
            };
        }
        catch (error) {
            logger_1.default.error("Get review stats error:", error);
            throw error;
        }
    }
    async getReviewAnalytics(params) {
        try {
            const where = {};
            if (params.startDate || params.endDate) {
                where.createdAt = {};
                if (params.startDate)
                    where.createdAt.gte = new Date(params.startDate);
                if (params.endDate)
                    where.createdAt.lte = new Date(params.endDate);
            }
            if (params.type) {
                where.type = params.type;
            }
            const [totalReviews, averageRating, ratingDistribution, reviewsByType, reviewsByMonth, topReviewedUsers] = await Promise.all([
                database_1.default.review.count({ where }),
                this.calculateAverageRating(where),
                this.getRatingDistribution(where),
                this.getReviewsByType(where),
                this.getReviewsByMonth(where),
                this.getTopReviewedUsers(where),
            ]);
            return {
                totalReviews,
                averageRating,
                ratingDistribution,
                reviewsByType,
                reviewsByMonth,
                topReviewedUsers,
            };
        }
        catch (error) {
            logger_1.default.error("Get review analytics error:", error);
            throw error;
        }
    }
    async calculateAverageRating(where) {
        try {
            const result = await database_1.default.review.aggregate({
                where,
                _avg: {
                    rating: true,
                },
            });
            return result._avg.rating || 0;
        }
        catch (error) {
            logger_1.default.error("Calculate average rating error:", error);
            return 0;
        }
    }
    async getRatingDistribution(where) {
        try {
            const distribution = await database_1.default.review.groupBy({
                by: ["rating"],
                where,
                _count: true,
                orderBy: {
                    rating: "asc",
                },
            });
            // Ensure all ratings 1-5 are represented
            const fullDistribution = [1, 2, 3, 4, 5].map((rating) => {
                const found = distribution.find((d) => d.rating === rating);
                return {
                    rating,
                    count: found?._count || 0,
                };
            });
            return fullDistribution;
        }
        catch (error) {
            logger_1.default.error("Get rating distribution error:", error);
            return [];
        }
    }
    async getReviewsByType(where) {
        try {
            const reviewsByType = await database_1.default.review.groupBy({
                by: ["type"],
                where,
                _count: true,
                _avg: {
                    rating: true,
                },
            });
            return reviewsByType.map((item) => ({
                type: item.type,
                count: item._count,
                averageRating: item._avg.rating || 0,
            }));
        }
        catch (error) {
            logger_1.default.error("Get reviews by type error:", error);
            return [];
        }
    }
    async getReviewsByMonth(where) {
        try {
            // Get reviews from the last 12 months
            const twelveMonthsAgo = new Date();
            twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
            const reviews = await database_1.default.review.findMany({
                where: {
                    ...where,
                    createdAt: {
                        gte: twelveMonthsAgo,
                    },
                },
                select: {
                    createdAt: true,
                    rating: true,
                },
            });
            // Group by month
            const monthlyData = {};
            reviews.forEach((review) => {
                const monthKey = review.createdAt.toISOString().slice(0, 7); // YYYY-MM
                if (!monthlyData[monthKey]) {
                    monthlyData[monthKey] = { count: 0, totalRating: 0 };
                }
                monthlyData[monthKey].count++;
                monthlyData[monthKey].totalRating += review.rating;
            });
            return Object.entries(monthlyData).map(([month, data]) => ({
                month,
                count: data.count,
                averageRating: data.totalRating / data.count,
            }));
        }
        catch (error) {
            logger_1.default.error("Get reviews by month error:", error);
            return [];
        }
    }
    async getTopReviewedUsers(where) {
        try {
            const topUsers = await database_1.default.review.groupBy({
                by: ["receiverId"],
                where,
                _count: true,
                _avg: {
                    rating: true,
                },
                orderBy: {
                    _count: {
                        receiverId: "desc",
                    },
                },
                take: 10,
            });
            // Get user details
            const usersWithDetails = await Promise.all(topUsers.map(async (user) => {
                const userDetails = await database_1.default.user.findUnique({
                    where: { id: user.receiverId },
                    select: {
                        firstName: true,
                        lastName: true,
                        avatar: true,
                    },
                });
                return {
                    userId: user.receiverId,
                    user: userDetails,
                    reviewCount: user._count,
                    averageRating: user._avg.rating || 0,
                };
            }));
            return usersWithDetails;
        }
        catch (error) {
            logger_1.default.error("Get top reviewed users error:", error);
            return [];
        }
    }
}
exports.ReviewService = ReviewService;
