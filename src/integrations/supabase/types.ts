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
    PostgrestVersion: "14.4"
  }
  public: {
    Tables: {
      addresses: {
        Row: {
          address_line1: string
          address_line2: string | null
          city: string
          created_at: string
          full_name: string
          id: string
          is_default: boolean | null
          label: string | null
          phone: string | null
          pincode: string
          state: string
          user_id: string
        }
        Insert: {
          address_line1: string
          address_line2?: string | null
          city: string
          created_at?: string
          full_name: string
          id?: string
          is_default?: boolean | null
          label?: string | null
          phone?: string | null
          pincode: string
          state: string
          user_id: string
        }
        Update: {
          address_line1?: string
          address_line2?: string | null
          city?: string
          created_at?: string
          full_name?: string
          id?: string
          is_default?: boolean | null
          label?: string | null
          phone?: string | null
          pincode?: string
          state?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_activity_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: []
      }
      banners: {
        Row: {
          bg_color: string | null
          created_at: string
          cta_link: string | null
          cta_text: string | null
          ends_at: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          position: string | null
          sort_order: number | null
          starts_at: string | null
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          bg_color?: string | null
          created_at?: string
          cta_link?: string | null
          cta_text?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          position?: string | null
          sort_order?: number | null
          starts_at?: string | null
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          bg_color?: string | null
          created_at?: string
          cta_link?: string | null
          cta_text?: string | null
          ends_at?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          position?: string | null
          sort_order?: number | null
          starts_at?: string | null
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          category: string | null
          content: string | null
          created_at: string
          excerpt: string | null
          id: string
          image_url: string | null
          is_published: boolean | null
          published_at: string | null
          slug: string
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          published_at?: string | null
          slug: string
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          content?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          image_url?: string | null
          is_published?: boolean | null
          published_at?: string | null
          slug?: string
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cart_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cart_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      coupons: {
        Row: {
          applicable_ids: string[] | null
          applicable_to: string | null
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          first_order_only: boolean | null
          id: string
          is_active: boolean | null
          max_uses: number | null
          min_order_value: number | null
          per_customer_limit: number | null
          updated_at: string
          used_count: number | null
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          applicable_ids?: string[] | null
          applicable_to?: string | null
          code: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          first_order_only?: boolean | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_order_value?: number | null
          per_customer_limit?: number | null
          updated_at?: string
          used_count?: number | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          applicable_ids?: string[] | null
          applicable_to?: string | null
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          first_order_only?: boolean | null
          id?: string
          is_active?: boolean | null
          max_uses?: number | null
          min_order_value?: number | null
          per_customer_limit?: number | null
          updated_at?: string
          used_count?: number | null
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer: string
          category: string | null
          created_at: string
          id: string
          is_active: boolean | null
          question: string
          sort_order: number | null
        }
        Insert: {
          answer: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          question: string
          sort_order?: number | null
        }
        Update: {
          answer?: string
          category?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          question?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      health_concerns: {
        Row: {
          created_at: string
          description: string | null
          icon: string | null
          id: string
          name: string
          slug: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name: string
          slug: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string | null
          id?: string
          name?: string
          slug?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string
          id: string
          order_id: string
          price: number
          product_id: string
          product_image: string | null
          product_name: string
          quantity: number
        }
        Insert: {
          created_at?: string
          id?: string
          order_id: string
          price: number
          product_id: string
          product_image?: string | null
          product_name: string
          quantity: number
        }
        Update: {
          created_at?: string
          id?: string
          order_id?: string
          price?: number
          product_id?: string
          product_image?: string | null
          product_name?: string
          quantity?: number
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          address_snapshot: Json | null
          created_at: string
          discount: number | null
          id: string
          shipping: number | null
          status: string
          stripe_session_id: string | null
          subtotal: number
          total: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address_snapshot?: Json | null
          created_at?: string
          discount?: number | null
          id?: string
          shipping?: number | null
          status?: string
          stripe_session_id?: string | null
          subtotal: number
          total: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address_snapshot?: Json | null
          created_at?: string
          discount?: number | null
          id?: string
          shipping?: number | null
          status?: string
          stripe_session_id?: string | null
          subtotal?: number
          total?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_health_concerns: {
        Row: {
          concern_id: string
          product_id: string
        }
        Insert: {
          concern_id: string
          product_id: string
        }
        Update: {
          concern_id?: string
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_health_concerns_concern_id_fkey"
            columns: ["concern_id"]
            isOneToOne: false
            referencedRelation: "health_concerns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_health_concerns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          badge: string | null
          benefits: string | null
          category_id: string | null
          created_at: string
          description: string | null
          gallery_urls: string[] | null
          how_to_use: string | null
          id: string
          image_url: string | null
          ingredients: string | null
          is_active: boolean | null
          is_featured: boolean | null
          name: string
          original_price: number | null
          price: number
          rating: number | null
          review_count: number | null
          short_description: string | null
          slug: string
          stock_quantity: number | null
          updated_at: string
        }
        Insert: {
          badge?: string | null
          benefits?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          gallery_urls?: string[] | null
          how_to_use?: string | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          name: string
          original_price?: number | null
          price: number
          rating?: number | null
          review_count?: number | null
          short_description?: string | null
          slug: string
          stock_quantity?: number | null
          updated_at?: string
        }
        Update: {
          badge?: string | null
          benefits?: string | null
          category_id?: string | null
          created_at?: string
          description?: string | null
          gallery_urls?: string[] | null
          how_to_use?: string | null
          id?: string
          image_url?: string | null
          ingredients?: string | null
          is_active?: boolean | null
          is_featured?: boolean | null
          name?: string
          original_price?: number | null
          price?: number
          rating?: number | null
          review_count?: number | null
          short_description?: string | null
          slug?: string
          stock_quantity?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          phone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          content: string | null
          created_at: string
          id: string
          is_approved: boolean | null
          product_id: string
          rating: number
          title: string | null
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean | null
          product_id: string
          rating: number
          title?: string | null
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          is_approved?: boolean | null
          product_id?: string
          rating?: number
          title?: string | null
          user_id?: string
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
      site_settings: {
        Row: {
          id: string
          key: string
          updated_at: string
          value: string | null
        }
        Insert: {
          id?: string
          key: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          id?: string
          key?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          city: string | null
          created_at: string
          id: string
          is_active: boolean | null
          name: string
          photo_url: string | null
          product: string | null
          quote: string
          rating: number | null
          sort_order: number | null
        }
        Insert: {
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name: string
          photo_url?: string | null
          product?: string | null
          quote: string
          rating?: number | null
          sort_order?: number | null
        }
        Update: {
          city?: string | null
          created_at?: string
          id?: string
          is_active?: boolean | null
          name?: string
          photo_url?: string | null
          product?: string | null
          quote?: string
          rating?: number | null
          sort_order?: number | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wishlist_items: {
        Row: {
          created_at: string
          id: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wishlist_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "moderator"
        | "user"
        | "content_manager"
        | "inventory_manager"
        | "customer_support"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: [
        "admin",
        "moderator",
        "user",
        "content_manager",
        "inventory_manager",
        "customer_support",
      ],
    },
  },
} as const
