CREATE TABLE "custom_exercises" (
	"id" text PRIMARY KEY NOT NULL,
	"exercise" jsonb NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	CONSTRAINT "custom_exercises_id_prefix" CHECK ("custom_exercises"."id" LIKE 'custom-%'),
	CONSTRAINT "custom_exercises_exercise_object" CHECK (jsonb_typeof("custom_exercises"."exercise") = 'object')
);
--> statement-breakpoint
CREATE TABLE "exercise_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"pinned_note" text DEFAULT '' NOT NULL,
	"rest_seconds" integer,
	CONSTRAINT "exercise_settings_rest_seconds" CHECK ("exercise_settings"."rest_seconds" >= 0)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"id" text PRIMARY KEY NOT NULL,
	"weight_unit" text DEFAULT 'kg' NOT NULL,
	"rest_compound_upper" integer DEFAULT 120 NOT NULL,
	"rest_compound_lower" integer DEFAULT 180 NOT NULL,
	"rest_upper_isolation" integer DEFAULT 90 NOT NULL,
	"rest_lower_isolation" integer DEFAULT 90 NOT NULL,
	"rest_core" integer DEFAULT 60 NOT NULL,
	CONSTRAINT "settings_id" CHECK ("settings"."id" = 'settings'),
	CONSTRAINT "settings_weight_unit" CHECK ("settings"."weight_unit" IN ('kg', 'lb')),
	CONSTRAINT "settings_rest_seconds" CHECK (LEAST("settings"."rest_compound_upper", "settings"."rest_compound_lower", "settings"."rest_upper_isolation", "settings"."rest_lower_isolation", "settings"."rest_core") >= 0)
);
--> statement-breakpoint
CREATE TABLE "workout_sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"template_id" text,
	"started_at" timestamp with time zone NOT NULL,
	"ended_at" timestamp with time zone,
	"notes" text DEFAULT '' NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "workout_sessions_blocks_array" CHECK (jsonb_typeof("workout_sessions"."blocks") = 'array')
);
--> statement-breakpoint
CREATE TABLE "workout_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"blocks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "workout_templates_blocks_array" CHECK (jsonb_typeof("workout_templates"."blocks") = 'array')
);
