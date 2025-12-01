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
    PostgrestVersion: "12.2.3 (519615d)"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      _prisma_migrations: {
        Row: {
          applied_steps_count: number
          checksum: string
          finished_at: string | null
          id: string
          logs: string | null
          migration_name: string
          rolled_back_at: string | null
          started_at: string
        }
        Insert: {
          applied_steps_count?: number
          checksum: string
          finished_at?: string | null
          id: string
          logs?: string | null
          migration_name: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Update: {
          applied_steps_count?: number
          checksum?: string
          finished_at?: string | null
          id?: string
          logs?: string | null
          migration_name?: string
          rolled_back_at?: string | null
          started_at?: string
        }
        Relationships: []
      }
      AppSettings: {
        Row: {
          createdAt: string
          enabled: boolean | null
          id: number
          name: string | null
          note: string | null
          updatedAt: string
          value: string | null
        }
        Insert: {
          createdAt?: string
          enabled?: boolean | null
          id?: number
          name?: string | null
          note?: string | null
          updatedAt?: string
          value?: string | null
        }
        Update: {
          createdAt?: string
          enabled?: boolean | null
          id?: number
          name?: string | null
          note?: string | null
          updatedAt?: string
          value?: string | null
        }
        Relationships: []
      }
      Basket: {
        Row: {
          booking_details: Json | null
          bubbleBasketId: string | null
          cancellationReason: string | null
          city: string | null
          createdAt: string
          dayFrom: string
          dayTo: string
          external_id: string | null
          id: number
          isCancelled: boolean | null
          isCancelledAtTime: string | null
          isCreatedByAdmin: boolean
          isPaid: boolean
          mail: string | null
          name: string | null
          nexiOperationId: string | null
          nexiOrderId: string | null
          nexiPaymentCircuit: string | null
          nexiSecurityToken: string | null
          note: string | null
          paymentConfirmationEmailSent: boolean | null
          paymentIntentId: string | null
          phone: string | null
          region: string | null
          reservationType: string
          stripeId: string | null
          surname: string | null
          totalPrice: number
          updatedAt: string
        }
        Insert: {
          booking_details?: Json | null
          bubbleBasketId?: string | null
          cancellationReason?: string | null
          city?: string | null
          createdAt?: string
          dayFrom?: string
          dayTo?: string
          external_id?: string | null
          id?: number
          isCancelled?: boolean | null
          isCancelledAtTime?: string | null
          isCreatedByAdmin?: boolean
          isPaid?: boolean
          mail?: string | null
          name?: string | null
          nexiOperationId?: string | null
          nexiOrderId?: string | null
          nexiPaymentCircuit?: string | null
          nexiSecurityToken?: string | null
          note?: string | null
          paymentConfirmationEmailSent?: boolean | null
          paymentIntentId?: string | null
          phone?: string | null
          region?: string | null
          reservationType: string
          stripeId?: string | null
          surname?: string | null
          totalPrice?: number
          updatedAt?: string
        }
        Update: {
          booking_details?: Json | null
          bubbleBasketId?: string | null
          cancellationReason?: string | null
          city?: string | null
          createdAt?: string
          dayFrom?: string
          dayTo?: string
          external_id?: string | null
          id?: number
          isCancelled?: boolean | null
          isCancelledAtTime?: string | null
          isCreatedByAdmin?: boolean
          isPaid?: boolean
          mail?: string | null
          name?: string | null
          nexiOperationId?: string | null
          nexiOrderId?: string | null
          nexiPaymentCircuit?: string | null
          nexiSecurityToken?: string | null
          note?: string | null
          paymentConfirmationEmailSent?: boolean | null
          paymentIntentId?: string | null
          phone?: string | null
          region?: string | null
          reservationType?: string
          stripeId?: string | null
          surname?: string | null
          totalPrice?: number
          updatedAt?: string
        }
        Relationships: []
      }
      Bed: {
        Row: {
          createdAt: string
          description: string
          id: number
          langTrasn: Json | null
          peopleCount: number
          priceBandB: number
          priceMP: number
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          description?: string
          id?: number
          langTrasn?: Json | null
          peopleCount: number
          priceBandB: number
          priceMP: number
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          description?: string
          id?: number
          langTrasn?: Json | null
          peopleCount?: number
          priceBandB?: number
          priceMP?: number
          updatedAt?: string
        }
        Relationships: []
      }
      BedBlock: {
        Row: {
          createdAt: string
          description: string
          id: number
          price: number
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          description?: string
          id?: number
          price: number
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          description?: string
          id?: number
          price?: number
          updatedAt?: string
        }
        Relationships: []
      }
      booking_on_hold: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          entered_payment: string | null
          id: number
          session_id: string | null
          still_on_hold: boolean | null
          time_is_up_at: string | null
          updated_at: string | null
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          entered_payment?: string | null
          id?: number
          session_id?: string | null
          still_on_hold?: boolean | null
          time_is_up_at?: string | null
          updated_at?: string | null
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          entered_payment?: string | null
          id?: number
          session_id?: string | null
          still_on_hold?: boolean | null
          time_is_up_at?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      BuildingRegistration: {
        Row: {
          buildingName: string
          createdAt: string
          id: number
          roomIds: number[] | null
          updatedAt: string
        }
        Insert: {
          buildingName: string
          createdAt?: string
          id?: number
          roomIds?: number[] | null
          updatedAt?: string
        }
        Update: {
          buildingName?: string
          createdAt?: string
          id?: number
          roomIds?: number[] | null
          updatedAt?: string
        }
        Relationships: []
      }
      day_blocked: {
        Row: {
          created_at: string
          day_blocked: string | null
          id: number
        }
        Insert: {
          created_at?: string
          day_blocked?: string | null
          id?: number
        }
        Update: {
          created_at?: string
          day_blocked?: string | null
          id?: number
        }
        Relationships: []
      }
      DayBlocked: {
        Row: {
          createdAt: string
          dayFrom: string
          dayTo: string
          id: number
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          dayFrom?: string
          dayTo?: string
          id?: number
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          dayFrom?: string
          dayTo?: string
          id?: number
          updatedAt?: string
        }
        Relationships: []
      }
      FailsReservations: {
        Row: {
          createdAt: string
          extra: string | null
          id: number
          name: string | null
          note: string | null
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          extra?: string | null
          id?: number
          name?: string | null
          note?: string | null
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          extra?: string | null
          id?: number
          name?: string | null
          note?: string | null
          updatedAt?: string
        }
        Relationships: []
      }
      GuestDivision: {
        Row: {
          ageFrom: number
          ageTo: number
          cityTax: boolean
          cityTaxPrice: number
          createdAt: string
          description: string
          id: number
          langTrasn: Json | null
          salePercent: number
          title: string
          updatedAt: string
        }
        Insert: {
          ageFrom: number
          ageTo: number
          cityTax?: boolean
          cityTaxPrice?: number
          createdAt?: string
          description?: string
          id?: number
          langTrasn?: Json | null
          salePercent: number
          title?: string
          updatedAt?: string
        }
        Update: {
          ageFrom?: number
          ageTo?: number
          cityTax?: boolean
          cityTaxPrice?: number
          createdAt?: string
          description?: string
          id?: number
          langTrasn?: Json | null
          salePercent?: number
          title?: string
          updatedAt?: string
        }
        Relationships: []
      }
      languages: {
        Row: {
          code: string | null
          created_at: string
          id: number
          name: string | null
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: number
          name?: string | null
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: number
          name?: string | null
        }
        Relationships: []
      }
      ReservationCancel: {
        Row: {
          basketId: number | null
          createdAt: string
          id: number
          isRefunded: boolean | null
          reason: string | null
          refundAmount: number | null
          refundDateTime: string | null
          refundedStatus: string | null
          refundFailerReason: string | null
          refundId: string | null
          updatedAt: string
        }
        Insert: {
          basketId?: number | null
          createdAt?: string
          id?: number
          isRefunded?: boolean | null
          reason?: string | null
          refundAmount?: number | null
          refundDateTime?: string | null
          refundedStatus?: string | null
          refundFailerReason?: string | null
          refundId?: string | null
          updatedAt?: string
        }
        Update: {
          basketId?: number | null
          createdAt?: string
          id?: number
          isRefunded?: boolean | null
          reason?: string | null
          refundAmount?: number | null
          refundDateTime?: string | null
          refundedStatus?: string | null
          refundFailerReason?: string | null
          refundId?: string | null
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "ReservationCancel_basketId_fkey"
            columns: ["basketId"]
            isOneToOne: false
            referencedRelation: "Basket"
            referencedColumns: ["id"]
          },
        ]
      }
      ReservationLinkBedBlock: {
        Row: {
          bedBlockId: number | null
          createdAt: string
          day: string
          id: number
          roomLinkBedId: number[] | null
          roomReservationId: number
          updatedAt: string
        }
        Insert: {
          bedBlockId?: number | null
          createdAt?: string
          day?: string
          id?: number
          roomLinkBedId?: number[] | null
          roomReservationId: number
          updatedAt?: string
        }
        Update: {
          bedBlockId?: number | null
          createdAt?: string
          day?: string
          id?: number
          roomLinkBedId?: number[] | null
          roomReservationId?: number
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "ReservationLinkBedBlock_bedBlockId_fkey"
            columns: ["bedBlockId"]
            isOneToOne: false
            referencedRelation: "BedBlock"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ReservationLinkBedBlock_roomReservationId_fkey"
            columns: ["roomReservationId"]
            isOneToOne: false
            referencedRelation: "RoomReservation"
            referencedColumns: ["id"]
          },
        ]
      }
      ReservationLinkService: {
        Row: {
          createdAt: string
          id: number
          quantity: number
          roomReservationId: number
          serviceId: number
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          id?: number
          quantity: number
          roomReservationId: number
          serviceId: number
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          id?: number
          quantity?: number
          roomReservationId?: number
          serviceId?: number
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "ReservationLinkService_roomReservationId_fkey"
            columns: ["roomReservationId"]
            isOneToOne: false
            referencedRelation: "RoomReservation"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ReservationLinkService_serviceId_fkey"
            columns: ["serviceId"]
            isOneToOne: false
            referencedRelation: "Service"
            referencedColumns: ["id"]
          },
        ]
      }
      Room: {
        Row: {
          bedCount: number
          createdAt: string
          description: string
          id: number
          langTrasn: Json | null
          order: number | null
          updatedAt: string
        }
        Insert: {
          bedCount: number
          createdAt?: string
          description?: string
          id?: number
          langTrasn?: Json | null
          order?: number | null
          updatedAt?: string
        }
        Update: {
          bedCount?: number
          createdAt?: string
          description?: string
          id?: number
          langTrasn?: Json | null
          order?: number | null
          updatedAt?: string
        }
        Relationships: []
      }
      RoomImage: {
        Row: {
          createdAt: string
          id: number
          roomId: number
          updatedAt: string
          url: string
        }
        Insert: {
          createdAt?: string
          id?: number
          roomId: number
          updatedAt?: string
          url?: string
        }
        Update: {
          createdAt?: string
          id?: number
          roomId?: number
          updatedAt?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "RoomImage_roomId_fkey"
            columns: ["roomId"]
            isOneToOne: false
            referencedRelation: "Room"
            referencedColumns: ["id"]
          },
        ]
      }
      RoomLinkBed: {
        Row: {
          bedId: number
          createdAt: string
          id: number
          langTrasn: Json | null
          name: string
          roomId: number
          updatedAt: string
        }
        Insert: {
          bedId: number
          createdAt?: string
          id?: number
          langTrasn?: Json | null
          name?: string
          roomId: number
          updatedAt?: string
        }
        Update: {
          bedId?: number
          createdAt?: string
          id?: number
          langTrasn?: Json | null
          name?: string
          roomId?: number
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "RoomLinkBed_bedId_fkey"
            columns: ["bedId"]
            isOneToOne: false
            referencedRelation: "Bed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "RoomLinkBed_roomId_fkey"
            columns: ["roomId"]
            isOneToOne: false
            referencedRelation: "Room"
            referencedColumns: ["id"]
          },
        ]
      }
      RoomReservation: {
        Row: {
          basketId: number | null
          bedBlockPriceTotal: number
          createdAt: string
          id: number
          servicePriceTotal: number
          updatedAt: string
        }
        Insert: {
          basketId?: number | null
          bedBlockPriceTotal?: number
          createdAt?: string
          id?: number
          servicePriceTotal?: number
          updatedAt?: string
        }
        Update: {
          basketId?: number | null
          bedBlockPriceTotal?: number
          createdAt?: string
          id?: number
          servicePriceTotal?: number
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "RoomReservation_basketId_fkey"
            columns: ["basketId"]
            isOneToOne: false
            referencedRelation: "Basket"
            referencedColumns: ["id"]
          },
        ]
      }
      RoomReservationSpec: {
        Row: {
          createdAt: string
          guestDivisionId: number
          id: number
          price: number
          roomLinkBedId: number
          roomReservationId: number
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          guestDivisionId: number
          id?: number
          price: number
          roomLinkBedId: number
          roomReservationId: number
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          guestDivisionId?: number
          id?: number
          price?: number
          roomLinkBedId?: number
          roomReservationId?: number
          updatedAt?: string
        }
        Relationships: [
          {
            foreignKeyName: "RoomReservationSpec_guestDivisionId_fkey"
            columns: ["guestDivisionId"]
            isOneToOne: false
            referencedRelation: "GuestDivision"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "RoomReservationSpec_roomLinkBedId_fkey"
            columns: ["roomLinkBedId"]
            isOneToOne: false
            referencedRelation: "RoomLinkBed"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "RoomReservationSpec_roomReservationId_fkey"
            columns: ["roomReservationId"]
            isOneToOne: false
            referencedRelation: "RoomReservation"
            referencedColumns: ["id"]
          },
        ]
      }
      sent_email_resend: {
        Row: {
          created_at: string
          email_id: string | null
          error_message: string | null
          error_name: string | null
          id: number
          mail_body: string | null
          sent_time: string | null
          status: string | null
          subject: string | null
          to: string | null
        }
        Insert: {
          created_at?: string
          email_id?: string | null
          error_message?: string | null
          error_name?: string | null
          id?: number
          mail_body?: string | null
          sent_time?: string | null
          status?: string | null
          subject?: string | null
          to?: string | null
        }
        Update: {
          created_at?: string
          email_id?: string | null
          error_message?: string | null
          error_name?: string | null
          id?: number
          mail_body?: string | null
          sent_time?: string | null
          status?: string | null
          subject?: string | null
          to?: string | null
        }
        Relationships: []
      }
      Service: {
        Row: {
          createdAt: string
          description: string
          id: number
          langTrasn: Json | null
          price: number
          requestQuantity: boolean
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          description?: string
          id?: number
          langTrasn?: Json | null
          price: number
          requestQuantity?: boolean
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          description?: string
          id?: number
          langTrasn?: Json | null
          price?: number
          requestQuantity?: boolean
          updatedAt?: string
        }
        Relationships: []
      }
      stripe_check: {
        Row: {
          check_status: string | null
          created_at: string
          id: number
          meta: Json | null
        }
        Insert: {
          check_status?: string | null
          created_at?: string
          id?: number
          meta?: Json | null
        }
        Update: {
          check_status?: string | null
          created_at?: string
          id?: number
          meta?: Json | null
        }
        Relationships: []
      }
      Stripe_log: {
        Row: {
          created_at: string
          date: string | null
          id: number
          meta: Json | null
          solved: boolean | null
          status: string | null
          stripe_id: string | null
          transaction_type: string | null
        }
        Insert: {
          created_at?: string
          date?: string | null
          id?: number
          meta?: Json | null
          solved?: boolean | null
          status?: string | null
          stripe_id?: string | null
          transaction_type?: string | null
        }
        Update: {
          created_at?: string
          date?: string | null
          id?: number
          meta?: Json | null
          solved?: boolean | null
          status?: string | null
          stripe_id?: string | null
          transaction_type?: string | null
        }
        Relationships: []
      }
      TemplateData: {
        Row: {
          createdAt: string
          enabled: boolean | null
          htmlMarkUp: string | null
          id: number
          templateName: string | null
          type: string | null
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          enabled?: boolean | null
          htmlMarkUp?: string | null
          id?: number
          templateName?: string | null
          type?: string | null
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          enabled?: boolean | null
          htmlMarkUp?: string | null
          id?: number
          templateName?: string | null
          type?: string | null
          updatedAt?: string
        }
        Relationships: []
      }
      User: {
        Row: {
          createdAt: string
          email: string
          id: number
          name: string | null
          password: string | null
          surname: string | null
          token: string | null
          updatedAt: string
        }
        Insert: {
          createdAt?: string
          email: string
          id?: number
          name?: string | null
          password?: string | null
          surname?: string | null
          token?: string | null
          updatedAt?: string
        }
        Update: {
          createdAt?: string
          email?: string
          id?: number
          name?: string | null
          password?: string | null
          surname?: string | null
          token?: string | null
          updatedAt?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_table_columns: {
        Args: { p_table_name: string }
        Returns: {
          column_name: string
          data_type: string
        }[]
      }
      migrate_day_blocked: { Args: never; Returns: undefined }
      reset_basket_id_seq: { Args: never; Returns: undefined }
      reset_reservationlinkbedblock_id_seq: { Args: never; Returns: undefined }
      reset_reservationlinkservice_id_seq: { Args: never; Returns: undefined }
      reset_roomreservation_id_seq: { Args: never; Returns: undefined }
      reset_roomreservationpec_id_seq: { Args: never; Returns: undefined }
      reset_roomreservationspec_id_seq: { Args: never; Returns: undefined }
      set_basket_id_seq_to_max: { Args: never; Returns: undefined }
      set_reservationlinkbedblock_id_seq_to_max: {
        Args: never
        Returns: undefined
      }
      set_reservationlinkservice_id_seq_to_max: {
        Args: never
        Returns: undefined
      }
      set_roomreservation_id_seq_to_max: { Args: never; Returns: undefined }
      set_roomreservationspec_id_seq_to_max: { Args: never; Returns: undefined }
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
