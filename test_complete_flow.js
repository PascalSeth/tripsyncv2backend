const axios = require('axios');

// Complete Flow Test - Cart to Purchase to Delivery to Confirmation
// This file demonstrates all the API endpoints and their usage

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';

// Test data
const testData = {
  customer: {
    id: 'user_customer_123',
    token: process.env.CUSTOMER_TOKEN || 'customer_jwt_token_here'
  },
  storeOwner: {
    id: 'user_store_owner_456',
    token: process.env.STORE_OWNER_TOKEN || 'store_owner_jwt_token_here'
  },
  dispatchRider: {
    id: 'user_rider_789',
    token: process.env.RIDER_TOKEN || 'rider_jwt_token_here'
  },
  productId: process.env.PRODUCT_ID || 'prod_123',
  storeId: process.env.STORE_ID || 'store_456',
  paymentMethodId: process.env.PAYMENT_METHOD_ID || 'pm_test123'
};

// Global variables to store IDs from previous steps
let orderId = null;
let deliveryId = null;
let trackingCode = null;
let cartItemId = null;

// ===== CART MANAGEMENT =====

/**
 * 1. Add Product to Cart
 */
async function addToCart() {
  console.log('\n🛒 STEP 1: Adding product to cart...');

  try {
    const response = await axios.post(`${API_BASE}/cart/items`, {
      productId: testData.productId,
      quantity: 2
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testData.customer.token}`
      }
    });

    console.log('✅ Cart item added:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Add to cart failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 2. Get Cart Items
 */
async function getCartItems() {
  console.log('\n📋 STEP 2: Getting cart items...');

  try {
    const response = await axios.get(`${API_BASE}/cart/items`, {
      headers: {
        'Authorization': `Bearer ${testData.customer.token}`
      }
    });

    console.log('✅ Cart items retrieved:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Get cart items failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 3. Update Cart Item
 */
async function updateCartItem(itemId) {
  console.log('\n✏️ STEP 3: Updating cart item quantity...');

  try {
    const response = await axios.put(`${API_BASE}/cart/items/${itemId}`, {
      quantity: 3
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testData.customer.token}`
      }
    });

    console.log('✅ Cart item updated:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Update cart item failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 4. Get Cart Summary
 */
async function getCartSummary() {
  console.log('\n📊 STEP 4: Getting cart summary...');

  try {
    const response = await axios.get(`${API_BASE}/cart/summary`, {
      headers: {
        'Authorization': `Bearer ${testData.customer.token}`
      }
    });

    console.log('✅ Cart summary retrieved:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Get cart summary failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 5. Validate Cart
 */
async function validateCart() {
  console.log('\n✅ STEP 5: Validating cart...');

  try {
    const response = await axios.get(`${API_BASE}/cart/validate`, {
      headers: {
        'Authorization': `Bearer ${testData.customer.token}`
      }
    });

    console.log('✅ Cart validated:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Validate cart failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 6. Checkout from Cart
 */
async function checkout() {
  console.log('\n💳 STEP 6: Checking out from cart...');

  try {
    const response = await axios.post(`${API_BASE}/cart/checkout`, {
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
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testData.customer.token}`
      }
    });

    console.log('✅ Checkout completed:', response.data);

    // Store IDs for next steps
    if (response.data.data?.order?.id) {
      orderId = response.data.data.order.id;
    }
    if (response.data.data?.delivery?.id) {
      deliveryId = response.data.data.delivery.id;
    }
    if (response.data.data?.delivery?.trackingCode) {
      trackingCode = response.data.data.delivery.trackingCode;
    }

    return response.data;
  } catch (error) {
    console.error('❌ Checkout failed:', error.response?.data || error.message);
    throw error;
  }
}

// ===== ORDER MANAGEMENT =====

/**
 * 7. Store Owner Views Orders
 */
async function getStoreOrders() {
  console.log('\n🏪 STEP 7: Store owner viewing orders...');

  try {
    const response = await axios.get(`${API_BASE}/orders/store?page=1&limit=20&status=PENDING`, {
      headers: {
        'Authorization': `Bearer ${testData.storeOwner.token}`
      }
    });

    console.log('✅ Store orders retrieved:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Get store orders failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 8. Store Owner Updates Order Status
 */
async function updateOrderStatus(orderId) {
  console.log('\n📝 STEP 8: Store owner updating order status...');

  try {
    const response = await axios.put(`${API_BASE}/orders/store/${orderId}/status`, {
      status: "ORDER_PROCESSING",
      notes: "Order is being prepared"
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testData.storeOwner.token}`
      }
    });

    console.log('✅ Order status updated:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Update order status failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 9. Store Owner Marks Order Ready
 */
async function markOrderReady(orderId) {
  console.log('\n✅ STEP 9: Store owner marking order ready...');

  try {
    const response = await axios.put(`${API_BASE}/orders/store/${orderId}/status`, {
      status: "READY_FOR_PICKUP",
      notes: "Order is ready for courier pickup"
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testData.storeOwner.token}`
      }
    });

    console.log('✅ Order marked ready for pickup:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Mark order ready failed:', error.response?.data || error.message);
    throw error;
  }
}

// ===== DELIVERY MANAGEMENT =====

/**
 * 10. Get Delivery Estimate
 */
async function getDeliveryEstimate() {
  console.log('\n📏 STEP 10: Getting delivery estimate...');

  try {
    const response = await axios.post(`${API_BASE}/delivery/estimate`, {
      storeId: testData.storeId,
      customerLatitude: 40.7128,
      customerLongitude: -74.0060,
      items: [{ productId: testData.productId, quantity: 2 }]
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testData.customer.token}`
      }
    });

    console.log('✅ Delivery estimate retrieved:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Get delivery estimate failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 11. Get Pending Deliveries (Dispatch Rider)
 */
async function getPendingDeliveries() {
  console.log('\n📦 STEP 11: Dispatch rider getting pending deliveries...');

  try {
    const response = await axios.get(`${API_BASE}/delivery/pending`, {
      headers: {
        'Authorization': `Bearer ${testData.dispatchRider.token}`
      }
    });

    console.log('✅ Pending deliveries retrieved:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Get pending deliveries failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 12. Accept Delivery (Dispatch Rider)
 */
async function acceptDelivery(deliveryId) {
  console.log('\n🤝 STEP 12: Dispatch rider accepting delivery...');

  try {
    const response = await axios.post(`${API_BASE}/delivery/${deliveryId}/accept`, {}, {
      headers: {
        'Authorization': `Bearer ${testData.dispatchRider.token}`
      }
    });

    console.log('✅ Delivery accepted:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Accept delivery failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 13. Update Delivery Status (Dispatch Rider)
 */
async function updateDeliveryStatus(deliveryId) {
  console.log('\n🚚 STEP 13: Dispatch rider updating delivery status...');

  try {
    const response = await axios.put(`${API_BASE}/delivery/${deliveryId}/status`, {
      status: "PICKUP_IN_PROGRESS",
      notes: "Heading to pickup location"
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testData.dispatchRider.token}`
      }
    });

    console.log('✅ Delivery status updated:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Update delivery status failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 14. Track Delivery (Customer)
 */
async function trackDelivery(trackingCode) {
  console.log('\n📍 STEP 14: Customer tracking delivery...');

  try {
    const response = await axios.get(`${API_BASE}/delivery/track/${trackingCode}`);

    console.log('✅ Delivery tracking retrieved:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Track delivery failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 15. Get Active Delivery (Dispatch Rider)
 */
async function getActiveDelivery() {
  console.log('\n🎯 STEP 15: Dispatch rider getting active delivery...');

  try {
    const response = await axios.get(`${API_BASE}/delivery/active`, {
      headers: {
        'Authorization': `Bearer ${testData.dispatchRider.token}`
      }
    });

    console.log('✅ Active delivery retrieved:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Get active delivery failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 16. Complete Delivery (Dispatch Rider)
 */
async function completeDelivery(deliveryId) {
  console.log('\n🏁 STEP 16: Dispatch rider completing delivery...');

  try {
    const response = await axios.put(`${API_BASE}/delivery/${deliveryId}/status`, {
      status: "DELIVERED",
      notes: "Order delivered successfully",
      location: {
        latitude: 40.7128,
        longitude: -74.0060
      }
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testData.dispatchRider.token}`
      }
    });

    console.log('✅ Delivery completed:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Complete delivery failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 17. Confirm Purchase (Customer)
 */
async function confirmPurchase(confirmationToken) {
  console.log('\n🤝 STEP 17: Customer confirming purchase...');

  try {
    const response = await axios.post(`${API_BASE}/delivery/confirm-purchase`, {
      confirmationToken: confirmationToken
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${testData.customer.token}`
      }
    });

    console.log('✅ Purchase confirmed:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Confirm purchase failed:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 18. Get Customer Orders
 */
async function getCustomerOrders() {
  console.log('\n📚 STEP 18: Customer viewing order history...');

  try {
    const response = await axios.get(`${API_BASE}/orders/customer?page=1&limit=10&status=DELIVERED`, {
      headers: {
        'Authorization': `Bearer ${testData.customer.token}`
      }
    });

    console.log('✅ Customer orders retrieved:', response.data);
    return response.data;
  } catch (error) {
    console.error('❌ Get customer orders failed:', error.response?.data || error.message);
    throw error;
  }
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
    const cartData = await getCartItems();
    if (cartData.data?.items?.[0]?.id) {
      cartItemId = cartData.data.items[0].id;
      await updateCartItem(cartItemId);
    }
    await getCartSummary();
    await validateCart();

    // Checkout
    const checkoutResult = await checkout();

    // Order Management
    await getStoreOrders();
    if (orderId) {
      await updateOrderStatus(orderId);
      await markOrderReady(orderId);
    }

    // Delivery Management
    await getDeliveryEstimate();
    const pendingDeliveries = await getPendingDeliveries();

    // Simulate delivery acceptance and completion
    if (pendingDeliveries.data?.[0]?.id) {
      deliveryId = pendingDeliveries.data[0].id;
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
    process.exit(1);
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