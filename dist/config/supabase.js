"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabase = void 0;
const supabase_js_1 = require("@supabase/supabase-js");
const logger_1 = __importDefault(require("../utils/logger"));
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseServiceKey) {
    logger_1.default.error("Missing Supabase configuration");
    process.exit(1);
}
exports.supabase = (0, supabase_js_1.createClient)(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});
// Test Supabase connection
async function testSupabaseConnection() {
    try {
        const { data, error } = await exports.supabase.storage.listBuckets();
        if (error)
            throw error;
        logger_1.default.info("✅ Supabase connected successfully");
    }
    catch (error) {
        logger_1.default.error("❌ Supabase connection failed:", error);
    }
}
testSupabaseConnection();
