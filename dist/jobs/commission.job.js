"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.commissionService = void 0;
const node_cron_1 = __importDefault(require("node-cron"));
const commission_service_1 = require("../services/commission.service");
const logger_1 = __importDefault(require("../utils/logger"));
const commissionService = new commission_service_1.CommissionService();
exports.commissionService = commissionService;
// Run monthly commission bill generation on the 1st of each month at 2 AM
node_cron_1.default.schedule("0 2 1 * *", async () => {
    try {
        logger_1.default.info("Starting monthly commission bill generation...");
        await commissionService.generateMonthlyCommissionBills();
        logger_1.default.info("Monthly commission bill generation completed");
    }
    catch (error) {
        logger_1.default.error("Monthly commission bill generation failed:", error);
    }
});
// Check for overdue bills daily at 9 AM
node_cron_1.default.schedule("0 9 * * *", async () => {
    try {
        logger_1.default.info("Checking for overdue commission bills...");
        await commissionService.checkOverdueBills();
        logger_1.default.info("Overdue commission bills check completed");
    }
    catch (error) {
        logger_1.default.error("Overdue commission bills check failed:", error);
    }
});
