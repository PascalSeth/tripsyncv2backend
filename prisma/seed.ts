import { PrismaClient, ServiceCategory, SubscriptionTier, RideType } from "@prisma/client"
import { RBACService } from "../src/services/rbac.service"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Starting database seed for foundational data...")

  // Clear existing data (optional, but good for a fresh foundation seed)
  // Be cautious with this in production environments!
  await prisma.auditLog.deleteMany({})
  await prisma.userSession.deleteMany({})
  await prisma.commissionPayment.deleteMany({})
  await prisma.monthlyCommissionBill.deleteMany({})
  await prisma.transaction.deleteMany({})
  await prisma.paymentMethod.deleteMany({})
  await prisma.providerPayout.deleteMany({})
  await prisma.userSubscription.deleteMany({})
  await prisma.scheduledNotification.deleteMany({})
  await prisma.customerProfile.deleteMany({})
  await prisma.driverProfile.deleteMany({})
  await prisma.taxiDriverProfile.deleteMany({})
  await prisma.deliveryProfile.deleteMany({})
  await prisma.moverProfile.deleteMany({})
  await prisma.emergencyProfile.deleteMany({})
  await prisma.businessProfile.deleteMany({})
  await prisma.storeOwnerProfile.deleteMany({})
  await prisma.placeOwnerProfile.deleteMany({})
  await prisma.booking.deleteMany({})
  await prisma.dayBookingConfig.deleteMany({})
  await prisma.dayBookingAvailability.deleteMany({})
  await prisma.driverNotification.deleteMany({})
  await prisma.bookingRejection.deleteMany({})
  await prisma.tripTracking.deleteMany({})
  await prisma.driverLocationHistory.deleteMany({})
  await prisma.surgeZone.deleteMany({})
  await prisma.vehicle.deleteMany({})
  await prisma.address.deleteMany({})
  await prisma.store.deleteMany({})
  await prisma.business.deleteMany({})
  await prisma.place.deleteMany({})
  await prisma.placeCategorySuggestion.deleteMany({})
  await prisma.survey.deleteMany({})
  await prisma.placeVote.deleteMany({})
  await prisma.review.deleteMany({})
  await prisma.supportTicket.deleteMany({})
  await prisma.supportMessage.deleteMany({})
  await prisma.dailyAnalytics.deleteMany({})
  await prisma.trackingUpdate.deleteMany({})
  await prisma.orderItem.deleteMany({})
  await prisma.movingInventoryItem.deleteMany({})
  await prisma.emergencyContact.deleteMany({})
  await prisma.favoriteLocation.deleteMany({})
  await prisma.product.deleteMany({})
  await prisma.businessHours.deleteMany({})
  await prisma.placeAttribute.deleteMany({})
  await prisma.placePhoto.deleteMany({})
  await prisma.userPreferenceInsight.deleteMany({})
  await prisma.pricingRule.deleteMany({})
  await prisma.driverEarning.deleteMany({})
  await prisma.taxiDriverEarning.deleteMany({})
  await prisma.deliveryEarning.deleteMany({})
  await prisma.moverEarning.deleteMany({})
  await prisma.driverDocument.deleteMany({})
  await prisma.taxiDriverDocument.deleteMany({})
  await prisma.vehicleDocument.deleteMany({})
  await prisma.driverServiceZone.deleteMany({})
  await prisma.taxiDriverServiceZone.deleteMany({})
  await prisma.driverRideType.deleteMany({})
  await prisma.anonymousUser.deleteMany({})
  await prisma.rolePermission.deleteMany({})
  await prisma.serviceType.deleteMany({})
  await prisma.placeCategory.deleteMany({})
  await prisma.subscriptionPlan.deleteMany({})
  await prisma.location.deleteMany({})
  await prisma.serviceZone.deleteMany({})

  console.log("🗑️ Cleared existing data.")

  // Initialize RBAC permissions
  const rbacService = new RBACService()
  await rbacService.initializeDefaultPermissions()
  console.log("✅ RBAC permissions initialized.")

  // Start seeding service types...
  console.log("Start seeding service types...")

  // Define all service types used in the application with all required fields
  const serviceTypes = [
    {
      name: "RIDE",
      displayName: "Private Ride",
      description: "Standard point-to-point transportation for a single party.",
      category: ServiceCategory.TRANSPORTATION,
      basePrice: 500, // Example: 5.00 USD
      pricePerKm: 100, // Example: 1.00 USD per km
      pricePerMinute: 10, // Example: 0.10 USD per minute
      commissionRate: 0.18,
      icon: "car",
      requiresVehicle: true,
      allowsScheduling: true,
      maxCapacity: 4,
    },
    {
      name: "SHARED_RIDE",
      displayName: "Shared Ride",
      description: "Ride service for multiple passengers sharing a route.",
      category: ServiceCategory.TRANSPORTATION,
      basePrice: 300, // Example: 3.00 USD (lower for shared)
      pricePerKm: 70, // Example: 0.70 USD per km
      pricePerMinute: 7, // Example: 0.07 USD per minute
      commissionRate: 0.15, // Slightly lower commission for shared rides
      icon: "car-side", // Or a specific shared ride icon
      requiresVehicle: true,
      allowsScheduling: true,
      maxCapacity: 2, // Max passengers for shared ride in one booking
    },
    {
      name: "TAXI",
      displayName: "Taxi",
      description: "Licensed taxi service, often with metered pricing and specific regulations.",
      category: ServiceCategory.TRANSPORTATION,
      basePrice: 600, // Slightly higher base price for taxis
      pricePerKm: 120, // Potentially higher per km rate
      pricePerMinute: 12, // Potentially higher per minute rate
      commissionRate: 0.15, // Lower commission for taxis as per previous explanation
      icon: "taxi",
      requiresVehicle: true,
      allowsScheduling: true,
      maxCapacity: 4,
    },
    {
      name: "DELIVERY",
      displayName: "Delivery",
      description: "General package and item delivery service.",
      category: ServiceCategory.DELIVERY,
      basePrice: 400,
      pricePerKm: 70,
      pricePerMinute: 0, // Not applicable for delivery
      commissionRate: 0.18,
      icon: "package",
      requiresVehicle: true,
      allowsScheduling: true,
      maxCapacity: 1,
    },
    {
      name: "EMERGENCY",
      displayName: "Emergency Response",
      description: "Immediate emergency assistance.",
      category: ServiceCategory.EMERGENCY,
      basePrice: 0, // Emergency might be free or billed differently
      pricePerKm: 0,
      pricePerMinute: 0,
      commissionRate: 0,
      icon: "alert-triangle",
      requiresVehicle: true,
      allowsScheduling: false,
      maxCapacity: 1,
    },
    {
      name: "DAY_BOOKING",
      displayName: "Day Booking",
      description: "Hire a driver for an extended period.",
      category: ServiceCategory.TRANSPORTATION,
      basePrice: 15000, // Example: 150.00 USD for a base day
      pricePerHour: 2000, // Example: 20.00 USD per hour
      pricePerKm: 0, // Not typically charged per km for day booking
      pricePerMinute: 0, // Not typically charged per minute for day booking
      commissionRate: 0.15,
      icon: "calendar",
      requiresVehicle: true,
      allowsScheduling: true,
      maxCapacity: 4,
    },
    // Add other service types if they exist in your schema
    // { name: "STORE_DELIVERY", displayName: "Store Delivery", ... },
    // { name: "PACKAGE_DELIVERY", displayName: "Package Delivery", ... },
    // { name: "FOOD_DELIVERY", displayName: "Food Delivery", ... },
    // { name: "HOUSE_MOVING", displayName: "House Moving", ... },
  ]

  // Upsert (create or update) each service type
  for (const serviceTypeData of serviceTypes) {
    await prisma.serviceType.upsert({
      where: { name: serviceTypeData.name },
      update: serviceTypeData,
      create: serviceTypeData,
    })
    console.log(`Upserted service type: ${serviceTypeData.name}`)
  }

  console.log("Service type seeding finished.")

  // Create foundational place categories
  const placeCategories = [
    { name: "Restaurant", description: "Places to eat and dine.", icon: "utensils" },
    { name: "Shopping", description: "Retail stores and shopping centers.", icon: "shopping-bag" },
    { name: "Healthcare", description: "Hospitals, clinics, and pharmacies.", icon: "heart" },
    { name: "Entertainment", description: "Venues for leisure and fun.", icon: "music" },
  ]

  for (const category of placeCategories) {
    await prisma.placeCategory.upsert({
      where: { name: category.name },
      update: category,
      create: category,
    })
  }
  console.log("✅ Foundational place categories created.")

  // Create foundational subscription plans
  const subscriptionPlans = [
    {
      name: "BASIC",
      displayName: "Basic Plan",
      description: "Standard features for all users.",
      tier: SubscriptionTier.BASIC,
      monthlyPrice: 0,
      yearlyPrice: 0,
      commissionRate: 0.18,
      features: ["Basic access"],
      isActive: true,
      sortOrder: 1,
    },
    {
      name: "PREMIUM",
      displayName: "Premium Plan",
      description: "Enhanced features with lower commission.",
      tier: SubscriptionTier.PREMIUM,
      monthlyPrice: 2000,
      yearlyPrice: 20000,
      commissionRate: 0.15,
      features: ["Priority support", "Reduced commission"],
      prioritySupport: true,
      isActive: true,
      sortOrder: 2,
    },
    {
      name: "ENTERPRISE",
      displayName: "Enterprise Plan",
      description: "Comprehensive features for businesses.",
      tier: SubscriptionTier.ENTERPRISE,
      monthlyPrice: 10000,
      yearlyPrice: 100000,
      commissionRate: 0.12,
      features: ["Advanced analytics", "Dedicated account manager"],
      prioritySupport: true,
      advancedAnalytics: true,
      isActive: true,
      sortOrder: 3,
    },
  ]

  for (const plan of subscriptionPlans) {
    await prisma.subscriptionPlan.upsert({
      where: { name: plan.name },
      update: plan,
      create: plan,
    })
  }
  console.log("✅ Foundational subscription plans created.")

  console.log("🎉 Database seeded with foundational data successfully!")
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

  