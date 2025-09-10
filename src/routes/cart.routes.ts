import { Router } from "express"
import { CartController } from "../controllers/cart.controller"
import { authMiddleware } from "../middleware/auth.middleware"
import { cartValidation } from "../validations/cart.validation"
import { validateRequest } from "../middleware/validation.middleware"

const router = Router()
const cartController = new CartController()

// All cart routes require authentication
router.use(authMiddleware)

// Get user's cart
router.get("/", cartController.getCart)

// Get cart summary
router.get("/summary", cartController.getCartSummary)

// Validate cart for checkout
router.get("/validate", cartController.validateCart)

// Add item to cart
router.post(
  "/items",
  validateRequest(cartValidation.addToCart),
  cartController.addToCart
)

// Update cart item
router.put(
  "/items/:itemId",
  validateRequest(cartValidation.updateCartItem),
  cartController.updateCartItem
)

// Remove item from cart
router.delete(
  "/items/:itemId",
  validateRequest(cartValidation.removeFromCart),
  cartController.removeFromCart
)

// Clear entire cart
router.delete("/", cartController.clearCart)

// Checkout from cart
router.post(
  "/checkout",
  validateRequest(cartValidation.checkoutFromCart),
  cartController.checkoutFromCart
)

export default router