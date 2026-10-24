CREATE TABLE "body_weights" (
	"id" text PRIMARY KEY NOT NULL,
	"measured_at" timestamp with time zone NOT NULL,
	"weight_kg" double precision NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	CONSTRAINT "body_weights_weight_kg" CHECK ("body_weights"."weight_kg" > 0),
	CONSTRAINT "body_weights_source" CHECK ("body_weights"."source" IN ('manual', 'healthkit'))
);
--> statement-breakpoint
CREATE TABLE "gym_profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon" text NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"equipment" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "gym_profiles_equipment_object" CHECK (jsonb_typeof("gym_profiles"."equipment") = 'object')
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text NOT NULL,
	"icon" text NOT NULL,
	"cycles" integer NOT NULL,
	"current_cycle" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"days" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL,
	CONSTRAINT "programs_cycles" CHECK ("programs"."cycles" >= 1 AND "programs"."current_cycle" >= 1),
	CONSTRAINT "programs_config_object" CHECK (jsonb_typeof("programs"."config") = 'object'),
	CONSTRAINT "programs_days_array" CHECK (jsonb_typeof("programs"."days") = 'array')
);
--> statement-breakpoint
ALTER TABLE "exercise_settings" ADD COLUMN "do_not_recommend" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise_settings" ADD COLUMN "overrides" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "workout" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "profile" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "dashboard" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "settings" ADD COLUMN "shortcuts" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "program_id" text;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "program_day_id" text;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "cycle" integer;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "gym_id" text;--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD COLUMN "paused_seconds" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "workout_templates" ADD COLUMN "program_id" text;--> statement-breakpoint
ALTER TABLE "workout_templates" ADD COLUMN "gym_id" text;--> statement-breakpoint
ALTER TABLE "workout_templates" ADD COLUMN "archived" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "exercise_settings" ADD CONSTRAINT "exercise_settings_overrides_object" CHECK (jsonb_typeof("exercise_settings"."overrides") = 'object');--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_json_objects" CHECK (jsonb_typeof("settings"."workout") = 'object' AND jsonb_typeof("settings"."profile") = 'object' AND jsonb_typeof("settings"."dashboard") = 'object' AND jsonb_typeof("settings"."shortcuts") = 'object');--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_program" CHECK (("workout_sessions"."program_id" IS NULL) = ("workout_sessions"."program_day_id" IS NULL) AND ("workout_sessions"."program_day_id" IS NULL) = ("workout_sessions"."cycle" IS NULL));--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_cycle" CHECK ("workout_sessions"."cycle" >= 1);--> statement-breakpoint
ALTER TABLE "workout_sessions" ADD CONSTRAINT "workout_sessions_paused_seconds" CHECK ("workout_sessions"."paused_seconds" >= 0);--> statement-breakpoint
ALTER PUBLICATION powersync ADD TABLE "programs", "gym_profiles", "body_weights";
--> statement-breakpoint
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'a_better_me_powersync') THEN
		GRANT SELECT ON "programs", "gym_profiles", "body_weights" TO a_better_me_powersync;
	END IF;
END $$;
