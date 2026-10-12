export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admins: {
        Row: {
          clerk_user_id: string
          created_at: string
        }
        Insert: {
          clerk_user_id: string
          created_at?: string
        }
        Update: {
          clerk_user_id?: string
          created_at?: string
        }
        Relationships: []
      }
      customer_profiles: {
        Row: {
          clerk_user_id: string
          created_at: string
          name: string | null
          whatsapp: string | null
        }
        Insert: {
          clerk_user_id: string
          created_at?: string
          name?: string | null
          whatsapp?: string | null
        }
        Update: {
          clerk_user_id?: string
          created_at?: string
          name?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      order_events: {
        Row: {
          actor_id: string | null
          created_at: string
          customer_id: string
          from_status: Database["public"]["Enums"]["order_status"] | null
          id: number
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          customer_id: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: never
          order_id: string
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          customer_id?: string
          from_status?: Database["public"]["Enums"]["order_status"] | null
          id?: never
          order_id?: string
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: [
          {
            foreignKeyName: "order_events_order_id_customer_id_fkey"
            columns: ["order_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id", "customer_id"]
          },
        ]
      }
      order_planned_margins: {
        Row: {
          margin: number
          order_id: string
        }
        Insert: {
          margin: number
          order_id: string
        }
        Update: {
          margin?: number
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_planned_margins_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_status_moves: {
        Row: {
          from_status: Database["public"]["Enums"]["order_status"]
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Insert: {
          from_status: Database["public"]["Enums"]["order_status"]
          to_status: Database["public"]["Enums"]["order_status"]
        }
        Update: {
          from_status?: Database["public"]["Enums"]["order_status"]
          to_status?: Database["public"]["Enums"]["order_status"]
        }
        Relationships: []
      }
      orders: {
        Row: {
          activation_email: string | null
          created_at: string
          customer_id: string
          duration_days: number
          expires_at: string
          id: string
          number: number
          plan_id: string
          price: number
          product_name: string
          status: Database["public"]["Enums"]["order_status"]
          warranty_days: number
        }
        Insert: {
          activation_email?: string | null
          created_at?: string
          customer_id: string
          duration_days: number
          expires_at: string
          id?: string
          number?: never
          plan_id: string
          price: number
          product_name: string
          status?: Database["public"]["Enums"]["order_status"]
          warranty_days: number
        }
        Update: {
          activation_email?: string | null
          created_at?: string
          customer_id?: string
          duration_days?: number
          expires_at?: string
          id?: string
          number?: never
          plan_id?: string
          price?: number
          product_name?: string
          status?: Database["public"]["Enums"]["order_status"]
          warranty_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customer_profiles"
            referencedColumns: ["clerk_user_id"]
          },
          {
            foreignKeyName: "orders_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_accounts: {
        Row: {
          account_number: string
          account_title: string
          active: boolean
          bank_name: string | null
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
        }
        Insert: {
          account_number: string
          account_title: string
          active?: boolean
          bank_name?: string | null
          created_at?: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
        }
        Update: {
          account_number?: string
          account_title?: string
          active?: boolean
          bank_name?: string | null
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
        }
        Relationships: []
      }
      payment_rejections: {
        Row: {
          created_at: string
          customer_id: string
          order_id: string
          reason: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          order_id: string
          reason: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          order_id?: string
          reason?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_rejections_order_id_customer_id_fkey"
            columns: ["order_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id", "customer_id"]
          },
        ]
      }
      payments: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          payment_account_id: string
          receipt_path: string
          sender_number: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          payment_account_id: string
          receipt_path: string
          sender_number: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          order_id?: string
          payment_account_id?: string
          receipt_path?: string
          sender_number?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_customer_id_fkey"
            columns: ["order_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id", "customer_id"]
          },
          {
            foreignKeyName: "payments_payment_account_id_fkey"
            columns: ["payment_account_id"]
            isOneToOne: false
            referencedRelation: "payment_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      plan_supplier_details: {
        Row: {
          margin: number
          numastore_url: string
          plan_id: string
          price_checked_at: string
          supplier_price: number
        }
        Insert: {
          margin: number
          numastore_url: string
          plan_id: string
          price_checked_at?: string
          supplier_price: number
        }
        Update: {
          margin?: number
          numastore_url?: string
          plan_id?: string
          price_checked_at?: string
          supplier_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "plan_supplier_details_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string
          duration_days: number
          id: string
          product_id: string
          sell_price: number | null
          warranty_days: number
        }
        Insert: {
          created_at?: string
          duration_days: number
          id?: string
          product_id: string
          sell_price?: number | null
          warranty_days: number
        }
        Update: {
          created_at?: string
          duration_days?: number
          id?: string
          product_id?: string
          sell_price?: number | null
          warranty_days?: number
        }
        Relationships: [
          {
            foreignKeyName: "plans_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          account_type: Database["public"]["Enums"]["account_type"]
          active: boolean
          category: string
          created_at: string
          description: string
          id: string
          image_path: string | null
          name: string
          needs_activation_email: boolean
          plan_note: string | null
          setup_instructions: string
          slug: string
          sold_out: boolean
          warranty_warning: string
        }
        Insert: {
          account_type: Database["public"]["Enums"]["account_type"]
          active?: boolean
          category: string
          created_at?: string
          description?: string
          id?: string
          image_path?: string | null
          name: string
          needs_activation_email?: boolean
          plan_note?: string | null
          setup_instructions?: string
          slug: string
          sold_out?: boolean
          warranty_warning?: string
        }
        Update: {
          account_type?: Database["public"]["Enums"]["account_type"]
          active?: boolean
          category?: string
          created_at?: string
          description?: string
          id?: string
          image_path?: string | null
          name?: string
          needs_activation_email?: boolean
          plan_note?: string | null
          setup_instructions?: string
          slug?: string
          sold_out?: boolean
          warranty_warning?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          created_by: string
          endpoint_tag: string
          id: string
          label: string
          subscription: string
        }
        Insert: {
          created_at?: string
          created_by?: string
          endpoint_tag: string
          id?: string
          label: string
          subscription: string
        }
        Update: {
          created_at?: string
          created_by?: string
          endpoint_tag?: string
          id?: string
          label?: string
          subscription?: string
        }
        Relationships: []
      }
      refunds: {
        Row: {
          amount: number
          created_at: string
          customer_id: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          reference: string
          refunded_by: string | null
          sent_to: string
        }
        Insert: {
          amount: number
          created_at?: string
          customer_id: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          reference: string
          refunded_by?: string | null
          sent_to: string
        }
        Update: {
          amount?: number
          created_at?: string
          customer_id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          order_id?: string
          reference?: string
          refunded_by?: string | null
          sent_to?: string
        }
        Relationships: [
          {
            foreignKeyName: "refunds_order_id_customer_id_fkey"
            columns: ["order_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id", "customer_id"]
          },
        ]
      }
      replaced_credentials: {
        Row: {
          credential: string
          id: number
          kind: Database["public"]["Enums"]["credential_kind"]
          order_id: string
          replaced_at: string
          replacement_id: string
        }
        Insert: {
          credential: string
          id?: never
          kind: Database["public"]["Enums"]["credential_kind"]
          order_id: string
          replaced_at?: string
          replacement_id: string
        }
        Update: {
          credential?: string
          id?: never
          kind?: Database["public"]["Enums"]["credential_kind"]
          order_id?: string
          replaced_at?: string
          replacement_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "replaced_credentials_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vault_entries"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "replaced_credentials_replacement_id_fkey"
            columns: ["replacement_id"]
            isOneToOne: true
            referencedRelation: "replacements"
            referencedColumns: ["id"]
          },
        ]
      }
      replacements: {
        Row: {
          cost: number
          created_at: string
          id: string
          order_id: string
          replaced_by: string | null
          source: Database["public"]["Enums"]["replacement_source"]
          supplier_order_number: string | null
          ticket_id: string
        }
        Insert: {
          cost: number
          created_at?: string
          id?: string
          order_id: string
          replaced_by?: string | null
          source: Database["public"]["Enums"]["replacement_source"]
          supplier_order_number?: string | null
          ticket_id: string
        }
        Update: {
          cost?: number
          created_at?: string
          id?: string
          order_id?: string
          replaced_by?: string | null
          source?: Database["public"]["Enums"]["replacement_source"]
          supplier_order_number?: string | null
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "replacements_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "replacements_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "warranty_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          comment: string
          created_at: string
          customer_id: string
          duration_days: number
          hidden_at: string | null
          hidden_by: string | null
          hidden_reason: string | null
          id: string
          order_id: string
          product_id: string
          rating: number
          reviewer_name: string | null
          updated_at: string
        }
        Insert: {
          comment?: string
          created_at?: string
          customer_id: string
          duration_days: number
          hidden_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          order_id: string
          product_id: string
          rating: number
          reviewer_name?: string | null
          updated_at?: string
        }
        Update: {
          comment?: string
          created_at?: string
          customer_id?: string
          duration_days?: number
          hidden_at?: string | null
          hidden_by?: string | null
          hidden_reason?: string | null
          id?: string
          order_id?: string
          product_id?: string
          rating?: number
          reviewer_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_order_id_customer_id_fkey"
            columns: ["order_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id", "customer_id"]
          },
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      seller_alert_settings: {
        Row: {
          email_on: boolean
          id: boolean
          push_on: boolean
          updated_at: string
        }
        Insert: {
          email_on?: boolean
          id?: boolean
          push_on?: boolean
          updated_at?: string
        }
        Update: {
          email_on?: boolean
          id?: boolean
          push_on?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      store_settings: {
        Row: {
          away: boolean
          back_at: string | null
          id: boolean
        }
        Insert: {
          away?: boolean
          back_at?: string | null
          id?: boolean
        }
        Update: {
          away?: boolean
          back_at?: string | null
          id?: boolean
        }
        Relationships: []
      }
      supplier_purchases: {
        Row: {
          amount_paid: number
          created_at: string
          id: string
          order_id: string
          supplier_name: string
          supplier_order_number: string
        }
        Insert: {
          amount_paid: number
          created_at?: string
          id?: string
          order_id: string
          supplier_name?: string
          supplier_order_number: string
        }
        Update: {
          amount_paid?: number
          created_at?: string
          id?: string
          order_id?: string
          supplier_name?: string
          supplier_order_number?: string
        }
        Relationships: [
          {
            foreignKeyName: "supplier_purchases_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      supply_failures: {
        Row: {
          created_at: string
          customer_id: string
          order_id: string
          recorded_by: string | null
        }
        Insert: {
          created_at?: string
          customer_id: string
          order_id: string
          recorded_by?: string | null
        }
        Update: {
          created_at?: string
          customer_id?: string
          order_id?: string
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supply_failures_order_id_customer_id_fkey"
            columns: ["order_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id", "customer_id"]
          },
        ]
      }
      ticket_claims: {
        Row: {
          claimed_by: string | null
          created_at: string
          order_id: string
          supplier_reference: string
          ticket_id: string
        }
        Insert: {
          claimed_by?: string | null
          created_at?: string
          order_id: string
          supplier_reference: string
          ticket_id: string
        }
        Update: {
          claimed_by?: string | null
          created_at?: string
          order_id?: string
          supplier_reference?: string
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_claims_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ticket_claims_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: true
            referencedRelation: "warranty_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_messages: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          customer_id: string
          from_seller: boolean
          id: number
          ticket_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          customer_id: string
          from_seller?: boolean
          id?: never
          ticket_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          customer_id?: string
          from_seller?: boolean
          id?: never
          ticket_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ticket_messages_ticket_id_fkey"
            columns: ["ticket_id"]
            isOneToOne: false
            referencedRelation: "warranty_tickets"
            referencedColumns: ["id"]
          },
        ]
      }
      vault_entries: {
        Row: {
          credential: string
          customer_id: string
          delivered_at: string
          delivered_by: string | null
          kind: Database["public"]["Enums"]["credential_kind"]
          order_id: string
          setup_instructions: string
          warranty_warning: string
        }
        Insert: {
          credential: string
          customer_id: string
          delivered_at?: string
          delivered_by?: string | null
          kind: Database["public"]["Enums"]["credential_kind"]
          order_id: string
          setup_instructions: string
          warranty_warning: string
        }
        Update: {
          credential?: string
          customer_id?: string
          delivered_at?: string
          delivered_by?: string | null
          kind?: Database["public"]["Enums"]["credential_kind"]
          order_id?: string
          setup_instructions?: string
          warranty_warning?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_entries_order_id_customer_id_fkey"
            columns: ["order_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id", "customer_id"]
          },
        ]
      }
      vault_reveals: {
        Row: {
          created_at: string
          customer_id: string
          id: number
          order_id: string
          replaced_credential_id: number | null
          revealed_by: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: never
          order_id: string
          replaced_credential_id: number | null
          revealed_by: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: never
          order_id?: string
          replaced_credential_id?: number | null
          revealed_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "vault_reveals_order_id_customer_id_fkey"
            columns: ["order_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id", "customer_id"]
          },
          {
            foreignKeyName: "vault_reveals_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "vault_entries"
            referencedColumns: ["order_id"]
          },
          {
            foreignKeyName: "vault_reveals_replaced_credential_id_fkey"
            columns: ["replaced_credential_id"]
            isOneToOne: false
            referencedRelation: "replaced_credentials"
            referencedColumns: ["id"]
          },
        ]
      }
      warranty_tickets: {
        Row: {
          closed_at: string | null
          created_at: string
          customer_id: string
          id: string
          note: string
          order_id: string
          reason: Database["public"]["Enums"]["ticket_reason"]
          screenshot_path: string | null
          status: Database["public"]["Enums"]["ticket_status"]
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          customer_id: string
          id?: string
          note?: string
          order_id: string
          reason: Database["public"]["Enums"]["ticket_reason"]
          screenshot_path?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          customer_id?: string
          id?: string
          note?: string
          order_id?: string
          reason?: Database["public"]["Enums"]["ticket_reason"]
          screenshot_path?: string | null
          status?: Database["public"]["Enums"]["ticket_status"]
        }
        Relationships: [
          {
            foreignKeyName: "warranty_tickets_order_id_customer_id_fkey"
            columns: ["order_id", "customer_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id", "customer_id"]
          },
        ]
      }
    }
    Views: {
      product_ratings: {
        Row: {
          product_id: string | null
          rating_total: number | null
          review_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      approve_payment: { Args: { p_order_id: string }; Returns: undefined }
      claim_ticket: {
        Args: { p_supplier_reference: string; p_ticket_id: string }
        Returns: undefined
      }
      create_plan: {
        Args: {
          p_duration_days: number
          p_margin: number
          p_numastore_url: string
          p_product_id: string
          p_supplier_price: number
          p_warranty_days: number
        }
        Returns: string
      }
      deliver_order: {
        Args: {
          p_credential: string
          p_kind: Database["public"]["Enums"]["credential_kind"]
          p_order_id: string
        }
        Returns: undefined
      }
      drop_push_subscription: {
        Args: { p_endpoint_tag: string; p_order_id: string }
        Returns: undefined
      }
      hide_review: {
        Args: { p_reason: string; p_review_id: string }
        Returns: undefined
      }
      leave_review: {
        Args: {
          p_comment: string
          p_order_id: string
          p_rating: number
          p_reviewer_name?: string
        }
        Returns: string
      }
      mark_order_bought: {
        Args: {
          p_amount_paid: number
          p_order_id: string
          p_supplier_order_number: string
        }
        Returns: undefined
      }
      mark_plan_price_checked: { Args: { p_plan_id: string }; Returns: string }
      order_status_counts: {
        Args: never
        Returns: {
          order_count: number
          order_status: Database["public"]["Enums"]["order_status"]
        }[]
      }
      place_order: {
        Args: {
          p_activation_email?: string
          p_plan_id: string
          p_whatsapp?: string
        }
        Returns: number
      }
      proof_alert_targets: {
        Args: { p_order_id: string }
        Returns: {
          email_on: boolean
          push_on: boolean
          subscriptions: string[]
        }[]
      }
      record_cannot_supply: { Args: { p_order_id: string }; Returns: undefined }
      refund_rejected_order: {
        Args: {
          p_amount: number
          p_method: Database["public"]["Enums"]["payment_method"]
          p_order_id: string
          p_reference: string
        }
        Returns: undefined
      }
      refund_ticket: {
        Args: {
          p_amount: number
          p_method: Database["public"]["Enums"]["payment_method"]
          p_reference: string
          p_ticket_id: string
        }
        Returns: undefined
      }
      refund_unsupplied_order: {
        Args: {
          p_amount: number
          p_method: Database["public"]["Enums"]["payment_method"]
          p_order_id: string
          p_reference: string
        }
        Returns: undefined
      }
      reject_payment: {
        Args: { p_order_id: string; p_reason: string }
        Returns: undefined
      }
      replace_by_purchase: {
        Args: {
          p_cost: number
          p_credential: string
          p_kind: Database["public"]["Enums"]["credential_kind"]
          p_supplier_order_number: string
          p_ticket_id: string
        }
        Returns: undefined
      }
      replace_from_claim: {
        Args: {
          p_credential: string
          p_kind: Database["public"]["Enums"]["credential_kind"]
          p_ticket_id: string
        }
        Returns: undefined
      }
      report_orders: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          duration_days: number
          number: number
          placed_at: string
          price: number
          product_name: string
          refund: number
          replacement_cost: number
          status: Database["public"]["Enums"]["order_status"]
          supplier_cost: number
        }[]
      }
      report_products: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          claim_replacements: number
          delivered: number
          out_of_stock_refund_amount: number
          out_of_stock_refunds: number
          paid_replacement_cost: number
          paid_replacements: number
          planned_margin: number
          product_id: string
          product_name: string
          rejected_refund_amount: number
          rejected_refunds: number
          revenue: number
          supplier_cost: number
          warranty_refund_amount: number
          warranty_refunds: number
        }[]
      }
      report_waiting_times: {
        Args: { p_from?: string; p_to?: string }
        Returns: {
          median_seconds: number
          orders: number
          over_30_minutes: number
          slowest_seconds: number
          step: string
        }[]
      }
      reveal_credential: {
        Args: { p_order_id: string }
        Returns: {
          credential: string
          kind: Database["public"]["Enums"]["credential_kind"]
        }[]
      }
      reveal_replaced_credential: {
        Args: { p_replaced_credential_id: number }
        Returns: {
          credential: string
          kind: Database["public"]["Enums"]["credential_kind"]
          order_id: string
        }[]
      }
      submit_payment_proof: {
        Args: {
          p_order_id: string
          p_payment_account_id: string
          p_receipt_path: string
          p_sender_number: string
          p_transaction_id: string
        }
        Returns: undefined
      }
      update_plan: {
        Args: {
          p_duration_days: number
          p_margin: number
          p_numastore_url: string
          p_plan_id: string
          p_product_id: string
          p_supplier_price: number
          p_warranty_days: number
        }
        Returns: undefined
      }
    }
    Enums: {
      account_type: "own_account" | "shared_slot" | "email_invite"
      credential_kind: "login" | "licence_key" | "invite"
      order_status:
        | "awaiting_payment"
        | "verifying"
        | "paid"
        | "bought"
        | "delivered"
        | "rejected"
        | "refunded"
        | "replaced"
      payment_method:
        | "easypaisa"
        | "jazzcash"
        | "nayapay"
        | "sadapay"
        | "bank_transfer"
      replacement_source: "claim" | "purchase"
      ticket_reason: "login_failed" | "ended_early" | "other"
      ticket_status: "open" | "claimed" | "replaced" | "refunded"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      account_type: ["own_account", "shared_slot", "email_invite"],
      credential_kind: ["login", "licence_key", "invite"],
      order_status: [
        "awaiting_payment",
        "verifying",
        "paid",
        "bought",
        "delivered",
        "rejected",
        "refunded",
        "replaced",
      ],
      payment_method: [
        "easypaisa",
        "jazzcash",
        "nayapay",
        "sadapay",
        "bank_transfer",
      ],
      replacement_source: ["claim", "purchase"],
      ticket_reason: ["login_failed", "ended_early", "other"],
      ticket_status: ["open", "claimed", "replaced", "refunded"],
    },
  },
} as const
