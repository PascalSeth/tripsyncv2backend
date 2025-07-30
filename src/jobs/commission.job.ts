import cron from "node-cron"
import { CommissionService } from "../services/commission.service"
import logger from "../utils/logger"

const commissionService = new CommissionService()

// Run monthly commission bill generation on the 1st of each month at 2 AM
cron.schedule("0 2 1 * *", async () => {
  try {
    logger.info("Starting monthly commission bill generation...")
    await commissionService.generateMonthlyCommissionBills()
    logger.info("Monthly commission bill generation completed")
  } catch (error) {
    logger.error("Monthly commission bill generation failed:", error)
  }
})

// Check for overdue bills daily at 9 AM
cron.schedule("0 9 * * *", async () => {
  try {
    logger.info("Checking for overdue commission bills...")
    await commissionService.checkOverdueBills()
    logger.info("Overdue commission bills check completed")
  } catch (error) {
    logger.error("Overdue commission bills check failed:", error)
  }
})

export { commissionService }
