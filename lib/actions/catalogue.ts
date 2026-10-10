"use server";

import { randomUUID } from "node:crypto";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import {
  type FormState,
  MAX_IMAGE_BYTES,
  flagSchema,
  formValues,
  idSchema,
  planSchema,
  productSchema,
  refusal,
} from "@/lib/catalogue";
import { detectImageType, imageContentType } from "@/lib/image-type";
import { PRODUCT_IMAGE_BUCKET } from "@/lib/product-image";
import { slugFromName } from "@/lib/slug";
import { createServerSupabase } from "@/lib/supabase/server";

// Every write here runs as the signed-in seller. Whether it's allowed is the
// policies' decision: a customer calling these gets a refusal from the
// database, not from a check in this file.

type Supabase = Awaited<ReturnType<typeof createServerSupabase>>;
type DbError = { code?: string; message: string };

const NOT_ALLOWED =
  "Not saved: this account isn't an admin, or the item no longer exists.";

function failed(message: string, prev: FormState): FormState {
  return { ok: false, message, fieldErrors: {}, version: prev.version };
}

function saved(message: string, prev: FormState): FormState {
  return { ok: true, message, fieldErrors: {}, version: prev.version + 1 };
}

// 42501 is a policy refusing an insert or a function; P0002 is a function
// finding no row it may touch, which for a customer is every row.
function dbFailure(error: DbError, prev: FormState): FormState {
  if (error.code === "42501" || error.code === "P0002") return failed(NOT_ALLOWED, prev);
  if (error.code === "23505") {
    return {
      ok: false,
      message: "Not saved. A product with this name already exists.",
      fieldErrors: { name: ["A product with this name already exists"] },
      version: prev.version,
    };
  }
  return failed(`Not saved: ${error.message}`, prev);
}

function badInput(prev: FormState): FormState {
  return failed("Not saved: the request was malformed. Reload the page and try again.", prev);
}

// ───────────────────────────── Images ─────────────────────────────

type ImageUpload =
  | { kind: "none" }
  | { kind: "bad"; message: string }
  | { kind: "image"; bytes: Uint8Array; path: string; contentType: string };

async function readImage(entry: FormDataEntryValue | null): Promise<ImageUpload> {
  if (!(entry instanceof File) || entry.size === 0) return { kind: "none" };
  if (entry.size > MAX_IMAGE_BYTES) return { kind: "bad", message: "Image is over 1 MB" };
  const bytes = new Uint8Array(await entry.arrayBuffer());
  const ext = detectImageType(bytes);
  if (!ext) return { kind: "bad", message: "Image must be a JPEG, PNG or WebP file" };
  // A fresh name every time, so a replaced image is never served from a cache.
  return { kind: "image", bytes, path: `${randomUUID()}.${ext}`, contentType: imageContentType[ext] };
}

async function uploadImage(supabase: Supabase, image: ImageUpload & { kind: "image" }) {
  const { error } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(image.path, image.bytes, {
      contentType: image.contentType,
      cacheControl: "31536000",
      upsert: false,
    });
  return error;
}

// Best effort: an orphaned file costs a little storage, never correctness, so a
// failed cleanup doesn't turn a saved product into an error.
async function removeImage(supabase: Supabase, path: string): Promise<void> {
  await supabase.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
}

function imageRefusal(message: string, prev: FormState): FormState {
  return {
    ok: false,
    message: `Not saved. ${message}.`,
    fieldErrors: { image: [message] },
    version: prev.version,
  };
}

function parseProduct(formData: FormData) {
  return productSchema.safeParse({
    ...formValues(formData),
    needsActivationEmail: formData.get("needsActivationEmail") === "on",
  });
}

// ───────────────────────────── Products ─────────────────────────────

export async function createProduct(prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseProduct(formData);
  if (!parsed.success) return refusal(parsed.error, prev);
  const product = parsed.data;

  const slug = slugFromName(product.name);
  if (!slug) {
    const message = "Name needs at least one English letter or digit, for the product's web address";
    return { ok: false, message: `Not saved. ${message}.`, fieldErrors: { name: [message] }, version: prev.version };
  }

  const image = await readImage(formData.get("image"));
  if (image.kind === "bad") return imageRefusal(image.message, prev);

  const supabase = await createServerSupabase();
  if (image.kind === "image") {
    const uploadError = await uploadImage(supabase, image);
    if (uploadError) return failed(`Not saved: the image didn't upload (${uploadError.message}).`, prev);
  }

  // New products start hidden, so nothing reaches the storefront before the
  // seller has added its plans and chosen to show it.
  const { data, error } = await supabase
    .from("products")
    .insert({
      slug,
      name: product.name,
      category: product.category,
      description: product.description,
      setup_instructions: product.setupInstructions,
      account_type: product.accountType,
      plan_note: product.planNote,
      needs_activation_email: product.needsActivationEmail,
      image_path: image.kind === "image" ? image.path : null,
      active: false,
    })
    .select("id")
    .single();

  if (error) {
    if (image.kind === "image") await removeImage(supabase, image.path);
    return dbFailure(error, prev);
  }

  redirect(`/admin/products/${data.id}`);
}

