const axios = require('axios');

// Complete Flow Test - Cart to Purchase to Delivery to Confirmation
// Jest test suite for end-to-end API testing

const API_BASE = process.env.API_BASE || 'http://localhost:3000/api';

// Test data - these should be set via environment variables in CI/CD
const testData = {
  superAdmin: {
    id: 'user_super_admin_000',
    token: process.env.SUPER_ADMIN_TOKEN || 'super_admin_jwt_token_here'
  },
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

// Test context to share data between tests
let testContext = {
  selectedStore: null,
  cartItemId: null,
  orderId: null,
  deliveryId: null,
  trackingCode: null
};

describe('Complete Cart to Delivery Flow', () => {
  beforeAll(() => {
    // Set longer timeout for API calls
    jest.setTimeout(30000);
  });

  beforeEach(() => {
    // Reset axios defaults for each test
    axios.defaults.timeout = 10000;
  });

  describe('Super Admin Store Control', () => {
    test('1. Super Admin Gets All Stores', async () => {
      console.log('📤 REQUEST: GET /stores');

      const response = await axios.get(`${API_BASE}/stores`, {
        headers: {
          'Authorization': `Bearer ${testData.superAdmin.token}`
        }
      });

      console.log('📥 RESPONSE: Status', response.status);
      console.log('📦 RESPONSE BODY:', JSON.stringify(response.data, null, 2));

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('message');
      expect(Array.isArray(response.data.data)).toBe(true);
      expect(response.data.data.length).toBeGreaterThan(0);

      // Select the first available store for testing
      testContext.selectedStore = response.data.data[0];
      expect(testContext.selectedStore).toHaveProperty('id');
      expect(testContext.selectedStore).toHaveProperty('name');

      console.log('🏪 SELECTED STORE:', testContext.selectedStore.name, '(ID:', testContext.selectedStore.id + ')');
    });

    test('2. Super Admin Gets Store Details', async () => {
      expect(testContext.selectedStore).toBeTruthy();

      console.log('📤 REQUEST: GET /stores/' + testContext.selectedStore.id);

      const response = await axios.get(`${API_BASE}/stores/${testContext.selectedStore.id}`, {
        headers: {
          'Authorization': `Bearer ${testData.superAdmin.token}`
        }
      });

      console.log('📥 RESPONSE: Status', response.status);
      console.log('📦 RESPONSE BODY:', JSON.stringify(response.data, null, 2));

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data.data).toHaveProperty('id', testContext.selectedStore.id);
      expect(response.data.data).toHaveProperty('name');
      expect(response.data.data).toHaveProperty('status');
      expect(response.data.data).toHaveProperty('location');
    });

    test('3. Super Admin Gets Store Products', async () => {
      expect(testContext.selectedStore).toBeTruthy();

      console.log('📤 REQUEST: GET /stores/' + testContext.selectedStore.id + '/products');

      const response = await axios.get(`${API_BASE}/stores/${testContext.selectedStore.id}/products`, {
        headers: {
          'Authorization': `Bearer ${testData.superAdmin.token}`
        }
      });

      console.log('📥 RESPONSE: Status', response.status);
      console.log('📦 RESPONSE BODY:', JSON.stringify(response.data, null, 2));

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(Array.isArray(response.data.data)).toBe(true);

      // Update test data with actual product from selected store
      if (response.data.data.length > 0) {
        testData.productId = response.data.data[0].id;
        console.log('📦 UPDATED PRODUCT ID:', testData.productId);
      }
    });

    test('4. Super Admin Updates Store Status', async () => {
      expect(testContext.selectedStore).toBeTruthy();

      const requestBody = {
        status: 'ACTIVE',
        description: 'Store activated by super admin for testing'
      };

      console.log('📤 REQUEST: PUT /stores/' + testContext.selectedStore.id);
      console.log('📦 BODY:', JSON.stringify(requestBody, null, 2));

      const response = await axios.put(`${API_BASE}/stores/${testContext.selectedStore.id}`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testData.superAdmin.token}`
        }
      });

      console.log('📥 RESPONSE: Status', response.status);
      console.log('📦 RESPONSE BODY:', JSON.stringify(response.data, null, 2));

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data.data).toHaveProperty('status', 'ACTIVE');
    });
  });

  describe('Cart Management', () => {
    test('5. Add Product to Cart', async () => {
      const requestBody = {
        productId: testData.productId,
        quantity: 2
      };

      console.log('📤 REQUEST: POST /cart/items');
      console.log('📦 BODY:', JSON.stringify(requestBody, null, 2));

      const response = await axios.post(`${API_BASE}/cart/items`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testData.customer.token}`
        }
      });

      console.log('📥 RESPONSE: Status', response.status);
      console.log('📦 RESPONSE BODY:', JSON.stringify(response.data, null, 2));

      expect(response.status).toBe(201);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('message', 'Item added to cart successfully');
      expect(response.data.data).toHaveProperty('id');
      expect(response.data.data).toHaveProperty('productId', testData.productId);
      expect(response.data.data).toHaveProperty('quantity', 2);
      expect(response.data.data).toHaveProperty('unitPrice');
      expect(response.data.data).toHaveProperty('total');

      // Validate data types
      expect(typeof response.data.data.id).toBe('string');
      expect(typeof response.data.data.unitPrice).toBe('number');
      expect(typeof response.data.data.total).toBe('number');

      // Store cart item ID for subsequent tests
      testContext.cartItemId = response.data.data.id;
    });

    test('2. Get Cart Items', async () => {
      console.log('📤 REQUEST: GET /cart/items');

      const response = await axios.get(`${API_BASE}/cart/items`, {
        headers: {
          'Authorization': `Bearer ${testData.customer.token}`
        }
      });

      console.log('📥 RESPONSE: Status', response.status);
      console.log('📦 RESPONSE BODY:', JSON.stringify(response.data, null, 2));

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('message', 'Cart items retrieved successfully');
      expect(response.data.data).toHaveProperty('items');
      expect(Array.isArray(response.data.data.items)).toBe(true);
      expect(response.data.data.items.length).toBeGreaterThan(0);

      // Validate cart item structure
      const firstItem = response.data.data.items[0];
      expect(firstItem).toHaveProperty('id');
      expect(firstItem).toHaveProperty('productId');
      expect(firstItem).toHaveProperty('quantity');
      expect(firstItem).toHaveProperty('unitPrice');
      expect(firstItem).toHaveProperty('total');
      expect(firstItem).toHaveProperty('product');

      // Validate data types
      expect(typeof firstItem.quantity).toBe('number');
      expect(typeof firstItem.unitPrice).toBe('number');
      expect(typeof firstItem.total).toBe('number');
    });

    test('3. Update Cart Item', async () => {
      expect(testContext.cartItemId).toBeTruthy();

      const requestBody = {
        quantity: 3
      };

      console.log('📤 REQUEST: PUT /cart/items/' + testContext.cartItemId);
      console.log('📦 BODY:', JSON.stringify(requestBody, null, 2));

      const response = await axios.put(`${API_BASE}/cart/items/${testContext.cartItemId}`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testData.customer.token}`
        }
      });

      console.log('📥 RESPONSE: Status', response.status);
      console.log('📦 RESPONSE BODY:', JSON.stringify(response.data, null, 2));

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('message', 'Cart item updated successfully');
      expect(response.data.data).toHaveProperty('quantity', 3);
      expect(response.data.data).toHaveProperty('id', testContext.cartItemId);

      // Validate updated totals
      expect(response.data.data).toHaveProperty('total');
      expect(typeof response.data.data.total).toBe('number');
      expect(response.data.data.total).toBeGreaterThan(0);
    });

    test('4. Get Cart Summary', async () => {
      const response = await axios.get(`${API_BASE}/cart/summary`, {
        headers: {
          'Authorization': `Bearer ${testData.customer.token}`
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.message).toBe('Cart summary retrieved successfully');
      expect(response.data.data).toHaveProperty('itemCount');
      expect(response.data.data).toHaveProperty('totalItems');
      expect(response.data.data).toHaveProperty('subtotal');
      expect(response.data.data).toHaveProperty('total');
      expect(response.data.data.total).toBeGreaterThan(0);
    });

    test('5. Validate Cart', async () => {
      const response = await axios.get(`${API_BASE}/cart/validate`, {
        headers: {
          'Authorization': `Bearer ${testData.customer.token}`
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.message).toBe('Cart validated successfully');
      expect(response.data.data).toHaveProperty('valid');
      expect(response.data.data.valid).toBe(true);
    });

    test('6. Checkout from Cart', async () => {
      const requestBody = {
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
      };

      console.log('📤 REQUEST: POST /cart/checkout');
      console.log('📦 BODY:', JSON.stringify(requestBody, null, 2));

      const response = await axios.post(`${API_BASE}/cart/checkout`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testData.customer.token}`
        }
      });

      console.log('📥 RESPONSE: Status', response.status);
      console.log('📦 RESPONSE BODY:', JSON.stringify(response.data, null, 2));

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('message', 'Order created successfully from cart');
      expect(response.data.data).toHaveProperty('order');
      expect(response.data.data).toHaveProperty('delivery');

      // Validate order structure
      const order = response.data.data.order;
      expect(order).toHaveProperty('id');
      expect(order).toHaveProperty('orderNumber');
      expect(order).toHaveProperty('totalAmount');
      expect(order).toHaveProperty('status');
      expect(order).toHaveProperty('createdAt');

      // Validate delivery structure
      const delivery = response.data.data.delivery;
      expect(delivery).toHaveProperty('id');
      expect(delivery).toHaveProperty('trackingCode');
      expect(delivery).toHaveProperty('status');
      expect(delivery).toHaveProperty('estimatedDeliveryTime');

      // Validate data types
      expect(typeof order.id).toBe('string');
      expect(typeof order.totalAmount).toBe('number');
      expect(typeof delivery.trackingCode).toBe('string');

      // Store IDs for subsequent tests
      testContext.orderId = order.id;
      testContext.deliveryId = delivery.id;
      testContext.trackingCode = delivery.trackingCode;

      expect(testContext.orderId).toBeTruthy();
      expect(testContext.deliveryId).toBeTruthy();
      expect(testContext.trackingCode).toBeTruthy();
    });
  });

  describe('Order Management', () => {
    test('7. Super Admin Views All Orders', async () => {
      console.log('📤 REQUEST: GET /orders/store (Super Admin)');

      const response = await axios.get(`${API_BASE}/orders/store?page=1&limit=20&status=PENDING`, {
        headers: {
          'Authorization': `Bearer ${testData.superAdmin.token}`
        }
      });

      console.log('📥 RESPONSE: Status', response.status);
      console.log('📦 RESPONSE BODY:', JSON.stringify(response.data, null, 2));

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('message', 'Store orders retrieved successfully');
      expect(Array.isArray(response.data.data)).toBe(true);
      expect(response.data.data).toHaveProperty('length');
    });

    test('8. Super Admin Updates Order Status', async () => {
      expect(testContext.orderId).toBeTruthy();

      const requestBody = {
        status: "ORDER_PROCESSING",
        notes: "Order is being prepared by super admin"
      };

      console.log('📤 REQUEST: PUT /orders/store/' + testContext.orderId + '/status');
      console.log('📦 BODY:', JSON.stringify(requestBody, null, 2));

      const response = await axios.put(`${API_BASE}/orders/store/${testContext.orderId}/status`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testData.superAdmin.token}`
        }
      });

      console.log('📥 RESPONSE: Status', response.status);
      console.log('📦 RESPONSE BODY:', JSON.stringify(response.data, null, 2));

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('message', 'Order status updated successfully');
      expect(response.data.data).toHaveProperty('status', 'ORDER_PROCESSING');
      expect(response.data.data).toHaveProperty('id', testContext.orderId);
    });

    test('9. Super Admin Marks Order Ready', async () => {
      expect(testContext.orderId).toBeTruthy();

      const requestBody = {
        status: "READY_FOR_PICKUP",
        notes: "Order is ready for courier pickup - approved by super admin"
      };

      console.log('📤 REQUEST: PUT /orders/store/' + testContext.orderId + '/status');
      console.log('📦 BODY:', JSON.stringify(requestBody, null, 2));

      const response = await axios.put(`${API_BASE}/orders/store/${testContext.orderId}/status`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testData.superAdmin.token}`
        }
      });

      console.log('📥 RESPONSE: Status', response.status);
      console.log('📦 RESPONSE BODY:', JSON.stringify(response.data, null, 2));

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('message', 'Order status updated successfully');
      expect(response.data.data).toHaveProperty('status', 'READY_FOR_PICKUP');
      expect(response.data.data).toHaveProperty('readyForPickupAt');
      expect(typeof response.data.data.readyForPickupAt).toBe('string');
    });
  });

  describe('Delivery Management', () => {
    test('10. Get Delivery Estimate', async () => {
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

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.message).toBe('Delivery estimate calculated successfully');
      expect(response.data.data).toHaveProperty('deliveryFee');
      expect(response.data.data).toHaveProperty('estimatedDuration');
      expect(response.data.data).toHaveProperty('totalCost');
      expect(response.data.data.deliveryFee).toBeGreaterThan(0);
    });

    test('11. Super Admin Gets Pending Deliveries', async () => {
      console.log('📤 REQUEST: GET /delivery/pending (Super Admin)');

      const response = await axios.get(`${API_BASE}/delivery/pending`, {
        headers: {
          'Authorization': `Bearer ${testData.superAdmin.token}`
        }
      });

      console.log('📥 RESPONSE: Status', response.status);
      console.log('📦 RESPONSE BODY:', JSON.stringify(response.data, null, 2));

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('message', 'Pending deliveries retrieved successfully');
      expect(Array.isArray(response.data.data)).toBe(true);
    });

    test('12. Super Admin Accepts Delivery', async () => {
      expect(testContext.deliveryId).toBeTruthy();

      console.log('📤 REQUEST: POST /delivery/' + testContext.deliveryId + '/accept (Super Admin)');
      console.log('📦 BODY: {} (empty body)');

      const response = await axios.post(`${API_BASE}/delivery/${testContext.deliveryId}/accept`, {}, {
        headers: {
          'Authorization': `Bearer ${testData.superAdmin.token}`
        }
      });

      console.log('📥 RESPONSE: Status', response.status);
      console.log('📦 RESPONSE BODY:', JSON.stringify(response.data, null, 2));

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('message', 'Delivery accepted successfully');
      expect(response.data.data).toHaveProperty('status', 'ASSIGNED');
      expect(response.data.data).toHaveProperty('id', testContext.deliveryId);
      expect(response.data.data).toHaveProperty('dispatchRiderId');
      expect(response.data.data).toHaveProperty('assignedAt');

      // Validate data types
      expect(typeof response.data.data.assignedAt).toBe('string');
      expect(typeof response.data.data.dispatchRiderId).toBe('string');
    });

    test('13. Super Admin Updates Delivery Status', async () => {
      expect(testContext.deliveryId).toBeTruthy();

      const requestBody = {
        status: "PICKUP_IN_PROGRESS",
        notes: "Heading to pickup location - managed by super admin"
      };

      console.log('📤 REQUEST: PUT /delivery/' + testContext.deliveryId + '/status');
      console.log('📦 BODY:', JSON.stringify(requestBody, null, 2));

      const response = await axios.put(`${API_BASE}/delivery/${testContext.deliveryId}/status`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testData.superAdmin.token}`
        }
      });

      console.log('📥 RESPONSE: Status', response.status);
      console.log('📦 RESPONSE BODY:', JSON.stringify(response.data, null, 2));

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('message', 'Delivery status updated successfully');
      expect(response.data.data).toHaveProperty('status', 'PICKUP_IN_PROGRESS');
      expect(response.data.data).toHaveProperty('id', testContext.deliveryId);

      // Validate status-specific fields
      if (requestBody.status === 'PICKUP_IN_PROGRESS') {
        expect(response.data.data).toHaveProperty('pickupStartedAt');
        expect(typeof response.data.data.pickupStartedAt).toBe('string');
      }
    });

    test('14. Track Delivery (Customer)', async () => {
      expect(testContext.trackingCode).toBeTruthy();

      const response = await axios.get(`${API_BASE}/delivery/track/${testContext.trackingCode}`);

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.message).toBe('Delivery tracking retrieved successfully');
      expect(response.data.data).toHaveProperty('status');
      expect(response.data.data).toHaveProperty('trackingCode');
      expect(response.data.data.trackingCode).toBe(testContext.trackingCode);
    });

    test('15. Super Admin Gets Active Delivery', async () => {
      console.log('📤 REQUEST: GET /delivery/active (Super Admin)');

      const response = await axios.get(`${API_BASE}/delivery/active`, {
        headers: {
          'Authorization': `Bearer ${testData.superAdmin.token}`
        }
      });

      console.log('📥 RESPONSE: Status', response.status);
      console.log('📦 RESPONSE BODY:', JSON.stringify(response.data, null, 2));

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('message', 'Active delivery retrieved successfully');
      expect(response.data.data).toBeDefined();
    });

    test('16. Super Admin Completes Delivery', async () => {
      expect(testContext.deliveryId).toBeTruthy();

      const requestBody = {
        status: "DELIVERED",
        notes: "Order delivered successfully by super admin",
        location: {
          latitude: 40.7128,
          longitude: -74.0060
        }
      };

      console.log('📤 REQUEST: PUT /delivery/' + testContext.deliveryId + '/status');
      console.log('📦 BODY:', JSON.stringify(requestBody, null, 2));

      const response = await axios.put(`${API_BASE}/delivery/${testContext.deliveryId}/status`, requestBody, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testData.superAdmin.token}`
        }
      });

      console.log('📥 RESPONSE: Status', response.status);
      console.log('📦 RESPONSE BODY:', JSON.stringify(response.data, null, 2));

      expect(response.status).toBe(200);
      expect(response.data).toHaveProperty('success', true);
      expect(response.data).toHaveProperty('message', 'Delivery status updated successfully');
      expect(response.data.data).toHaveProperty('status', 'DELIVERED');
      expect(response.data.data).toHaveProperty('id', testContext.deliveryId);

      // Validate delivery completion fields
      expect(response.data.data).toHaveProperty('deliveredAt');
      expect(response.data.data).toHaveProperty('deliveryNotes', requestBody.notes);

      // Validate data types
      expect(typeof response.data.data.deliveredAt).toBe('string');
      expect(typeof response.data.data.deliveryNotes).toBe('string');

      // Validate location data if provided
      if (requestBody.location) {
        expect(response.data.data).toHaveProperty('deliveryLocation');
        // Note: The actual location validation would depend on your API response structure
      }
    });

    test('17. Confirm Purchase (Customer)', async () => {
      const response = await axios.post(`${API_BASE}/delivery/confirm-purchase`, {
        confirmationToken: 'confirmation_token_here'
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${testData.customer.token}`
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.message).toBe('Purchase confirmed successfully');
    });

    test('18. Get Customer Orders', async () => {
      const response = await axios.get(`${API_BASE}/orders/customer?page=1&limit=10&status=DELIVERED`, {
        headers: {
          'Authorization': `Bearer ${testData.customer.token}`
        }
      });

      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      expect(response.data.message).toBe('Customer orders retrieved successfully');
      expect(Array.isArray(response.data.data)).toBe(true);
    });
  });

  afterAll(async () => {
    // Clean up test data if needed
    console.log('Test suite completed successfully! 🎉');
  });
});