# Courier Component with Real-Time Location Sharing

This React Native component provides comprehensive courier services with **real-time location sharing** with emergency contacts during deliveries, fully integrated with your backend delivery system.

## 🚚 Key Features

### **Real-Time Location Sharing with Emergency Contacts**
- **Live location sharing**: Share your current location with emergency contacts during courier deliveries
- **Email notifications**: Send last known location via email to all emergency contacts
- **Safety monitoring**: Emergency contacts can track your location in real-time during package deliveries
- **Automatic sharing**: Location updates sent every 2 minutes when sharing is active

### **Complete Courier Service Flow**
- **Send Package**: Full booking flow for authenticated users sending packages
- **Receive Package**: Full booking flow for authenticated users receiving packages
- **Track Package**: **PUBLIC TRACKING** - Anyone with tracking number can view package location
- **Real-time Map Integration**: Interactive maps with route visualization
- **Live Courier Tracking**: Track courier location and route in real-time
- **WebSocket Integration**: Real-time updates for booking status and courier location

### **Professional Package Management**
- **Multi-item packages**: Add multiple items with descriptions and values
- **Delivery options**: Standard, Express, and Same-Day delivery
- **Price estimation**: Real-time pricing based on distance and delivery type
- **Tracking system**: Complete package tracking with status updates

## 🔧 Backend Integration

### **Exact API Endpoints - MATCHING YOUR BACKEND**
```typescript
// MATCHES YOUR BACKEND ROUTES EXACTLY
POST /api/delivery/user-to-user     // Create user-to-user delivery
GET  /api/delivery/track/:trackingCode  // Track delivery status
POST /api/emergency/share-location     // Share location with contacts
POST /api/emergency/broadcast-location // Send to all emergency contacts
```

### **WebSocket Events - MATCHING YOUR BACKEND**
```typescript
// FROM YOUR WebSocketService
socket.on("courier_location_update", (data) => {
  // Live courier location updates
  // Update map with current position
  // Recalculate and display route
})

socket.on("booking_status_update", (data) => {
  // Real-time booking status updates
  // Status: "PENDING", "PICKED_UP", "IN_TRANSIT", "DELIVERED"
})
```

### **Request/Response Structure - MATCHING YOUR VALIDATION**
```typescript
// MATCHES userToUserDeliverySchema EXACTLY
// Note: recipientId is NOT required since recipients don't need to be app users
const deliveryPayload = {
  items: [{
    name: "Package Item",
    description: "Item description",
    quantity: 1,
    value: 50.00
  }],
  pickupAddress: {
    latitude: 5.6037,
    longitude: -0.187,
    address: "123 Pickup St, Accra",
    instructions: "Ring doorbell"
  },
  deliveryAddress: {
    latitude: 5.6137,
    longitude: -0.197,
    address: "456 Delivery Ave, Accra",
    instructions: "Call upon arrival"
  },
  specialInstructions: "Handle with care",
  recipientName: "John Doe",  // Just name and phone - no user account required
  recipientPhone: "+233501234567"
}

// PUBLIC TRACKING - No authentication required
GET /api/delivery/track/TRP123456AB
// Returns: package location, courier location, status, route
```

## 📱 User Experience Flow

### **1. Service Selection**
```
📦 Send Package    📥 Receive Package    🔍 Track Package
- Send/Receive: Full booking flow for authenticated users
- Track Package: PUBLIC TRACKING - Anyone with tracking number can view
- No account required for tracking - completely public
```

### **2. Location Selection with Maps**
```
- Interactive Google Maps integration
- Search for pickup/delivery locations
- Real-time route visualization
- Current location detection
```

### **3. Package Details**
```
- Recipient information (name, phone)
- Multiple package items with descriptions
- Item values and quantities
- Special handling instructions
```

### **4. Delivery Options**
```
- Standard: 2-4 hours (Free)
- Express: 1-2 hours (+GHS 10)
- Same-Day: 30-60 min (+GHS 20)
- Real-time price calculation
```

### **5. Safety Features - Emergency Contact Integration**
```
- Share current location with emergency contacts
- Real-time location sharing during delivery
- Email notifications for last known location
- Safety monitoring throughout delivery process
```

### **6. Live Courier Tracking**
```
- Real-time courier location on map
- Route visualization from courier to destination
- Live status updates (Picked Up, In Transit, Delivered)
- WebSocket-powered updates
```

### **7. Public Package Tracking**
```
🔓 PUBLIC TRACKING - No Account Required
- Anyone with tracking number can view package location
- Real-time courier location and route updates
- Live status progression (Pending → Picked Up → In Transit → Delivered)
- No authentication required for viewing
- Perfect for recipients who aren't app users
```

## 🎯 Emergency Contact Location Sharing

### **Real-Time Location Sharing**
1. **During Courier Booking**: Users can share their live location with emergency contacts
2. **Automatic Updates**: Location sent every 2 minutes when sharing is active
3. **Email Notifications**: Last known location sent via email to all contacts
4. **Safety Monitoring**: Emergency contacts can track user's location during deliveries

### **Location Sharing API Integration**
```typescript
// Share with specific contact
POST /api/emergency/share-location
{
  latitude: 5.6037,
  longitude: -0.187,
  timestamp: "2024-01-01T12:00:00Z",
  userId: "user123",
  contactId: "contact456",
  contactName: "John Doe",
  contactPhone: "+1234567890",
  context: "courier_ride",
  bookingId: "booking789",
  message: "Sharing location during courier delivery"
}

// Broadcast to all contacts
POST /api/emergency/broadcast-location
{
  latitude: 5.6037,
  longitude: -0.187,
  timestamp: "2024-01-01T12:00:00Z",
  userId: "user123",
  userName: "Jane Smith",
  context: "safety_check",
  message: "Last known location shared for safety"
}
```

