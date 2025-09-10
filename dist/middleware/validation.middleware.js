"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.validateParams = exports.validateQuery = exports.validateRequest = void 0;
const validateRequest = (schema) => {
    return (req, res, next) => {
        console.log("=== VALIDATION MIDDLEWARE ===");
        console.log("Request path:", req.path);
        console.log("Request method:", req.method);
        console.log("Raw request body:", JSON.stringify(req.body, null, 2));
        const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true,
        });
        if (error) {
            console.log("❌ VALIDATION FAILED");
            console.log("Validation errors:", error.details.map((detail) => ({
                field: detail.path.join("."),
                message: detail.message,
                value: detail.context?.value,
            })));
            console.log("=====================================");
            return res.status(400).json({
                success: false,
                message: "Validation failed",
                errors: error.details.map((detail) => ({
                    field: detail.path.join("."),
                    message: detail.message,
                })),
            });
        }
        console.log("✅ VALIDATION PASSED");
        console.log("Validated body:", JSON.stringify(value, null, 2));
        console.log("=====================================");
        req.body = value;
        next();
    };
};
exports.validateRequest = validateRequest;
const validateQuery = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.query, {
            abortEarly: false,
            stripUnknown: true,
        });
        if (error) {
            return res.status(400).json({
                success: false,
                message: "Query validation failed",
                errors: error.details.map((detail) => ({
                    field: detail.path.join("."),
                    message: detail.message,
                })),
            });
        }
        req.query = value;
        next();
    };
};
exports.validateQuery = validateQuery;
const validateParams = (schema) => {
    return (req, res, next) => {
        const { error, value } = schema.validate(req.params, {
            abortEarly: false,
            stripUnknown: true,
        });
        if (error) {
            return res.status(400).json({
                success: false,
                message: "Parameter validation failed",
                errors: error.details.map((detail) => ({
                    field: detail.path.join("."),
                    message: detail.message,
                })),
            });
        }
        req.params = value;
        next();
    };
};
exports.validateParams = validateParams;
