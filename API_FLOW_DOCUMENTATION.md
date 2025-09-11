# Complete API Flow: Cart to Purchase to Delivery to Confirmation

This document outlines the complete API flow for processing an order from adding items to cart through delivery confirmation.

## 1. Add Product to Cart

**Endpoint:** `POST /api/cart/items`
**Authentication:** Required (Bearer token)

**Request:**
```json
{
  "productId": "prod_123",
  "quantity": 2
}
```

**Response:**
```json
{
  "success": true,
  "message": "Item added to cart successfully",
  "data": {
    "id": "cart_item_456",
    "productId": "prod_123",
    "quantity": 2,
    "price": 29.99,
    "total": 59.98
  }
}
```

## 2. Checkout from Cart

**Endpoint:** `POST /api/cart/checkout`
**Authentication:** Required (Bearer token)

**Request:**
```json
{
  "deliveryAddress": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "address": "123 Main St, New York, NY",
    "city": "New York",
    "state": "NY",
    "instructions": "Ring doorbell twice"
  },
  "paymentMethodId": "pm_1234567890",
  "specialInstructions": "Handle with care"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order created successfully from cart",
  "data": {
    "orderId": "ord_123",
    "orderNumber": "ORD-2024-001",
    "totalAmount": 59.98,
    "status": "PENDING",
    "delivery": {
      "id": "del_456",
      "trackingCode": "TRK123456789",
      "status": "PENDING"
    }
  }
}
```

## 3. Store Owner Views Orders

**Endpoint:** `GET /api/orders/store?page=1&limit=20&status=PENDING`
**Authentication:** Required (Store Owner Bearer token)

**Response:**
```json
{
  "success": true,
  "message": "Store orders retrieved successfully",
  "data": [
    {
      "id": "ord_123",
      "orderNumber": "ORD-2024-001",
      "status": "PENDING",
      "totalAmount": 59.98,
      "customer": {
        "firstName": "John",
        "lastName": "Doe",
        "phone": "+1234567890"
      }
    }
  ]
}
```

## 4. Store Owner Updates Order Status

**Endpoint:** `PUT /api/orders/store/ord_123/status`
**Authentication:** Required (Store Owner Bearer token)

**Request:**
```json
{
  "status": "ORDER_PROCESSING",
  "notes": "Order is being prepared"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order status updated successfully",
  "data": {
    "id": "ord_123",
    "status": "ORDER_PROCESSING",
    "updatedAt": "2024-09-11T06:30:00.000Z"
  }
}
```

## 5. Store Owner Marks Order Ready for Pickup

**Endpoint:** `PUT /api/orders/store/ord_123/status`
**Authentication:** Required (Store Owner Bearer token)

**Request:**
```json
{
  "status": "READY_FOR_PICKUP",
  "notes": "Order is ready for courier pickup"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order status updated successfully",
  "data": {
    "id": "ord_123",
    "status": "READY_FOR_PICKUP",
    "readyForPickupAt": "2024-09-11T06:45:00.000Z"
  }
}
```

## 6. Customer Tracks Delivery

**Endpoint:** `GET /api/delivery/track/TRK123456789`
**Authentication:** Not required (Public endpoint)

**Response:**
```json
{
  "success": true,
  "message": "Delivery tracking retrieved successfully",
  "data": {
    "id": "del_456",
    "trackingCode": "TRK123456789",
    "status": "IN_TRANSIT",
    "estimatedDeliveryTime": "2024-09-11T08:00:00.000Z",
    "currentLocation": {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "address": "Manhattan, NY"
    },
    "dispatchRider": {
      "name": "John Rider",
      "phone": "+1234567890",
      "vehicleType": "motorcycle"
    },
    "order": {
      "orderNumber": "ORD-2024-001",
      "storeName": "Pizza Palace"
    }
  }
}
```

## 7. Courier Updates Delivery Status

**Endpoint:** `PUT /api/orders/store/ord_123/status`
**Authentication:** Required (Store Owner Bearer token)

**Request:**
```json
{
  "status": "DELIVERED",
  "notes": "Order delivered successfully"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Order status updated successfully",
  "data": {
    "id": "ord_123",
    "status": "DELIVERED",
    "deliveredAt": "2024-09-11T08:15:00.000Z"
  }
}
```

## 8. Customer Confirms Delivery

**Endpoint:** `POST /api/delivery/confirm-purchase`
**Authentication:** Required (Customer Bearer token)

**Request:**
```json
{
  "confirmationToken": "conf_abc123def456"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Purchase confirmed successfully",
  "data": {
    "orderId": "ord_123",
    "orderNumber": "ORD-2024-001",
    "status": "DELIVERED",
    "confirmedAt": "2024-09-11T08:20:00.000Z",
    "confirmationToken": "conf_abc123def456"
  }
}
```

## 9. Customer Views Order History

**Endpoint:** `GET /api/orders/customer?page=1&limit=10&status=DELIVERED`
**Authentication:** Required (Customer Bearer token)

**Response:**
```json
{
  "success": true,
  "message": "Customer orders retrieved successfully",
  "data": [
    {
      "id": "ord_123",
      "orderNumber": "ORD-2024-001",
      "status": "DELIVERED",
      "totalAmount": 59.98,
      "store": {
        "name": "Pizza Palace",
        "contactPhone": "+1234567890"
      },
      "delivery": {
        "trackingCode": "TRK123456789",
        "status": "DELIVERED"
      }
    }
  ]
}
```

## Order Status Flow

1. `PENDING` - Order created, awaiting store confirmation
2. `ORDER_PROCESSING` - Store is preparing the order
3. `ORDER_CONFIRMED` - Order confirmed by store
4. `WAITING_COURIER` - Waiting for courier assignment
5. `COURIER_PICKING_UP` - Courier is picking up the order
6. `COURIER_ON_WAY` - Courier is on the way
7. `COURIER_ARRIVED` - Courier has arrived at destination
8. `PREPARING` - Order is being prepared
9. `READY_FOR_PICKUP` - Order is ready for pickup
10. `PICKED_UP` - Order has been picked up
11. `IN_TRANSIT` - Order is in transit
12. `DELIVERED` - Order has been delivered
13. `ORDER_REJECTED` - Order was rejected
14. `CANCELLED` - Order was cancelled

## Key Features

- **Real-time Notifications:** Customers receive push notifications for order status updates
- **Public Tracking:** Delivery tracking is available without authentication
- **Role-based Access:** Different endpoints for customers, store owners, and couriers
- **Comprehensive Validation:** All requests are validated with detailed error messages
- **Error Handling:** Robust error handling with meaningful error messages
- **Pagination:** List endpoints support pagination for better performance