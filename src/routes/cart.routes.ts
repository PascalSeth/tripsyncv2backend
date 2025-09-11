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



// Add item to cart
// API Example:
// POST /api/cart/items
// Headers: Authorization: Bearer <token>
// Body: { "productId": "prod_123", "quantity": 2 }
// Response: 201 Created
// {
//   "success": true,
//   "message": "Item added to cart successfully",
//   "data": {
//     "id": "cart_item_456",
//     "productId": "prod_123",
//     "quantity": 2,
//     "price": 29.99,
//     "total": 59.98
//   }
// }
router.post(
  "/items",
  validateRequest(cartValidation.addToCart),
  cartController.addToCart
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
// API Example:
// POST /api/cart/checkout
// Headers: Authorization: Bearer <token>
// Body: {
//   "deliveryAddress": {
//     "latitude": 40.7128,
//     "longitude": -74.0060,
//     "address": "123 Main St, New York, NY",
//     "city": "New York",
//     "state": "NY",
//     "instructions": "Ring doorbell twice"
//   },
//   "paymentMethodId": "pm_1234567890",
//   "specialInstructions": "Handle with care"
// }
// Response: 200 OK
// {
//   "success": true,
//   "message": "Order created successfully from cart",
//   "data": {
//     "orderId": "ord_123",
//     "orderNumber": "ORD-2024-001",
//     "totalAmount": 59.98,
//     "status": "PENDING",
//     "delivery": {
//       "id": "del_456",
//       "trackingCode": "TRK123456789",
//       "status": "PENDING"
//     }
//   }
// }
router.post(
  "/checkout",
  validateRequest(cartValidation.checkoutFromCart),
  cartController.checkoutFromCart
)

// Get cart items with product details
// API Example:
// GET /api/cart/items
// Headers: Authorization: Bearer <token>
// Response: 200 OK
// {
//   "success": true,
//   "message": "Cart items retrieved successfully",
//   "data": {
//     "id": "cart_123",
//     "items": [
//       {
//         "id": "cart_item_456",
//         "productId": "prod_789",
//         "quantity": 2,
//         "unitPrice": 29.99,
//         "total": 59.98,
//         "product": {
//           "name": "Pizza Margherita",
//           "description": "Classic pizza with tomato sauce and cheese",
//           "image": "https://example.com/pizza.jpg"
//         }
//       }
//     ],
//     "summary": {
//       "itemCount": 1,
//       "totalItems": 2,
//       "subtotal": 59.98,
//       "deliveryFee": 2.99,
//       "total": 62.97
//     }
//   }
// }
router.get("/items", authMiddleware, cartController.getCartItems)

// Update cart item quantity
// API Example:
// PUT /api/cart/items/cart_item_456
// Headers: Authorization: Bearer <token>
// Body: { "quantity": 3 }
// Response: 200 OK
// {
//   "success": true,
//   "message": "Cart item updated successfully",
//   "data": {
//     "id": "cart_item_456",
//     "quantity": 3,
//     "total": 89.97
//   }
// }
router.put(
  "/items/:itemId",
  authMiddleware,
  validateRequest(cartValidation.updateCartItem),
  cartController.updateCartItem
)

// Remove item from cart
// API Example:
// DELETE /api/cart/items/cart_item_456
// Headers: Authorization: Bearer <token>
// Response: 200 OK
// {
//   "success": true,
//   "message": "Item removed from cart successfully"
// }
router.delete("/items/:itemId", authMiddleware, cartController.removeFromCart)

// Get cart summary
// API Example:
// GET /api/cart/summary
// Headers: Authorization: Bearer <token>
// Response: 200 OK
// {
//   "success": true,
//   "message": "Cart summary retrieved successfully",
//   "data": {
//     "itemCount": 2,
//     "totalItems": 5,
//     "subtotal": 149.95,
//     "deliveryFee": 2.99,
//     "serviceFee": 1.50,
//     "total": 154.44,
//     "items": [...]
//   }
// }
router.get("/summary", authMiddleware, cartController.getCartSummary)

// Validate cart before checkout
// API Example:
// GET /api/cart/validate
// Headers: Authorization: Bearer <token>
// Response: 200 OK
// {
//   "success": true,
//   "message": "Cart validated successfully",
//   "data": {
//     "valid": true,
//     "warnings": [],
//     "errors": []
//   }
// }
router.get("/validate", authMiddleware, cartController.validateCart)

export default router