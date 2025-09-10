import Joi from "joi"

// Store purchase delivery estimate validation
export const storePurchaseDeliveryEstimateSchema = Joi.object({
  storeId: Joi.string().required(),
  customerLatitude: Joi.number().min(-90).max(90).required(),
  customerLongitude: Joi.number().min(-180).max(180).required(),
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().required(),
        quantity: Joi.number().integer().min(1).required()
      })
    )
    .min(1)
    .required()
})

// Store purchase delivery request validation
export const storePurchaseDeliverySchema = Joi.object({
  storeId: Joi.string().required(),
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().required(),
        quantity: Joi.number().integer().min(1).required(),
        unitPrice: Joi.number().min(0).required(),
        name: Joi.string().required()
      })
    )
    .min(1)
    .required(),
  deliveryAddress: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    address: Joi.string().required(),
    instructions: Joi.string().optional()
  }).required(),
  specialInstructions: Joi.string().optional(),
  recipientName: Joi.string().optional(),
  recipientPhone: Joi.string().optional(),
  paymentMethodId: Joi.string().optional()
})

// User-to-user delivery request validation
export const userToUserDeliverySchema = Joi.object({
  recipientId: Joi.string().required(),
  items: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().required(),
        description: Joi.string().optional(),
        quantity: Joi.number().integer().min(1).required(),
        value: Joi.number().min(0).optional()
      })
    )
    .min(1)
    .required(),
  pickupAddress: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    address: Joi.string().required(),
    instructions: Joi.string().optional()
  }).required(),
  deliveryAddress: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    address: Joi.string().required(),
    instructions: Joi.string().optional()
  }).required(),
  specialInstructions: Joi.string().optional(),
  recipientName: Joi.string().required(),
  recipientPhone: Joi.string().required(),
  paymentMethodId: Joi.string().optional()
})

// Delivery tracking validation
export const deliveryTrackingSchema = Joi.object({
  trackingCode: Joi.string().required()
})

// Delivery statistics validation
export const deliveryStatisticsSchema = Joi.object({
  startDate: Joi.string().optional(),
  endDate: Joi.string().optional(),
  storeId: Joi.string().optional()
})