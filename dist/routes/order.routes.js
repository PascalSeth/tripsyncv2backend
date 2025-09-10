"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const order_controller_1 = require("../controllers/order.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const rbac_middleware_1 = require("../middleware/rbac.middleware");
const validation_middleware_1 = require("../middleware/validation.middleware");
const order_validation_1 = require("../validations/order.validation");
const router = (0, express_1.Router)();
const orderController = new order_controller_1.OrderController();
// All order routes require authentication
router.use(auth_middleware_1.authMiddleware);
// Store owner routes
router.get("/store", (0, rbac_middleware_1.rbacMiddleware)(["STORE_OWNER"]), orderController.getStoreOrders);
router.get("/store/:orderId", (0, rbac_middleware_1.rbacMiddleware)(["STORE_OWNER"]), orderController.getOrderById);
router.put("/store/:orderId/status", (0, rbac_middleware_1.rbacMiddleware)(["STORE_OWNER"]), (0, validation_middleware_1.validateRequest)(order_validation_1.orderValidation.updateOrderStatus), orderController.updateOrderStatus);
router.get("/store/statistics", (0, rbac_middleware_1.rbacMiddleware)(["STORE_OWNER"]), orderController.getOrderStatistics);
// Customer routes
router.get("/customer", orderController.getCustomerOrders);
router.get("/customer/:orderId", orderController.getCustomerOrderById);
exports.default = router;
