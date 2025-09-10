import Joi from "joi"

export const cartValidation = {
  addToCart: Joi.object({
    body: Joi.object({
      productId: Joi.string().required(),
      quantity: Joi.number().integer().min(1).required()
    })
  }),

  updateCartItem: Joi.object({
    params: Joi.object({
      itemId: Joi.string().required()
    }),
    body: Joi.object({
      quantity: Joi.number().integer().min(0).required()
    })
  }),

  removeFromCart: Joi.object({
    params: Joi.object({
      itemId: Joi.string().required()
    })
  }),

  checkoutFromCart: Joi.object({
    body: Joi.object({
      deliveryAddress: Joi.object({
        latitude: Joi.number().required(),
        longitude: Joi.number().required(),
        address: Joi.string().required(),
        city: Joi.string().optional(),
        state: Joi.string().optional(),
        instructions: Joi.string().optional()
      }).required(),
      paymentMethodId: Joi.string().required(),
      specialInstructions: Joi.string().optional()
    })
  })
}