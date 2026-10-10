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
          created_at: string
          customer_id: string
          duration_days: number
          id: string
          number: number
          plan_id: string
          price: number
          product_name: string
          status: Database["public"]["Enums"]["order_status"]
          warranty_days: number
        }
        Insert: {
          created_at?: string
          customer_id: string
          duration_days: number
          id?: string
          number?: never
          plan_id: string
          price: number
          product_name: string
          status?: Database["public"]["Enums"]["order_status"]
          warranty_days: number
        }
        Update: {
          created_at?: string
          customer_id?: string
          duration_days?: number
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
      payments: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          receipt_path: string | null
          sender_number: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          method: Database["public"]["Enums"]["payment_method"]
          order_id: string
          receipt_path?: string | null
          sender_number: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          method?: Database["public"]["Enums"]["payment_method"]
          order_id?: string
          receipt_path?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
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
      mark_plan_price_checked: { Args: { p_plan_id: string }; Returns: string }
      order_status_counts: {
        Args: never
        Returns: {
          order_count: number
          order_status: Database["public"]["Enums"]["order_status"]
        }[]
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
    },
  },
} as const