## 🗺️ Map Integration Features

### **Interactive Maps**
- **Google Maps integration** with real-time location updates
- **Route visualization** for both user routes and courier routes
- **Multiple markers**: Pickup, delivery, and courier locations
- **Real-time updates** via WebSocket connections

### **Route Visualization**
```typescript
// User route (pickup to delivery)
<Polyline
  coordinates={routeCoordinates}
  strokeColor="#000"
  strokeWidth={3}
/>

// Courier route (courier to delivery)
<Polyline
  coordinates={courierRouteCoordinates}
  strokeColor="#3B82F6"
  strokeWidth={3}
  lineDashPattern={[10, 10]}
/>
```

## 🔄 Real-Time Features

### **WebSocket Integration**
1. **Connection**: Establishes WebSocket connection with JWT authentication
2. **Room Joining**: Joins booking-specific rooms for targeted updates
3. **Live Updates**: Receives real-time courier location and status updates
4. **Automatic Reconnection**: Handles connection drops gracefully

### **Live Tracking Events**
```typescript
// Courier location updates
socket.on("courier_location_update", (data) => {
  setCourierLocation({
    latitude: data.latitude,
    longitude: data.longitude
  })
  // Update route visualization
  fetchCourierRoute(data.latitude, data.longitude, deliveryLat, deliveryLon)
})

// Booking status updates
socket.on("booking_status_update", (data) => {
  setCurrentBooking(prev => ({
    ...prev,
    status: data.status
  }))
  // Handle status-specific UI updates
})
```

## 📊 Data Flow

### **Courier Booking Process**
1. **Service Selection**: User chooses send/receive
2. **Location Input**: Pickup and delivery locations via maps
3. **Package Details**: Items, recipient info, special instructions
4. **Delivery Options**: Speed selection with pricing
5. **Safety Setup**: Emergency contact location sharing
6. **Booking Creation**: API call to `/api/delivery/user-to-user`
7. **Real-Time Tracking**: WebSocket updates for courier location and status

### **Location Sharing Process**
1. **Contact Selection**: Choose emergency contacts to share with
2. **Permission Check**: Verify location permissions
3. **Real-Time Sharing**: Send location updates every 2 minutes
4. **Email Notifications**: Send last location via email
5. **Safety Monitoring**: Continuous location tracking during delivery

## 🚀 Performance Optimizations

### **Efficient Updates**
- **Debounced API calls**: Prevents excessive location requests
- **Selective re-renders**: Only updates changed delivery data
- **WebSocket optimization**: Efficient real-time data handling
- **Map clustering**: Optimized for multiple location markers

### **Memory Management**
- **Cleanup on unmount**: Proper WebSocket disconnection
- **State optimization**: Efficient delivery state management
- **Route caching**: Optimized route calculations
- **Location sharing intervals**: Proper cleanup of sharing timers

## 🔧 Configuration

### **Environment Variables**
```env
EXPO_PUBLIC_BACKEND_API_URL=http://your-backend-url:3000
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
EXPO_PUBLIC_BACKEND_TOKEN=your-jwt-token
```

### **Emergency Contacts Configuration**
```typescript
const emergencyContacts: EmergencyContact[] = [
  {
    id: "1",
    name: "John Doe",
    phone: "+1234567890",
    relationship: "Emergency Contact"
  },
  {
    id: "2",
    name: "Jane Smith",
    phone: "+1234567891",
    relationship: "Family"
  }
]
```

## 🧪 Testing Features

### **Courier Service Testing**
- [ ] Test send/receive package selection
- [ ] Verify map location selection and route calculation
- [ ] Test package details form with multiple items
- [ ] Check delivery option pricing and selection
- [ ] Validate booking creation with backend API

### **Location Sharing Testing**
- [ ] Test emergency contact location sharing
- [ ] Verify real-time location updates (every 2 minutes)
- [ ] Check email notifications for location sharing
- [ ] Test location sharing during active deliveries

### **Real-Time Tracking Testing**
- [ ] Test WebSocket connection and authentication
- [ ] Verify live courier location updates on map
- [ ] Check booking status progression
- [ ] Test route visualization updates

## 🔄 Integration Points

### **Backend Services**
- **DeliveryController**: Handles delivery booking logic
- **WebSocketService**: Manages real-time communication
- **EmergencyService**: Processes location sharing requests
- **LocationService**: Provides geocoding and distance calculations

### **External Services**
- **Google Maps API**: Route calculation and map display
- **Expo Location**: GPS location services
- **WebSocket**: Real-time communication
- **Email Service**: Location sharing notifications

## 🔐 Security & Privacy

### **Location Data Protection**
- **Encrypted transmission**: Location data encrypted in transit
- **User consent**: Explicit permission for location sharing
- **Contact verification**: Emergency contacts verified before sharing
- **Temporary sharing**: Location sharing can be stopped anytime

### **Data Handling**
- **Minimal data collection**: Only necessary location data collected
- **Purpose limitation**: Location data used only for safety during deliveries
- **Data retention**: Location data retained only during active sharing
- **User control**: Users can stop sharing at any time

## 🚀 Future Enhancements

- [ ] Add courier profiles and ratings
- [ ] Implement delivery history and analytics
- [ ] Add voice instructions for package handling
- [ ] Integrate with courier partner APIs
- [ ] Add delivery time slot selection
- [ ] Implement package insurance options
- [ ] Add multi-stop delivery routing
- [ ] Integrate with wearable safety devices

This courier component provides a comprehensive, professional delivery service with real-time location sharing for safety, fully integrated with your backend delivery and emergency systems.