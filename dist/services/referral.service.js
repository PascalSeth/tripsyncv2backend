"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ReferralService = void 0;
const notification_service_1 = require("./notification.service");
const analytics_service_1 = require("./analytics.service");
const payment_service_1 = require("./payment.service");
class ReferralService {
    constructor() {
        this.notificationService = new notification_service_1.NotificationService();
        this.analyticsService = new analytics_service_1.AnalyticsService();
        this.paymentService = new payment_service_1.PaymentService();
        this.REFERRAL_REWARDS = {
            FIRST_RIDE: {
                referrerReward: 500, // ₦5
                refereeReward: 1000, // ₦10
                type: "CASH",
            },
        };
        // Additional methods and logic can be added here
    }
}
exports.ReferralService = ReferralService;
