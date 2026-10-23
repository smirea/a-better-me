-- PowerSync replicates exactly the synced tables (`SYNCED_TABLES`). A new synced table needs its own
-- `ALTER PUBLICATION powersync ADD TABLE` and grant.
CREATE PUBLICATION powersync FOR TABLE "workout_templates", "workout_sessions", "custom_exercises", "exercise_settings", "settings";
--> statement-breakpoint
-- Supabase's replication role. Local Docker PowerSync connects as `postgres` and has no such role.
DO $$
BEGIN
	IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'a_better_me_powersync') THEN
		GRANT SELECT ON "workout_templates", "workout_sessions", "custom_exercises", "exercise_settings", "settings" TO a_better_me_powersync;
	END IF;
END $$;
