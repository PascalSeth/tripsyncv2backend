import Joi from "joi"

export const orderValidation = {
  updateOrderStatus: Joi.object({
    params: Joi.object({
      orderId: Joi.string().required()
    }),
    body: Joi.object({
      status: Joi.string()
        .valid(
          "ORDER_PROCESSING",
          "ORDER_CONFIRMED",
          "WAITING_COURIER",
          "COURIER_PICKING_UP",
          "COURIER_ON_WAY",
          "COURIER_ARRIVED",
          "PREPARING",
          "READY_FOR_PICKUP",
          "PICKED_UP",
          "IN_TRANSIT",
          "DELIVERED",
          "ORDER_REJECTED",
          "CANCELLED"
        )
        .required(),
      notes: Joi.string().max(500).optional()
    })
  }),

  getOrders: Joi.object({
    query: Joi.object({
      page: Joi.number().integer().min(1).optional(),
      limit: Joi.number().integer().min(1).max(100).optional(),
      status: Joi.string()
        .valid(
          "PENDING",
          "ORDER_PROCESSING",
          "ORDER_CONFIRMED",
          "WAITING_COURIER",
          "COURIER_PICKING_UP",
          "COURIER_ON_WAY",
          "COURIER_ARRIVED",
          "PREPARING",
          "READY_FOR_PICKUP",
          "PICKED_UP",
          "IN_TRANSIT",
          "DELIVERED",
          "ORDER_REJECTED",
          "CANCELLED",
          "REFUNDED"
        )
        .optional(),
      startDate: Joi.date().iso().optional(),
      endDate: Joi.date().iso().optional()
    })
  })
}