import "server-only";

import { createServerSupabase } from "@/lib/supabase/server";

const DEVICE_LIMIT = 20;

// Both tables are admin-only by policy: anyone else gets no settings row and
// no devices.
export async function getAlertSettings() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("seller_alert_settings")
    .select("push_on, email_on")
    .maybeSingle();
  if (error) throw new Error(`Couldn't load notification settings: ${error.message}`);
  return data;
}

// The list never needs the sealed subscription, so it isn't read.
export async function listPushDevices() {
  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("id, label, created_at")
    .order("created_at")
    .limit(DEVICE_LIMIT);
  if (error) throw new Error(`Couldn't load devices: ${error.message}`);
  return data;
}
