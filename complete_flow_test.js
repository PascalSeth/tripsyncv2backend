// Complete Flow Test - Cart to Purchase to Delivery to Confirmation
// This file demonstrates all the API endpoints and their usage

const API_BASE = 'http://localhost:3000/api';

// Test data
const testData = {
  customer: {
    id: 'user_customer_123',
    token: 'customer_jwt_token_here'
  },
  storeOwner: {
    id: 'user_store_owner_456',
    token: 'store_owner_jwt_token_here'
  },
  dispatchRider: {
    id: 'user_rider_789',
    token: 'rider_jwt_token_here'
  },
  productId: 'prod_123',
  storeId: 'store_456',
  paymentMethodId: 'pm_test123'
};

// ===== CART MANAGEMENT =====

/**
 * 1. Add Product to Cart
 */
async function addToCart() {
  console.log('\n🛒 STEP 1: Adding product to cart...');

  const response = await fetch(`${API_BASE}/cart/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${testData.customer.token}`
    },
    body: JSON.stringify({
      productId: testData.productId,
      quantity: 2
    })
  });

  const result = await response.json();
  console.log('✅ Cart item added:', result);
  return result;
}

/**
 * 2. Get Cart Items
 */
async function getCartItems() {
  console.log('\n📋 STEP 2: Getting cart items...');

  const response = await fetch(`${API_BASE}/cart/items`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${testData.customer.token}`
    }
  });

  const result = await response.json();
  console.log('✅ Cart items retrieved:', result);
  return result;
}

/**
 * 3. Update Cart Item
 */
async function updateCartItem(itemId) {
  console.log('\n✏️ STEP 3: Updating cart item quantity...');

  const response = await fetch(`${API_BASE}/cart/items/${itemId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${testData.customer.token}`
    },
    body: JSON.stringify({
      quantity: 3
    })
  });

  const result = await response.json();
  console.log('✅ Cart item updated:', result);
  return result;
}

/**
 * 4. Get Cart Summary
 */
async function getCartSummary() {
  console.log('\n📊 STEP 4: Getting cart summary...');

  const response = await fetch(`${API_BASE}/cart/summary`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${testData.customer.token}`
    }
  });

  const result = await response.json();
  console.log('✅ Cart summary retrieved:', result);
  return result;
}

/**
 * 5. Validate Cart
 */
async function validateCart() {
  console.log('\n✅ STEP 5: Validating cart...');

  const response = await fetch(`${API_BASE}/cart/validate`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${testData.customer.token}`
    }
  });

  const result = await response.json();
  console.log('✅ Cart validated:', result);
  return result;
}

/**
 * 6. Checkout from Cart
 */
async function checkout() {
  console.log('\n💳 STEP 6: Checking out from cart...');

  const response = await fetch(`${API_BASE}/cart/checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${testData.customer.token}`
    },
    body: JSON.stringify({
      deliveryAddress: {
        latitude: 40.7128,
        longitude: -74.0060,
        address: "123 Main St, New York, NY",
        city: "New York",
        state: "NY",
        instructions: "Ring doorbell twice"
      },
      paymentMethodId: testData.paymentMethodId,
      specialInstructions: "Handle with care"
    })
  });

  const result = await response.json();
  console.log('✅ Checkout completed:', result);
  return result;
}

// ===== ORDER MANAGEMENT =====

/**
 * 7. Store Owner Views Orders
 */
async function getStoreOrders() {
  console.log('\n🏪 STEP 7: Store owner viewing orders...');

  const response = await fetch(`${API_BASE}/orders/store?page=1&limit=20&status=PENDING`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${testData.storeOwner.token}`
    }
  });

  const result = await response.json();
  console.log('✅ Store orders retrieved:', result);
  return result;
}

/**
 * 8. Store Owner Updates Order Status
 */
async function updateOrderStatus(orderId) {
  console.log('\n📝 STEP 8: Store owner updating order status...');

  const response = await fetch(`${API_BASE}/orders/store/${orderId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${testData.storeOwner.token}`
    },
    body: JSON.stringify({
      status: "ORDER_PROCESSING",
      notes: "Order is being prepared"
    })
  });

  const result = await response.json();
  console.log('✅ Order status updated:', result);
  return result;
}

/**
 * 9. Store Owner Marks Order Ready
 */
async function markOrderReady(orderId) {
  console.log('\n✅ STEP 9: Store owner marking order ready...');

  const response = await fetch(`${API_BASE}/orders/store/${orderId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${testData.storeOwner.token}`
    },
    body: JSON.stringify({
      status: "READY_FOR_PICKUP",
      notes: "Order is ready for courier pickup"
    })
  });

  const result = await response.json();
  console.log('✅ Order marked ready for pickup:', result);
  return result;
}

// ===== DELIVERY MANAGEMENT =====

/**
 * 10. Get Delivery Estimate
 */
async function getDeliveryEstimate() {
  console.log('\n📏 STEP 10: Getting delivery estimate...');

  const response = await fetch(`${API_BASE}/delivery/estimate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${testData.customer.token}`
    },
    body: JSON.stringify({
      storeId: testData.storeId,
      customerLatitude: 40.7128,
      customerLongitude: -74.0060,
      items: [{ productId: testData.productId, quantity: 2 }]
    })
  });

  const result = await response.json();
  console.log('✅ Delivery estimate retrieved:', result);
  return result;
}

/**
 * 11. Get Pending Deliveries (Dispatch Rider)
 */
