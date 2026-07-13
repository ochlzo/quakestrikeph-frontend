-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations
/*
CREATE TABLE "RawEarthquakeEvents" (
	"id" text PRIMARY KEY NOT NULL,
	"Date-Time" text NOT NULL,
	"Latitude" double precision NOT NULL,
	"Longitude" double precision NOT NULL,
	"Depth" text NOT NULL,
	"Magnitude" double precision NOT NULL,
	"Location" text,
	"Month" text NOT NULL,
	"Year" bigint NOT NULL,
	"event_time" timestamp,
	"ingestion_run_id" bigint NOT NULL,
	CONSTRAINT "unique_event" UNIQUE("Date-Time","Latitude","Longitude","Depth","Magnitude")
);
--> statement-breakpoint
ALTER TABLE "RawEarthquakeEvents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "SeisPredictions_v1" (
	"event_id" text PRIMARY KEY NOT NULL,
	"prediction_json" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"aftershock_24h" double precision GENERATED ALWAYS AS (((prediction_json #>> '{predictions,aftershock_24h_probability}'::text[]))::double precision) STORED NOT NULL,
	"m5_plus_aftershock" double precision GENERATED ALWAYS AS (((prediction_json #>> '{predictions,m5_plus_aftershock_24h_probability}'::text[]))::double precision) STORED NOT NULL,
	"within_10km" double precision GENERATED ALWAYS AS (((prediction_json #>> '{predictions,aftershock_distance_probabilities_24h,within_10km}'::text[]))::double precision) STORED NOT NULL,
	"between_10_25km" double precision GENERATED ALWAYS AS (((prediction_json #>> '{predictions,aftershock_distance_probabilities_24h,between_10_25km}'::text[]))::double precision) STORED NOT NULL,
	"between_25_50km" double precision GENERATED ALWAYS AS (((prediction_json #>> '{predictions,aftershock_distance_probabilities_24h,between_25_50km}'::text[]))::double precision) STORED NOT NULL,
	"beyond_50km" double precision GENERATED ALWAYS AS (((prediction_json #>> '{predictions,aftershock_distance_probabilities_24h,beyond_50km}'::text[]))::double precision) STORED NOT NULL,
	"est_max_aftershock" double precision GENERATED ALWAYS AS (((prediction_json #>> '{predictions,estimated_max_aftershock_magnitude_if_aftershock_24h}'::text[]))::double precision) STORED NOT NULL,
	"aftershock_24h_likelihood_level" text GENERATED ALWAYS AS ((prediction_json #>> '{likelihoods,aftershock_24h_likelihood_level}'::text[])) STORED NOT NULL,
	"m5_plus_likelihood_level" text GENERATED ALWAYS AS ((prediction_json #>> '{likelihoods,m5_plus_aftershock_24h_likelihood_level}'::text[])) STORED NOT NULL,
	"aftershock_msg" text GENERATED ALWAYS AS ((prediction_json #>> '{messages,aftershock_24h}'::text[])) STORED NOT NULL,
	"m5_plus_msg" text GENERATED ALWAYS AS ((prediction_json #>> '{messages,m5_plus_aftershock_24h}'::text[])) STORED NOT NULL,
	"distance_msg" text GENERATED ALWAYS AS ((prediction_json #>> '{messages,aftershock_distance_24h}'::text[])) STORED NOT NULL,
	"max_magnitude_msg" text GENERATED ALWAYS AS ((prediction_json #>> '{messages,estimated_max_aftershock_magnitude_24h}'::text[])) STORED NOT NULL
);
--> statement-breakpoint
ALTER TABLE "SeisPredictions_v1" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ScraperRuns" (
	"run_id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name ""ScraperRuns_run_id_seq"" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1),
	"trigger_type" text DEFAULT 'scheduled' NOT NULL,
	"status" text NOT NULL,
	"events_found" integer DEFAULT 0 NOT NULL,
	"events_inserted" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "ScraperRuns_check" CHECK ((finished_at IS NULL) OR (finished_at >= started_at)),
	CONSTRAINT "ScraperRuns_events_found_check" CHECK (events_found >= 0),
	CONSTRAINT "ScraperRuns_events_inserted_check" CHECK (events_inserted >= 0),
	CONSTRAINT "ScraperRuns_status_check" CHECK (status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text])),
	CONSTRAINT "ScraperRuns_trigger_type_check" CHECK (trigger_type = ANY (ARRAY['scheduled'::text, 'manual'::text, 'historical_import'::text]))
);
--> statement-breakpoint
ALTER TABLE "ScraperRuns" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "ProcessingJobs" (
	"job_id" text PRIMARY KEY NOT NULL,
	"event_id" text NOT NULL,
	"scraper_run_id" bigint,
	"status" text NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ProcessingJobs_attempt_count_check" CHECK (attempt_count >= 0),
	CONSTRAINT "ProcessingJobs_check" CHECK ((finished_at IS NULL) OR (started_at IS NULL) OR (finished_at >= started_at)),
	CONSTRAINT "ProcessingJobs_status_check" CHECK (status = ANY (ARRAY['queued'::text, 'running'::text, 'completed'::text, 'failed'::text]))
);
--> statement-breakpoint
ALTER TABLE "ProcessingJobs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "RawEarthquakeEvents" ADD CONSTRAINT "RawEarthquakeEvents_ingestion_run_id_fkey" FOREIGN KEY ("ingestion_run_id") REFERENCES "public"."ScraperRuns"("run_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "SeisPredictions_v1" ADD CONSTRAINT "SeisPredictions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."RawEarthquakeEvents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProcessingJobs" ADD CONSTRAINT "ProcessingJobs_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "public"."RawEarthquakeEvents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ProcessingJobs" ADD CONSTRAINT "ProcessingJobs_scraper_run_id_fkey" FOREIGN KEY ("scraper_run_id") REFERENCES "public"."ScraperRuns"("run_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "index_rawearthquakeevents_event_time" ON "RawEarthquakeEvents" USING btree ("event_time" timestamp_ops);--> statement-breakpoint
CREATE INDEX "raw_earthquake_events_ingestion_run_id_idx" ON "RawEarthquakeEvents" USING btree ("ingestion_run_id" int8_ops);--> statement-breakpoint
CREATE INDEX "processing_jobs_event_id_idx" ON "ProcessingJobs" USING btree ("event_id" text_ops);--> statement-breakpoint
CREATE INDEX "processing_jobs_scraper_run_id_idx" ON "ProcessingJobs" USING btree ("scraper_run_id" int8_ops);--> statement-breakpoint
CREATE POLICY "public map reads events" ON "RawEarthquakeEvents" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);--> statement-breakpoint
CREATE POLICY "public map reads predictions" ON "SeisPredictions_v1" AS PERMISSIVE FOR SELECT TO "anon", "authenticated" USING (true);
*/