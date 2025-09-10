"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PricingService = void 0;
const database_1 = __importDefault(require("../config/database"));
const location_service_1 = require("./location.service");
const logger_1 = __importDefault(require("../utils/logger"));
class PricingService {
    constructor() {
        this.locationService = new location_service_1.LocationService();
        this.config = {
            rideTypeMultipliers: {
                ECONOMY: 1.0,
                COMFORT: 1.15,
                PREMIUM: 1.3,
                SUV: 1.2,
                SHARED: 0.8,
                TAXI: 1.1,
            },
            deliveryTypeMultipliers: {
                PACKAGE: 1.0,
                FOOD: 1.1,
                GROCERY: 1.05,
                PHARMACY: 1.15,
                DOCUMENTS: 0.9,
            },
            surgeFactors: {
                rushHour: 1.2,
                lateNight: 1.25,
                weekend: 1.1,
                highDemand: 1.3,
                maxSurge: 1.5,
                minDriversForSurge: 3,
                baseSurgeWhenNoSupply: 1.1,
            },
            timeMultipliers: {
                weekend: 1.1,
                peakHours: 1.15,
                lateNight: 1.2,
                maxMultiplier: 1.4,
            },
            searchRadius: {
                ride: 15000,
                delivery: 15000,
            },
            minimumFare: 5,
            demandTimeWindow: 30,
            stabilityConfig: {
                minDemandForSurge: 2,
                demandThresholds: {
                    low: 1.5,
                    medium: 2.5,
                    high: 4.0,
                },
                surgeFactors: {
                    low: 1.1,
                    medium: 1.2,
                    high: 1.3,
                },
            },
            sharedRideConfig: {
                maxPassengers: 4,
                discountFactorPerPassenger: 0.1,
                minPassengersForDiscount: 2,
            },
        };
    }
    /**
     * Enhanced surge pricing with stability logic
     */
    async calculateSurgePricing(latitude, longitude, scheduledAt) {
        try {
            const currentTime = scheduledAt || new Date();
            console.log(`⚡ SURGE CALCULATION START`);
            console.log(`📍 Location: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
            console.log(`🕐 Time: ${currentTime.toLocaleString()}`);
            // Get supply and demand
            const [demandCount, supplyCount] = await Promise.all([
                this.getAreaDemand(latitude, longitude, currentTime),
                this.getAreaSupply(latitude, longitude),
            ]);
            console.log(`📊 Area Stats:`);
            console.log(`   - Demand (pending bookings): ${demandCount}`);
            console.log(`   - Supply (available drivers): ${supplyCount}`);
            // NEW: Handle no supply scenario with fixed surge
            if (supplyCount === 0) {
                const noSupplySurge = this.config.surgeFactors.baseSurgeWhenNoSupply;
                console.log(`🚨 No Supply Available! Fixed Surge: ${noSupplySurge}x`);
                console.log(`⚡ SURGE CALCULATION END\n`);
                return noSupplySurge;
            }
            // NEW: Only apply time-based surge if we have minimum drivers
            let surgeMultiplier = 1.0;
            if (supplyCount >= this.config.surgeFactors.minDriversForSurge) {
                surgeMultiplier = this.calculateTimeBasedSurge(currentTime);
                console.log(`🕐 Time-based Surge (${supplyCount} drivers available): ${surgeMultiplier.toFixed(2)}x`);
            }
            else {
                console.log(`⏸️  Insufficient drivers (${supplyCount} < ${this.config.surgeFactors.minDriversForSurge}) - No time surge`);
            }
            // NEW: Enhanced demand-based surge logic
            const demandSurge = this.calculateDemandBasedSurge(demandCount, supplyCount);
            if (demandSurge > 1.0) {
                surgeMultiplier *= demandSurge;
                console.log(`📈 Demand Surge: ${demandSurge.toFixed(2)}x → Total: ${surgeMultiplier.toFixed(2)}x`);
            }
            else {
                console.log(`✅ No Demand Surge Applied`);
            }
            // Cap surge at maximum
            const finalSurge = Math.min(surgeMultiplier, this.config.surgeFactors.maxSurge);
            if (finalSurge !== surgeMultiplier) {
                console.log(`🔒 Capped at Maximum Surge: ${this.config.surgeFactors.maxSurge}x`);
            }
            console.log(`✅ Final Surge Multiplier: ${finalSurge.toFixed(2)}x`);
            console.log(`⚡ SURGE CALCULATION END\n`);
            return finalSurge;
        }
        catch (error) {
            logger_1.default.error("Calculate surge pricing error:", error);
            console.log(`❌ Surge calculation failed, using base: 1.0x`);
            return 1.0;
        }
    }
    /**
     * NEW: Calculate demand-based surge with thresholds
     */
    calculateDemandBasedSurge(demandCount, supplyCount) {
        const { minDemandForSurge, demandThresholds, surgeFactors } = this.config.stabilityConfig;
        // No surge if demand is too low
        if (demandCount < minDemandForSurge) {
            console.log(`📊 Demand too low (${demandCount} < ${minDemandForSurge}) - No demand surge`);
            return 1.0;
        }
        const demandSupplyRatio = supplyCount > 0 ? demandCount / supplyCount : 999; // Avoid division by zero
        console.log(`📊 Demand/Supply Ratio: ${demandSupplyRatio.toFixed(2)}`);
        if (demandSupplyRatio >= demandThresholds.high) {
            console.log(`🔥 High Demand Threshold (≥${demandThresholds.high})`);
            return surgeFactors.high;
        }
        else if (demandSupplyRatio >= demandThresholds.medium) {
            console.log(`📈 Medium Demand Threshold (≥${demandThresholds.medium})`);
            return surgeFactors.medium;
        }
        else if (demandSupplyRatio >= demandThresholds.low) {
            console.log(`📊 Low Demand Threshold (≥${demandThresholds.low})`);
            return surgeFactors.low;
        }
        return 1.0;
    }
    /**
     * Enhanced time-based surge with conservative multipliers
     */
    calculateTimeBasedSurge(dateTime) {
        const hour = dateTime.getHours();
        const dayOfWeek = dateTime.getDay();
        let multiplier = 1.0;
        console.log(`🕐 TIME-BASED SURGE BREAKDOWN:`);
        console.log(`   - Base: ${multiplier}x`);
        // NEW: More conservative approach - only apply one primary time factor
        let primaryFactor = 1.0;
        let factorName = "None";
        if (this.isRushHour(hour)) {
            primaryFactor = this.config.surgeFactors.rushHour;
            factorName = `Rush Hour (${hour}:00)`;
        }
        else if (this.isLateNight(hour)) {
            primaryFactor = this.config.surgeFactors.lateNight;
            factorName = `Late Night (${hour}:00)`;
        }
        multiplier *= primaryFactor;
        console.log(`   - ${factorName}: ${primaryFactor}x → ${multiplier.toFixed(2)}x`);
        // Weekend gets smaller additional multiplier
        if (this.isWeekend(dayOfWeek) && primaryFactor === 1.0) {
            // Only apply if no other primary factor
            const weekendFactor = this.config.surgeFactors.weekend;
            multiplier *= weekendFactor;
            const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek];
            console.log(`   - Weekend (${dayName}): ${weekendFactor}x → ${multiplier.toFixed(2)}x`);
        }
        return multiplier;
    }
    /**
     * NEW: Get realistic area demand with better filtering
     */
    async getAreaDemand(latitude, longitude, currentTime) {
        try {
            const timeWindow = new Date(currentTime.getTime() - this.config.demandTimeWindow * 60 * 1000);
            const pendingBookings = await database_1.default.booking.findMany({
                where: {
                    status: { in: ["PENDING", "DRIVER_ASSIGNED"] },
                    pickupLatitude: { not: null },
                    pickupLongitude: { not: null },
                    createdAt: { gte: timeWindow },
                    serviceType: { name: "RIDE" },
                },
                select: {
                    pickupLatitude: true,
                    pickupLongitude: true,
                    createdAt: true,
                },
            });
            const nearbyBookings = pendingBookings.filter((booking) => {
                if (!booking.pickupLatitude || !booking.pickupLongitude)
                    return false;
                const distance = this.locationService.calculateDistance(latitude, longitude, booking.pickupLatitude, booking.pickupLongitude);
                return distance <= this.config.searchRadius.ride;
            });
            console.log(`📊 Demand Analysis:`);
            console.log(`   - Total pending bookings: ${pendingBookings.length}`);
            console.log(`   - Nearby bookings (${this.config.searchRadius.ride / 1000}km): ${nearbyBookings.length}`);
            return nearbyBookings.length;
        }
        catch (error) {
            logger_1.default.error("Get area demand error:", error);
            return 0;
        }
    }
    /**
     * Enhanced area supply with better availability checks
     */
    async getAreaSupply(latitude, longitude) {
        try {
            const availableDrivers = await database_1.default.driverProfile.findMany({
                where: {
                    isAvailable: true,
                    isOnline: true,
                    currentLatitude: { not: null },
                    currentLongitude: { not: null },
                    user: {
                        isActive: true,
                    },
                },
                select: {
                    currentLatitude: true,
                    currentLongitude: true,
                    updatedAt: true,
                },
            });
            // NEW: Filter out drivers with stale location data (older than 10 minutes)
            const staleThreshold = new Date(Date.now() - 10 * 60 * 1000);
            const activeDrivers = availableDrivers.filter((driver) => {
                return driver.updatedAt && driver.updatedAt > staleThreshold; // Added null check
            });
            const nearbyDrivers = activeDrivers.filter((driver) => {
                if (!driver.currentLatitude || !driver.currentLongitude)
                    return false;
                const distance = this.locationService.calculateDistance(latitude, longitude, driver.currentLatitude, driver.currentLongitude);
                return distance <= this.config.searchRadius.ride;
            });
            console.log(`📊 Supply Analysis:`);
            console.log(`   - Total available drivers: ${availableDrivers.length}`);
            console.log(`   - Active drivers (recent location): ${activeDrivers.length}`);
            console.log(`   - Nearby drivers (${this.config.searchRadius.ride / 1000}km): ${nearbyDrivers.length}`);
            return nearbyDrivers.length;
        }
        catch (error) {
            logger_1.default.error("Get area supply error:", error);
            return 0;
        }
    }
    /**
     * NEW: Price stability validation
     */
    validatePriceStability(estimatedPrice, expectedRange) {
        return estimatedPrice >= expectedRange.min && estimatedPrice <= expectedRange.max;
    }
    /**
     * Enhanced calculate ride estimate with stability checks and shared ride logic
     */
    async calculateRideEstimate(params) {
        try {
            const { pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude, rideType = "ECONOMY", scheduledAt, isSharedRide = false, sharedRideGroupDetails, } = params;
            // Validate inputs
            this.validateCoordinates(pickupLatitude, pickupLongitude);
            this.validateCoordinates(dropoffLatitude, dropoffLongitude);
            this.validateRideType(rideType);
            // Get service type
            const serviceType = await database_1.default.serviceType.findFirst({
                where: { name: "RIDE" },
            });
            if (!serviceType) {
                throw new Error("Ride service type not found");
            }
            // Calculate distance and duration
            const { distance, duration } = await this.locationService.getEstimatedTravelTime(pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude);
            // UPDATED: New Ghana-friendly rates
            const basePrice = serviceType.basePrice || 3;
            const pricePerKm = serviceType.pricePerKm || 0.5;
            const pricePerMinute = serviceType.pricePerMinute || 0.4;
            console.log(`🚗 RIDE CALCULATION START`);
            console.log(`📍 Distance: ${(distance / 1000).toFixed(2)}km`);
            console.log(`⏱️  Duration: ${duration.toFixed(1)} minutes`);
            console.log(`🏷️  Ride Type: ${rideType}`);
            console.log(`💰 Updated Rates:`);
            console.log(`   - Base Price: GH₵${basePrice}`);
            console.log(`   - Price per KM: GH₵${pricePerKm}`);
            console.log(`   - Price per Minute: GH₵${pricePerMinute}`);
            console.log(`🤝 Is Shared Ride: ${isSharedRide}`);
            // Apply ride type multiplier
            const multiplier = this.config.rideTypeMultipliers[rideType];
            console.log(`🔢 Ride Type Multiplier (${rideType}): ${multiplier}x`);
            // Calculate enhanced surge pricing
            const surgePricing = await this.calculateSurgePricing(pickupLatitude, pickupLongitude, scheduledAt);
            // Calculate subtotal before surge
            const distancePrice = (distance / 1000) * pricePerKm;
            const timePrice = duration * pricePerMinute;
            const beforeMultiplier = basePrice + distancePrice + timePrice;
            const subtotal = beforeMultiplier * multiplier;
            console.log(`💵 Price Breakdown (Individual Ride Base):`);
            console.log(`   - Distance Cost: ${(distance / 1000).toFixed(2)}km × GH₵${pricePerKm} = GH₵${distancePrice.toFixed(2)}`);
            console.log(`   - Time Cost: ${duration.toFixed(1)}min × GH₵${pricePerMinute} = GH₵${timePrice.toFixed(2)}`);
            console.log(`   - Subtotal Before Multiplier: GH₵${beforeMultiplier.toFixed(2)}`);
            console.log(`   - After Ride Type (${multiplier}x): GH₵${subtotal.toFixed(2)}`);
            console.log(`   - Surge Multiplier: ${surgePricing.toFixed(2)}x`);
            let estimatedPrice = this.applyMinimumFare(Math.round(subtotal * surgePricing));
            let totalSharedRidePriceForGroup = undefined;
            let isFirstSharedRideBooking = false;
            // NEW: Shared Ride Logic
            if (isSharedRide) {
                if (sharedRideGroupDetails) {
                    // Joining an existing shared ride
                    const newTotalPassengers = sharedRideGroupDetails.currentGroupPassengers + 1;
                    const perPassengerCost = this.calculatePerPassengerSharedRidePrice(sharedRideGroupDetails.totalGroupPrice, newTotalPassengers);
                    estimatedPrice = perPassengerCost;
                    console.log(`👥 Joining Shared Ride:`);
                    console.log(`   - Group Total Price: GH₵${sharedRideGroupDetails.totalGroupPrice.toFixed(2)}`);
                    console.log(`   - Current Passengers: ${sharedRideGroupDetails.currentGroupPassengers}`);
                    console.log(`   - New Total Passengers: ${newTotalPassengers}`);
                    console.log(`   - Per Passenger Cost: GH₵${perPassengerCost.toFixed(2)}`);
                }
                else {
                    // First booking for a new shared ride group
                    totalSharedRidePriceForGroup = estimatedPrice; // This is the total for the group initially
                    isFirstSharedRideBooking = true;
                    console.log(`👥 Starting New Shared Ride:`);
                    console.log(`   - Initial Group Total Price: GH₵${totalSharedRidePriceForGroup.toFixed(2)}`);
                }
            }
            console.log(`   - After Surge: GH₵${(subtotal * surgePricing).toFixed(2)}`);
            console.log(`   - Final Price (min GH₵${this.config.minimumFare}): GH₵${estimatedPrice}`);
            // NEW: Price stability validation
            const expectedRange = { min: 15, max: 25 }; // Expected range for your route
            const isStable = this.validatePriceStability(estimatedPrice, expectedRange);
            console.log(`🎯 Price Stability: ${isStable ? "✅ STABLE" : "⚠️  UNSTABLE"} (${expectedRange.min}-${expectedRange.max} range)`);
            console.log(`🚗 RIDE CALCULATION END\n`);
            // Get available providers count
            const availableProviders = await this.getAvailableProvidersCount(pickupLatitude, pickupLongitude);
            // Calculate breakdown with consistent rounding
            const baseWithMultiplier = basePrice * multiplier;
            const distanceWithMultiplier = distancePrice * multiplier;
            const timeWithMultiplier = timePrice * multiplier;
            const surgeAmount = subtotal * (surgePricing - 1);
            return {
                estimatedPrice,
                estimatedDuration: duration,
                estimatedDistance: distance,
                surgePricing,
                availableProviders,
                breakdown: {
                    basePrice: Math.round(baseWithMultiplier),
                    distancePrice: Math.round(distanceWithMultiplier),
                    timePrice: Math.round(timeWithMultiplier),
                    surgeAmount: Math.round(surgeAmount),
                    serviceFee: 0,
                },
                stabilityMetrics: {
                    isStable,
                    expectedRange,
                    supplyCount: availableProviders,
                },
                // NEW: Shared ride specific return values
                isFirstSharedRideBooking,
                totalSharedRidePriceForGroup,
            };
        }
        catch (error) {
            logger_1.default.error("Calculate ride estimate error:", error);
            throw error;
        }
    }
    /**
     * NEW: Calculate per-passenger price for a shared ride group.
     * This method is intended to be called by a service (e.g., BookingService)
     * when a new passenger joins an existing shared ride group.
     */
    calculatePerPassengerSharedRidePrice(totalGroupPrice, newPassengerCount) {
        if (newPassengerCount <= 0) {
            throw new Error("Passenger count must be greater than zero for shared ride pricing.");
        }
        if (newPassengerCount > this.config.sharedRideConfig.maxPassengers) {
            logger_1.default.warn(`Shared ride passenger count exceeds max (${newPassengerCount} > ${this.config.sharedRideConfig.maxPassengers}). Capping discount.`);
            newPassengerCount = this.config.sharedRideConfig.maxPassengers; // Cap for discount calculation
        }
        let discountedPrice = totalGroupPrice;
        if (newPassengerCount >= this.config.sharedRideConfig.minPassengersForDiscount) {
            // Apply discount for each additional passenger beyond the first
            const additionalPassengers = newPassengerCount - 1;
            const totalDiscountFactor = additionalPassengers * this.config.sharedRideConfig.discountFactorPerPassenger;
            // Ensure discount doesn't make price too low (e.g., max 50% discount)
            const maxDiscount = 0.5; // Max 50% discount on total group price
            const effectiveDiscountFactor = Math.min(totalDiscountFactor, maxDiscount);
            discountedPrice = totalGroupPrice * (1 - effectiveDiscountFactor);
            console.log(`👥 Shared Ride Discount: ${additionalPassengers} additional passengers, total discount factor ${effectiveDiscountFactor.toFixed(2)}`);
        }
        const perPassengerPrice = discountedPrice / newPassengerCount;
        console.log(`👥 Recalculating Shared Ride Price: Total Group GH₵${totalGroupPrice.toFixed(2)}, New Passengers ${newPassengerCount} -> Per Passenger GH₵${perPassengerPrice.toFixed(2)}`);
        return Math.round(perPassengerPrice);
    }
    /**
     * Validate coordinates
     */
    validateCoordinates(latitude, longitude) {
        if (latitude < -90 || latitude > 90) {
            throw new Error(`Invalid latitude: ${latitude}. Must be between -90 and 90`);
        }
        if (longitude < -180 || longitude > 180) {
            throw new Error(`Invalid longitude: ${longitude}. Must be between -180 and 180`);
        }
    }
    /**
     * Validate ride type
     */
    validateRideType(rideType) {
        if (!this.config.rideTypeMultipliers[rideType]) {
            throw new Error(`Invalid ride type: ${rideType}`);
        }
    }
    /**
     * Validate delivery type
     */
    validateDeliveryType(deliveryType) {
        if (!this.config.deliveryTypeMultipliers[deliveryType]) {
            throw new Error(`Invalid delivery type: ${deliveryType}`);
        }
    }
    /**
     * Check if time is rush hour
     */
    isRushHour(hour) {
        return (hour >= 7 && hour <= 9) || (hour >= 17 && hour <= 19);
    }
    /**
     * Check if time is late night
     */
    isLateNight(hour) {
        return hour >= 22 || hour <= 6;
    }
    /**
     * Check if day is weekend
     */
    isWeekend(dayOfWeek) {
        return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
    }
    /**
     * Apply minimum fare
     */
    applyMinimumFare(price) {
        return Math.max(price, this.config.minimumFare);
    }
    /**
     * Enhanced calculate day booking price with stability
     */
    async calculateDayBookingPrice(params) {
        try {
            const { duration, scheduledAt, driverId } = params;
            // Validate inputs
            if (duration <= 0) {
                throw new Error("Duration must be greater than 0");
            }
            if (duration > 24) {
                throw new Error("Duration cannot exceed 24 hours");
            }
            let hourlyRate = 12; // REDUCED: GH₵12/hour for stability
            console.log(`🚐 DAY BOOKING CALCULATION START`);
            console.log(`⏳ Duration: ${duration} hours`);
            console.log(`📅 Scheduled: ${scheduledAt.toLocaleString()}`);
            if (driverId) {
                const driverProfile = await database_1.default.driverProfile.findFirst({
                    where: { userId: driverId },
                    include: { dayBookingConfig: true },
                });
                if (driverProfile?.dayBookingConfig) {
                    hourlyRate = Math.min(driverProfile.dayBookingConfig.hourlyRate, 20); // Cap at GH₵20
                    console.log(`👤 Driver Custom Rate (capped): GH₵${hourlyRate}/hour`);
                }
                else if (driverProfile?.dayBookingPrice) {
                    hourlyRate = Math.min(driverProfile.dayBookingPrice, 20); // Cap at GH₵20
                    console.log(`👤 Driver Legacy Rate (capped): GH₵${hourlyRate}/hour`);
                }
            }
            else {
                console.log(`🏷️  Default Rate: GH₵${hourlyRate}/hour`);
            }
            // Calculate time-based multiplier using enhanced approach
            const timeMultiplier = this.calculateTimeBasedMultiplier(scheduledAt);
            const baseAmount = hourlyRate * duration;
            console.log(`💰 Base Amount: ${duration}h × GH₵${hourlyRate} = GH₵${baseAmount}`);
            console.log(`🔢 Time Multiplier: ${timeMultiplier.toFixed(2)}x`);
            const beforeMinimum = baseAmount * timeMultiplier;
            const totalPrice = this.applyMinimumFare(Math.round(beforeMinimum));
            console.log(`💵 After Time Multiplier: GH₵${beforeMinimum.toFixed(2)}`);
            console.log(`💵 Final Price (min GH₵${this.config.minimumFare}): GH₵${totalPrice}`);
            // NEW: Day booking stability validation
            const expectedHourlyRange = { min: 10, max: 25 };
            const actualHourlyRate = totalPrice / duration;
            const isStable = actualHourlyRate >= expectedHourlyRange.min && actualHourlyRate <= expectedHourlyRange.max;
            console.log(`🎯 Hourly Rate Stability: ${isStable ? "✅ STABLE" : "⚠️  UNSTABLE"} (GH₵${actualHourlyRate.toFixed(2)}/hour)`);
            console.log(`🚐 DAY BOOKING CALCULATION END\n`);
            // Calculate individual premiums for breakdown
            const hour = scheduledAt.getHours();
            const dayOfWeek = scheduledAt.getDay();
            const weekendMultiplier = this.isWeekend(dayOfWeek) ? this.config.timeMultipliers.weekend : 1.0;
            const peakHoursMultiplier = this.isRushHour(hour) ? this.config.timeMultipliers.peakHours : 1.0;
            const lateNightMultiplier = this.isLateNight(hour) ? this.config.timeMultipliers.lateNight : 1.0;
            return {
                totalPrice,
                breakdown: {
                    hourlyRate,
                    duration,
                    baseAmount,
                    timeMultiplier,
                    weekendPremium: this.isWeekend(dayOfWeek) ? Math.round(baseAmount * (weekendMultiplier - 1)) : 0,
                    peakHoursPremium: this.isRushHour(hour) ? Math.round(baseAmount * (peakHoursMultiplier - 1)) : 0,
                    lateNightPremium: this.isLateNight(hour) ? Math.round(baseAmount * (lateNightMultiplier - 1)) : 0,
                },
                stabilityMetrics: {
                    isStable,
                    actualHourlyRate: Math.round(actualHourlyRate),
                    expectedRange: expectedHourlyRange,
                },
            };
        }
        catch (error) {
            logger_1.default.error("Calculate day booking price error:", error);
            throw error;
        }
    }
    /**
     * Enhanced time-based multiplier calculation with caps
     */
    calculateTimeBasedMultiplier(scheduledAt) {
        const hour = scheduledAt.getHours();
        const dayOfWeek = scheduledAt.getDay();
        let multiplier = 1.0;
        // Apply conservative multipliers with individual caps
        if (this.isWeekend(dayOfWeek)) {
            multiplier *= Math.min(this.config.timeMultipliers.weekend, 1.15); // Cap weekend at 1.15x
        }
        if (this.isRushHour(hour)) {
            multiplier *= Math.min(this.config.timeMultipliers.peakHours, 1.2); // Cap peak at 1.2x
        }
        if (this.isLateNight(hour)) {
            multiplier *= Math.min(this.config.timeMultipliers.lateNight, 1.25); // Cap late night at 1.25x
        }
        // Cap the total multiplier more conservatively
        return Math.min(multiplier, 1.35);
    }
    /**
     * Enhanced delivery estimate calculation
     */
    async calculateDeliveryEstimate(params) {
        try {
            const { pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude, deliveryType = "PACKAGE" } = params;
            // Validate inputs
            this.validateCoordinates(pickupLatitude, pickupLongitude);
            this.validateCoordinates(dropoffLatitude, dropoffLongitude);
            this.validateDeliveryType(deliveryType);
            // Get service type - use DELIVERY service type from database
            const serviceType = await database_1.default.serviceType.findFirst({
                where: { name: "DELIVERY" },
            });
            if (!serviceType) {
                throw new Error("Delivery service type not found");
            }
            // Calculate distance and duration
            const { distance, duration } = await this.locationService.getEstimatedTravelTime(pickupLatitude, pickupLongitude, dropoffLatitude, dropoffLongitude);
            // Apply delivery type multiplier
            const multiplier = this.config.deliveryTypeMultipliers[deliveryType];
            // UPDATED: Reasonable delivery pricing for store pickup
            const basePrice = (serviceType.basePrice || 2) * multiplier;
            // Use lower per-km rate for store delivery (more reasonable than general delivery)
            const distancePrice = (distance / 1000) * 0.5; // GH₵0.50 per km for store delivery
            const subtotal = basePrice + distancePrice;
            const estimatedPrice = this.applyMinimumFare(Math.round(subtotal));
            console.log(`📦 DELIVERY CALCULATION START`);
            console.log(`📍 Distance: ${(distance / 1000).toFixed(2)}km`);
            console.log(`⏱️  Duration: ${duration.toFixed(1)} minutes`);
            console.log(`📋 Delivery Type: ${deliveryType}`);
            console.log(`🔢 Type Multiplier: ${multiplier}x`);
            console.log(`💰 Base Price: GH₵${serviceType.basePrice || 2} × ${multiplier} = GH₵${basePrice.toFixed(2)}`);
            console.log(`📏 Distance Cost: ${(distance / 1000).toFixed(2)}km × GH₵0.50 = GH₵${distancePrice.toFixed(2)}`);
            console.log(`💵 Subtotal: GH₵${subtotal.toFixed(2)}`);
            console.log(`💵 Final Price (min GH₵${this.config.minimumFare}): GH₵${estimatedPrice}`);
            // NEW: Delivery price stability check
            const expectedDeliveryRange = { min: 5, max: 15 };
            const isStable = this.validatePriceStability(estimatedPrice, expectedDeliveryRange);
            console.log(`🎯 Delivery Stability: ${isStable ? "✅ STABLE" : "⚠️  UNSTABLE"} (${expectedDeliveryRange.min}-${expectedDeliveryRange.max} range)`);
            console.log(`📦 DELIVERY CALCULATION END\n`);
            // Get available providers count
            const availableProviders = await this.getAvailableDeliveryProvidersCount(pickupLatitude, pickupLongitude);
            return {
                estimatedPrice,
                estimatedDuration: duration,
                estimatedDistance: distance, // Ensure this is explicitly returned
                surgePricing: 1.0,
                availableProviders,
                breakdown: {
                    basePrice: Math.round(basePrice),
                    distancePrice: Math.round(distancePrice),
                    timePrice: 0,
                    surgeAmount: 0,
                    serviceFee: 0,
                },
                stabilityMetrics: {
                    isStable,
                    expectedRange: expectedDeliveryRange,
                    providerCount: availableProviders,
                },
            };
        }
        catch (error) {
            logger_1.default.error("Calculate delivery estimate error:", error);
            throw error;
        }
    }
    /**
     * Get available providers count with enhanced filtering
     */
    async getAvailableProvidersCount(latitude, longitude) {
        return this.getAreaSupply(latitude, longitude);
    }
    /**
     * Enhanced delivery providers count with staleness check
     */
    async getAvailableDeliveryProvidersCount(latitude, longitude) {
        try {
            const staleThreshold = new Date(Date.now() - 10 * 60 * 1000); // 10 minutes
            const availableProviders = await database_1.default.deliveryProfile.findMany({
                where: {
                    isAvailable: true,
                    isOnline: true,
                    currentLatitude: { not: null },
                    currentLongitude: { not: null },
                    updatedAt: { gte: staleThreshold }, // NEW: Filter stale locations
                    user: {
                        isActive: true,
                    },
                },
                select: {
                    currentLatitude: true,
                    currentLongitude: true,
                    updatedAt: true,
                },
            });
            const nearbyProviders = availableProviders.filter((provider) => {
                if (!provider.currentLatitude || !provider.currentLongitude)
                    return false;
                const distance = this.locationService.calculateDistance(latitude, longitude, provider.currentLatitude, provider.currentLongitude);
                return distance <= this.config.searchRadius.delivery;
            });
            console.log(`📦 Delivery Supply Analysis:`);
            console.log(`   - Available providers: ${availableProviders.length}`);
            console.log(`   - Nearby providers (${this.config.searchRadius.delivery / 1000}km): ${nearbyProviders.length}`);
            return nearbyProviders.length;
        }
        catch (error) {
            logger_1.default.error("Get available delivery providers count error:", error);
            return 0;
        }
    }
    /**
     * Enhanced final trip price calculation with actual distance
     */
    async calculateFinalTripPrice(bookingId, actualDistance) {
        try {
            const booking = await database_1.default.booking.findUnique({
                where: { id: bookingId },
                include: {
                    serviceType: true,
                },
            });
            if (!booking) {
                throw new Error("Booking not found");
            }
            const serviceType = booking.serviceType;
            let finalPrice = serviceType.basePrice || 3;
            console.log(`💰 FINAL TRIP PRICE CALCULATION START`);
            console.log(`📋 Booking ID: ${bookingId}`);
            console.log(`🎯 Service Type: ${serviceType.name}`);
            // Use actual distance if provided, otherwise use estimated
            const distance = actualDistance || booking.estimatedDistance || 0;
            console.log(`📏 Distance: ${actualDistance ? "Actual" : "Estimated"} ${(distance / 1000).toFixed(2)}km`);
            if (distance > 0 && serviceType.pricePerKm) {
                const distancePrice = (distance / 1000) * serviceType.pricePerKm;
                finalPrice += distancePrice;
                console.log(`📏 Distance Cost: ${(distance / 1000).toFixed(2)}km × GH₵${serviceType.pricePerKm} = GH₵${distancePrice.toFixed(2)}`);
            }
            // Add time cost if available
            if (booking.estimatedDuration && serviceType.pricePerMinute) {
                const timePrice = (booking.estimatedDuration / 60) * serviceType.pricePerMinute; // Convert to minutes
                finalPrice += timePrice;
                console.log(`⏱️  Time Cost: ${(booking.estimatedDuration / 60).toFixed(1)}min × GH₵${serviceType.pricePerMinute} = GH₵${timePrice.toFixed(2)}`);
            }
            console.log(`💵 Subtotal: GH₵${finalPrice.toFixed(2)}`);
            // Apply surge pricing with stability cap
            if (booking.surgePricing && booking.surgePricing > 1) {
                const cappedSurge = Math.min(booking.surgePricing, 1.5); // Cap surge for final pricing
                finalPrice *= cappedSurge;
                console.log(`⚡ Surge: ${booking.surgePricing.toFixed(2)}x (capped at ${cappedSurge.toFixed(2)}x) = GH₵${finalPrice.toFixed(2)}`);
            }
            // Apply minimum fare
            const beforeMinimum = finalPrice;
            finalPrice = this.applyMinimumFare(finalPrice);
            if (finalPrice !== beforeMinimum) {
                console.log(`🔒 Minimum Fare Applied: GH₵${beforeMinimum.toFixed(2)} → GH₵${finalPrice}`);
            }
            const roundedPrice = Math.round(finalPrice);
            console.log(`✅ Final Trip Price: GH₵${roundedPrice}`);
            console.log(`💰 FINAL TRIP PRICE CALCULATION END\n`);
            return roundedPrice;
        }
        catch (error) {
            logger_1.default.error("Calculate final trip price error:", error);
            throw error;
        }
    }
    /**
     * Enhanced pricing configuration update with validation
     */
    async updatePricingConfig(newConfig) {
        // NEW: Validate configuration before applying
        if (newConfig.surgeFactors?.maxSurge && newConfig.surgeFactors.maxSurge > 2.0) {
            throw new Error("Maximum surge factor cannot exceed 2.0x for price stability");
        }
        if (newConfig.minimumFare && newConfig.minimumFare < 3) {
            throw new Error("Minimum fare cannot be less than GH₵3");
        }
        // Apply conservative defaults for critical values
        const safeConfig = {
            ...newConfig,
            surgeFactors: {
                ...this.config.surgeFactors,
                ...newConfig.surgeFactors,
                maxSurge: Math.min(newConfig.surgeFactors?.maxSurge || this.config.surgeFactors.maxSurge, 1.5),
            },
        };
        this.config = { ...this.config, ...safeConfig };
        logger_1.default.info("Pricing configuration updated with safety constraints", { config: this.config });
    }
    /**
     * Get current pricing configuration
     */
    getPricingConfig() {
        return { ...this.config };
    }
    /**
     * NEW: Get pricing health metrics for monitoring
     */
    async getPricingHealthMetrics(area) {
        try {
            let supply = 0;
            let demand = 0;
            const recommendations = [];
            if (area) {
                supply = await this.getAreaSupply(area.latitude, area.longitude);
                demand = await this.getAreaDemand(area.latitude, area.longitude, new Date());
            }
            else {
                // Global metrics
                const [totalDrivers, totalDemand] = await Promise.all([
                    database_1.default.driverProfile.count({ where: { isAvailable: true, isOnline: true } }),
                    database_1.default.booking.count({
                        where: {
                            status: { in: ["PENDING", "DRIVER_ASSIGNED"] },
                            createdAt: { gte: new Date(Date.now() - 30 * 60 * 1000) }, // Last 30 minutes
                        },
                    }),
                ]);
                supply = totalDrivers;
                demand = totalDemand;
            }
            // Calculate average surge
            const surgePricing = await this.calculateSurgePricing(area?.latitude || 5.6037, // Default to Kumasi
            area?.longitude || -0.187);
            // Determine stability
            const supplyDemandRatio = supply > 0 ? demand / supply : 999;
            const priceStability = supplyDemandRatio <= 2 && surgePricing <= 1.3 ? "STABLE" : "UNSTABLE";
            // Generate recommendations
            if (supply < 5) {
                recommendations.push("Low driver availability - consider driver incentives");
            }
            if (supplyDemandRatio > 3) {
                recommendations.push("High demand detected - monitor surge pricing");
            }
            if (surgePricing > 1.4) {
                recommendations.push("High surge pricing - review demand management");
            }
            if (supply === 0) {
                recommendations.push("No available drivers - urgent action required");
            }
            return {
                supply,
                demand,
                averageSurge: Math.round(surgePricing * 100) / 100,
                priceStability,
                recommendations,
            };
        }
        catch (error) {
            logger_1.default.error("Get pricing health metrics error:", error);
            return {
                supply: 0,
                demand: 0,
                averageSurge: 1.0,
                priceStability: "UNSTABLE",
                recommendations: ["Error calculating metrics - check system health"],
            };
        }
    }
    /**
     * NEW: Simulate pricing for testing
     */
    async simulatePricing(params) {
        const originalGetAreaSupply = this.getAreaSupply;
        const originalGetAreaDemand = this.getAreaDemand;
        try {
            // Override supply/demand for simulation
            if (params.simulatedSupply !== undefined) {
                this.getAreaSupply = async () => params.simulatedSupply;
            }
            if (params.simulatedDemand !== undefined) {
                this.getAreaDemand = async () => params.simulatedDemand;
            }
            console.log(`🧪 SIMULATION MODE:`);
            console.log(`   - Simulated Supply: ${params.simulatedSupply ?? "actual"}`);
            console.log(`   - Simulated Demand: ${params.simulatedDemand ?? "actual"}`);
            // Calculate estimate with simulated values
            const result = await this.calculateRideEstimate({
                pickupLatitude: params.pickupLatitude,
                pickupLongitude: params.pickupLongitude,
                dropoffLatitude: params.dropoffLatitude,
                dropoffLongitude: params.dropoffLongitude,
                rideType: params.rideType,
            });
            return {
                ...result,
                isSimulation: true,
                simulatedValues: {
                    supply: params.simulatedSupply,
                    demand: params.simulatedDemand,
                },
            };
        }
        finally {
            // Restore original methods
            this.getAreaSupply = originalGetAreaSupply;
            this.getAreaDemand = originalGetAreaDemand;
        }
    }
}
exports.PricingService = PricingService;
