"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RBACService = void 0;
const database_1 = __importDefault(require("../config/database"));
const logger_1 = __importDefault(require("../utils/logger"));
class RBACService {
    constructor() {
        this.permissionCache = new Map();
        this.cacheExpiry = new Map();
        this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
    }
    async getUserPermissions(role) {
        try {
            // Check cache first
            const cached = this.permissionCache.get(role);
            const expiry = this.cacheExpiry.get(role);
            if (cached && expiry && Date.now() < expiry) {
                return cached;
            }
            // Get permissions based on role (hardcoded for now since RolePermission table might not exist)
            const permissions = this.getPermissionsByRole(role);
            // Update cache
            this.permissionCache.set(role, permissions);
            this.cacheExpiry.set(role, Date.now() + this.CACHE_DURATION);
            return permissions;
        }
        catch (error) {
            logger_1.default.error("Get user permissions error:", error);
            return [];
        }
    }
    getPermissionsByRole(role) {
        switch (role) {
            case "SUPER_ADMIN":
                return [
                    "CREATE_USER",
                    "READ_USER",
                    "UPDATE_USER",
                    "DELETE_USER",
                    "MANAGE_USER_ROLES",
                    "APPROVE_DRIVER",
                    "SUSPEND_DRIVER",
                    "VIEW_DRIVER_ANALYTICS",
                    "MANAGE_DRIVER_SHIFTS",
                    "APPROVE_TAXI_DRIVER",
                    "SUSPEND_TAXI_DRIVER",
                    "MANAGE_TAXI_LICENSES",
                    "CREATE_STORE",
                    "UPDATE_STORE",
                    "MANAGE_STORE_PRODUCTS",
                    "VIEW_STORE_ANALYTICS",
                    "CREATE_PLACE",
                    "UPDATE_PLACE",
                    "APPROVE_PLACE",
                    "MANAGE_PLACE_PHOTOS",
                    "CREATE_SERVICE",
                    "UPDATE_SERVICE",
                    "ASSIGN_DRIVER",
                    "VIEW_PAYMENTS",
                    "PROCESS_REFUNDS",
                    "VIEW_FINANCIAL_REPORTS",
                    "MODERATE_REVIEWS",
                    "MANAGE_NOTIFICATIONS",
                    "HANDLE_REPORTS",
                    "DISPATCH_EMERGENCY",
                    "MANAGE_RESPONDERS",
                    "VIEW_EMERGENCY_ANALYTICS",
                    "COORDINATE_INCIDENTS",
                ];
            case "CITY_ADMIN":
                return [
                    "CREATE_USER",
                    "READ_USER",
                    "UPDATE_USER",
                    "MANAGE_USER_ROLES",
                    "APPROVE_DRIVER",
                    "SUSPEND_DRIVER",
                    "VIEW_DRIVER_ANALYTICS",
                    "MANAGE_DRIVER_SHIFTS",
                    "APPROVE_TAXI_DRIVER",
                    "SUSPEND_TAXI_DRIVER",
                    "MANAGE_TAXI_LICENSES",
                    "CREATE_STORE",
                    "UPDATE_STORE",
                    "MANAGE_STORE_PRODUCTS",
                    "VIEW_STORE_ANALYTICS",
                    "CREATE_PLACE",
                    "UPDATE_PLACE",
                    "APPROVE_PLACE",
                    "MANAGE_PLACE_PHOTOS",
                    "CREATE_SERVICE",
                    "UPDATE_SERVICE",
                    "ASSIGN_DRIVER",
                    "VIEW_PAYMENTS",
                    "PROCESS_REFUNDS",
                    "VIEW_FINANCIAL_REPORTS",
                    "MODERATE_REVIEWS",
                    "MANAGE_NOTIFICATIONS",
                    "HANDLE_REPORTS",
                ];
            case "EMERGENCY_ADMIN":
                return [
                    "DISPATCH_EMERGENCY",
                    "MANAGE_RESPONDERS",
                    "VIEW_EMERGENCY_ANALYTICS",
                    "COORDINATE_INCIDENTS",
                    "READ_USER",
                    "HANDLE_REPORTS",
                ];
            case "PLACE_OWNER":
                return ["CREATE_PLACE", "UPDATE_PLACE", "MANAGE_PLACE_PHOTOS", "READ_USER"];
            case "STORE_OWNER":
                return ["CREATE_STORE", "UPDATE_STORE", "MANAGE_STORE_PRODUCTS", "READ_USER"];
            case "DRIVER":
                return ["CREATE_SERVICE", "UPDATE_SERVICE", "READ_USER"];
            case "TAXI_DRIVER":
                return ["CREATE_SERVICE", "UPDATE_SERVICE", "READ_USER"];
            case "USER":
                return ["CREATE_SERVICE", "READ_USER"];
            case "EMERGENCY_RESPONDER":
                return ["DISPATCH_EMERGENCY", "COORDINATE_INCIDENTS", "READ_USER"];
            case "DISPATCHER":
                return ["ASSIGN_DRIVER", "DISPATCH_EMERGENCY", "READ_USER"];
            case "SUPPORT_AGENT":
                return ["READ_USER", "HANDLE_REPORTS", "VIEW_PAYMENTS", "PROCESS_REFUNDS"];
            default:
                return ["READ_USER"];
        }
    }
    async hasPermission(role, permission) {
        try {
            const permissions = await this.getUserPermissions(role);
            return permissions.includes(permission);
        }
        catch (error) {
            logger_1.default.error("Has permission check error:", error);
            return false;
        }
    }
    async hasPermissions(role, requiredPermissions) {
        try {
            const userPermissions = await this.getUserPermissions(role);
            return requiredPermissions.every((permission) => userPermissions.includes(permission));
        }
        catch (error) {
            logger_1.default.error("Has permissions check error:", error);
            return false;
        }
    }
    async hasAnyPermission(role, permissions) {
        try {
            const userPermissions = await this.getUserPermissions(role);
            return permissions.some((permission) => userPermissions.includes(permission));
        }
        catch (error) {
            logger_1.default.error("Has any permission check error:", error);
            return false;
        }
    }
    async isResourceOwner(userId, resourceId, resourceType) {
        try {
            switch (resourceType) {
                case "/bookings":
                case "/bookings/:id":
                    const booking = await database_1.default.booking.findFirst({
                        where: {
                            id: resourceId,
                            OR: [{ customerId: userId }, { providerId: userId }],
                        },
                    });
                    return !!booking;
                case "/users":
                case "/users/:id":
                    return userId === resourceId;
                case "/stores":
                case "/stores/:id":
                    const store = await database_1.default.store.findFirst({
                        where: {
                            id: resourceId,
                            ownerId: userId,
                        },
                    });
                    return !!store;
                case "/places":
                case "/places/:id":
                    const place = await database_1.default.place.findFirst({
                        where: {
                            id: resourceId,
                            ownerId: userId,
                        },
                    });
                    return !!place;
                case "/support":
                case "/support/:id":
                    const ticket = await database_1.default.supportTicket.findFirst({
                        where: {
                            id: resourceId,
                            userId,
                        },
                    });
                    return !!ticket;
                case "/reviews":
                case "/reviews/:id":
                    const review = await database_1.default.review.findFirst({
                        where: {
                            id: resourceId,
                            OR: [{ giverId: userId }, { receiverId: userId }],
                        },
                    });
                    return !!review;
                default:
                    return false;
            }
        }
        catch (error) {
            logger_1.default.error("Resource ownership check error:", error);
            return false;
        }
    }
    async canAccessBooking(userId, userRole, bookingId) {
        try {
            // Admins can access all bookings
            if (["SUPER_ADMIN", "CITY_ADMIN"].includes(userRole)) {
                return true;
            }
            // Check if user is customer or provider
            const booking = await database_1.default.booking.findFirst({
                where: {
                    id: bookingId,
                    OR: [{ customerId: userId }, { providerId: userId }],
                },
            });
            return !!booking;
        }
        catch (error) {
            logger_1.default.error("Can access booking check error:", error);
            return false;
        }
    }
    async canManageUser(managerRole, targetRole) {
        const roleHierarchy = {
            HOUSE_MOVER: 9, // New role added with a specific level
            SUPER_ADMIN: 10,
            CITY_ADMIN: 8,
            EMERGENCY_ADMIN: 7,
            DISPATCHER: 6,
            SUPPORT_AGENT: 5,
            PLACE_OWNER: 4,
            STORE_OWNER: 4,
            DRIVER: 3,
            TAXI_DRIVER: 3,
            EMERGENCY_RESPONDER: 3,
            USER: 1,
        };
        const managerLevel = roleHierarchy[managerRole] || 0;
        const targetLevel = roleHierarchy[targetRole] || 0;
        return managerLevel > targetLevel;
    }
    async getAccessibleServiceTypes(role) {
        switch (role) {
            case "SUPER_ADMIN":
            case "CITY_ADMIN":
                return ["ALL"];
            case "DRIVER":
                return ["RIDE", "DAY_BOOKING", "SHARED_RIDE"];
            case "TAXI_DRIVER":
                return ["TAXI"];
            case "STORE_OWNER":
                return ["STORE_DELIVERY"];
            case "EMERGENCY_RESPONDER":
                return ["EMERGENCY"];
            case "USER":
                return [
                    "RIDE",
                    "TAXI",
                    "DAY_BOOKING",
                    "SHARED_RIDE",
                    "STORE_DELIVERY",
                    "FOOD_DELIVERY",
                    "PACKAGE_DELIVERY",
                    "HOUSE_MOVING",
                ];
            default:
                return [];
        }
    }
    clearCache() {
        this.permissionCache.clear();
        this.cacheExpiry.clear();
    }
    async initializeDefaultPermissions() {
        // Since Permission table doesn't exist in schema, we'll just log that permissions are initialized
        // The permissions are handled in-memory through the getPermissionsByRole method
        console.log("✅ Default permissions initialized (in-memory)");
    }
}
exports.RBACService = RBACService;
