import type { Request, Response, NextFunction } from "express"
import type { AuthenticatedRequest } from "../types"
import { CartService } from "../services/cart.service"
import logger from "../utils/logger"

export class CartController {
  private cartService = new CartService()

  // Get user's cart
  getCart = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const cart = await this.cartService.getOrCreateCart(userId)

      res.json({
        success: true,
        message: "Cart retrieved successfully",
        data: cart
      })
    } catch (error) {
      logger.error("Get cart error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve cart",
        error: error instanceof Error ? error.message : "Unknown error"
      })
    }
  }

  // Add item to cart
  addToCart = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const { productId, quantity } = req.body

      if (!productId || !quantity || quantity <= 0) {
        return res.status(400).json({
          success: false,
          message: "Product ID and valid quantity are required"
        })
      }

      const cartItem = await this.cartService.addToCart(userId, { productId, quantity })

      res.status(201).json({
        success: true,
        message: "Item added to cart successfully",
        data: cartItem
      })
    } catch (error) {
      logger.error("Add to cart error:", error)

      if (error instanceof Error && error.message.includes("out of stock")) {
        return res.status(400).json({
          success: false,
          message: error.message
        })
      }

      res.status(500).json({
        success: false,
        message: "Failed to add item to cart",
        error: error instanceof Error ? error.message : "Unknown error"
      })
    }
  }

  // Update cart item
  updateCartItem = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const { itemId } = req.params
      const { quantity } = req.body

      if (!itemId) {
        return res.status(400).json({
          success: false,
          message: "Cart item ID is required"
        })
      }

      if (quantity === undefined || quantity < 0) {
        return res.status(400).json({
          success: false,
          message: "Valid quantity is required"
        })
      }

      const cartItem = await this.cartService.updateCartItem(userId, itemId, { quantity })

      if (!cartItem) {
        return res.json({
          success: true,
          message: "Item removed from cart successfully"
        })
      }

      res.json({
        success: true,
        message: "Cart item updated successfully",
        data: cartItem
      })
    } catch (error) {
      logger.error("Update cart item error:", error)

      if (error instanceof Error && error.message.includes("out of stock")) {
        return res.status(400).json({
          success: false,
          message: error.message
        })
      }

      res.status(500).json({
        success: false,
        message: "Failed to update cart item",
        error: error instanceof Error ? error.message : "Unknown error"
      })
    }
  }

  // Remove item from cart
  removeFromCart = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const { itemId } = req.params

      if (!itemId) {
        return res.status(400).json({
          success: false,
          message: "Cart item ID is required"
        })
      }

      await this.cartService.removeFromCart(userId, itemId)

      res.json({
        success: true,
        message: "Item removed from cart successfully"
      })
    } catch (error) {
      logger.error("Remove from cart error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to remove item from cart",
        error: error instanceof Error ? error.message : "Unknown error"
      })
    }
  }

  // Clear entire cart
  clearCart = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id

      await this.cartService.clearCart(userId)

      res.json({
        success: true,
        message: "Cart cleared successfully"
      })
    } catch (error) {
      logger.error("Clear cart error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to clear cart",
        error: error instanceof Error ? error.message : "Unknown error"
      })
    }
  }

  // Get cart summary
  getCartSummary = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const summary = await this.cartService.getCartSummary(userId)

      res.json({
        success: true,
        message: "Cart summary retrieved successfully",
        data: summary
      })
    } catch (error) {
      logger.error("Get cart summary error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve cart summary",
        error: error instanceof Error ? error.message : "Unknown error"
      })
    }
  }

  // Validate cart for checkout
  validateCart = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const validation = await this.cartService.validateCartForCheckout(userId)

      res.json({
        success: true,
        message: "Cart validated successfully",
        data: validation
      })
    } catch (error) {
      logger.error("Validate cart error:", error)
      res.status(400).json({
        success: false,
        message: error instanceof Error ? error.message : "Cart validation failed"
      })
    }
  }

  // Checkout from cart - convert cart to order
  checkoutFromCart = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const { deliveryAddress, paymentMethodId, specialInstructions } = req.body

      // Validate cart first
      const validation = await this.cartService.validateCartForCheckout(userId)
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: "Cart validation failed",
          errors: validation
        })
      }

      // Convert cart to order
      const orderData = await this.cartService.convertCartToOrder(userId, {
        deliveryAddress,
        paymentMethodId,
        specialInstructions
      })

      res.json({
        success: true,
        message: "Order created successfully from cart",
        data: orderData
      })
    } catch (error) {
      logger.error("Checkout from cart error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to checkout from cart",
        error: error instanceof Error ? error.message : "Unknown error"
      })
    }
  }

  // Get cart items with product details
  getCartItems = async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user!.id
      const cart = await this.cartService.getOrCreateCart(userId)

      res.json({
        success: true,
        message: "Cart items retrieved successfully",
        data: cart
      })
    } catch (error) {
      logger.error("Get cart items error:", error)
      res.status(500).json({
        success: false,
        message: "Failed to retrieve cart items",
        error: error instanceof Error ? error.message : "Unknown error"
      })
    }
  }




}