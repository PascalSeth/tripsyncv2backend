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
// API Example - Get Store Orders:
// GET /api/orders/store?page=1&limit=20&status=ORDER_PROCESSING
// Headers: Authorization: Bearer <token>
// Response: 200 OK
// {
//   "success": true,
//   "message": "Store orders retrieved successfully",
//   "data": [
//     {
//       "id": "ord_123",
//       "orderNumber": "ORD-2024-001",
//       "status": "ORDER_PROCESSING",
//       "totalAmount": 59.98,
//       "customer": {
//         "firstName": "John",
//         "lastName": "Doe",
//         "phone": "+1234567890"
//       }
//     }
//   ]
// }
router.get("/store", rbacMiddleware(["STORE_OWNER"]), orderController.getStoreOrders)
router.get("/store/:orderId", rbacMiddleware(["STORE_OWNER"]), orderController.getOrderById)
// API Example - Update Order Status:
// PUT /api/orders/store/ord_123/status
// Headers: Authorization: Bearer <token>
// Body: {
//   "status": "READY_FOR_PICKUP",
//   "notes": "Order is ready for courier pickup"
// }
// Response: 200 OK
// {
//   "success": true,
//   "message": "Order status updated successfully",
//   "data": {
//     "id": "ord_123",
//     "status": "READY_FOR_PICKUP",
//     "readyForPickupAt": "2024-09-11T06:24:00.000Z"
//   }
// }
router.put(
  "/store/:orderId/status",
  rbacMiddleware(["STORE_OWNER"]),
  validateRequest(orderValidation.updateOrderStatus),
  orderController.updateOrderStatus
)
router.get("/store/statistics", rbacMiddleware(["STORE_OWNER"]), orderController.getOrderStatistics)

// Customer routes
// API Example - Get Customer Orders:
// GET /api/orders/customer?page=1&limit=10&status=DELIVERED
// Headers: Authorization: Bearer <token>
// Response: 200 OK
// {
//   "success": true,
//   "message": "Customer orders retrieved successfully",
//   "data": [
//     {
//       "id": "ord_123",
//       "orderNumber": "ORD-2024-001",
//       "status": "DELIVERED",
//       "totalAmount": 59.98,
//       "store": {
//         "name": "Pizza Palace",
//         "contactPhone": "+1234567890"
//       },
//       "delivery": {
//         "trackingCode": "TRK123456789",
//         "status": "DELIVERED"
//       }
//     }
//   ]
// }
router.get("/customer", orderController.getCustomerOrders)
router.get("/customer/:orderId", orderController.getCustomerOrderById)

export default router