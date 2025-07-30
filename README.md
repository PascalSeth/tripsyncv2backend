# TripSync Backend

Complete backend API for TripSync - A comprehensive transportation and delivery platform with Firebase phone authentication and role-based access control.

## 🚀 Features

- **Firebase Phone Authentication** - Secure phone-based authentication with OTP
- **Role-Based Access Control (RBAC)** - Comprehensive permission system
- **Complete Service Flows** - All transportation and delivery services
- **Real-time Features** - Socket.IO for live tracking and notifications
- **Payment Integration** - Paystack for payments and commission management
- **File Storage** - Supabase for images and documents
- **Email Notifications** - Automated email system for important updates
- **Automated Tasks** - Cron jobs for commission billing and maintenance

## 🏗️ Architecture

- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Firebase Admin SDK (Phone Auth)
- **Real-time**: Socket.IO
- **Storage**: Supabase
- **Payments**: Paystack
- **Email**: Nodemailer (SMTP)

## 📋 Prerequisites

- Node.js 18+
- PostgreSQL 13+
- Firebase project with Phone Authentication enabled
- Supabase project
- Paystack account
- SMTP email service (Gmail, SendGrid, etc.)

## 🛠️ Installation

1. **Clone the repository**
   \`\`\`bash
   git clone <repository-url>
   cd tripsync-backend
   \`\`\`

2. **Install dependencies**
   \`\`\`bash
   npm install
   \`\`\`

3. **Set up environment variables**
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your configuration
   \`\`\`

4. **Set up the database**
   \`\`\`bash
   npx prisma generate
   npx prisma db push
   npx prisma db seed
   \`\`\`

5. **Start the development server**
   \`\`\`bash
   npm run dev
   \`\`\`

## 🔧 Configuration

### Firebase Setup

1. Create a Firebase project at https://console.firebase.google.com
2. Enable Authentication with Phone provider
3. Go to Project Settings > Service Accounts
4. Generate a new private key (JSON file)
5. Extract the values and add to `.env`:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_PRIVATE_KEY_ID`
   - `FIREBASE_PRIVATE_KEY`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_CLIENT_ID`
   - `FIREBASE_CLIENT_CERT_URL`

### Database Setup

1. Create a PostgreSQL database
2. Update `DATABASE_URL` in `.env`
3. Run migrations: `npx prisma db push`
4. Seed the database: `npx prisma db seed`

### Supabase Setup

1. Create a Supabase project at https://supabase.com
2. Create storage buckets for:
   - `avatars`
   - `documents`
   - `vehicle-photos`
   - `place-photos`
3. Add Supabase configuration to `.env`

### Email Setup

Configure SMTP settings in `.env`:
- For Gmail: Use App Password (not regular password)
- For SendGrid: Use API key as password
- For other providers: Use their SMTP settings

## 🎯 API Endpoints

### Authentication (Firebase Phone Auth)
- `POST /api/auth/register` - Register with Firebase token
- `POST /api/auth/login` - Login with Firebase token
- `POST /api/auth/verify-phone` - Verify phone (handled by Firebase)
- `POST /api/auth/complete-profile` - Complete user profile
- `POST /api/auth/check-phone` - Check phone availability
- `POST /api/auth/get-profile` - Get user profile

### Bookings
- `POST /api/bookings` - Create booking
- `GET /api/bookings` - Get user bookings
- `GET /api/bookings/:id` - Get booking details
- `PUT /api/bookings/:id/accept` - Accept booking (driver)
- `PUT /api/bookings/:id/complete` - Complete booking

### Services
- `GET /api/services/types` - Get service types
- `GET /api/services/drivers/nearby` - Find nearby drivers
- `POST /api/bookings/estimate` - Get service estimate

### Admin (Role-based access)
- `GET /api/admin/users` - Manage users (Admin only)
- `GET /api/admin/bookings` - View all bookings (Admin only)
- `GET /api/admin/analytics` - System analytics (Admin only)

## 🔐 Role-Based Access Control

### Roles
- `SUPER_ADMIN` - Full system access
- `CITY_ADMIN` - City-level management
- `EMERGENCY_ADMIN` - Emergency services management
- `PLACE_OWNER` - Place management
- `STORE_OWNER` - Store management
- `DRIVER` - Driver services
- `USER` - Regular customer
- `EMERGENCY_RESPONDER` - Emergency response
- `DISPATCHER` - Service dispatch
- `SUPPORT_AGENT` - Customer support

### Authentication Flow

1. **Client Side (Frontend)**:
   - User enters phone number
   - Firebase sends OTP via SMS
   - User enters OTP code
   - Firebase returns ID token

2. **Server Side (Backend)**:
   - Verify Firebase ID token
   - Extract phone number from token
   - Create/login user in database
   - Set custom claims in Firebase
   - Return user data with permissions

## 🚗 Service Types

1. **RIDE** - Point-to-point transportation
2. **TAXI** - Licensed taxi service
3. **DAY_BOOKING** - Extended driver hire
4. **SHARED_RIDE** - Cost-effective ride sharing
5. **STORE_DELIVERY** - Product delivery from stores
6. **FOOD_DELIVERY** - Restaurant food delivery
7. **PACKAGE_DELIVERY** - Document and package delivery
8. **HOUSE_MOVING** - Comprehensive moving services
9. **EMERGENCY** - Emergency response service

## 💳 Payment & Commission System

- **Paystack Integration** for card payments
- **Mobile Money Payouts** for commission payments
- **Monthly Commission Bills** automatically generated
- **18% commission rate** for most services
- **Automated payout processing**

## 📱 Real-time Features

- **Live location tracking** for drivers
- **Real-time booking updates**
- **Emergency alerts**
- **Chat messaging** between users and drivers
- **Push notifications**

## 📧 Email System

Automated emails for:
- Welcome messages
- Password reset
- Commission payment reminders
- Critical notifications
- System alerts

## 🔄 Automated Tasks

- **Monthly commission bill generation**
- **Payment reminders via email**
- **Payout processing**
- **Session cleanup**
- **Rating updates**
- **RBAC cache management**

## 🧪 Testing

\`\`\`bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage
\`\`\`

## 📦 Deployment

### Using Docker

\`\`\`bash
# Build and run with Docker Compose
docker-compose up -d
\`\`\`

### Manual Deployment

1. Build the application:
   \`\`\`bash
   npm run build
   \`\`\`

2. Start the production server:
   \`\`\`bash
   npm start
   \`\`\`

## 📊 Monitoring

- **Winston logging** with multiple transports
- **Health check endpoint** at `/health`
- **Error tracking** with detailed stack traces
- **Performance monitoring**

## 🔒 Security Features

- **Firebase Authentication** with phone verification
- **Role-based access control** with permissions
- **Rate limiting** to prevent abuse
- **Input validation** with Joi schemas
- **CORS protection**
- **Helmet security headers**
- **Token expiration** and refresh handling

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support, email support@tripsync.com or create an issue in the repository.

---

## Firebase Phone Authentication Setup

### Frontend Integration Example

\`\`\`javascript
// Initialize Firebase
import { initializeApp } from 'firebase/app';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';

const firebaseConfig = {
  // Your config
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

// Send OTP
const sendOTP = async (phoneNumber) => {
  const recaptcha = new RecaptchaVerifier('recaptcha-container', {}, auth);
  const confirmation = await signInWithPhoneNumber(auth, phoneNumber, recaptcha);
  return confirmation;
};

// Verify OTP
const verifyOTP = async (confirmation, otp) => {
  const result = await confirmation.confirm(otp);
  const idToken = await result.user.getIdToken();
  
  // Send to backend
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ firebaseToken: idToken })
  });
  
  return response.json();
};
\`\`\`

This completes the TripSync backend with Firebase phone authentication, removing all Twilio dependencies since Firebase handles OTP verification natively.

# Comprehensive API Guide

This guide covers all available routes in the backend API with detailed scenarios and examples for each endpoint.

## Table of Contents

1. [Authentication Routes](#authentication-routes)
2. [Admin Routes](#admin-routes)
3. [Booking Routes](#booking-routes)
4. [Driver Routes](#driver-routes)
5. [Emergency Routes](#emergency-routes)
6. [Moving Routes](#moving-routes)
7. [Place Routes](#place-routes)
8. [Review Routes](#review-routes)
9. [Search Routes](#search-routes)
10. [Service Routes](#service-routes)
11. [Store Routes](#store-routes)
12. [Subscription Routes](#subscription-routes)

---

## Authentication Routes

Base URL: `/api/auth`

### 1. User Registration

**Endpoint:** `POST /api/auth/register`

**Scenario:** A new user wants to create an account using their phone number.

**Request:**
\`\`\`json
{
  "phoneNumber": "+1234567890",
  "countryCode": "+1",
  "userType": "CUSTOMER"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Verification code sent to your phone",
  "verificationId": "verification_id_123"
}
\`\`\`

### 2. Phone Verification

**Endpoint:** `POST /api/auth/verify-phone`

**Scenario:** User enters the OTP received on their phone to verify their number.

**Request:**
\`\`\`json
{
  "verificationId": "verification_id_123",
  "verificationCode": "123456"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Phone verified successfully",
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "phoneNumber": "+1234567890",
    "isVerified": true
  }
}
\`\`\`

### 3. User Login

**Endpoint:** `POST /api/auth/login`

**Scenario:** Existing user wants to log in with their phone number.

**Request:**
\`\`\`json
{
  "phoneNumber": "+1234567890",
  "password": "optional_password"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "token": "jwt_token_here",
  "refreshToken": "refresh_token_here",
  "user": {
    "id": "user_id",
    "phoneNumber": "+1234567890",
    "name": "John Doe",
    "userType": "CUSTOMER"
  }
}
\`\`\`

### 4. Refresh Token

**Endpoint:** `POST /api/auth/refresh-token`

**Scenario:** User's access token has expired and needs to be refreshed.

**Request:**
\`\`\`json
{
  "refreshToken": "refresh_token_here"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "token": "new_jwt_token_here",
  "refreshToken": "new_refresh_token_here"
}
\`\`\`

### 5. Logout

**Endpoint:** `POST /api/auth/logout`

**Scenario:** User wants to log out and invalidate their session.

**Headers:**
\`\`\`
Authorization: Bearer jwt_token_here
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Logged out successfully"
}
\`\`\`

### 6. Complete Profile

**Endpoint:** `POST /api/auth/complete-profile`

**Scenario:** User wants to complete their profile after registration.

**Request:**
\`\`\`json
{
  "name": "John Doe",
  "email": "john@example.com",
  "dateOfBirth": "1990-01-01",
  "gender": "MALE",
  "address": {
    "street": "123 Main St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001"
  }
}
\`\`\`

### 7. Get Profile

**Endpoint:** `POST /api/auth/get-profile`

**Scenario:** User wants to retrieve their profile information.

**Headers:**
\`\`\`
Authorization: Bearer jwt_token_here
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@example.com",
    "phoneNumber": "+1234567890",
    "profileComplete": true
  }
}
\`\`\`

### 8. Check Phone Availability

**Endpoint:** `POST /api/auth/check-phone`

**Scenario:** Check if a phone number is already registered.

**Request:**
\`\`\`json
{
  "phoneNumber": "+1234567890"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "available": false,
  "message": "Phone number is already registered"
}
\`\`\`

### 9. Social Authentication (Google)

**Endpoint:** `POST /api/auth/google`

**Scenario:** User wants to sign in with Google.

**Request:**
\`\`\`json
{
  "idToken": "google_id_token_here",
  "userType": "CUSTOMER"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "token": "jwt_token_here",
  "user": {
    "id": "user_id",
    "name": "John Doe",
    "email": "john@gmail.com"
  }
}
\`\`\`

---

## Admin Routes

Base URL: `/api/admin`

**Note:** All admin routes require authentication and admin role (SUPER_ADMIN or CITY_ADMIN).

### 1. Get Admin Dashboard

**Endpoint:** `GET /api/admin/dashboard`

**Scenario:** Admin wants to view dashboard statistics.

**Headers:**
\`\`\`
Authorization: Bearer admin_jwt_token
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "data": {
    "totalUsers": 1500,
    "totalDrivers": 250,
    "totalBookings": 5000,
    "pendingVerifications": 15,
    "revenue": {
      "today": 2500.00,
      "thisMonth": 75000.00
    }
  }
}
\`\`\`

### 2. Approve Driver

**Endpoint:** `PUT /api/admin/drivers/:driverId/approve`

**Scenario:** Admin approves a driver's application.

**Headers:**
\`\`\`
Authorization: Bearer admin_jwt_token
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Driver approved successfully",
  "driver": {
    "id": "driver_id",
    "status": "APPROVED",
    "approvedAt": "2024-01-15T10:30:00Z"
  }
}
\`\`\`

### 3. Suspend User

**Endpoint:** `PUT /api/admin/users/:userId/suspend`

**Scenario:** Admin suspends a user for policy violation.

**Request:**
\`\`\`json
{
  "reason": "Violation of community guidelines"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "User suspended successfully"
}
\`\`\`

### 4. Get System Metrics

**Endpoint:** `GET /api/admin/metrics`

**Scenario:** Admin wants to view detailed system metrics.

**Response:**
\`\`\`json
{
  "success": true,
  "metrics": {
    "activeUsers": 850,
    "activeDrivers": 120,
    "completedTrips": 4500,
    "averageRating": 4.7,
    "systemHealth": "GOOD"
  }
}
\`\`\`

### 5. Get Pending Verifications

**Endpoint:** `GET /api/admin/verifications/pending`

**Scenario:** Admin wants to see all pending document verifications.

**Response:**
\`\`\`json
{
  "success": true,
  "verifications": [
    {
      "id": "verification_id",
      "userId": "user_id",
      "documentType": "DRIVER_LICENSE",
      "submittedAt": "2024-01-15T09:00:00Z",
      "status": "PENDING"
    }
  ]
}
\`\`\`

### 6. Review Document

**Endpoint:** `PUT /api/admin/documents/:documentId/review`

**Scenario:** Admin reviews and approves/rejects a submitted document.

**Request:**
\`\`\`json
{
  "decision": "APPROVED",
  "rejectionReason": null
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Document reviewed successfully"
}
\`\`\`

---

## Booking Routes

Base URL: `/api/bookings`

### 1. Create General Booking

**Endpoint:** `POST /api/bookings`

**Scenario:** User creates a general booking request.

**Headers:**
\`\`\`
Authorization: Bearer jwt_token_here
\`\`\`

**Request:**
\`\`\`json
{
  "serviceType": "RIDE",
  "pickupLocation": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "address": "123 Main St, New York, NY"
  },
  "dropoffLocation": {
    "latitude": 40.7589,
    "longitude": -73.9851,
    "address": "456 Broadway, New York, NY"
  },
  "scheduledTime": "2024-01-15T14:30:00Z",
  "notes": "Please call when you arrive"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "booking": {
    "id": "booking_id_123",
    "status": "PENDING",
    "estimatedFare": 25.50,
    "estimatedDuration": 15,
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
\`\`\`

### 2. Get User Bookings

**Endpoint:** `GET /api/bookings`

**Scenario:** User wants to view their booking history.

**Query Parameters:**
- `status` (optional): Filter by booking status
- `page` (optional): Page number for pagination
- `limit` (optional): Number of results per page

**Example:** `GET /api/bookings?status=COMPLETED&page=1&limit=10`

**Response:**
\`\`\`json
{
  "success": true,
  "bookings": [
    {
      "id": "booking_id_123",
      "serviceType": "RIDE",
      "status": "COMPLETED",
      "fare": 25.50,
      "createdAt": "2024-01-15T10:00:00Z",
      "driver": {
        "name": "Mike Johnson",
        "rating": 4.8
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25
  }
}
\`\`\`

### 3. Get Booking by ID

**Endpoint:** `GET /api/bookings/:id`

**Scenario:** User wants to view details of a specific booking.

**Response:**
\`\`\`json
{
  "success": true,
  "booking": {
    "id": "booking_id_123",
    "serviceType": "RIDE",
    "status": "IN_PROGRESS",
    "pickupLocation": {
      "latitude": 40.7128,
      "longitude": -74.0060,
      "address": "123 Main St, New York, NY"
    },
    "dropoffLocation": {
      "latitude": 40.7589,
      "longitude": -73.9851,
      "address": "456 Broadway, New York, NY"
    },
    "driver": {
      "id": "driver_id",
      "name": "Mike Johnson",
      "phoneNumber": "+1234567890",
      "vehicle": {
        "make": "Toyota",
        "model": "Camry",
        "licensePlate": "ABC123"
      }
    },
    "fare": 25.50,
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
\`\`\`

### 4. Create Ride Booking

**Endpoint:** `POST /api/bookings/ride`

**Scenario:** User books a standard ride.

**Request:**
\`\`\`json
{
  "pickupLocation": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "address": "123 Main St, New York, NY"
  },
  "dropoffLocation": {
    "latitude": 40.7589,
    "longitude": -73.9851,
    "address": "456 Broadway, New York, NY"
  },
  "vehicleType": "SEDAN",
  "passengers": 2,
  "scheduledTime": null,
  "paymentMethod": "CARD"
}
\`\`\`

### 5. Create Day Booking

**Endpoint:** `POST /api/bookings/day-booking`

**Scenario:** User books a driver for the entire day.

**Request:**
\`\`\`json
{
  "date": "2024-01-20",
  "startTime": "09:00",
  "endTime": "17:00",
  "pickupLocation": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "address": "123 Main St, New York, NY"
  },
  "vehicleType": "SUV",
  "purpose": "Business meetings",
  "estimatedDistance": 100
}
\`\`\`

### 6. Create Store Delivery

**Endpoint:** `POST /api/bookings/store-delivery`

**Scenario:** User orders items from a store for delivery.

**Request:**
\`\`\`json
{
  "storeId": "store_id_123",
  "items": [
    {
      "productId": "product_id_1",
      "quantity": 2,
      "price": 15.99
    },
    {
      "productId": "product_id_2",
      "quantity": 1,
      "price": 8.50
    }
  ],
  "deliveryAddress": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "address": "123 Main St, Apt 4B, New York, NY"
  },
  "deliveryInstructions": "Leave at door",
  "paymentMethod": "CARD"
}
\`\`\`

### 7. Create House Moving

**Endpoint:** `POST /api/bookings/house-moving`

**Scenario:** User books a house moving service.

**Request:**
\`\`\`json
{
  "fromAddress": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "address": "123 Old St, New York, NY"
  },
  "toAddress": {
    "latitude": 40.7589,
    "longitude": -73.9851,
    "address": "456 New Ave, New York, NY"
  },
  "movingDate": "2024-01-25",
  "homeSize": "2_BEDROOM",
  "specialItems": ["Piano", "Antique furniture"],
  "packingRequired": true,
  "estimatedWeight": 5000
}
\`\`\`

### 8. Create Shared Ride

**Endpoint:** `POST /api/bookings/shared-ride`

**Scenario:** User books a shared ride to save costs.

**Request:**
\`\`\`json
{
  "pickupLocation": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "address": "123 Main St, New York, NY"
  },
  "dropoffLocation": {
    "latitude": 40.7589,
    "longitude": -73.9851,
    "address": "456 Broadway, New York, NY"
  },
  "passengers": 1,
  "maxWaitTime": 10,
  "maxDetourTime": 5
}
\`\`\`

### 9. Create Taxi Booking

**Endpoint:** `POST /api/bookings/taxi`

**Scenario:** User books a traditional taxi service.

**Request:**
\`\`\`json
{
  "pickupLocation": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "address": "123 Main St, New York, NY"
  },
  "dropoffLocation": {
    "latitude": 40.7589,
    "longitude": -73.9851,
    "address": "456 Broadway, New York, NY"
  },
  "taxiType": "STANDARD",
  "passengers": 3
}
\`\`\`

### 10. Create Package Delivery

**Endpoint:** `POST /api/bookings/package-delivery`

**Scenario:** User sends a package to someone.

**Request:**
\`\`\`json
{
  "pickupLocation": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "address": "123 Main St, New York, NY"
  },
  "deliveryLocation": {
    "latitude": 40.7589,
    "longitude": -73.9851,
    "address": "456 Broadway, New York, NY"
  },
  "packageDetails": {
    "weight": 2.5,
    "dimensions": "30x20x10 cm",
    "fragile": false,
    "description": "Documents"
  },
  "recipientName": "Jane Smith",
  "recipientPhone": "+1987654321",
  "deliveryInstructions": "Ring doorbell"
}
\`\`\`

### 11. Create Food Delivery

**Endpoint:** `POST /api/bookings/food-delivery`

**Scenario:** User orders food from a restaurant.

**Request:**
\`\`\`json
{
  "restaurantId": "restaurant_id_123",
  "items": [
    {
      "menuItemId": "item_id_1",
      "quantity": 2,
      "price": 12.99,
      "customizations": ["Extra cheese", "No onions"]
    }
  ],
  "deliveryAddress": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "address": "123 Main St, Apt 4B, New York, NY"
  },
  "deliveryInstructions": "Call when arrived",
  "paymentMethod": "CARD"
}
\`\`\`

### 12. Get Booking Estimate

**Endpoint:** `POST /api/bookings/estimate`

**Scenario:** User wants to get fare estimate before booking.

**Request:**
\`\`\`json
{
  "serviceType": "RIDE",
  "pickupLocation": {
    "latitude": 40.7128,
    "longitude": -74.0060
  },
  "dropoffLocation": {
    "latitude": 40.7589,
    "longitude": -73.9851
  },
  "vehicleType": "SEDAN"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "estimate": {
    "baseFare": 5.00,
    "distanceFare": 15.50,
    "timeFare": 5.00,
    "totalFare": 25.50,
    "estimatedDuration": 15,
    "estimatedDistance": 5.2,
    "surgeMultiplier": 1.0
  }
}
\`\`\`

### 13. Accept Booking (Driver)

**Endpoint:** `PUT /api/bookings/:id/accept`

**Scenario:** Driver accepts a booking request.

**Headers:**
\`\`\`
Authorization: Bearer driver_jwt_token
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Booking accepted successfully",
  "booking": {
    "id": "booking_id_123",
    "status": "ACCEPTED",
    "driver": {
      "id": "driver_id",
      "name": "Mike Johnson"
    }
  }
}
\`\`\`

### 14. Start Booking (Driver)

**Endpoint:** `PUT /api/bookings/:id/start`

**Scenario:** Driver starts the trip/service.

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Booking started successfully",
  "booking": {
    "id": "booking_id_123",
    "status": "IN_PROGRESS",
    "startedAt": "2024-01-15T14:30:00Z"
  }
}
\`\`\`

### 15. Complete Booking (Driver)

**Endpoint:** `PUT /api/bookings/:id/complete`

**Scenario:** Driver completes the service.

**Request:**
\`\`\`json
{
  "finalFare": 27.50,
  "actualDistance": 5.5,
  "actualDuration": 18,
  "notes": "Traffic delay on highway"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Booking completed successfully",
  "booking": {
    "id": "booking_id_123",
    "status": "COMPLETED",
    "completedAt": "2024-01-15T15:00:00Z",
    "finalFare": 27.50
  }
}
\`\`\`

### 16. Cancel Booking

**Endpoint:** `PUT /api/bookings/:id/cancel`

**Scenario:** User or driver cancels the booking.

**Request:**
\`\`\`json
{
  "reason": "Change of plans",
  "cancelledBy": "CUSTOMER"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Booking cancelled successfully",
  "cancellationFee": 2.50
}
\`\`\`

### 17. Get Booking Tracking

**Endpoint:** `GET /api/bookings/:id/tracking`

**Scenario:** User wants to track their ongoing booking.

**Response:**
\`\`\`json
{
  "success": true,
  "tracking": {
    "bookingId": "booking_id_123",
    "status": "IN_PROGRESS",
    "driverLocation": {
      "latitude": 40.7200,
      "longitude": -74.0100
    },
    "estimatedArrival": "2024-01-15T15:05:00Z",
    "route": [
      {
        "latitude": 40.7200,
        "longitude": -74.0100
      },
      {
        "latitude": 40.7300,
        "longitude": -74.0050
      }
    ]
  }
}
\`\`\`

### 18. Update Booking Tracking (Driver)

**Endpoint:** `POST /api/bookings/:id/tracking`

**Scenario:** Driver updates their location during the trip.

**Request:**
\`\`\`json
{
  "latitude": 40.7250,
  "longitude": -74.0075,
  "heading": 45,
  "speed": 25
}
\`\`\`

---

## Driver Routes

Base URL: `/api/drivers`

### 1. Driver Onboarding

**Endpoint:** `POST /api/drivers/onboard`

**Scenario:** A user wants to become a driver and submits their application.

**Headers:**
\`\`\`
Authorization: Bearer jwt_token_here
\`\`\`

**Request:**
\`\`\`json
{
  "personalInfo": {
    "firstName": "John",
    "lastName": "Doe",
    "dateOfBirth": "1985-05-15",
    "address": {
      "street": "123 Driver St",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001"
    }
  },
  "drivingExperience": 8,
  "licenseNumber": "D123456789",
  "licenseExpiryDate": "2026-05-15",
  "backgroundCheckConsent": true,
  "serviceTypes": ["RIDE", "DELIVERY", "TAXI"]
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Driver application submitted successfully",
  "driverId": "driver_id_123",
  "status": "PENDING_VERIFICATION"
}
\`\`\`

### 2. Update Driver Profile

**Endpoint:** `PUT /api/drivers/profile`

**Scenario:** Driver wants to update their profile information.

**Request:**
\`\`\`json
{
  "firstName": "John",
  "lastName": "Smith",
  "phoneNumber": "+1234567890",
  "email": "john.smith@email.com",
  "address": {
    "street": "456 New Address St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10002"
  },
  "emergencyContact": {
    "name": "Jane Smith",
    "phoneNumber": "+1987654321",
    "relationship": "Spouse"
  }
}
\`\`\`

### 3. Get Driver Profile

**Endpoint:** `GET /api/drivers/profile`

**Scenario:** Driver wants to view their profile information.

**Response:**
\`\`\`json
{
  "success": true,
  "driver": {
    "id": "driver_id_123",
    "firstName": "John",
    "lastName": "Smith",
    "phoneNumber": "+1234567890",
    "email": "john.smith@email.com",
    "status": "ACTIVE",
    "rating": 4.8,
    "totalTrips": 1250,
    "joinedDate": "2023-06-15T00:00:00Z",
    "serviceTypes": ["RIDE", "DELIVERY"],
    "isOnline": true
  }
}
\`\`\`

### 4. Add Vehicle

**Endpoint:** `POST /api/drivers/vehicle`

**Scenario:** Driver adds a new vehicle to their account.

**Request:**
\`\`\`json
{
  "make": "Toyota",
  "model": "Camry",
  "year": 2020,
  "color": "Silver",
  "licensePlate": "ABC123",
  "vin": "1HGBH41JXMN109186",
  "registrationNumber": "REG123456",
  "insurancePolicyNumber": "INS789012",
  "insuranceExpiryDate": "2024-12-31",
  "vehicleType": "SEDAN",
  "capacity": 4,
  "features": ["AC", "GPS", "Bluetooth"]
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Vehicle added successfully",
  "vehicle": {
    "id": "vehicle_id_123",
    "make": "Toyota",
    "model": "Camry",
    "licensePlate": "ABC123",
    "status": "PENDING_VERIFICATION"
  }
}
\`\`\`

### 5. Update Vehicle

**Endpoint:** `PUT /api/drivers/vehicle/:id`

**Scenario:** Driver updates vehicle information.

**Request:**
\`\`\`json
{
  "color": "Blue",
  "insurancePolicyNumber": "INS789013",
  "insuranceExpiryDate": "2025-12-31",
  "features": ["AC", "GPS", "Bluetooth", "USB Charging"]
}
\`\`\`

### 6. Get Driver Vehicles

**Endpoint:** `GET /api/drivers/vehicles`

**Scenario:** Driver wants to view all their registered vehicles.

**Response:**
\`\`\`json
{
  "success": true,
  "vehicles": [
    {
      "id": "vehicle_id_123",
      "make": "Toyota",
      "model": "Camry",
      "year": 2020,
      "color": "Blue",
      "licensePlate": "ABC123",
      "status": "VERIFIED",
      "isActive": true
    }
  ]
}
\`\`\`

### 7. Upload Document

**Endpoint:** `POST /api/drivers/documents`

**Scenario:** Driver uploads required documents for verification.

**Request (Form Data):**
\`\`\`
documentType: "DRIVER_LICENSE"
file: [binary file data]
expiryDate: "2026-05-15"
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Document uploaded successfully",
  "document": {
    "id": "doc_id_123",
    "type": "DRIVER_LICENSE",
    "status": "PENDING_REVIEW",
    "uploadedAt": "2024-01-15T10:00:00Z"
  }
}
\`\`\`

### 8. Get Driver Documents

**Endpoint:** `GET /api/drivers/documents`

**Scenario:** Driver wants to view all uploaded documents and their status.

**Response:**
\`\`\`json
{
  "success": true,
  "documents": [
    {
      "id": "doc_id_123",
      "type": "DRIVER_LICENSE",
      "status": "APPROVED",
      "uploadedAt": "2024-01-15T10:00:00Z",
      "reviewedAt": "2024-01-16T09:00:00Z"
    },
    {
      "id": "doc_id_124",
      "type": "VEHICLE_REGISTRATION",
      "status": "PENDING_REVIEW",
      "uploadedAt": "2024-01-15T11:00:00Z"
    }
  ]
}
\`\`\`

### 9. Update Availability

**Endpoint:** `PUT /api/drivers/availability`

**Scenario:** Driver goes online/offline or updates their availability status.

**Request:**
\`\`\`json
{
  "isOnline": true,
  "availableServices": ["RIDE", "DELIVERY"],
  "workingHours": {
    "start": "08:00",
    "end": "20:00"
  }
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Availability updated successfully",
  "isOnline": true,
  "availableServices": ["RIDE", "DELIVERY"]
}
\`\`\`

### 10. Update Location

**Endpoint:** `PUT /api/drivers/location`

**Scenario:** Driver updates their current location while online.

**Request:**
\`\`\`json
{
  "latitude": 40.7128,
  "longitude": -74.0060,
  "heading": 90,
  "speed": 0,
  "accuracy": 5
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Location updated successfully"
}
\`\`\`

### 11. Setup Day Booking

**Endpoint:** `POST /api/drivers/day-booking/setup`

**Scenario:** Driver sets up their profile for day booking services.

**Request:**
\`\`\`json
{
  "hourlyRate": 25.00,
  "minimumHours": 4,
  "maximumHours": 12,
  "availableDays": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"],
  "serviceAreas": ["Manhattan", "Brooklyn", "Queens"],
  "specialties": ["Business meetings", "Airport transfers", "City tours"],
  "languages": ["English", "Spanish"]
}
\`\`\`

### 12. Update Day Booking Availability

**Endpoint:** `PUT /api/drivers/day-booking/availability`

**Scenario:** Driver updates their availability for day bookings.

**Request:**
\`\`\`json
{
  "date": "2024-01-20",
  "available": true,
  "timeSlots": [
    {
      "startTime": "09:00",
      "endTime": "17:00",
      "rate": 25.00
    }
  ]
}
\`\`\`

### 13. Get Day Booking Schedule

**Endpoint:** `GET /api/drivers/day-booking/schedule`

**Scenario:** Driver wants to view their day booking schedule.

**Query Parameters:**
- `startDate`: Start date for schedule (YYYY-MM-DD)
- `endDate`: End date for schedule (YYYY-MM-DD)

**Example:** `GET /api/drivers/day-booking/schedule?startDate=2024-01-15&endDate=2024-01-21`

**Response:**
\`\`\`json
{
  "success": true,
  "schedule": [
    {
      "date": "2024-01-20",
      "available": true,
      "bookings": [
        {
          "id": "booking_id_123",
          "startTime": "09:00",
          "endTime": "17:00",
          "customer": "John Doe",
          "status": "CONFIRMED"
        }
      ]
    }
  ]
}
\`\`\`

### 14. Update Day Booking Pricing

**Endpoint:** `PUT /api/drivers/day-booking/pricing`

**Scenario:** Driver updates their day booking rates.

**Request:**
\`\`\`json
{
  "hourlyRate": 30.00,
  "minimumHours": 4,
  "weekendSurcharge": 1.2,
  "holidaySurcharge": 1.5,
  "overtimeRate": 35.00
}
\`\`\`

### 15. Get Driver Bookings

**Endpoint:** `GET /api/drivers/bookings`

**Scenario:** Driver wants to view their booking requests and history.

**Query Parameters:**
- `status`: Filter by booking status (PENDING, ACCEPTED, IN_PROGRESS, COMPLETED, CANCELLED)
- `date`: Filter by specific date
- `page`: Page number
- `limit`: Results per page

**Example:** `GET /api/drivers/bookings?status=PENDING&page=1&limit=10`

**Response:**
\`\`\`json
{
  "success": true,
  "bookings": [
    {
      "id": "booking_id_123",
      "serviceType": "RIDE",
      "status": "PENDING",
      "pickupLocation": {
        "address": "123 Main St, New York, NY",
        "latitude": 40.7128,
        "longitude": -74.0060
      },
      "dropoffLocation": {
        "address": "456 Broadway, New York, NY",
        "latitude": 40.7589,
        "longitude": -73.9851
      },
      "estimatedFare": 25.50,
      "estimatedDuration": 15,
      "customer": {
        "name": "Jane Smith",
        "rating": 4.9
      },
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 5
  }
}
\`\`\`

### 16. Accept Booking

**Endpoint:** `PUT /api/drivers/bookings/:id/accept`

**Scenario:** Driver accepts a booking request.

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Booking accepted successfully",
  "booking": {
    "id": "booking_id_123",
    "status": "ACCEPTED",
    "customer": {
      "name": "Jane Smith",
      "phoneNumber": "+1987654321"
    }
  }
}
\`\`\`

### 17. Reject Booking

**Endpoint:** `PUT /api/drivers/bookings/:id/reject`

**Scenario:** Driver rejects a booking request.

**Request:**
\`\`\`json
{
  "reason": "Too far from current location"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Booking rejected successfully"
}
\`\`\`

### 18. Arrive at Pickup

**Endpoint:** `PUT /api/drivers/bookings/:id/arrive`

**Scenario:** Driver arrives at the pickup location.

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Arrival confirmed",
  "booking": {
    "id": "booking_id_123",
    "status": "DRIVER_ARRIVED",
    "arrivedAt": "2024-01-15T14:25:00Z"
  }
}
\`\`\`

### 19. Start Trip

**Endpoint:** `PUT /api/drivers/bookings/:id/start`

**Scenario:** Driver starts the trip after customer gets in.

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Trip started successfully",
  "booking": {
    "id": "booking_id_123",
    "status": "IN_PROGRESS",
    "startedAt": "2024-01-15T14:30:00Z"
  }
}
\`\`\`

### 20. Complete Trip

**Endpoint:** `PUT /api/drivers/bookings/:id/complete`

**Scenario:** Driver completes the trip.

**Request:**
\`\`\`json
{
  "endLocation": {
    "latitude": 40.7589,
    "longitude": -73.9851
  },
  "actualDistance": 5.5,
  "actualDuration": 18,
  "tollCharges": 2.50,
  "waitingTime": 3,
  "notes": "Customer requested stop at ATM"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Trip completed successfully",
  "booking": {
    "id": "booking_id_123",
    "status": "COMPLETED",
    "completedAt": "2024-01-15T15:00:00Z",
    "finalFare": 28.00,
    "earnings": 22.40
  }
}
\`\`\`

### 21. Get Driver Earnings

**Endpoint:** `GET /api/drivers/earnings`

**Scenario:** Driver wants to view their earnings report.

**Query Parameters:**
- `period`: Time period (daily, weekly, monthly, yearly)
- `startDate`: Start date for custom period
- `endDate`: End date for custom period

**Example:** `GET /api/drivers/earnings?period=weekly`

**Response:**
\`\`\`json
{
  "success": true,
  "earnings": {
    "period": "weekly",
    "totalEarnings": 850.00,
    "totalTrips": 45,
    "averagePerTrip": 18.89,
    "breakdown": {
      "rideFare": 750.00,
      "tips": 75.00,
      "bonuses": 25.00
    },
    "deductions": {
      "commission": 127.50,
      "fees": 12.50
    },
    "netEarnings": 710.00,
    "dailyBreakdown": [
      {
        "date": "2024-01-15",
        "earnings": 120.00,
        "trips": 8
      }
    ]
  }
}
\`\`\`

### 22. Get Driver Analytics

**Endpoint:** `GET /api/drivers/analytics`

**Scenario:** Driver wants to view their performance analytics.

**Response:**
\`\`\`json
{
  "success": true,
  "analytics": {
    "rating": {
      "current": 4.8,
      "trend": "+0.1"
    },
    "acceptance": {
      "rate": 85,
      "trend": "+5%"
    },
    "cancellation": {
      "rate": 3,
      "trend": "-1%"
    },
    "onlineHours": {
      "thisWeek": 45,
      "lastWeek": 42
    },
    "popularTimes": [
      {
        "hour": 8,
        "demand": "HIGH"
      },
      {
        "hour": 17,
        "demand": "HIGH"
      }
    ],
    "topAreas": [
      {
        "area": "Manhattan",
        "trips": 25,
        "earnings": 450.00
      }
    ]
  }
}
\`\`\`

---

## Emergency Routes

Base URL: `/api/emergency`

### 1. Create Emergency Booking

**Endpoint:** `POST /api/emergency/bookings`

**Scenario:** User needs emergency assistance and creates an urgent booking.

**Headers:**
\`\`\`
Authorization: Bearer jwt_token_here
\`\`\`

**Request:**
\`\`\`json
{
  "emergencyType": "MEDICAL",
  "severity": "HIGH",
  "location": {
    "latitude": 40.7128,
    "longitude": -74.0060,
    "address": "123 Emergency St, New York, NY"
  },
  "description": "Person unconscious, needs immediate medical attention",
  "contactNumber": "+1234567890",
  "patientInfo": {
    "age": 45,
    "gender": "MALE",
    "medicalConditions": ["Diabetes", "Hypertension"]
  }
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "emergency": {
    "id": "emergency_id_123",
    "emergencyType": "MEDICAL",
    "severity": "HIGH",
    "status": "DISPATCHED",
    "estimatedArrival": "2024-01-15T14:35:00Z",
    "responder": {
      "id": "responder_id_456",
      "name": "Dr. Sarah Johnson",
      "phoneNumber": "+1555123456",
      "vehicleInfo": "Ambulance - AMB001"
    }
  }
}
\`\`\`

### 2. Get Emergency Bookings

**Endpoint:** `GET /api/emergency/bookings`

**Scenario:** User wants to view their emergency booking history.

**Response:**
\`\`\`json
{
  "success": true,
  "emergencies": [
    {
      "id": "emergency_id_123",
      "emergencyType": "MEDICAL",
      "severity": "HIGH",
      "status": "COMPLETED",
      "createdAt": "2024-01-15T14:30:00Z",
      "completedAt": "2024-01-15T15:45:00Z",
      "responder": {
        "name": "Dr. Sarah Johnson",
        "rating": 4.9
      }
    }
  ]
}
\`\`\`

### 3. Update Emergency Status (Responder)

**Endpoint:** `PUT /api/emergency/bookings/:id/status`

**Scenario:** Emergency responder updates the status of an emergency call.

**Headers:**
\`\`\`
Authorization: Bearer responder_jwt_token
\`\`\`

**Request:**
\`\`\`json
{
  "status": "EN_ROUTE",
  "estimatedArrival": "2024-01-15T14:35:00Z",
  "notes": "Traffic is heavy, may be delayed by 5 minutes"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Emergency status updated successfully"
}
\`\`\`

### 4. Accept Emergency Call (Responder)

**Endpoint:** `POST /api/emergency/bookings/:id/accept`

**Scenario:** Emergency responder accepts an emergency call.

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Emergency call accepted",
  "emergency": {
    "id": "emergency_id_123",
    "status": "ACCEPTED",
    "patient": {
      "location": {
        "latitude": 40.7128,
        "longitude": -74.0060,
        "address": "123 Emergency St, New York, NY"
      },
      "contactNumber": "+1234567890"
    }
  }
}
\`\`\`

### 5. Complete Emergency Call (Responder)

**Endpoint:** `POST /api/emergency/bookings/:id/complete`

**Scenario:** Emergency responder completes an emergency call.

**Request:**
\`\`\`json
{
  "treatmentProvided": "First aid administered, patient stabilized",
  "hospitalTransfer": true,
  "hospitalName": "NYC General Hospital",
  "patientCondition": "STABLE",
  "medicationsAdministered": ["Aspirin", "Oxygen"],
  "followUpRequired": true,
  "notes": "Patient responded well to treatment"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Emergency call completed successfully",
  "emergency": {
    "id": "emergency_id_123",
    "status": "COMPLETED",
    "completedAt": "2024-01-15T15:45:00Z"
  }
}
\`\`\`

### 6. Onboard Emergency Responder

**Endpoint:** `POST /api/emergency/responders/onboard`

**Scenario:** A medical professional wants to become an emergency responder.

**Request:**
\`\`\`json
{
  "personalInfo": {
    "firstName": "Sarah",
    "lastName": "Johnson",
    "dateOfBirth": "1980-03-15",
    "phoneNumber": "+1555123456",
    "email": "sarah.johnson@email.com"
  },
  "professionalInfo": {
    "licenseNumber": "MD123456",
    "licenseType": "MEDICAL_DOCTOR",
    "specialization": "Emergency Medicine",
    "yearsOfExperience": 12,
    "currentEmployer": "NYC General Hospital"
  },
  "certifications": [
    {
      "name": "BLS Certification",
      "issuingOrganization": "American Heart Association",
      "expiryDate": "2025-06-15"
    },
    {
      "name": "ACLS Certification",
      "issuingOrganization": "American Heart Association",
      "expiryDate": "2025-06-15"
    }
  ],
  "vehicleInfo": {
    "type": "AMBULANCE",
    "licensePlate": "AMB001",
    "equipmentList": ["Defibrillator", "Oxygen tank", "First aid kit"]
  }
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Emergency responder application submitted",
  "responderId": "responder_id_456",
  "status": "PENDING_VERIFICATION"
}
\`\`\`

### 7. Get Responder Profile

**Endpoint:** `GET /api/emergency/responders/profile`

**Scenario:** Emergency responder wants to view their profile.

**Headers:**
\`\`\`
Authorization: Bearer responder_jwt_token
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "responder": {
    "id": "responder_id_456",
    "firstName": "Sarah",
    "lastName": "Johnson",
    "specialization": "Emergency Medicine",
    "rating": 4.9,
    "totalCalls": 150,
    "status": "ACTIVE",
    "isOnDuty": true,
    "certifications": [
      {
        "name": "BLS Certification",
        "status": "VALID",
        "expiryDate": "2025-06-15"
      }
    ]
  }
}
\`\`\`

### 8. Update Responder Profile

**Endpoint:** `PUT /api/emergency/responders/profile`

**Scenario:** Emergency responder updates their profile information.

**Request:**
\`\`\`json
{
  "phoneNumber": "+1555123457",
  "email": "sarah.johnson.new@email.com",
  "currentEmployer": "NYC Emergency Services",
  "certifications": [
    {
      "name": "PALS Certification",
      "issuingOrganization": "American Heart Association",
      "expiryDate": "2025-08-15"
    }
  ]
}
\`\`\`

### 9. Get Nearby Emergencies (Responder)

**Endpoint:** `GET /api/emergency/nearby`

**Scenario:** Emergency responder wants to see nearby emergency calls.

**Query Parameters:**
- `radius`: Search radius in kilometers (default: 10)
- `emergencyType`: Filter by emergency type
- `severity`: Filter by severity level

**Example:** `GET /api/emergency/nearby?radius=15&emergencyType=MEDICAL&severity=HIGH`

**Response:**
\`\`\`json
{
  "success": true,
  "emergencies": [
    {
      "id": "emergency_id_789",
      "emergencyType": "MEDICAL",
      "severity": "HIGH",
      "location": {
        "latitude": 40.7200,
        "longitude": -74.0100,
        "address": "456 Crisis Ave, New York, NY"
      },
      "distance": 2.5,
      "description": "Chest pain, difficulty breathing",
      "createdAt": "2024-01-15T14:45:00Z"
    }
  ]
}
\`\`\`

### 10. Update Responder Location

**Endpoint:** `PUT /api/emergency/responders/location`

**Scenario:** Emergency responder updates their current location.

**Request:**
\`\`\`json
{
  "latitude": 40.7150,
  "longitude": -74.0080,
  "heading": 180,
  "speed": 35,
  "onDuty": true
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Location updated successfully"
}
\`\`\`

### 11. Get Emergency Analytics (Admin)

**Endpoint:** `GET /api/emergency/analytics`

**Scenario:** Admin wants to view emergency service analytics.

**Headers:**
\`\`\`
Authorization: Bearer admin_jwt_token
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "analytics": {
    "totalEmergencies": 1250,
    "averageResponseTime": 8.5,
    "completionRate": 98.5,
    "emergencyTypes": {
      "MEDICAL": 750,
      "FIRE": 200,
      "ACCIDENT": 300
    },
    "severityDistribution": {
      "LOW": 400,
      "MEDIUM": 500,
      "HIGH": 250,
      "CRITICAL": 100
    },
    "monthlyTrend": [
      {
        "month": "2024-01",
        "emergencies": 105,
        "avgResponseTime": 8.2
      }
    ]
  }
}
\`\`\`

### 12. Get All Emergency Responders (Admin)

**Endpoint:** `GET /api/emergency/responders`

**Scenario:** Admin wants to view all emergency responders.

**Response:**
\`\`\`json
{
  "success": true,
  "responders": [
    {
      "id": "responder_id_456",
      "name": "Dr. Sarah Johnson",
      "specialization": "Emergency Medicine",
      "status": "ACTIVE",
      "rating": 4.9,
      "totalCalls": 150,
      "isOnDuty": true,
      "lastActive": "2024-01-15T14:30:00Z"
    }
  ]
}
\`\`\`

### 13. Verify Emergency Responder (Admin)

**Endpoint:** `PUT /api/emergency/responders/:id/verify`

**Scenario:** Admin verifies an emergency responder's credentials.

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Emergency responder verified successfully",
  "responder": {
    "id": "responder_id_456",
    "status": "VERIFIED",
    "verifiedAt": "2024-01-15T10:00:00Z"
  }
}
\`\`\`

---

## Moving Routes

Base URL: `/api/moving`

### 1. Onboard Mover

**Endpoint:** `POST /api/moving/movers/onboard`

**Scenario:** A person wants to become a professional mover.

**Headers:**
\`\`\`
Authorization: Bearer jwt_token_here
\`\`\`

**Request:**
\`\`\`json
{
  "personalInfo": {
    "firstName": "Mike",
    "lastName": "Strong",
    "phoneNumber": "+1234567890",
    "email": "mike.strong@email.com",
    "dateOfBirth": "1985-08-20"
  },
  "businessInfo": {
    "companyName": "Strong Movers LLC",
    "businessLicense": "BL123456",
    "insurancePolicyNumber": "INS789012",
    "yearsInBusiness": 5
  },
  "services": [
    "RESIDENTIAL_MOVING",
    "COMMERCIAL_MOVING",
    "PACKING_SERVICES",
    "STORAGE"
  ],
  "equipment": [
    "Moving truck (26ft)",
    "Dollies",
    "Moving blankets",
    "Straps and ties"
  ],
  "teamSize": 4,
  "serviceAreas": ["Manhattan", "Brooklyn", "Queens", "Bronx"],
  "hourlyRate": 120.00,
  "minimumHours": 3
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Mover application submitted successfully",
  "moverId": "mover_id_123",
  "status": "PENDING_VERIFICATION"
}
\`\`\`

### 2. Get Mover Profile

**Endpoint:** `GET /api/moving/movers/profile`

**Scenario:** Mover wants to view their profile information.

**Headers:**
\`\`\`
Authorization: Bearer mover_jwt_token
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "mover": {
    "id": "mover_id_123",
    "companyName": "Strong Movers LLC",
    "rating": 4.7,
    "totalJobs": 85,
    "status": "ACTIVE",
    "services": ["RESIDENTIAL_MOVING", "PACKING_SERVICES"],
    "hourlyRate": 120.00,
    "isAvailable": true,
    "teamSize": 4,
    "serviceAreas": ["Manhattan", "Brooklyn", "Queens"]
  }
}
\`\`\`

### 3. Update Mover Profile

**Endpoint:** `PUT /api/moving/movers/profile`

**Scenario:** Mover updates their profile information.

**Request:**
\`\`\`json
{
  "hourlyRate": 130.00,
  "teamSize": 5,
  "services": [
    "RESIDENTIAL_MOVING",
    "COMMERCIAL_MOVING",
    "PACKING_SERVICES",
    "STORAGE",
    "PIANO_MOVING"
  ],
  "equipment": [
    "Moving truck (26ft)",
    "Moving truck (16ft)",
    "Piano dolly",
    "Moving blankets",
    "Straps and ties"
  ],
  "serviceAreas": ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"]
}
\`\`\`

### 4. Create Moving Booking

**Endpoint:** `POST /api/moving/bookings`

**Scenario:** Customer books a moving service.

**Headers:**
\`\`\`
Authorization: Bearer jwt_token_here
\`\`\`

**Request:**
\`\`\`json
{
  "movingType": "RESIDENTIAL",
  "fromAddress": {
    "street": "123 Old Apartment St",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001",
    "floor": 3,
    "elevator": false,
    "parkingAvailable": true
  },
  "toAddress": {
    "street": "456 New House Ave",
    "city": "Brooklyn",
    "state": "NY",
    "zipCode": "11201",
    "floor": 1,
    "elevator": false,
    "parkingAvailable": true
  },
  "movingDate": "2024-01-25",
  "preferredTime": "09:00",
  "homeSize": "2_BEDROOM",
  "inventory": [
    {
      "item": "Sofa",
      "quantity": 1,
      "weight": 80,
      "fragile": false
    },
    {
      "item": "Dining table",
      "quantity": 1,
      "weight": 60,
      "fragile": false
    },
    {
      "item": "Piano",
      "quantity": 1,
      "weight": 300,
      "fragile": true,
      "specialHandling": true
    }
  ],
  "additionalServices": ["PACKING", "UNPACKING"],
  "specialInstructions": "Piano needs special care, antique dining table",
  "estimatedDuration": 6,
  "budget": {
    "min": 800,
    "max": 1200
  }
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "booking": {
    "id": "moving_booking_123",
    "status": "PENDING_QUOTES",
    "movingDate": "2024-01-25",
    "estimatedCost": 950.00,
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
\`\`\`

### 5. Get Moving Quote

**Endpoint:** `POST /api/moving/quote`

**Scenario:** Customer wants to get an estimate for their move.

**Request:**
\`\`\`json
{
  "fromAddress": {
    "zipCode": "10001",
    "floor": 3,
    "elevator": false
  },
  "toAddress": {
    "zipCode": "11201",
    "floor": 1,
    "elevator": false
  },
  "homeSize": "2_BEDROOM",
  "distance": 15.5,
  "inventory": [
    {
      "item": "Sofa",
      "quantity": 1,
      "weight": 80
    },
    {
      "item": "Piano",
      "quantity": 1,
      "weight": 300,
      "specialHandling": true
    }
  ],
  "additionalServices": ["PACKING", "UNPACKING"],
  "movingDate": "2024-01-25"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "quote": {
    "baseRate": 120.00,
    "estimatedHours": 6,
    "laborCost": 720.00,
    "additionalServices": {
      "packing": 150.00,
      "unpacking": 100.00
    },
    "specialItems": {
      "piano": 200.00
    },
    "travelTime": 50.00,
    "totalEstimate": 1220.00,
    "breakdown": {
      "labor": 720.00,
      "services": 250.00,
      "specialHandling": 200.00,
      "travel": 50.00
    }
  }
}
\`\`\`

### 6. Get Moving Bookings

**Endpoint:** `GET /api/moving/bookings`

**Scenario:** Customer wants to view their moving bookings.

**Query Parameters:**
- `status`: Filter by booking status
- `page`: Page number
- `limit`: Results per page

**Response:**
\`\`\`json
{
  "success": true,
  "bookings": [
    {
      "id": "moving_booking_123",
      "movingType": "RESIDENTIAL",
      "status": "CONFIRMED",
      "movingDate": "2024-01-25",
      "fromAddress": "123 Old Apartment St, New York, NY",
      "toAddress": "456 New House Ave, Brooklyn, NY",
      "mover": {
        "id": "mover_id_123",
        "companyName": "Strong Movers LLC",
        "rating": 4.7,
        "phoneNumber": "+1234567890"
      },
      "estimatedCost": 950.00,
      "createdAt": "2024-01-15T10:00:00Z"
    }
  ]
}
\`\`\`

### 7. Get Available Movers

**Endpoint:** `GET /api/moving/available-movers`

**Scenario:** Customer wants to see available movers for their move.

**Query Parameters:**
- `date`: Moving date (YYYY-MM-DD)
- `serviceType`: Type of moving service
- `area`: Service area
- `budget`: Maximum budget

**Example:** `GET /api/moving/available-movers?date=2024-01-25&serviceType=RESIDENTIAL&area=Manhattan&budget=1000`

**Response:**
\`\`\`json
{
  "success": true,
  "movers": [
    {
      "id": "mover_id_123",
      "companyName": "Strong Movers LLC",
      "rating": 4.7,
      "totalJobs": 85,
      "hourlyRate": 120.00,
      "teamSize": 4,
      "services": ["RESIDENTIAL_MOVING", "PACKING_SERVICES"],
      "estimatedCost": 950.00,
      "availability": "AVAILABLE",
      "responseTime": "Usually responds within 2 hours"
    },
    {
      "id": "mover_id_124",
      "companyName": "Quick Move Pro",
      "rating": 4.5,
      "totalJobs": 120,
      "hourlyRate": 110.00,
      "teamSize": 3,
      "services": ["RESIDENTIAL_MOVING", "COMMERCIAL_MOVING"],
      "estimatedCost": 880.00,
      "availability": "AVAILABLE",
      "responseTime": "Usually responds within 1 hour"
    }
  ]
}
\`\`\`

### 8. Update Mover Availability

**Endpoint:** `PUT /api/moving/movers/availability`

**Scenario:** Mover updates their availability status.

**Headers:**
\`\`\`
Authorization: Bearer mover_jwt_token
\`\`\`

**Request:**
\`\`\`json
{
  "isAvailable": true,
  "availableDates": [
    "2024-01-20",
    "2024-01-21",
    "2024-01-22",
    "2024-01-25"
  ],
  "unavailableDates": [
    "2024-01-23",
    "2024-01-24"
  ],
  "workingHours": {
    "start": "08:00",
    "end": "18:00"
  },
  "maxJobsPerDay": 2
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Availability updated successfully"
}
\`\`\`

### 9. Accept Moving Job (Mover)

**Endpoint:** `POST /api/moving/bookings/:id/accept`

**Scenario:** Mover accepts a moving job request.

**Headers:**
\`\`\`
Authorization: Bearer mover_jwt_token
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Moving job accepted successfully",
  "booking": {
    "id": "moving_booking_123",
    "status": "ACCEPTED",
    "customer": {
      "name": "John Doe",
      "phoneNumber": "+1987654321",
      "email": "john@example.com"
    },
    "movingDate": "2024-01-25",
    "estimatedCost": 950.00
  }
}
\`\`\`

### 10. Start Moving Job (Mover)

**Endpoint:** `POST /api/moving/bookings/:id/start`

**Scenario:** Mover starts the moving job.

**Request:**
\`\`\`json
{
  "startTime": "2024-01-25T09:00:00Z",
  "teamMembers": [
    {
      "name": "Mike Strong",
      "role": "Team Leader"
    },
    {
      "name": "John Helper",
      "role": "Mover"
    },
    {
      "name": "Sam Lifter",
      "role": "Mover"
    }
  ],
  "truckInfo": {
    "licensePlate": "MOVE123",
    "size": "26ft"
  },
  "initialInventoryCheck": true
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Moving job started successfully",
  "booking": {
    "id": "moving_booking_123",
    "status": "IN_PROGRESS",
    "startedAt": "2024-01-25T09:00:00Z"
  }
}
\`\`\`

### 11. Complete Moving Job (Mover)

**Endpoint:** `POST /api/moving/bookings/:id/complete`

**Scenario:** Mover completes the moving job.

**Request:**
\`\`\`json
{
  "endTime": "2024-01-25T15:30:00Z",
  "actualHours": 6.5,
  "finalInventoryCheck": true,
  "damageReport": [],
  "additionalCharges": [
    {
      "description": "Extra heavy item handling",
      "amount": 50.00
    }
  ],
  "customerSignature": "signature_data_here",
  "finalCost": 1000.00,
  "notes": "Move completed successfully, customer satisfied"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Moving job completed successfully",
  "booking": {
    "id": "moving_booking_123",
    "status": "COMPLETED",
    "completedAt": "2024-01-25T15:30:00Z",
    "finalCost": 1000.00,
    "actualHours": 6.5
  }
}
\`\`\`

### 12. Get Mover Earnings

**Endpoint:** `GET /api/moving/movers/earnings`

**Scenario:** Mover wants to view their earnings report.

**Headers:**
\`\`\`
Authorization: Bearer mover_jwt_token
\`\`\`

**Query Parameters:**
- `period`: Time period (daily, weekly, monthly, yearly)
- `startDate`: Start date for custom period
- `endDate`: End date for custom period

**Response:**
\`\`\`json
{
  "success": true,
  "earnings": {
    "period": "monthly",
    "totalEarnings": 8500.00,
    "totalJobs": 15,
    "averagePerJob": 566.67,
    "breakdown": {
      "labor": 6800.00,
      "additionalServices": 1200.00,
      "tips": 500.00
    },
    "deductions": {
      "commission": 850.00,
      "fees": 50.00
    },
    "netEarnings": 7600.00
  }
}
\`\`\`

### 13. Get Mover Analytics

**Endpoint:** `GET /api/moving/movers/analytics`

**Scenario:** Mover wants to view their performance analytics.

**Response:**
\`\`\`json
{
  "success": true,
  "analytics": {
    "rating": {
      "current": 4.7,
      "trend": "+0.2"
    },
    "jobCompletion": {
      "rate": 98,
      "trend": "+2%"
    },
    "averageJobValue": 566.67,
    "popularServices": [
      {
        "service": "RESIDENTIAL_MOVING",
        "percentage": 70
      },
      {
        "service": "PACKING_SERVICES",
        "percentage": 45
      }
    ],
    "busyDays": ["Saturday", "Sunday", "Friday"],
    "customerRetention": 25
  }
}
\`\`\`

### 14. Get All Movers (Admin)

**Endpoint:** `GET /api/moving/movers/all`

**Scenario:** Admin wants to view all registered movers.

**Headers:**
\`\`\`
Authorization: Bearer admin_jwt_token
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "movers": [
    {
      "id": "mover_id_123",
      "companyName": "Strong Movers LLC",
      "status": "ACTIVE",
      "rating": 4.7,
      "totalJobs": 85,
      "joinedDate": "2023-06-15T00:00:00Z",
      "lastActive": "2024-01-15T14:30:00Z"
    }
  ]
}
\`\`\`

### 15. Verify Mover (Admin)

**Endpoint:** `PUT /api/moving/movers/:id/verify`

**Scenario:** Admin verifies a mover's credentials and business license.

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Mover verified successfully",
  "mover": {
    "id": "mover_id_123",
    "status": "VERIFIED",
    "verifiedAt": "2024-01-15T10:00:00Z"
  }
}
\`\`\`

### 16. Suspend Mover (Admin)

**Endpoint:** `PUT /api/moving/movers/:id/suspend`

**Scenario:** Admin suspends a mover for policy violations.

**Request:**
\`\`\`json
{
  "reason": "Multiple customer complaints about damaged items",
  "suspensionDuration": 30
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Mover suspended successfully"
}
\`\`\`

---

## Place Routes

Base URL: `/api/places`

### 1. Get Places

**Endpoint:** `GET /api/places`

**Scenario:** User wants to browse places in their area.

**Query Parameters:**
- `category`: Filter by category ID
- `city`: Filter by city
- `rating`: Minimum rating filter
- `page`: Page number
- `limit`: Results per page
- `sortBy`: Sort criteria (rating, distance, popularity)

**Example:** `GET /api/places?category=restaurants&city=New York&rating=4&page=1&limit=20&sortBy=rating`

**Response:**
\`\`\`json
{
  "success": true,
  "places": [
    {
      "id": "place_id_123",
      "name": "The Great Restaurant",
      "category": "Restaurant",
      "address": "123 Food St, New York, NY",
      "location": {
        "latitude": 40.7128,
        "longitude": -74.0060
      },
      "rating": 4.5,
      "reviewCount": 150,
      "priceRange": "$$",
      "photos": [
        "https://example.com/photo1.jpg"
      ],
      "isOpen": true,
      "distance": 0.5
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45
  }
}
\`\`\`

### 2. Get Place by ID

**Endpoint:** `GET /api/places/:id`

**Scenario:** User wants to view detailed information about a specific place.

**Response:**
\`\`\`json
{
  "success": true,
  "place": {
    "id": "place_id_123",
    "name": "The Great Restaurant",
    "description": "Fine dining restaurant with authentic Italian cuisine",
    "category": "Restaurant",
    "subcategory": "Italian",
    "address": "123 Food St, New York, NY 10001",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060
    },
    "contact": {
      "phone": "+1234567890",
      "email": "info@greatrestaurant.com",
      "website": "https://greatrestaurant.com"
    },
    "rating": 4.5,
    "reviewCount": 150,
    "priceRange": "$$",
    "features": ["Outdoor seating", "WiFi", "Parking"],
    "businessHours": {
      "monday": "11:00-22:00",
      "tuesday": "11:00-22:00",
      "wednesday": "11:00-22:00",
      "thursday": "11:00-22:00",
      "friday": "11:00-23:00",
      "saturday": "11:00-23:00",
      "sunday": "12:00-21:00"
    },
    "photos": [
      "https://example.com/photo1.jpg",
      "https://example.com/photo2.jpg"
    ],
    "menu": [
      {
        "category": "Appetizers",
        "items": [
          {
            "name": "Bruschetta",
            "price": 12.99,
            "description": "Fresh tomatoes, basil, garlic on toasted bread"
          }
        ]
      }
    ],
    "isOpen": true,
    "popularTimes": [
      {
        "day": "friday",
        "hours": [
          {"hour": 19, "popularity": 85},
          {"hour": 20, "popularity": 95}
        ]
      }
    ]
  }
}
\`\`\`

### 3. Get Places by Category

**Endpoint:** `GET /api/places/category/:categoryId`

**Scenario:** User wants to see all restaurants in their area.

**Query Parameters:**
- `city`: Filter by city
- `radius`: Search radius in km
- `lat`: User's latitude
- `lng`: User's longitude

**Example:** `GET /api/places/category/restaurants?city=New York&radius=5&lat=40.7128&lng=-74.0060`

**Response:**
\`\`\`json
{
  "success": true,
  "category": {
    "id": "restaurants",
    "name": "Restaurants",
    "description": "Dining establishments"
  },
  "places": [
    {
      "id": "place_id_123",
      "name": "The Great Restaurant",
      "rating": 4.5,
      "priceRange": "$$",
      "distance": 0.5,
      "isOpen": true
    }
  ]
}
\`\`\`

### 4. Get Nearby Places

**Endpoint:** `GET /api/places/nearby`

**Scenario:** User wants to find places near their current location.

**Query Parameters:**
- `lat`: User's latitude (required)
- `lng`: User's longitude (required)
- `radius`: Search radius in km (default: 5)
- `category`: Filter by category
- `limit`: Number of results

**Example:** `GET /api/places/nearby?lat=40.7128&lng=-74.0060&radius=2&category=restaurants&limit=10`

**Response:**
\`\`\`json
{
  "success": true,
  "places": [
    {
      "id": "place_id_123",
      "name": "The Great Restaurant",
      "category": "Restaurant",
      "distance": 0.3,
      "rating": 4.5,
      "isOpen": true,
      "estimatedWalkTime": 4
    }
  ],
  "userLocation": {
    "latitude": 40.7128,
    "longitude": -74.0060
  }
}
\`\`\`

### 5. Submit Anonymous Vote

**Endpoint:** `POST /api/places/vote/anonymous`

**Scenario:** User wants to vote on a place's category without creating an account.

**Request:**
\`\`\`json
{
  "placeId": "place_id_123",
  "suggestedCategory": "Italian Restaurant",
  "currentCategory": "Restaurant",
  "reason": "They specialize in authentic Italian cuisine",
  "userLocation": {
    "latitude": 40.7128,
    "longitude": -74.0060
  }
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Vote submitted successfully",
  "voteId": "vote_id_456"
}
\`\`\`

### 6. Get Place Votes

**Endpoint:** `GET /api/places/:id/votes`

**Scenario:** User wants to see voting results for a place's categorization.

**Response:**
\`\`\`json
{
  "success": true,
  "votes": {
    "totalVotes": 25,
    "currentCategory": "Restaurant",
    "suggestions": [
      {
        "category": "Italian Restaurant",
        "votes": 15,
        "percentage": 60
      },
      {
        "category": "Fine Dining",
        "votes": 8,
        "percentage": 32
      },
      {
        "category": "Restaurant",
        "votes": 2,
        "percentage": 8
      }
    ]
  }
}
\`\`\`

### 7. Get Category Suggestions

**Endpoint:** `GET /api/places/:id/category-suggestions`

**Scenario:** User wants to see suggested categories for a place.

**Response:**
\`\`\`json
{
  "success": true,
  "suggestions": [
    {
      "category": "Italian Restaurant",
      "confidence": 85,
      "reasons": ["Menu items", "User reviews", "Business description"]
    },
    {
      "category": "Fine Dining",
      "confidence": 70,
      "reasons": ["Price range", "Ambiance", "Service style"]
    }
  ]
}
\`\`\`

### 8. Submit User Vote (Authenticated)

**Endpoint:** `POST /api/places/vote`

**Scenario:** Authenticated user votes on a place's category.

**Headers:**
\`\`\`
Authorization: Bearer jwt_token_here
\`\`\`

**Request:**
\`\`\`json
{
  "placeId": "place_id_123",
  "suggestedCategory": "Italian Restaurant",
  "reason": "Authentic Italian menu and atmosphere"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Vote submitted successfully",
  "vote": {
    "id": "vote_id_456",
    "category": "Italian Restaurant",
    "submittedAt": "2024-01-15T10:00:00Z"
  }
}
\`\`\`

### 9. Get User Votes

**Endpoint:** `GET /api/places/user/votes`

**Scenario:** User wants to see their voting history.

**Headers:**
\`\`\`
Authorization: Bearer jwt_token_here
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "votes": [
    {
      "id": "vote_id_456",
      "place": {
        "id": "place_id_123",
        "name": "The Great Restaurant"
      },
      "suggestedCategory": "Italian Restaurant",
      "submittedAt": "2024-01-15T10:00:00Z",
      "status": "PENDING"
    }
  ]
}
\`\`\`

### 10. Create Place

**Endpoint:** `POST /api/places`

**Scenario:** Business owner or user adds a new place.

**Headers:**
\`\`\`
Authorization: Bearer jwt_token_here
\`\`\`

**Request:**
\`\`\`json
{
  "name": "New Coffee Shop",
  "description": "Cozy coffee shop with artisan roasted beans",
  "category": "Coffee Shop",
  "address": {
    "street": "789 Coffee Ave",
    "city": "New York",
    "state": "NY",
    "zipCode": "10001"
  },
  "location": {
    "latitude": 40.7200,
    "longitude": -74.0100
  },
  "contact": {
    "phone": "+1234567891",
    "email": "info@newcoffeeshop.com",
    "website": "https://newcoffeeshop.com"
  },
  "businessHours": {
    "monday": "07:00-19:00",
    "tuesday": "07:00-19:00",
    "wednesday": "07:00-19:00",
    "thursday": "07:00-19:00",
    "friday": "07:00-20:00",
    "saturday": "08:00-20:00",
    "sunday": "08:00-18:00"
  },
  "features": ["WiFi", "Outdoor seating", "Pet friendly"],
  "priceRange": "$"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Place created successfully",
  "place": {
    "id": "place_id_789",
    "name": "New Coffee Shop",
    "status": "PENDING_APPROVAL"
  }
}
\`\`\`

### 11. Update Place

**Endpoint:** `PUT /api/places/:id`

**Scenario:** Place owner updates their business information.

**Request:**
\`\`\`json
{
  "description": "Updated description with new specialties",
  "contact": {
    "phone": "+1234567892",
    "email": "newemail@coffeeshop.com"
  },
  "businessHours": {
    "monday": "06:30-19:30",
    "tuesday": "06:30-19:30",
    "wednesday": "06:30-19:30",
    "thursday": "06:30-19:30",
    "friday": "06:30-20:30",
    "saturday": "07:30-20:30",
    "sunday": "07:30-18:30"
  },
  "features": ["WiFi", "Outdoor seating", "Pet friendly", "Live music"]
}
\`\`\`

### 12. Delete Place

**Endpoint:** `DELETE /api/places/:id`

**Scenario:** Place owner or admin removes a place.

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Place deleted successfully"
}
\`\`\`

### 13. Upload Photo

**Endpoint:** `POST /api/places/:id/photos`

**Scenario:** Place owner uploads photos of their business.

**Request (Form Data):**
\`\`\`
photo: [binary file data]
caption: "Interior view of the dining area"
isPrimary: false
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Photo uploaded successfully",
  "photo": {
    "id": "photo_id_123",
    "url": "https://example.com/photo123.jpg",
    "caption": "Interior view of the dining area"
  }
}
\`\`\`

### 14. Delete Photo

**Endpoint:** `DELETE /api/places/photos/:photoId`

**Scenario:** Place owner removes a photo.

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Photo deleted successfully"
}
\`\`\`

### 15. Get Categories

**Endpoint:** `GET /api/places/categories/all`

**Scenario:** User wants to see all available place categories.

**Response:**
\`\`\`json
{
  "success": true,
  "categories": [
    {
      "id": "restaurants",
      "name": "Restaurants",
      "icon": "restaurant",
      "subcategories": [
        {
          "id": "italian",
          "name": "Italian"
        },
        {
          "id": "chinese",
          "name": "Chinese"
        }
      ]
    },
    {
      "id": "coffee_shops",
      "name": "Coffee Shops",
      "icon": "coffee"
    }
  ]
}
\`\`\`

---

## Review Routes

Base URL: `/api/reviews`

### 1. Submit Review

**Endpoint:** `POST /api/reviews`

**Scenario:** User wants to leave a review for a place they visited.

**Headers:**
\`\`\`
Authorization: Bearer jwt_token_here
\`\`\`

**Request:**
\`\`\`json
{
  "placeId": "place_id_123",
  "rating": 5,
  "title": "Excellent dining experience!",
  "content": "The food was amazing, service was top-notch, and the atmosphere was perfect for a date night. Highly recommend the pasta dishes!",
  "visitDate": "2024-01-10",
  "photos": [
    "https://example.com/review_photo1.jpg",
    "https://example.com/review_photo2.jpg"
  ],
  "tags": ["Great food", "Romantic", "Good service"],
  "wouldRecommend": true,
  "priceRating": 4,
  "serviceRating": 5,
  "ambianceRating": 5
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Review submitted successfully",
  "review": {
    "id": "review_id_123",
    "rating": 5,
    "title": "Excellent dining experience!",
    "submittedAt": "2024-01-15T10:00:00Z",
    "status": "PUBLISHED"
  }
}
\`\`\`

### 2. Get Reviews

**Endpoint:** `GET /api/reviews`

**Scenario:** User wants to see reviews for a specific place.

**Query Parameters:**
- `placeId`: Filter by place ID
- `rating`: Filter by rating
- `sortBy`: Sort by (newest, oldest, rating_high, rating_low, helpful)
- `page`: Page number
- `limit`: Results per page

**Example:** `GET /api/reviews?placeId=place_id_123&sortBy=helpful&page=1&limit=10`

**Response:**
\`\`\`json
{
  "success": true,
  "reviews": [
    {
      "id": "review_id_123",
      "user": {
        "name": "John D.",
        "avatar": "https://example.com/avatar.jpg",
        "reviewCount": 25,
        "isVerified": true
      },
      "rating": 5,
      "title": "Excellent dining experience!",
      "content": "The food was amazing, service was top-notch...",
      "visitDate": "2024-01-10",
      "submittedAt": "2024-01-15T10:00:00Z",
      "photos": [
        "https://example.com/review_photo1.jpg"
      ],
      "tags": ["Great food", "Romantic", "Good service"],
      "helpfulCount": 15,
      "wouldRecommend": true,
      "breakdown": {
        "price": 4,
        "service": 5,
        "ambiance": 5
      }
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 150
  },
  "summary": {
    "averageRating": 4.3,
    "totalReviews": 150,
    "ratingDistribution": {
      "5": 75,
      "4": 45,
      "3": 20,
      "2": 7,
      "1": 3
    }
  }
}
\`\`\`

### 3. Get Review by ID

**Endpoint:** `GET /api/reviews/:id`

**Scenario:** User wants to view a specific review in detail.

**Response:**
\`\`\`json
{
  "success": true,
  "review": {
    "id": "review_id_123",
    "user": {
      "name": "John D.",
      "avatar": "https://example.com/avatar.jpg",
      "reviewCount": 25,
      "isVerified": true,
      "joinedDate": "2023-05-15"
    },
    "place": {
      "id": "place_id_123",
      "name": "The Great Restaurant",
      "category": "Restaurant"
    },
    "rating": 5,
    "title": "Excellent dining experience!",
    "content": "The food was amazing, service was top-notch, and the atmosphere was perfect for a date night. Highly recommend the pasta dishes!",
    "visitDate": "2024-01-10",
    "submittedAt": "2024-01-15T10:00:00Z",
    "photos": [
      "https://example.com/review_photo1.jpg",
      "https://example.com/review_photo2.jpg"
    ],
    "tags": ["Great food", "Romantic", "Good service"],
    "helpfulCount": 15,
    "wouldRecommend": true,
    "breakdown": {
      "price": 4,
      "service": 5,
      "ambiance": 5
    },
    "responses": [
      {
        "id": "response_id_456",
        "author": "Restaurant Owner",
        "content": "Thank you for the wonderful review! We're so glad you enjoyed your experience.",
        "submittedAt": "2024-01-16T09:00:00Z"
      }
    ]
  }
}
\`\`\`

### 4. Update Review

**Endpoint:** `PUT /api/reviews/:id`

**Scenario:** User wants to edit their previously submitted review.

**Headers:**
\`\`\`
Authorization: Bearer jwt_token_here
\`\`\`

**Request:**
\`\`\`json
{
  "rating": 4,
  "title": "Good dining experience",
  "content": "Updated review content after second visit. Still good but not as exceptional as first time.",
  "tags": ["Good food", "Nice atmosphere"],
  "wouldRecommend": true,
  "priceRating": 3,
  "serviceRating": 4,
  "ambianceRating": 4
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Review updated successfully",
  "review": {
    "id": "review_id_123",
    "rating": 4,
    "updatedAt": "2024-01-20T14:30:00Z"
  }
}
\`\`\`

### 5. Delete Review

**Endpoint:** `DELETE /api/reviews/:id`

**Scenario:** User wants to delete their review.

**Headers:**
\`\`\`
Authorization: Bearer jwt_token_here
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Review deleted successfully"
}
\`\`\`

### 6. Get User Reviews

**Endpoint:** `GET /api/reviews/user/my-reviews`

**Scenario:** User wants to see all their submitted reviews.

**Headers:**
\`\`\`
Authorization: Bearer jwt_token_here
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "reviews": [
    {
      "id": "review_id_123",
      "place": {
        "id": "place_id_123",
        "name": "The Great Restaurant"
      },
      "rating": 5,
      "title": "Excellent dining experience!",
      "submittedAt": "2024-01-15T10:00:00Z",
      "helpfulCount": 15,
      "status": "PUBLISHED"
    }
  ]
}
\`\`\`

### 7. Mark Review Helpful

**Endpoint:** `POST /api/reviews/:id/helpful`

**Scenario:** User finds a review helpful and wants to mark it.

**Headers:**
\`\`\`
Authorization: Bearer jwt_token_here
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Review marked as helpful",
  "helpfulCount": 16
}
\`\`\`

### 8. Report Review

**Endpoint:** `POST /api/reviews/:id/report`

**Scenario:** User reports a review for inappropriate content.

**Headers:**
\`\`\`
Authorization: Bearer jwt_token_here
\`\`\`

**Request:**
\`\`\`json
{
  "reason": "INAPPROPRIATE_CONTENT",
  "description": "Review contains offensive language and personal attacks",
  "category": "HARASSMENT"
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Review reported successfully",
  "reportId": "report_id_789"
}
\`\`\`

### 9. Get Review Statistics

**Endpoint:** `GET /api/reviews/stats/overview`

**Scenario:** Get overall review statistics for the platform.

**Response:**
\`\`\`json
{
  "success": true,
  "stats": {
    "totalReviews": 15000,
    "averageRating": 4.2,
    "reviewsThisMonth": 1200,
    "topRatedPlaces": [
      {
        "placeId": "place_id_123",
        "name": "The Great Restaurant",
        "rating": 4.8,
        "reviewCount": 150
      }
    ],
    "categoryBreakdown": {
      "restaurants": 8500,
      "coffee_shops": 2500,
      "retail": 4000
    }
  }
}
\`\`\`

---

## Search Routes

Base URL: `/api/search`

### 1. Search

**Endpoint:** `GET /api/search`

**Scenario:** User searches for places, services, or content.

**Headers:**
\`\`\`
Authorization: Bearer jwt_token_here
\`\`\`

**Query Parameters:**
- `q`: Search query (required)
- `type`: Search type (places, services, all)
- `category`: Filter by category
- `location`: Search location
- `radius`: Search radius in km
- `page`: Page number
- `limit`: Results per page

**Example:** `GET /api/search?q=italian restaurant&type=places&location=New York&radius=5&page=1&limit=10`

**Response:**
\`\`\`json
{
  "success": true,
  "query": "italian restaurant",
  "results": {
    "places": [
      {
        "id": "place_id_123",
        "name": "The Great Italian Restaurant",
        "category": "Restaurant",
        "subcategory": "Italian",
        "rating": 4.5,
        "address": "123 Food St, New York, NY",
        "distance": 1.2,
        "priceRange": "$$",
        "isOpen": true,
        "relevanceScore": 0.95
      }
    ],
    "services": [
      {
        "id": "service_id_456",
        "name": "Italian Food Delivery",
        "type": "FOOD_DELIVERY",
        "rating": 4.3,
        "estimatedTime": 30,
        "relevanceScore": 0.87
      }
    ]
  },
  "suggestions": [
    "italian pizza",
    "italian cuisine near me",
    "best italian restaurants"
  ],
  "filters": {
    "categories": ["Restaurant", "Food Delivery"],
    "priceRanges": ["$", "$$", "$$$"],
    "ratings": [3, 4, 5]
  },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25
  }
}
\`\`\`

### 2. Get Popular Searches

**Endpoint:** `GET /api/search/popular`

**Scenario:** User wants to see trending or popular search terms.

**Response:**
\`\`\`json
{
  "success": true,
  "popularSearches": [
    {
      "query": "pizza near me",
      "count": 1250,
      "trend": "up"
    },
    {
      "query": "coffee shops",
      "count": 980,
      "trend": "stable"
    },
    {
      "query": "italian restaurant",
      "count": 875,
      "trend": "up"
    },
    {
      "query": "taxi service",
      "count": 750,
      "trend": "down"
    }
  ],
  "trendingCategories": [
    {
      "category": "restaurants",
      "growth": 15
    },
    {
      "category": "delivery",
      "growth": 25
    }
  ]
}
\`\`\`

---

## Service Routes

Base URL: `/api/services`

### 1. Get Service Types

**Endpoint:** `GET /api/services/types`

**Scenario:** User wants to see all available service types.

**Response:**
\`\`\`json
{
  "success": true,
  "serviceTypes": [
    {
      "id": "ride",
      "name": "Ride",
      "description": "Point-to-point transportation",
      "icon": "car",
      "basePrice": 5.00,
      "pricePerKm": 1.50,
      "available": true
    },
    {
      "id": "delivery",
      "name": "Delivery",
      "description": "Package and food delivery",
      "icon": "package",
      "basePrice": 3.00,
      "pricePerKm": 1.00,
      "available": true
    },
    {
      "id": "taxi",
      "name": "Taxi",
      "description": "Traditional taxi service",
      "icon": "taxi",
      "basePrice": 4.00,
      "pricePerKm": 2.00,
      "available": true
    }
  ]
}
\`\`\`

### 2. Get Service Type by ID

**Endpoint:** `GET /api/services/types/:id`

**Scenario:** User wants detailed information about a specific service type.

**Response:**
\`\`\`json
{
  "success": true,
  "serviceType": {
    "id": "ride",
    "name": "Ride",
    "description": "Point-to-point transportation service",
    "icon": "car",
    "pricing": {
      "basePrice": 5.00,
      "pricePerKm": 1.50,
      "pricePerMinute": 0.25,
      "minimumFare": 8.00,
      "cancellationFee": 2.50
    },
    "features": [
      "Real-time tracking",
      "Multiple payment options",
      "Driver rating system",
      "24/7 availability"
    ],
    "vehicleTypes": [
      {
        "type": "ECONOMY",
        "name": "Economy",
        "capacity": 4,
        "priceMultiplier": 1.0
      },
      {
        "type": "PREMIUM",
        "name": "Premium",
        "capacity": 4,
        "priceMultiplier": 1.5
      }
    ],
    "serviceAreas": ["Manhattan", "Brooklyn", "Queens"],
    "averageWaitTime": 5,
    "available": true
  }
}
\`\`\`

### 3. Get Nearby Drivers

**Endpoint:** `GET /api/services/drivers/nearby`

**Scenario:** User wants to see available drivers in their area.

**Query Parameters:**
- `lat`: User's latitude (required)
- `lng`: User's longitude (required)
- `radius`: Search radius in km (default: 5)
- `serviceType`: Filter by service type
- `vehicleType`: Filter by vehicle type

**Example:** `GET /api/services/drivers/nearby?lat=40.7128&lng=-74.0060&radius=3&serviceType=ride`

**Response:**
\`\`\`json
{
  "success": true,
  "drivers": [
    {
      "id": "driver_id_123",
      "name": "Mike Johnson",
      "rating": 4.8,
      "location": {
        "latitude": 40.7150,
        "longitude": -74.0080
      },
      "distance": 0.8,
      "estimatedArrival": 3,
      "vehicle": {
        "type": "SEDAN",
        "make": "Toyota",
        "model": "Camry",
        "color": "Silver",
        "licensePlate": "ABC123"
      },
      "serviceTypes": ["RIDE", "DELIVERY"],
      "isAvailable": true
    }
  ],
  "totalAvailable": 15,
  "averageWaitTime": 4
}
\`\`\`

### 4. Get Available Drivers

**Endpoint:** `GET /api/services/drivers/available`

**Scenario:** System needs to find available drivers for booking assignment.

**Query Parameters:**
- `serviceType`: Required service type
- `location`: Pickup location
- `vehicleType`: Required vehicle type

**Response:**
\`\`\`json
{
  "success": true,
  "availableDrivers": [
    {
      "id": "driver_id_123",
      "name": "Mike Johnson",
      "rating": 4.8,
      "distance": 0.8,
      "estimatedArrival": 3,
      "vehicle": {
        "type": "SEDAN",
        "licensePlate": "ABC123"
      },
      "acceptanceRate": 92,
      "completionRate": 98
    }
  ]
}
\`\`\`

### 5. Update Driver Availability

**Endpoint:** `PUT /api/services/drivers/availability`

**Scenario:** Driver goes online/offline or updates their service availability.

**Headers:**
\`\`\`
Authorization: Bearer driver_jwt_token
\`\`\`

**Request:**
\`\`\`json
{
  "isAvailable": true,
  "serviceTypes": ["RIDE", "DELIVERY"],
  "vehicleType": "SEDAN",
  "maxRadius": 10,
  "preferredAreas": ["Manhattan", "Brooklyn"]
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Availability updated successfully",
  "status": {
    "isAvailable": true,
    "serviceTypes": ["RIDE", "DELIVERY"],
    "updatedAt": "2024-01-15T10:00:00Z"
  }
}
\`\`\`

### 6. Update Driver Location

**Endpoint:** `PUT /api/services/drivers/location`

**Scenario:** Driver updates their current location for better matching.

**Headers:**
\`\`\`
Authorization: Bearer driver_jwt_token
\`\`\`

**Request:**
\`\`\`json
{
  "latitude": 40.7200,
  "longitude": -74.0100,
  "heading": 90,
  "speed": 25,
  "accuracy": 5
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Location updated successfully"
}
\`\`\`

### 7. Get Nearby Stores

**Endpoint:** `GET /api/services/stores/nearby`

**Scenario:** User wants to find stores for delivery orders.

**Query Parameters:**
- `lat`: User's latitude
- `lng`: User's longitude
- `radius`: Search radius in km
- `category`: Store category
- `isOpen`: Filter by open status

**Example:** `GET /api/services/stores/nearby?lat=40.7128&lng=-74.0060&radius=5&category=grocery&isOpen=true`

**Response:**
\`\`\`json
{
  "success": true,
  "stores": [
    {
      "id": "store_id_123",
      "name": "Fresh Market",
      "category": "Grocery",
      "address": "123 Market St, New York, NY",
      "distance": 1.2,
      "rating": 4.3,
      "deliveryTime": 30,
      "deliveryFee": 2.99,
      "minimumOrder": 25.00,
      "isOpen": true,
      "businessHours": {
        "today": "08:00-22:00"
      },
      "features": ["Same-day delivery", "Fresh produce", "Organic options"]
    }
  ]
}
\`\`\`

### 8. Get Store by ID

**Endpoint:** `GET /api/services/stores/:id`

**Scenario:** User wants detailed information about a specific store.

**Response:**
\`\`\`json
{
  "success": true,
  "store": {
    "id": "store_id_123",
    "name": "Fresh Market",
    "description": "Your neighborhood grocery store with fresh produce",
    "category": "Grocery",
    "address": "123 Market St, New York, NY 10001",
    "contact": {
      "phone": "+1234567890",
      "email": "info@freshmarket.com"
    },
    "rating": 4.3,
    "reviewCount": 250,
    "deliveryInfo": {
      "deliveryTime": 30,
      "deliveryFee": 2.99,
      "minimumOrder": 25.00,
      "freeDeliveryThreshold": 50.00
    },
    "businessHours": {
      "monday": "08:00-22:00",
      "tuesday": "08:00-22:00",
      "wednesday": "08:00-22:00",
      "thursday": "08:00-22:00",
      "friday": "08:00-23:00",
      "saturday": "08:00-23:00",
      "sunday": "09:00-21:00"
    },
    "features": ["Same-day delivery", "Fresh produce", "Organic options"],
    "paymentMethods": ["CARD", "CASH", "DIGITAL_WALLET"],
    "isOpen": true
  }
}
\`\`\`

### 9. Get Store Products

**Endpoint:** `GET /api/services/stores/:id/products`

**Scenario:** User browses products available at a store.

**Query Parameters:**
- `category`: Product category
- `search`: Search term
- `page`: Page number
- `limit`: Results per page

**Example:** `GET /api/services/stores/store_id_123/products?category=dairy&page=1&limit=20`

**Response:**
\`\`\`json
{
  "success": true,
  "products": [
    {
      "id": "product_id_123",
      "name": "Organic Whole Milk",
      "description": "Fresh organic whole milk from local farms",
      "category": "Dairy",
      "price": 4.99,
      "originalPrice": 5.49,
      "discount": 9,
      "unit": "1 gallon",
      "inStock": true,
      "stockQuantity": 25,
      "images": [
        "https://example.com/milk.jpg"
      ],
      "nutritionInfo": {
        "calories": 150,
        "fat": 8,
        "protein": 8
      },
      "tags": ["Organic", "Local", "Fresh"]
    }
  ],
  "categories": [
    {
      "name": "Dairy",
      "count": 45
    },
    {
      "name": "Produce",
      "count": 120
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 45
  }
}
\`\`\`

### 10. Get Nearby Restaurants

**Endpoint:** `GET /api/services/restaurants/nearby`

**Scenario:** User wants to order food from nearby restaurants.

**Query Parameters:**
- `lat`: User's latitude
- `lng`: User's longitude
- `radius`: Search radius in km
- `cuisine`: Cuisine type
- `deliveryTime`: Maximum delivery time
- `minRating`: Minimum rating

**Example:** `GET /api/services/restaurants/nearby?lat=40.7128&lng=-74.0060&radius=3&cuisine=italian&minRating=4`

**Response:**
\`\`\`json
{
  "success": true,
  "restaurants": [
    {
      "id": "restaurant_id_123",
      "name": "Mario's Italian Kitchen",
      "cuisine": "Italian",
      "rating": 4.5,
      "reviewCount": 180,
      "distance": 0.8,
      "deliveryTime": 25,
      "deliveryFee": 1.99,
      "minimumOrder": 20.00,
      "priceRange": "$$",
      "isOpen": true,
      "features": ["Fast delivery", "Popular items", "Highly rated"],
      "image": "https://example.com/restaurant.jpg"
    }
  ]
}
\`\`\`

### 11. Get Restaurant Menu

**Endpoint:** `GET /api/services/restaurants/:id/menu`

**Scenario:** User wants to view a restaurant's menu for ordering.

**Response:**
\`\`\`json
{
  "success": true,
  "restaurant": {
    "id": "restaurant_id_123",
    "name": "Mario's Italian Kitchen",
    "deliveryInfo": {
      "deliveryTime": 25,
      "deliveryFee": 1.99,
      "minimumOrder": 20.00
    }
  },
  "menu": [
    {
      "category": "Appetizers",
      "items": [
        {
          "id": "item_id_123",
          "name": "Bruschetta",
          "description": "Fresh tomatoes, basil, and garlic on toasted bread",
          "price": 8.99,
          "image": "https://example.com/bruschetta.jpg",
          "dietary": ["Vegetarian"],
          "popular": true,
          "customizations": [
            {
              "name": "Extra cheese",
              "price": 1.50
            }
          ]
        }
      ]
    },
    {
      "category": "Main Courses",
      "items": [
        {
          "id": "item_id_124",
          "name": "Spaghetti Carbonara",
          "description": "Classic Italian pasta with eggs, cheese, and pancetta",
          "price": 16.99,
          "image": "https://example.com/carbonara.jpg",
          "spicyLevel": 0,
          "preparationTime": 15,
          "customizations": [
            {
              "name": "Extra pancetta",
              "price": 3.00
            },
            {
              "name": "Gluten-free pasta",
              "price": 2.00
            }
          ]
        }
      ]
    }
  ]
}
\`\`\`

### 12. Get Place Recommendations

**Endpoint:** `GET /api/services/places/recommendations`

**Scenario:** User wants personalized place recommendations.

**Headers:**
\`\`\`
Authorization: Bearer jwt_token_here
\`\`\`

**Query Parameters:**
- `category`: Preferred category
- `location`: User's location
- `budget`: Budget range
- `occasion`: Occasion type

**Example:** `GET /api/services/places/recommendations?category=restaurants&location=New York&budget=moderate&occasion=date`

**Response:**
\`\`\`json
{
  "success": true,
  "recommendations": [
    {
      "id": "place_id_123",
      "name": "The Romantic Bistro",
      "category": "Restaurant",
      "rating": 4.6,
      "priceRange": "$$",
      "distance": 1.5,
      "matchScore": 92,
      "reasons": [
        "Perfect for dates",
        "Highly rated",
        "Within your budget",
        "Great ambiance"
      ],
      "features": ["Romantic atmosphere", "Wine selection", "Outdoor seating"],
      "image": "https://example.com/bistro.jpg"
    }
  ],
  "filters": {
    "appliedFilters": {
      "category": "restaurants",
      "budget": "moderate",
      "occasion": "date"
    },
    "userPreferences": {
      "cuisinePreferences": ["Italian", "French"],
      "averageSpending": 45.00
    }
  }
}
\`\`\`

### 13. Get Nearby Places

**Endpoint:** `GET /api/services/places/nearby`

**Scenario:** User wants to discover places around their location.

**Query Parameters:**
- `lat`: User's latitude
- `lng`: User's longitude
- `radius`: Search radius in km
- `category`: Place category
- `limit`: Number of results

**Response:**
\`\`\`json
{
  "success": true,
  "places": [
    {
      "id": "place_id_123",
      "name": "Central Park",
      "category": "Park",
      "distance": 0.3,
      "rating": 4.7,
      "isOpen": true,
      "features": ["Walking trails", "Playground", "Lake"],
      "estimatedVisitTime": 120
    }
  ]
}
\`\`\`

### 14. Submit Place Survey

**Endpoint:** `POST /api/services/places/survey`

**Scenario:** User provides feedback about a place to improve recommendations.

**Headers:**
\`\`\`
Authorization: Bearer jwt_token_here
\`\`\`

**Request:**
\`\`\`json
{
  "placeId": "place_id_123",
  "visitDate": "2024-01-10",
  "purpose": "Dining",
  "satisfaction": 4,
  "wouldReturn": true,
  "wouldRecommend": true,
  "feedback": {
    "service": 5,
    "ambiance": 4,
    "value": 4,
    "cleanliness": 5
  },
  "improvements": ["Faster service", "More vegetarian options"],
  "favoriteAspects": ["Great food", "Friendly staff"]
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Survey submitted successfully",
  "surveyId": "survey_id_456"
}
\`\`\`

### 15. Get Service Zones

**Endpoint:** `GET /api/services/zones`

**Scenario:** Check which areas are covered by different services.

**Response:**
\`\`\`json
{
  "success": true,
  "serviceZones": [
    {
      "id": "zone_id_123",
      "name": "Manhattan",
      "services": ["RIDE", "DELIVERY", "TAXI", "EMERGENCY"],
      "boundaries": {
        "north": 40.8176,
        "south": 40.7047,
        "east": -73.9441,
        "west": -74.0479
      },
      "surgeAreas": [
        {
          "area": "Times Square",
          "multiplier": 1.5,
          "reason": "High demand area"
        }
      ]
    }
  ]
}
\`\`\`

### 16. Check Service Coverage

**Endpoint:** `GET /api/services/zones/coverage`

**Scenario:** Check if a specific location is covered by services.

**Query Parameters:**
- `lat`: Location latitude
- `lng`: Location longitude
- `serviceType`: Service type to check

**Example:** `GET /api/services/zones/coverage?lat=40.7128&lng=-74.0060&serviceType=ride`

**Response:**
\`\`\`json
{
  "success": true,
  "coverage": {
    "isServiceable": true,
    "zone": "Manhattan",
    "availableServices": ["RIDE", "DELIVERY", "TAXI"],
    "restrictions": [],
    "surgeMultiplier": 1.0,
    "estimatedWaitTime": 5
  }
}
\`\`\`

---

## Store Routes

Base URL: `/api/stores`

### 1. Onboard Store Owner

**Endpoint:** `POST /api/stores/owners/onboard`

**Scenario:** A business owner wants to register their store on the platform.

**Headers:**
\`\`\`
Authorization: Bearer jwt_token_here
\`\`\`

**Request:**
\`\`\`json
{
  "personalInfo": {
    "firstName": "Sarah",
    "lastName": "Wilson",
    "phoneNumber": "+1234567890",
    "email": "sarah@freshmarket.com",
    "dateOfBirth": "1980-05-15"
  },
  "businessInfo": {
    "businessName": "Fresh Market",
    "businessType": "GROCERY_STORE",
    "businessLicense": "BL123456789",
    "taxId": "TAX987654321",
    "yearsInBusiness": 5,
    "numberOfEmployees": 15
  },
  "storeInfo": {
    "storeName": "Fresh Market Downtown",
    "address": {
      "street": "123 Market St",
      "city": "New York",
      "state": "NY",
      "zipCode": "10001"
    },
    "category": "GROCERY",
    "subcategories": ["Organic", "Fresh Produce", "Dairy"],
    "storeSize": "MEDIUM",
    "hasDelivery": true,
    "hasPickup": true
  },
  "bankingInfo": {
    "accountHolderName": "Fresh Market LLC",
    "bankName": "Chase Bank",
    "accountNumber": "****1234",
    "routingNumber": "021000021"
  }
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Store owner application submitted successfully",
  "ownerId": "owner_id_123",
  "status": "PENDING_VERIFICATION",
  "nextSteps": [
    "Upload business license",
    "Verify bank account",
    "Complete store setup"
  ]
}
\`\`\`

### 2. Get Store Owner Profile

**Endpoint:** `GET /api/stores/owners/profile`

**Scenario:** Store owner wants to view their profile information.

**Headers:**
\`\`\`
Authorization: Bearer store_owner_jwt_token
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "owner": {
    "id": "owner_id_123",
    "firstName": "Sarah",
    "lastName": "Wilson",
    "email": "sarah@freshmarket.com",
    "phoneNumber": "+1234567890",
    "status": "ACTIVE",
    "verificationStatus": "VERIFIED",
    "businessInfo": {
      "businessName": "Fresh Market",
      "businessType": "GROCERY_STORE",
      "yearsInBusiness": 5
    },
    "stores": [
      {
        "id": "store_id_123",
        "name": "Fresh Market Downtown",
        "status": "ACTIVE",
        "rating": 4.3
      }
    ],
    "joinedDate": "2023-08-15T00:00:00Z",
    "totalSales": 125000.00,
    "totalOrders": 2500
  }
}
\`\`\`

### 3. Update Store Owner Profile

**Endpoint:** `PUT /api/stores/owners/profile`

**Scenario:** Store owner updates their profile information.

**Request:**
\`\`\`json
{
  "firstName": "Sarah",
  "lastName": "Wilson-Smith",
  "phoneNumber": "+1234567891",
  "email": "sarah.wilson@freshmarket.com",
  "businessInfo": {
    "numberOfEmployees": 18,
    "businessDescription": "Premium grocery store focusing on organic and locally sourced products"
  }
}
\`\`\`

### 4. Create Store

**Endpoint:** `POST /api/stores`

**Scenario:** Store owner adds a new store location.

**Headers:**
\`\`\`
Authorization: Bearer store_owner_jwt_token
\`\`\`

**Request:**
\`\`\`json
{
  "name": "Fresh Market Uptown",
  "description": "Premium grocery store with organic and locally sourced products",
  "category": "GROCERY",
  "subcategories": ["Organic", "Fresh Produce", "Dairy", "Bakery"],
  "address": {
    "street": "456 Uptown Ave",
    "city": "New York",
    "state": "NY",
    "zipCode": "10025",
    "floor": 1,
    "suite": null
  },
  "location": {
    "latitude": 40.7831,
    "longitude": -73.9712
  },
  "contact": {
    "phone": "+1234567892",
    "email": "uptown@freshmarket.com",
    "website": "https://freshmarket.com/uptown"
  },
  "businessHours": {
    "monday": "08:00-22:00",
    "tuesday": "08:00-22:00",
    "wednesday": "08:00-22:00",
    "thursday": "08:00-22:00",
    "friday": "08:00-23:00",
    "saturday": "08:00-23:00",
    "sunday": "09:00-21:00"
  },
  "services": {
    "delivery": {
      "available": true,
      "radius": 5,
      "fee": 2.99,
      "freeDeliveryThreshold": 50.00,
      "estimatedTime": 30
    },
    "pickup": {
      "available": true,
      "preparationTime": 15
    },
    "curbside": {
      "available": true
    }
  },
  "paymentMethods": ["CARD", "CASH", "DIGITAL_WALLET"],
  "features": ["Organic products", "Local sourcing", "Fresh bakery", "Deli counter"]
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Store created successfully",
  "store": {
    "id": "store_id_456",
    "name": "Fresh Market Uptown",
    "status": "PENDING_APPROVAL",
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
\`\`\`

### 5. Get Stores

**Endpoint:** `GET /api/stores`

**Scenario:** User browses available stores for shopping.

**Query Parameters:**
- `category`: Store category
- `location`: User's location
- `radius`: Search radius in km
- `delivery`: Filter stores with delivery
- `isOpen`: Filter by open status
- `rating`: Minimum rating
- `page`: Page number
- `limit`: Results per page

**Example:** `GET /api/stores?category=grocery&location=New York&radius=5&delivery=true&isOpen=true&page=1&limit=10`

**Response:**
\`\`\`json
{
  "success": true,
  "stores": [
    {
      "id": "store_id_123",
      "name": "Fresh Market Downtown",
      "category": "Grocery",
      "rating": 4.3,
      "reviewCount": 250,
      "address": "123 Market St, New York, NY",
      "distance": 1.2,
      "deliveryInfo": {
        "available": true,
        "fee": 2.99,
        "estimatedTime": 30,
        "minimumOrder": 25.00
      },
      "isOpen": true,
      "currentHours": "08:00-22:00",
      "features": ["Organic products", "Fresh produce"],
      "image": "https://example.com/store.jpg"
    }
  ],
  "filters": {
    "categories": ["Grocery", "Pharmacy", "Electronics"],
    "priceRanges": ["$", "$$", "$$$"],
    "features": ["Delivery", "Pickup", "Organic"]
  },
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25
  }
}
\`\`\`

### 6. Get Store by ID

**Endpoint:** `GET /api/stores/:id`

**Scenario:** User wants detailed information about a specific store.

**Response:**
\`\`\`json
{
  "success": true,
  "store": {
    "id": "store_id_123",
    "name": "Fresh Market Downtown",
    "description": "Premium grocery store with organic and locally sourced products",
    "category": "Grocery",
    "subcategories": ["Organic", "Fresh Produce", "Dairy"],
    "rating": 4.3,
    "reviewCount": 250,
    "address": "123 Market St, New York, NY 10001",
    "location": {
      "latitude": 40.7128,
      "longitude": -74.0060
    },
    "contact": {
      "phone": "+1234567890",
      "email": "info@freshmarket.com",
      "website": "https://freshmarket.com"
    },
    "businessHours": {
      "monday": "08:00-22:00",
      "tuesday": "08:00-22:00",
      "wednesday": "08:00-22:00",
      "thursday": "08:00-22:00",
      "friday": "08:00-23:00",
      "saturday": "08:00-23:00",
      "sunday": "09:00-21:00"
    },
    "services": {
      "delivery": {
        "available": true,
        "radius": 5,
        "fee": 2.99,
        "freeDeliveryThreshold": 50.00,
        "estimatedTime": 30
      },
      "pickup": {
        "available": true,
        "preparationTime": 15
      }
    },
    "paymentMethods": ["CARD", "CASH", "DIGITAL_WALLET"],
    "features": ["Organic products", "Local sourcing", "Fresh bakery"],
    "photos": [
      "https://example.com/store1.jpg",
      "https://example.com/store2.jpg"
    ],
    "isOpen": true,
    "popularProducts": [
      {
        "id": "product_id_123",
        "name": "Organic Bananas",
        "price": 2.99,
        "image": "https://example.com/bananas.jpg"
      }
    ]
  }
}
\`\`\`

### 7. Update Store

**Endpoint:** `PUT /api/stores/:id`

**Scenario:** Store owner updates their store information.

**Headers:**
\`\`\`
Authorization: Bearer store_owner_jwt_token
\`\`\`

**Request:**
\`\`\`json
{
  "description": "Updated description with new specialties",
  "businessHours": {
    "monday": "07:30-22:30",
    "tuesday": "07:30-22:30",
    "wednesday": "07:30-22:30",
    "thursday": "07:30-22:30",
    "friday": "07:30-23:30",
    "saturday": "07:30-23:30",
    "sunday": "08:30-21:30"
  },
  "services": {
    "delivery": {
      "available": true,
      "radius": 7,
      "fee": 1.99,
      "freeDeliveryThreshold": 40.00,
      "estimatedTime": 25
    }
  },
  "features": ["Organic products", "Local sourcing", "Fresh bakery", "Meal kits", "Wine selection"]
}
\`\`\`

### 8. Delete Store

**Endpoint:** `DELETE /api/stores/:id`

**Scenario:** Store owner permanently closes a store location.

**Headers:**
\`\`\`
Authorization: Bearer store_owner_jwt_token
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Store deleted successfully"
}
\`\`\`

### 9. Add Product

**Endpoint:** `POST /api/stores/:id/products`

**Scenario:** Store owner adds a new product to their inventory.

**Headers:**
\`\`\`
Authorization: Bearer store_owner_jwt_token
\`\`\`

**Request:**
\`\`\`json
{
  "name": "Organic Avocados",
  "description": "Fresh organic avocados from California farms",
  "category": "Produce",
  "subcategory": "Fruits",
  "price": 1.99,
  "originalPrice": 2.49,
  "unit": "each",
  "sku": "AVG-ORG-001",
  "barcode": "1234567890123",
  "stockQuantity": 50,
  "minStockLevel": 10,
  "maxStockLevel": 100,
  "images": [
    "https://example.com/avocado1.jpg",
    "https://example.com/avocado2.jpg"
  ],
  "nutritionInfo": {
    "calories": 234,
    "fat": 21,
    "carbs": 12,
    "protein": 3,
    "fiber": 10
  },
  "tags": ["Organic", "Fresh", "Healthy", "Keto-friendly"],
  "allergens": [],
  "storage": "Room temperature until ripe, then refrigerate",
  "shelfLife": 7,
  "isActive": true,
  "isFeatured": false,
  "weight": 0.2,
  "dimensions": {
    "length": 10,
    "width": 7,
    "height": 7
  }
}
\`\`\`

**Response:**
\`\`\`json
{
  "success": true,
  "message": "Product added successfully",
  "product": {
    "id": "product_id_789",
    "name": "Organic Avocados",
    "price": 1.99,
    "sku": "AVG-ORG-001",
    "stockQuantity": 50,
    "createdAt": "2024-01-15T10:00:00Z"
  }
}
\`\`\`

### 10. Get Products

**Endpoint:** `GET /api/stores/:id/products`

**Scenario:** User browses products available at a store.

**Query Parameters:**
- `category`: Product category
- `search`: Search term
- `inStock`: Filter by stock availability
- `featured`: Filter featured products
- `sortBy`: Sort criteria (price, name, popularity)
- `page`: Page number
- `limit`: Results per page

**Example:** `GET /api/stores/store_id_123/products?category=produce&inStock=true&sortBy=price&page=1&limit=20`

**Response:**
\`\`\`json
{
  "success": true,
  "products": [
    {
      "id": "product_id_789",
      "name": "Organic Avocados",
      "description": "Fresh organic avocados from California farms",
      "category": "Produce",
      "price": 1.99,
      "originalPrice": 2.49,
      "discount": 20,
      "unit": "each",
      "inStock": true,
      "stockQuantity": 50,
      "images": [
        "https://example.com/avocado1.jpg"
      ],
      "tags": ["Organic", "Fresh", "Healthy"],
      "rating": 4.5,
      "reviewCount": 25,
      "isPopular": true
    }
  ],
  "categories": [
    {
      "name": "Produce",
      "count": 120
    },
    {
      "name": "Dairy",
      "count": 45
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 120
  }
}
\`\`\`

###

# tripsyncv2backend
