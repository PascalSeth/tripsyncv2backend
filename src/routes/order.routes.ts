import { Router } from "express"
import { OrderController } from "../controllers/order.controller"
import { authMiddleware } from "../middleware/auth.middleware"
import { rbacMiddleware } from "../middleware/rbac.middleware"
import { validateRequest } from "../middleware/validation.middleware"
import { orderValidation } from "../validations/order.validation"

const router = Router()
const orderController = new OrderController()

// All order routes require authentication
router.use(authMiddleware)

// Store owner routes
router.get("/store", rbacMiddleware(["STORE_OWNER"]), orderController.getStoreOrders)
router.get("/store/:orderId", rbacMiddleware(["STORE_OWNER"]), orderController.getOrderById)
router.put(
  "/store/:orderId/status",
  rbacMiddleware(["STORE_OWNER"]),
  validateRequest(orderValidation.updateOrderStatus),
  orderController.updateOrderStatus
)
router.get("/store/statistics", rbacMiddleware(["STORE_OWNER"]), orderController.getOrderStatistics)

// Customer routes
router.get("/customer", orderController.getCustomerOrders)
router.get("/customer/:orderId", orderController.getCustomerOrderById)

export default router