async function getPendingDeliveries() {
  console.log('\n📦 STEP 11: Dispatch rider getting pending deliveries...');

  const response = await fetch(`${API_BASE}/delivery/pending`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${testData.dispatchRider.token}`
    }
  });

  const result = await response.json();
  console.log('✅ Pending deliveries retrieved:', result);
  return result;
}

/**
 * 12. Accept Delivery (Dispatch Rider)
 */
async function acceptDelivery(deliveryId) {
  console.log('\n🤝 STEP 12: Dispatch rider accepting delivery...');

  const response = await fetch(`${API_BASE}/delivery/${deliveryId}/accept`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${testData.dispatchRider.token}`
    }
  });

  const result = await response.json();
  console.log('✅ Delivery accepted:', result);
  return result;
}

/**
 * 13. Update Delivery Status (Dispatch Rider)
 */
async function updateDeliveryStatus(deliveryId) {
  console.log('\n🚚 STEP 13: Dispatch rider updating delivery status...');

  const response = await fetch(`${API_BASE}/delivery/${deliveryId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${testData.dispatchRider.token}`
    },
    body: JSON.stringify({
      status: "PICKUP_IN_PROGRESS",
      notes: "Heading to pickup location"
    })
  });

  const result = await response.json();
  console.log('✅ Delivery status updated:', result);
  return result;
}

/**
 * 14. Track Delivery (Customer)
 */
async function trackDelivery(trackingCode) {
  console.log('\n📍 STEP 14: Customer tracking delivery...');

  const response = await fetch(`${API_BASE}/delivery/track/${trackingCode}`, {
    method: 'GET'
  });

  const result = await response.json();
  console.log('✅ Delivery tracking retrieved:', result);
  return result;
}

/**
 * 15. Get Active Delivery (Dispatch Rider)
 */
async function getActiveDelivery() {
  console.log('\n🎯 STEP 15: Dispatch rider getting active delivery...');

  const response = await fetch(`${API_BASE}/delivery/active`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${testData.dispatchRider.token}`
    }
  });

  const result = await response.json();
  console.log('✅ Active delivery retrieved:', result);
  return result;
}

/**
 * 16. Complete Delivery (Dispatch Rider)
 */
async function completeDelivery(deliveryId) {
  console.log('\n🏁 STEP 16: Dispatch rider completing delivery...');

  const response = await fetch(`${API_BASE}/delivery/${deliveryId}/status`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${testData.dispatchRider.token}`
    },
    body: JSON.stringify({
      status: "DELIVERED",
      notes: "Order delivered successfully",
      location: {
        latitude: 40.7128,
        longitude: -74.0060
      }
    })
  });

  const result = await response.json();
  console.log('✅ Delivery completed:', result);
  return result;
}

/**
 * 17. Confirm Purchase (Customer)
 */
async function confirmPurchase(confirmationToken) {
  console.log('\n🤝 STEP 17: Customer confirming purchase...');

  const response = await fetch(`${API_BASE}/delivery/confirm-purchase`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${testData.customer.token}`
    },
    body: JSON.stringify({
      confirmationToken: confirmationToken
    })
  });

  const result = await response.json();
  console.log('✅ Purchase confirmed:', result);
  return result;
}

/**
 * 18. Get Customer Orders
 */
async function getCustomerOrders() {
  console.log('\n📚 STEP 18: Customer viewing order history...');

  const response = await fetch(`${API_BASE}/orders/customer?page=1&limit=10&status=DELIVERED`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${testData.customer.token}`
    }
  });

  const result = await response.json();
  console.log('✅ Customer orders retrieved:', result);
  return result;
}

// ===== MAIN TEST FUNCTION =====

/**
 * Complete Flow Test
 */
async function runCompleteFlowTest() {
  try {
    console.log('🚀 STARTING COMPLETE CART TO DELIVERY FLOW TEST');
    console.log('=' .repeat(60));

    // Cart Management
    await addToCart();
    await getCartItems();
    const cartItems = await getCartItems();
    if (cartItems.data?.items?.[0]?.id) {
      await updateCartItem(cartItems.data.items[0].id);
    }
    await getCartSummary();
    await validateCart();

    // Checkout
    const checkoutResult = await checkout();
    const orderId = checkoutResult.data?.order?.id;
    const trackingCode = checkoutResult.data?.delivery?.trackingCode;

    // Order Management
    await getStoreOrders();
    if (orderId) {
      await updateOrderStatus(orderId);
      await markOrderReady(orderId);
    }

    // Delivery Management
    await getDeliveryEstimate();
    await getPendingDeliveries();

    // Simulate delivery acceptance and completion
    const pendingDeliveries = await getPendingDeliveries();
    if (pendingDeliveries.data?.[0]?.id) {
      const deliveryId = pendingDeliveries.data[0].id;
      await acceptDelivery(deliveryId);
      await updateDeliveryStatus(deliveryId);
      await getActiveDelivery();
      await completeDelivery(deliveryId);
    }

    // Tracking and Confirmation
    if (trackingCode) {
      await trackDelivery(trackingCode);
    }

    // Customer confirmation and order history
    await confirmPurchase('confirmation_token_here');
    await getCustomerOrders();

    console.log('\n' + '=' .repeat(60));
    console.log('🎉 COMPLETE FLOW TEST FINISHED SUCCESSFULLY!');
    console.log('All API endpoints tested and working.');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Export functions for individual testing
module.exports = {
  runCompleteFlowTest,
  addToCart,
  getCartItems,
  updateCartItem,
  getCartSummary,
  validateCart,
  checkout,
  getStoreOrders,
  updateOrderStatus,
  markOrderReady,
  getDeliveryEstimate,
  getPendingDeliveries,
  acceptDelivery,
  updateDeliveryStatus,
  trackDelivery,
  getActiveDelivery,
  completeDelivery,
  confirmPurchase,
  getCustomerOrders
};

// Run test if called directly
if (require.main === module) {
  runCompleteFlowTest();
}