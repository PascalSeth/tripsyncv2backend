"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionService = void 0;
const database_1 = __importDefault(require("../config/database"));
const payment_service_1 = require("./payment.service");
const notification_service_1 = require("./notification.service");
const logger_1 = __importDefault(require("../utils/logger"));
class SubscriptionService {
    constructor() {
        this.paymentService = new payment_service_1.PaymentService();
        this.notificationService = new notification_service_1.NotificationService();
        this.SUBSCRIPTION_BENEFITS = {
            BASIC: {
                tier: "BASIC",
                maxActiveBookings: 3,
                commissionDiscount: 0,
                prioritySupport: false,
                advancedFeatures: [],
            },
            PREMIUM: {
                tier: "PREMIUM",
                maxActiveBookings: 10,
                commissionDiscount: 0.05, // 5% discount
                prioritySupport: true,
                advancedFeatures: ["DAY_BOOKING", "PRIORITY_MATCHING"],
            },
            ENTERPRISE: {
                tier: "ENTERPRISE",
                maxActiveBookings: 50,
                commissionDiscount: 0.15, // 15% discount
                prioritySupport: true,
                advancedFeatures: ["DAY_BOOKING", "PRIORITY_MATCHING", "BULK_BOOKING", "ANALYTICS_DASHBOARD"],
            },
        };
    }
    async getSubscriptionPlans() {
        try {
            return [
                {
                    id: "basic",
                    name: "Basic Plan",
                    tier: "BASIC",
                    price: 0,
                    duration: 30,
                    features: ["Standard ride booking", "Basic support", "3 active bookings"],
                    isActive: true,
                },
                {
                    id: "premium",
                    name: "Premium Plan",
                    tier: "PREMIUM",
                    price: 5000,
                    duration: 30,
                    features: [
                        "All Basic features",
                        "Day booking",
                        "Priority support",
                        "10 active bookings",
                        "5% commission discount",
                    ],
                    isActive: true,
                },
                {
                    id: "enterprise",
                    name: "Enterprise Plan",
                    tier: "ENTERPRISE",
                    price: 15000,
                    duration: 30,
                    features: [
                        "All Premium features",
                        "Bulk booking",
                        "Analytics dashboard",
                        "50 active bookings",
                        "15% commission discount",
                        "Dedicated account manager",
                    ],
                    isActive: true,
                },
            ];
        }
        catch (error) {
            logger_1.default.error("Get subscription plans error:", error);
            throw error;
        }
    }
    async subscribeUser(userId, planId, paymentMethodId) {
        try {
            const plans = await this.getSubscriptionPlans();
            const plan = plans.find((p) => p.id === planId);
            if (!plan) {
                throw new Error("Subscription plan not found");
            }
            // Process payment if not free plan
            if (plan.price > 0) {
                await this.paymentService.processPayment({
                    userId,
                    bookingId: "", // Not applicable for subscriptions
                    amount: plan.price,
                    paymentMethodId,
                    description: `Subscription to ${plan.name}`,
                });
            }
            // Update user subscription
            await database_1.default.customerProfile.update({
                where: { userId },
                data: {
                    subscriptionTier: plan.tier,
                    // Remove subscriptionStartDate and subscriptionEndDate as they don't exist in schema
                },
            });
            // Send confirmation notification
            await this.notificationService.notifyCustomer(userId, {
                type: "SUBSCRIPTION_ACTIVATED",
                title: "Subscription Activated",
                body: `Your ${plan.name} subscription has been activated successfully!`,
                data: { planId, tier: plan.tier },
                priority: "STANDARD",
            });
            return { success: true, plan };
        }
        catch (error) {
            logger_1.default.error("Subscribe user error:", error);
            throw error;
        }
    }
    async checkSubscriptionBenefits(userId) {
        try {
            const customerProfile = await database_1.default.customerProfile.findUnique({
                where: { userId },
            });
            if (!customerProfile) {
                return this.SUBSCRIPTION_BENEFITS.BASIC;
            }
            return this.SUBSCRIPTION_BENEFITS[customerProfile.subscriptionTier] || this.SUBSCRIPTION_BENEFITS.BASIC;
        }
        catch (error) {
            logger_1.default.error("Check subscription benefits error:", error);
            return this.SUBSCRIPTION_BENEFITS.BASIC;
        }
    }
    async renewSubscription(userId) {
        try {
            const customerProfile = await database_1.default.customerProfile.findUnique({
                where: { userId },
            });
            if (!customerProfile) {
                throw new Error("Customer profile not found");
            }
            const plans = await this.getSubscriptionPlans();
            const currentPlan = plans.find((p) => p.tier === customerProfile.subscriptionTier);
            if (!currentPlan) {
                throw new Error("Current subscription plan not found");
            }
            // Update subscription (without date fields since they don't exist in schema)
            await database_1.default.customerProfile.update({
                where: { userId },
                data: {
                    subscriptionTier: currentPlan.tier,
                },
            });
            await this.notificationService.notifyCustomer(userId, {
                type: "SUBSCRIPTION_RENEWED",
                title: "Subscription Renewed",
                body: `Your ${currentPlan.name} subscription has been renewed for another ${currentPlan.duration} days.`,
                data: { planId: currentPlan.id },
                priority: "STANDARD",
            });
        }
        catch (error) {
            logger_1.default.error("Renew subscription error:", error);
            throw error;
        }
    }
}
exports.SubscriptionService = SubscriptionService;
