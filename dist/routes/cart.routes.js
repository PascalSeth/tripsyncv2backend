"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cart_controller_1 = require("../controllers/cart.controller");
const auth_middleware_1 = require("../middleware/auth.middleware");
const cart_validation_1 = require("../validations/cart.validation");
const validation_middleware_1 = require("../middleware/validation.middleware");
const router = (0, express_1.Router)();
const cartController = new cart_controller_1.CartController();
// All cart routes require authentication
router.use(auth_middleware_1.authMiddleware);
// Get user's cart
router.get("/", cartController.getCart);
// Get cart summary
router.get("/summary", cartController.getCartSummary);
// Validate cart for checkout
router.get("/validate", cartController.validateCart);
// Add item to cart
router.post("/items", (0, validation_middleware_1.validateRequest)(cart_validation_1.cartValidation.addToCart), cartController.addToCart);
// Update cart item
router.put("/items/:itemId", (0, validation_middleware_1.validateRequest)(cart_validation_1.cartValidation.updateCartItem), cartController.updateCartItem);
// Remove item from cart
router.delete("/items/:itemId", (0, validation_middleware_1.validateRequest)(cart_validation_1.cartValidation.removeFromCart), cartController.removeFromCart);
// Clear entire cart
router.delete("/", cartController.clearCart);
// Checkout from cart
router.post("/checkout", (0, validation_middleware_1.validateRequest)(cart_validation_1.cartValidation.checkoutFromCart), cartController.checkoutFromCart);
exports.default = router;
