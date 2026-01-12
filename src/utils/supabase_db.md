-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.AppSettings (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text,
  value text,
  note text,
  enabled boolean DEFAULT false,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT AppSettings_pkey PRIMARY KEY (id)
);
CREATE TABLE public.Basket (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL UNIQUE,
  dayFrom date NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dayTo date NOT NULL DEFAULT CURRENT_TIMESTAMP,
  note text DEFAULT ''::text,
  name text DEFAULT ''::text,
  surname text DEFAULT ''::text,
  mail text DEFAULT ''::text,
  phone text DEFAULT ''::text,
  city text DEFAULT ''::text,
  region text DEFAULT ''::text,
  reservationType text NOT NULL,
  totalPrice double precision NOT NULL DEFAULT 0,
  isPaid boolean NOT NULL DEFAULT false,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  stripeId text DEFAULT ''::text,
  paymentIntentId text DEFAULT ''::text,
  isCancelled boolean DEFAULT false,
  bubbleBasketId text DEFAULT ''::text,
  isCreatedByAdmin boolean NOT NULL DEFAULT false,
  external_id uuid DEFAULT gen_random_uuid(),
  booking_details jsonb,
  isCancelledAtTime timestamp with time zone,
  paymentConfirmationEmailSent boolean,
  cancellationReason text,
  nexiOrderId text,
  nexiSecurityToken text,
  nexiOperationId text,
  nexiPaymentCircuit text,
  CONSTRAINT Basket_pkey PRIMARY KEY (id)
);
CREATE TABLE public.Bed (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  priceMP integer NOT NULL,
  priceBandB integer NOT NULL,
  peopleCount integer NOT NULL,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  langTrasn jsonb,
  CONSTRAINT Bed_pkey PRIMARY KEY (id)
);
CREATE TABLE public.BedBlock (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  price double precision NOT NULL,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT BedBlock_pkey PRIMARY KEY (id)
);
CREATE TABLE public.BuildingRegistration (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  buildingName text NOT NULL,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  roomIds ARRAY,
  CONSTRAINT BuildingRegistration_pkey PRIMARY KEY (id)
);
CREATE TABLE public.DayBlocked (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dayFrom date NOT NULL DEFAULT CURRENT_TIMESTAMP,
  dayTo date NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT DayBlocked_pkey PRIMARY KEY (id)
);
CREATE TABLE public.FailsReservations (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  name text,
  note text,
  extra text DEFAULT ''::text,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT FailsReservations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.GuestDivision (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  ageFrom integer NOT NULL,
  ageTo integer NOT NULL,
  salePercent integer NOT NULL,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  title text NOT NULL DEFAULT ''::text,
  cityTax boolean NOT NULL DEFAULT false,
  cityTaxPrice double precision NOT NULL DEFAULT 0,
  langTrasn jsonb,
  CONSTRAINT GuestDivision_pkey PRIMARY KEY (id)
);
CREATE TABLE public.ReservationCancel (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  basketId integer,
  reason text DEFAULT ''::text,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  isRefunded boolean DEFAULT false,
  refundAmount integer DEFAULT 0,
  refundDateTime timestamp without time zone,
  refundFailerReason text DEFAULT ''::text,
  refundId text DEFAULT ''::text,
  refundedStatus text DEFAULT ''::text,
  CONSTRAINT ReservationCancel_pkey PRIMARY KEY (id),
  CONSTRAINT ReservationCancel_basketId_fkey FOREIGN KEY (basketId) REFERENCES public.Basket(id)
);
CREATE TABLE public.ReservationLinkBedBlock (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  day date NOT NULL DEFAULT CURRENT_TIMESTAMP,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  roomReservationId integer NOT NULL,
  bedBlockId integer,
  roomLinkBedId ARRAY,
  CONSTRAINT ReservationLinkBedBlock_pkey PRIMARY KEY (id),
  CONSTRAINT ReservationLinkBedBlock_bedBlockId_fkey FOREIGN KEY (bedBlockId) REFERENCES public.BedBlock(id),
  CONSTRAINT ReservationLinkBedBlock_roomReservationId_fkey FOREIGN KEY (roomReservationId) REFERENCES public.RoomReservation(id)
);
CREATE TABLE public.ReservationLinkService (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  serviceId integer NOT NULL,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  roomReservationId integer NOT NULL,
  quantity integer NOT NULL,
  CONSTRAINT ReservationLinkService_pkey PRIMARY KEY (id),
  CONSTRAINT ReservationLinkService_roomReservationId_fkey FOREIGN KEY (roomReservationId) REFERENCES public.RoomReservation(id),
  CONSTRAINT ReservationLinkService_serviceId_fkey FOREIGN KEY (serviceId) REFERENCES public.Service(id)
);
CREATE TABLE public.Room (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  bedCount integer NOT NULL,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  langTrasn jsonb,
  order bigint,
  CONSTRAINT Room_pkey PRIMARY KEY (id)
);
CREATE TABLE public.RoomImage (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  url text NOT NULL DEFAULT ''::text,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  roomId integer NOT NULL,
  CONSTRAINT RoomImage_pkey PRIMARY KEY (id),
  CONSTRAINT RoomImage_roomId_fkey FOREIGN KEY (roomId) REFERENCES public.Room(id)
);
CREATE TABLE public.RoomLinkBed (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  roomId integer NOT NULL,
  bedId integer NOT NULL,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  name text NOT NULL DEFAULT ''::text,
  langTrasn jsonb,
  CONSTRAINT RoomLinkBed_pkey PRIMARY KEY (id),
  CONSTRAINT RoomLinkBed_bedId_fkey FOREIGN KEY (bedId) REFERENCES public.Bed(id),
  CONSTRAINT RoomLinkBed_roomId_fkey FOREIGN KEY (roomId) REFERENCES public.Room(id)
);
CREATE TABLE public.RoomReservation (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  basketId integer,
  bedBlockPriceTotal double precision NOT NULL DEFAULT 0,
  servicePriceTotal double precision NOT NULL DEFAULT 0,
  CONSTRAINT RoomReservation_pkey PRIMARY KEY (id),
  CONSTRAINT RoomReservation_basketId_fkey FOREIGN KEY (basketId) REFERENCES public.Basket(id)
);
CREATE TABLE public.RoomReservationSpec (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  price double precision NOT NULL,
  roomReservationId integer NOT NULL,
  guestDivisionId integer NOT NULL,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  roomLinkBedId integer NOT NULL,
  CONSTRAINT RoomReservationSpec_pkey PRIMARY KEY (id),
  CONSTRAINT RoomReservationSpec_guestDivisionId_fkey FOREIGN KEY (guestDivisionId) REFERENCES public.GuestDivision(id),
  CONSTRAINT RoomReservationSpec_roomLinkBedId_fkey FOREIGN KEY (roomLinkBedId) REFERENCES public.RoomLinkBed(id),
  CONSTRAINT RoomReservationSpec_roomReservationId_fkey FOREIGN KEY (roomReservationId) REFERENCES public.RoomReservation(id)
);
CREATE TABLE public.Service (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  description text NOT NULL DEFAULT ''::text,
  price integer NOT NULL,
  requestQuantity boolean NOT NULL DEFAULT false,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  langTrasn jsonb,
  CONSTRAINT Service_pkey PRIMARY KEY (id)
);
CREATE TABLE public.Stripe_log (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  stripe_id text,
  meta jsonb,
  status text,
  date timestamp with time zone,
  transaction_type text,
  solved boolean,
  CONSTRAINT Stripe_log_pkey PRIMARY KEY (id)
);
CREATE TABLE public.TemplateData (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  templateName text,
  type text,
  htmlMarkUp text,
  enabled boolean DEFAULT false,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT TemplateData_pkey PRIMARY KEY (id)
);
CREATE TABLE public.User (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  email text NOT NULL,
  password text,
  name text DEFAULT ''::text,
  surname text DEFAULT ''::text,
  token text,
  createdAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updatedAt timestamp without time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT User_pkey PRIMARY KEY (id)
);
CREATE TABLE public._prisma_migrations (
  id character varying NOT NULL,
  checksum character varying NOT NULL,
  finished_at timestamp with time zone,
  migration_name character varying NOT NULL,
  logs text,
  rolled_back_at timestamp with time zone,
  started_at timestamp with time zone NOT NULL DEFAULT now(),
  applied_steps_count integer NOT NULL DEFAULT 0,
  CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.booking_on_hold (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone,
  check_in date,
  check_out date,
  still_on_hold boolean DEFAULT true,
  time_is_up_at timestamp with time zone,
  entered_payment timestamp with time zone,
  session_id text,
  CONSTRAINT booking_on_hold_pkey PRIMARY KEY (id)
);
CREATE TABLE public.day_blocked (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  day_blocked date,
  CONSTRAINT day_blocked_pkey PRIMARY KEY (id)
);
CREATE TABLE public.languages (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  code text,
  name text,
  CONSTRAINT languages_pkey PRIMARY KEY (id)
);
CREATE TABLE public.sent_email_resend (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  subject text,
  to text,
  mail_body text,
  sent_time timestamp without time zone,
  status text,
  email_id text,
  error_message text,
  error_name text,
  CONSTRAINT sent_email_resend_pkey PRIMARY KEY (id)
);
CREATE TABLE public.stripe_check (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  check_status text,
  meta json,
  CONSTRAINT stripe_check_pkey PRIMARY KEY (id)
);