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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "friendships_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "friendships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      game_messages: {
        Row: {
          content: string
          created_at: string
          game_id: string
          id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          game_id: string
          id?: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          game_id?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_messages_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      games: {
        Row: {
          bet_amount: number | null
          black_player_id: string | null
          black_remaining_time: number | null
          created_at: string
          ended_at: string | null
          fen_position: string | null
          id: string
          move_history: Json
          result: string | null
          started_at: string | null
          status: string
          time_control: string
          white_player_id: string | null
          white_remaining_time: number | null
        }
        Insert: {
          bet_amount?: number | null
          black_player_id?: string | null
          black_remaining_time?: number | null
          created_at?: string
          ended_at?: string | null
          fen_position?: string | null
          id?: string
          move_history?: Json
          result?: string | null
          started_at?: string | null
          status?: string
          time_control?: string
          white_player_id?: string | null
          white_remaining_time?: number | null
        }
        Update: {
          bet_amount?: number | null
          black_player_id?: string | null
          black_remaining_time?: number | null
          created_at?: string
          ended_at?: string | null
          fen_position?: string | null
          id?: string
          move_history?: Json
          result?: string | null
          started_at?: string | null
          status?: string
          time_control?: string
          white_player_id?: string | null
          white_remaining_time?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "games_black_player_id_fkey"
            columns: ["black_player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "games_white_player_id_fkey"
            columns: ["white_player_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      matchmaking_queue: {
        Row: {
          bet_amount: number | null
          elo_rating: number
          id: string
          joined_at: string
          time_control: string
          user_id: string
        }
        Insert: {
          bet_amount?: number | null
          elo_rating: number
          id?: string
          joined_at?: string
          time_control?: string
          user_id: string
        }
        Update: {
          bet_amount?: number | null
          elo_rating?: number
          id?: string
          joined_at?: string
          time_control?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "matchmaking_queue_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          cpf_cnpj: string | null
          created_at: string
          display_name: string | null
          draws: number
          elo_rating: number
          id: string
          is_online: boolean
          last_seen: string | null
          losses: number
          total_bet_amount: number
          total_winnings: number
          updated_at: string
          user_id: string
          username: string
          wins: number
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          display_name?: string | null
          draws?: number
          elo_rating?: number
          id?: string
          is_online?: boolean
          last_seen?: string | null
          losses?: number
          total_bet_amount?: number
          total_winnings?: number
          updated_at?: string
          user_id: string
          username: string
          wins?: number
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          cpf_cnpj?: string | null
          created_at?: string
          display_name?: string | null
          draws?: number
          elo_rating?: number
          id?: string
          is_online?: boolean
          last_seen?: string | null
          losses?: number
          total_bet_amount?: number
          total_winnings?: number
          updated_at?: string
          user_id?: string
          username?: string
          wins?: number
        }
        Relationships: []
      }
      tournament_participants: {
        Row: {
          id: string
          joined_at: string
          rank: number | null
          score: number
          tournament_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          rank?: number | null
          score?: number
          tournament_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          rank?: number | null
          score?: number
          tournament_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tournament_participants_tournament_id_fkey"
            columns: ["tournament_id"]
            isOneToOne: false
            referencedRelation: "tournaments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tournament_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      tournaments: {
        Row: {
          created_at: string
          description: string | null
          entry_fee: number | null
          format: string
          id: string
          max_participants: number
          name: string
          prize_pool: number | null
          starts_at: string
          status: string
          time_control: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          entry_fee?: number | null
          format?: string
          id?: string
          max_participants?: number
          name: string
          prize_pool?: number | null
          starts_at: string
          status?: string
          time_control?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          entry_fee?: number | null
          format?: string
          id?: string
          max_participants?: number
          name?: string
          prize_pool?: number | null
          starts_at?: string
          status?: string
          time_control?: string
        }
        Relationships: []
      }
      wallets: {
        Row: {
          id: string
          user_id: string
          balance_available: number
          balance_locked: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          balance_available?: number
          balance_locked?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          balance_available?: number
          balance_locked?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          type: string
          amount: number
          status: string
          created_at: string
          metadata: Json
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          amount: number
          status: string
          created_at?: string
          metadata?: Json
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          amount?: number
          status?: string
          created_at?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      pix_deposits: {
        Row: {
          id: string
          user_id: string
          asaas_payment_id: string
          amount: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          asaas_payment_id: string
          amount: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          asaas_payment_id?: string
          amount?: number
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "pix_deposits_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      withdrawals: {
        Row: {
          id: string
          user_id: string
          amount: number
          status: string
          pix_key: string | null
          pix_key_type: string | null
          asaas_transfer_id: string | null
          failure_reason: string | null
          created_at: string
          processed_at: string | null
          scheduled_after: string
        }
        Insert: {
          id?: string
          user_id: string
          amount: number
          status: string
          pix_key?: string | null
          pix_key_type?: string | null
          asaas_transfer_id?: string | null
          failure_reason?: string | null
          created_at?: string
          processed_at?: string | null
          scheduled_after: string
        }
        Update: {
          id?: string
          user_id?: string
          amount?: number
          status?: string
          pix_key?: string | null
          pix_key_type?: string | null
          asaas_transfer_id?: string | null
          failure_reason?: string | null
          created_at?: string
          processed_at?: string | null
          scheduled_after?: string
        }
        Relationships: [
          {
            foreignKeyName: "withdrawals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          id: string
          sender_id: string
          receiver_id: string
          content: string
          created_at: string
          read_at: string | null
        }
        Insert: {
          id?: string
          sender_id: string
          receiver_id: string
          content: string
          created_at?: string
          read_at?: string | null
        }
        Update: {
          id?: string
          sender_id?: string
          receiver_id?: string
          content?: string
          created_at?: string
          read_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "direct_messages_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["user_id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      increment_wallet_balance: {
        Args: { p_user_id: string; p_amount: number }
        Returns: { id: string; balance_available: number }[]
      }
      request_withdrawal_atomic: {
        Args: {
          p_user_id: string
          p_amount: number
          p_pix_key: string
          p_pix_key_type: string
          p_scheduled_after: string
        }
        Returns: { id: string; status: string; scheduled_after: string }[]
      }
      create_match_atomic: {
        Args: {
          p_white_player_id: string
          p_black_player_id: string
          p_time_control: string
          p_bet_amount: number
        }
        Returns: { id: string; status: string; time_control: string; bet_amount: number | null; white_player_id: string | null; black_player_id: string | null; started_at: string | null; move_history: Json; created_at: string; ended_at: string | null; result: string | null; fen_position: string | null; white_remaining_time: number | null; black_remaining_time: number | null }[]
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
