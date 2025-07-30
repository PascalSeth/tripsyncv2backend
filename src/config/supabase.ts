import { createClient } from "@supabase/supabase-js"
import logger from "../utils/logger"

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  logger.error("Missing Supabase configuration")
  process.exit(1)
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

// Test Supabase connection
async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.storage.listBuckets()
    if (error) throw error
    logger.info("✅ Supabase connected successfully")
  } catch (error) {
    logger.error("❌ Supabase connection failed:", error)
  }
}

testSupabaseConnection()
