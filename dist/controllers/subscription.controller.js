"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionController = void 0;
const subscription_service_1 = require("../services/subscription.service");
const logger_1 = __importDefault(require("../utils/logger"));
class SubscriptionController {
    constructor() {
        this.subscriptionService = new subscription_service_1.SubscriptionService();
        this.getPlans = async (req, res) => {
            try {
                const plans = await this.subscriptionService.getSubscriptionPlans();
                res.json({
                    success: true,
                    message: "Subscription plans retrieved successfully",
                    data: plans,
                });
            }
            catch (error) {
                logger_1.default.error("Get subscription plans error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve subscription plans",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.subscribe = async (req, res) => {
            try {
                const userId = req.user.id;
                const { planId, paymentMethodId } = req.body;
                const result = await this.subscriptionService.subscribeUser(userId, planId, paymentMethodId);
                res.json({
                    success: true,
                    message: "Subscription activated successfully",
                    data: result,
                });
            }
            catch (error) {
                logger_1.default.error("Subscribe user error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to activate subscription",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.getBenefits = async (req, res) => {
            try {
                const userId = req.user.id;
                const benefits = await this.subscriptionService.checkSubscriptionBenefits(userId);
                res.json({
                    success: true,
                    message: "Subscription benefits retrieved successfully",
                    data: benefits,
                });
            }
            catch (error) {
                logger_1.default.error("Get subscription benefits error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to retrieve subscription benefits",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
        this.renewSubscription = async (req, res) => {
            try {
                const userId = req.user.id;
                await this.subscriptionService.renewSubscription(userId);
                res.json({
                    success: true,
                    message: "Subscription renewed successfully",
                });
            }
            catch (error) {
                logger_1.default.error("Renew subscription error:", error);
                res.status(500).json({
                    success: false,
                    message: "Failed to renew subscription",
                    error: error instanceof Error ? error.message : "Unknown error",
                });
            }
        };
    }
}
exports.SubscriptionController = SubscriptionController;