export async function updateProduct(
  productId: string,
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = idSchema.safeParse(productId);
  if (!id.success) return badInput(prev);
  const parsed = parseProduct(formData);
  if (!parsed.success) return refusal(parsed.error, prev);
  const product = parsed.data;

  const image = await readImage(formData.get("image"));
  if (image.kind === "bad") return imageRefusal(image.message, prev);

  const supabase = await createServerSupabase();

  const { data: current, error: readError } = await supabase
    .from("products")
    .select("image_path")
    .eq("id", id.data)
    .maybeSingle();
  if (readError) return dbFailure(readError, prev);
  if (!current) return failed(NOT_ALLOWED, prev);

  if (image.kind === "image") {
    const uploadError = await uploadImage(supabase, image);
    if (uploadError) return failed(`Not saved: the image didn't upload (${uploadError.message}).`, prev);
  }

  // The slug is left alone: it was made from the first name and stays the
  // product's address even if the name changes.
  const { data, error } = await supabase
    .from("products")
    .update({
      name: product.name,
      category: product.category,
      description: product.description,
      setup_instructions: product.setupInstructions,
      account_type: product.accountType,
      plan_note: product.planNote,
      needs_activation_email: product.needsActivationEmail,
      ...(image.kind === "image" ? { image_path: image.path } : {}),
    })
    .eq("id", id.data)
    .select("id");

  // An update the policy doesn't allow matches no rows rather than erroring.
  if (error || data.length === 0) {
    if (image.kind === "image") await removeImage(supabase, image.path);
    return error ? dbFailure(error, prev) : failed(NOT_ALLOWED, prev);
  }

  if (image.kind === "image" && current.image_path) {
    await removeImage(supabase, current.image_path);
  }

  refresh();
  return saved("Saved.", prev);
}

async function setProductFlag(
  productId: string,
  column: "active" | "sold_out",
  value: boolean,
  prev: FormState,
): Promise<FormState> {
  const id = idSchema.safeParse(productId);
  const flag = flagSchema.safeParse(value);
  if (!id.success || !flag.success) return badInput(prev);

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("products")
    .update(column === "active" ? { active: flag.data } : { sold_out: flag.data })
    .eq("id", id.data)
    .select("id");
  if (error) return dbFailure(error, prev);
  if (data.length === 0) return failed(NOT_ALLOWED, prev);

  refresh();
  return saved("Saved.", prev);
}

// Hiding takes a product off the storefront; its plans and every order that
// references them stay exactly as they were.
export async function setProductListed(
  productId: string,
  listed: boolean,
  prev: FormState,
): Promise<FormState> {
  return setProductFlag(productId, "active", listed, prev);
}

export async function setProductSoldOut(
  productId: string,
  soldOut: boolean,
  prev: FormState,
): Promise<FormState> {
  return setProductFlag(productId, "sold_out", soldOut, prev);
}

// ───────────────────────────── Plans ─────────────────────────────

// A plan and its supplier details are two rows written together, so each save
// is one database function. Neither takes a sell price: the database works it
// out from the supplier price and margin.

export async function createPlan(
  productId: string,
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = idSchema.safeParse(productId);
  if (!id.success) return badInput(prev);
  const parsed = planSchema.safeParse(formValues(formData));
  if (!parsed.success) return refusal(parsed.error, prev);
  const plan = parsed.data;

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("create_plan", {
    p_product_id: id.data,
    p_duration_days: plan.durationDays,
    p_warranty_days: plan.warrantyDays,
    p_supplier_price: plan.supplierPrice,
    p_margin: plan.margin,
    p_numastore_url: plan.numastoreUrl,
  });
  if (error) return dbFailure(error, prev);

  refresh();
  return saved("Plan added.", prev);
}

export async function updatePlan(
  planId: string,
  productId: string,
  prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const planRef = idSchema.safeParse(planId);
  const productRef = idSchema.safeParse(productId);
  if (!planRef.success || !productRef.success) return badInput(prev);
  const parsed = planSchema.safeParse(formValues(formData));
  if (!parsed.success) return refusal(parsed.error, prev);
  const plan = parsed.data;

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("update_plan", {
    p_plan_id: planRef.data,
    p_product_id: productRef.data,
    p_duration_days: plan.durationDays,
    p_warranty_days: plan.warrantyDays,
    p_supplier_price: plan.supplierPrice,
    p_margin: plan.margin,
    p_numastore_url: plan.numastoreUrl,
  });
  if (error) return dbFailure(error, prev);

  refresh();
  return saved("Saved.", prev);
}

// The seller looked at numastore just now and the price is still right.
export async function markPriceChecked(planId: string, prev: FormState): Promise<FormState> {
  const id = idSchema.safeParse(planId);
  if (!id.success) return badInput(prev);

  const supabase = await createServerSupabase();
  const { error } = await supabase.rpc("mark_plan_price_checked", { p_plan_id: id.data });
  if (error) return dbFailure(error, prev);

  refresh();
  return saved("Checked.", prev);
}
