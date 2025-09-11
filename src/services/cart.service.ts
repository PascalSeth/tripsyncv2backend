import prisma from "../config/database"
import logger from "../utils/logger"

export interface CartItemData {
  productId: string
  quantity: number
}

export interface AddToCartData {
  productId: string
  quantity: number
}

export interface UpdateCartItemData {
  quantity: number
}

export class CartService {
  async getOrCreateCart(userId: string) {
    try {
      let cart = await prisma.cart.findUnique({
        where: { userId },
        include: {
          items: {
            include: {
              product: {
                include: {
                  store: true,
                  category: true,
                  subcategory: true
                }
              }
            }
          }
        }
      })

      if (!cart) {
        cart = await prisma.cart.create({
          data: { userId },
          include: {
            items: {
              include: {
                product: {
                  include: {
                    store: true,
                    category: true,
                    subcategory: true
                  }
                }
              }
            }
          }
        })
      }

      return cart
    } catch (error) {
      logger.error("Get or create cart error:", error)
      throw error
    }
  }

  async addToCart(userId: string, data: AddToCartData) {
    try {
      // Validate product exists and is in stock
      const product = await prisma.product.findUnique({
        where: { id: data.productId },
        include: { store: true }
      })

      if (!product) {
        throw new Error("Product not found")
      }

      if (!product.inStock || product.stockQuantity < data.quantity) {
        throw new Error("Product is out of stock or insufficient quantity")
      }

      // Get or create cart
      const cart = await this.getOrCreateCart(userId)

      // Check if product already exists in cart
      const existingItem = cart.items.find(item => item.productId === data.productId)

      if (existingItem) {
        // Update existing item
        const newQuantity = existingItem.quantity + data.quantity

        if (product.stockQuantity < newQuantity) {
          throw new Error("Insufficient stock for requested quantity")
        }

        return await prisma.cartItem.update({
          where: { id: existingItem.id },
          data: { quantity: newQuantity },
          include: {
            product: {
              include: {
                store: true,
                category: true,
                subcategory: true
              }
            }
          }
        })
      } else {
        // Add new item
        return await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            productId: data.productId,
            quantity: data.quantity,
            unitPrice: product.price
          },
          include: {
            product: {
              include: {
                store: true,
                category: true,
                subcategory: true
              }
            }
          }
        })
      }
    } catch (error) {
      logger.error("Add to cart error:", error)
      throw error
    }
  }

  async updateCartItem(userId: string, itemId: string, data: UpdateCartItemData) {
    try {
      // Verify cart ownership
      const cart = await prisma.cart.findUnique({
        where: { userId },
        include: { items: true }
      })

      if (!cart) {
        throw new Error("Cart not found")
      }

      const item = cart.items.find(item => item.id === itemId)
      if (!item) {
        throw new Error("Cart item not found")
      }

      // Validate stock
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      })

      if (!product || !product.inStock || product.stockQuantity < data.quantity) {
        throw new Error("Product is out of stock or insufficient quantity")
      }

      if (data.quantity <= 0) {
        // Remove item if quantity is 0 or negative
        await prisma.cartItem.delete({
          where: { id: itemId }
        })
        return null
      }

      return await prisma.cartItem.update({
        where: { id: itemId },
        data: { quantity: data.quantity },
        include: {
          product: {
            include: {
              store: true,
              category: true,
              subcategory: true
            }
          }
        }
      })
    } catch (error) {
      logger.error("Update cart item error:", error)
      throw error
    }
  }

  async removeFromCart(userId: string, itemId: string) {
    try {
      // Verify cart ownership
      const cart = await prisma.cart.findUnique({
        where: { userId },
        include: { items: true }
      })

      if (!cart) {
        throw new Error("Cart not found")
      }

      const item = cart.items.find(item => item.id === itemId)
      if (!item) {
        throw new Error("Cart item not found")
      }

      await prisma.cartItem.delete({
        where: { id: itemId }
      })

      return { success: true }
    } catch (error) {
      logger.error("Remove from cart error:", error)
      throw error
    }
  }

  async clearCart(userId: string) {
    try {
      const cart = await prisma.cart.findUnique({
        where: { userId }
      })

      if (!cart) {
        throw new Error("Cart not found")
      }

      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id }
      })

      return { success: true }
    } catch (error) {
      logger.error("Clear cart error:", error)
      throw error
    }
  }

  async getCartSummary(userId: string) {
    try {
      const cart = await this.getOrCreateCart(userId)

      const summary = {
        itemCount: cart.items.length,
        totalItems: cart.items.reduce((sum, item) => sum + item.quantity, 0),
        subtotal: cart.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0),
        items: cart.items
      }

      return summary
    } catch (error) {
      logger.error("Get cart summary error:", error)
      throw error
    }
  }

  async validateCartForCheckout(userId: string) {
    try {
      const cart = await this.getOrCreateCart(userId)

      if (cart.items.length === 0) {
        throw new Error("Cart is empty")
      }

      const validationErrors: string[] = []

      // Check each item for availability and stock
      for (const item of cart.items) {
        const product = await prisma.product.findUnique({
          where: { id: item.productId }
        })

        if (!product) {
          validationErrors.push(`Product ${item.product.name} no longer exists`)
          continue
        }

        if (!product.inStock) {
          validationErrors.push(`Product ${product.name} is out of stock`)
        }

        if (product.stockQuantity < item.quantity) {
          validationErrors.push(`Insufficient stock for ${product.name}. Available: ${product.stockQuantity}`)
        }

        // Check if price has changed
        if (product.price !== item.unitPrice) {
          // Update the price in cart
          await prisma.cartItem.update({
            where: { id: item.id },
            data: { unitPrice: product.price }
          })
        }
      }

      if (validationErrors.length > 0) {
        throw new Error(`Cart validation failed: ${validationErrors.join(', ')}`)
      }

      return { valid: true, cart }
    } catch (error) {
      logger.error("Validate cart for checkout error:", error)
      throw error
    }
  }

  async convertCartToOrder(userId: string, orderData: {
    deliveryAddress: any
    paymentMethodId: string
    specialInstructions?: string
  }) {
    try {
      // Get validated cart
      const validation = await this.validateCartForCheckout(userId)
      if (!validation.valid) {
        throw new Error("Cart validation failed")
      }

      const { cart } = validation

      // Calculate totals
      const subtotal = cart.items.reduce((sum: number, item: any) => sum + (item.unitPrice * item.quantity), 0)
      const deliveryFee = 2.99 // Fixed delivery fee, could be calculated based on distance
      const serviceFee = 1.50 // Fixed service fee
      const totalAmount = subtotal + deliveryFee + serviceFee

      // Create order
      const order = await prisma.order.create({
        data: {
          orderNumber: `ORD-${Date.now()}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          customerId: userId,
          totalAmount,
          deliveryFee,
          preparationNotes: orderData.specialInstructions,
          status: "ORDER_PROCESSING"
        }
      })

      // Create delivery location
      const deliveryLocation = await prisma.location.create({
        data: {
          latitude: orderData.deliveryAddress.latitude,
          longitude: orderData.deliveryAddress.longitude,
          address: orderData.deliveryAddress.address,
          city: orderData.deliveryAddress.city || "Unknown",
          state: orderData.deliveryAddress.state,
          country: "Ghana"
        }
      })

      // Update order with delivery location
      await prisma.order.update({
        where: { id: order.id },
        data: { deliveryLocationId: deliveryLocation.id }
      })

      // Create order items from cart items
      const orderItems = []
      for (const cartItem of cart.items) {
        // Create order item data - we'll handle the relation differently
        const orderItemData = {
          name: cartItem.product.name,
          description: cartItem.product.description,
          quantity: cartItem.quantity,
          unitPrice: cartItem.unitPrice,
          totalPrice: cartItem.unitPrice * cartItem.quantity,
          instructions: orderData.specialInstructions
        }

        // Create order item record
        const orderItem = await prisma.orderItem.create({
          data: {
            bookingId: order.id, // Using bookingId as orderId for now - this should be fixed in schema
            ...orderItemData
          }
        })
        orderItems.push(orderItem)

        // Update product stock
        await prisma.product.update({
          where: { id: cartItem.productId },
          data: {
            stockQuantity: {
              decrement: cartItem.quantity
            }
          }
        })
      }

      // Clear the cart
      await prisma.cartItem.deleteMany({
        where: { cartId: cart.id }
      })

      // Create transaction record
      const transaction = await prisma.transaction.create({
        data: {
          userId,
          bookingId: order.id,
          paymentMethodId: orderData.paymentMethodId,
          amount: totalAmount,
          currency: "NGN",
          type: "PAYMENT",
          status: "PENDING",
          description: `Store order payment - ${order.orderNumber}`
        }
      })

      return {
        order: {
          ...order,
          deliveryLocation,
          items: orderItems
        },
        transaction,
        totals: {
          subtotal,
          deliveryFee,
          serviceFee,
          total: totalAmount
        }
      }
    } catch (error) {
      logger.error("Convert cart to order error:", error)
      throw error
    }
  }
}