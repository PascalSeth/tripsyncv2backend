# Backend Implementation: Complete Cart to Delivery Flow

This document provides a comprehensive overview of the implemented backend functionality for the complete cart to purchase to delivery to confirmation flow.

## 📋 Table of Contents

1. [Overview](#overview)
2. [API Endpoints](#api-endpoints)
3. [Database Schema](#database-schema)
4. [Services Architecture](#services-architecture)
5. [Authentication & Authorization](#authentication--authorization)
6. [Error Handling](#error-handling)
7. [Testing](#testing)

## 🎯 Overview

The backend implementation provides a complete e-commerce delivery system with the following key features:

- **Cart Management**: Add, update, remove items with validation
- **Order Processing**: Complete order lifecycle management
- **Delivery System**: Real-time delivery tracking and management
- **Purchase Confirmation**: Email-based confirmation system
- **Dispatch Rider Management**: Rider onboarding and delivery assignment
- **Real-time Notifications**: WebSocket-based updates
- **Payment Integration**: Transaction processing and commission tracking

## 🔗 API Endpoints

### Cart Management

#### `POST /api/cart/items`
Add product to cart
```javascript
// Request
{
  "productId": "prod_123",
  "quantity": 2
}

// Response
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

#### `GET /api/cart/items`
Get cart items with product details
```javascript
// Response
{
  "success": true,
  "data": {
    "id": "cart_123",
    "items": [...],
    "summary": {
      "itemCount": 2,
      "totalItems": 5,
      "subtotal": 149.95
    }
  }
}
```

#### `PUT /api/cart/items/:itemId`
Update cart item quantity
```javascript
// Request
{ "quantity": 3 }

// Response
{
  "success": true,
  "message": "Cart item updated successfully",
  "data": { "quantity": 3, "total": 89.97 }
}
```

#### `DELETE /api/cart/items/:itemId`
Remove item from cart
```javascript
// Response
{
  "success": true,
  "message": "Item removed from cart successfully"
}
```

#### `GET /api/cart/summary`
Get cart summary
```javascript
// Response
{
  "success": true,
  "data": {
    "itemCount": 2,
    "totalItems": 5,
    "subtotal": 149.95,
    "deliveryFee": 2.99,
    "total": 152.94
  }
}
```

#### `GET /api/cart/validate`
Validate cart before checkout
```javascript
// Response
{
  "success": true,
  "data": {
    "valid": true,
    "warnings": [],
    "errors": []
  }
}
```

#### `POST /api/cart/checkout`
Checkout from cart
```javascript
// Request
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

// Response
{
  "success": true,
  "message": "Order created successfully from cart",
  "data": {
    "orderId": "ord_123",
    "orderNumber": "ORD-2024-001",
    "totalAmount": 59.98,
    "status": "PENDING"
  }
}
```

### Order Management

#### `GET /api/orders/store`
Store owner views orders
```javascript
// Query params: ?page=1&limit=20&status=PENDING

// Response
{
  "success": true,
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
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 1,
    "totalPages": 1
  }
}
```

#### `PUT /api/orders/store/:orderId/status`
Update order status
```javascript
// Request
{
  "status": "ORDER_PROCESSING",
  "notes": "Order is being prepared"
}

// Response
{
  "success": true,
  "message": "Order status updated successfully",
  "data": {
    "id": "ord_123",
    "status": "ORDER_PROCESSING"
  }
}
```

#### `GET /api/orders/customer`
Customer views orders
```javascript
// Query params: ?page=1&limit=10&status=DELIVERED

// Response
{
  "success": true,
  "data": [
    {
      "id": "ord_123",
      "orderNumber": "ORD-2024-001",
      "status": "DELIVERED",
      "totalAmount": 59.98,
      "store": {
        "name": "Pizza Palace",
        "contactPhone": "+1234567890"
      }
    }
  ]
}
```

### Delivery Management

#### `POST /api/delivery/estimate`
Calculate delivery estimate
```javascript
// Request
{
  "storeId": "store_456",
  "customerLatitude": 40.7128,
  "customerLongitude": -74.0060,
  "items": [
    { "productId": "prod_123", "quantity": 2 }
  ]
}

// Response
{
  "success": true,
  "data": {
    "deliveryFee": 5.99,
    "estimatedDuration": 25,
    "estimatedDistance": 3.2,
    "orderTotal": 59.98,
    "totalCost": 65.97
  }
}
```

#### `GET /api/delivery/track/:trackingCode`
Track delivery (Public)
```javascript
// Response
{
  "success": true,
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
    }
  }
}
```

#### `GET /api/delivery/pending`
Get pending deliveries (Dispatch Rider)
```javascript
// Response
{
  "success": true,
  "data": [
    {
      "id": "del_456",
      "orderId": "ord_123",
      "pickupLocation": {
        "latitude": 40.7589,
        "longitude": -73.9851,
        "address": "123 Store St, New York, NY"
      },
      "deliveryLocation": {
        "latitude": 40.7128,
        "longitude": -74.0060,
        "address": "456 Customer Ave, New York, NY"
      },
      "deliveryFee": 5.99,
      "distance": 2.5
    }
  ]
}
```

#### `POST /api/delivery/:deliveryId/accept`
Accept delivery (Dispatch Rider)
```javascript
// Response
{
  "success": true,
  "message": "Delivery accepted successfully",
  "data": {
    "id": "del_456",
    "status": "ASSIGNED",
    "dispatchRiderId": "rider_789",
    "assignedAt": "2024-09-11T06:30:00.000Z"
  }
}
```

#### `PUT /api/delivery/:deliveryId/status`
Update delivery status (Dispatch Rider)
```javascript
// Request
{
  "status": "PICKUP_IN_PROGRESS",
  "notes": "Heading to pickup location"
}

// Response
{
  "success": true,
  "message": "Delivery status updated successfully",
  "data": {
    "id": "del_456",
    "status": "PICKUP_IN_PROGRESS",
    "pickupStartedAt": "2024-09-11T07:00:00.000Z"
  }
}
```

#### `GET /api/delivery/active`
Get active delivery (Dispatch Rider)
```javascript
// Response
{
  "success": true,
  "data": {
    "id": "del_456",
    "status": "IN_TRANSIT",
    "orderId": "ord_123",
    "customer": {
      "name": "John Doe",
      "phone": "+1234567890"
    },
    "pickupLocation": { ... },
    "deliveryLocation": { ... }
  }
}
```

#### `POST /api/delivery/confirm-purchase`
Confirm purchase (Customer)
```javascript
// Request
{
  "confirmationToken": "conf_abc123def456"
}

// Response
{
  "success": true,
  "message": "Purchase confirmed successfully",
  "data": {
    "orderId": "ord_123",
    "orderNumber": "ORD-2024-001",
    "status": "DELIVERED",
    "confirmedAt": "2024-09-11T08:20:00.000Z"
  }
}
```

## 🗄️ Database Schema

### Core Tables

#### `carts`
- `id`: Primary key
- `userId`: Foreign key to User
- `createdAt`, `updatedAt`: Timestamps

#### `cart_items`
- `id`: Primary key
- `cartId`: Foreign key to Cart
- `productId`: Foreign key to Product
- `quantity`: Item quantity
- `unitPrice`: Price at time of adding

#### `orders`
- `id`: Primary key
- `orderNumber`: Unique order identifier
- `customerId`: Foreign key to User
- `storeId`: Foreign key to Store
- `status`: Order status enum
- `totalAmount`: Total order amount
- `deliveryFee`: Delivery fee
- `preparationNotes`: JSON notes

#### `deliveries`
- `id`: Primary key
- `orderId`: Foreign key to Order
- `dispatchRiderId`: Foreign key to User
- `status`: Delivery status enum
- `trackingCode`: Unique tracking code
- `deliveryFee`: Delivery fee
- Various timestamps and location data

#### `delivery_tracking`
- `id`: Primary key
- `deliveryId`: Foreign key to Delivery
- `latitude`, `longitude`: Location coordinates
- `status`: Status at this point
- `timestamp`: When this update occurred

#### `purchase_confirmations`
- `id`: Primary key
- `orderId`: Foreign key to Order
- `confirmationToken`: Unique token
- `status`: Confirmation status
- `expiresAt`: Expiration timestamp
- Email tracking fields

## 🏗️ Services Architecture

### CartService
- `getOrCreateCart()`: Get or create user cart
- `addToCart()`: Add product to cart with validation
- `updateCartItem()`: Update item quantity
- `removeFromCart()`: Remove item from cart
- `validateCartForCheckout()`: Validate cart before checkout
- `convertCartToOrder()`: Convert cart to order

### StoreDeliveryService
- `calculateStorePurchaseDeliveryEstimate()`: Calculate delivery cost
- `createStorePurchaseDelivery()`: Create delivery request
- `confirmPurchase()`: Confirm purchase with email system

### DispatchRiderService
- `onboardDispatchRider()`: Onboard new dispatch rider
- `acceptDeliveryRequest()`: Accept delivery assignment
- `updateDeliveryTracking()`: Update delivery location/status
- `completeDelivery()`: Mark delivery as completed

### PurchaseConfirmationService
- `createPurchaseConfirmation()`: Create confirmation token
- `confirmPurchase()`: Confirm purchase via token
- `sendPurchaseConfirmationEmail()`: Send confirmation email
- `sendReminderEmails()`: Send reminder emails

## 🔐 Authentication & Authorization

### JWT Authentication
- Bearer token required for protected routes
- Token validation middleware
- User context available in request object

### Role-Based Access Control (RBAC)
- **Customer**: Cart, orders, delivery tracking
- **Store Owner**: Order management, confirmations
- **Dispatch Rider**: Delivery acceptance, tracking, completion
- **Admin**: System management, analytics

### Route Protection Examples
```javascript
// Customer routes
router.use(authMiddleware)

// Store owner routes
router.use(authMiddleware)
router.use(rbacMiddleware(["STORE_OWNER"]))

// Dispatch rider routes
router.use(authMiddleware)
router.use(rbacMiddleware(["DRIVER", "DISPATCHER"]))
```

## 🚨 Error Handling

### Standardized Error Responses
```javascript
// Success response
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { ... }
}

// Error response
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error message"
}
```

### HTTP Status Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request (validation errors)
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error

### Error Types
- **ValidationError**: Invalid input data
- **AuthenticationError**: Invalid/missing credentials
- **AuthorizationError**: Insufficient permissions
- **NotFoundError**: Resource not found
- **BusinessLogicError**: Business rule violations

## 🧪 Testing

### Test Files
- `test_complete_flow.js`: Basic API testing
- `complete_flow_test.js`: Comprehensive flow testing

### Running Tests
```bash
# Run basic tests
node test_complete_flow.js

# Run comprehensive tests
node complete_flow_test.js
```

### Test Coverage
- ✅ Cart operations (add, update, remove, validate)
- ✅ Checkout process
- ✅ Order status updates
- ✅ Delivery estimation and creation
- ✅ Dispatch rider operations
- ✅ Delivery tracking
- ✅ Purchase confirmation
- ✅ Error scenarios

## 📊 Monitoring & Logging

### Winston Logger
- Comprehensive logging for all operations
- Error tracking with stack traces
- Performance monitoring
- Request/response logging

### Key Log Points
- Cart operations
- Order creation/updates
- Delivery status changes
- Payment processing
- Email sending
- WebSocket events

## 🔄 Real-time Features

### WebSocket Integration
- Live delivery tracking updates
- Real-time notifications
- Status change broadcasts
- Location updates

### WebSocket Events
- `delivery_update`: Delivery status changes
- `dispatch_rider_location_update`: Rider location updates
- `order_status_update`: Order status changes
- `notification`: Push notifications

## 📧 Email System

### Email Templates
- **Purchase Confirmation**: Sent to store owners
- **Purchase Confirmed**: Sent to customers
- **Purchase Expired**: Sent when confirmation times out
- **Reminder Emails**: Sent before expiration

### Email Features
- HTML templates with responsive design
- Token-based confirmation links
- Automatic expiration handling
- Email tracking and analytics

## 💰 Payment Integration

### Transaction Management
- Payment method validation
- Transaction creation and tracking
- Refund processing
- Commission calculation

### Payment Flow
1. Validate payment method
2. Create transaction record
3. Process payment via Paystack
4. Update transaction status
5. Handle success/failure scenarios

## 🚀 Production Considerations

### Scalability
- Database query optimization
- Redis caching for frequently accessed data
- Background job processing for emails
- Horizontal scaling support

### Security
- Input validation and sanitization
- SQL injection prevention
- XSS protection
- Rate limiting
- CORS configuration

### Performance
- Database indexing
- Query optimization
- Caching strategies
- CDN integration for static assets

---

## 🎯 Complete Flow Summary

1. **Cart Management** → Add/update/remove items
2. **Checkout** → Convert cart to order
3. **Order Processing** → Store owner manages orders
4. **Delivery Assignment** → Dispatch rider accepts delivery
5. **Delivery Tracking** → Real-time location and status updates
6. **Purchase Confirmation** → Email-based confirmation system
7. **Order Completion** → Delivery completion and customer confirmation

The implementation provides a complete, production-ready e-commerce delivery system with comprehensive API documentation, error handling, security, and real-time features.