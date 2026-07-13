import { pgTable, index, foreignKey, unique, pgPolicy, text, doublePrecision, bigint, timestamp, jsonb, check, integer } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const rawEarthquakeEvents = pgTable("RawEarthquakeEvents", {
	id: text().primaryKey().notNull(),
	dateTime: text("Date-Time").notNull(),
	latitude: doublePrecision("Latitude").notNull(),
	longitude: doublePrecision("Longitude").notNull(),
	depth: text("Depth").notNull(),
	magnitude: doublePrecision("Magnitude").notNull(),
	location: text("Location"),
	month: text("Month").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	year: bigint("Year", { mode: "number" }).notNull(),
	eventTime: timestamp("event_time", { mode: 'string' }),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	ingestionRunId: bigint("ingestion_run_id", { mode: "number" }).notNull(),
}, (table) => [
	index("index_rawearthquakeevents_event_time").using("btree", table.eventTime.desc().nullsFirst().op("timestamp_ops")),
	index("raw_earthquake_events_ingestion_run_id_idx").using("btree", table.ingestionRunId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.ingestionRunId],
			foreignColumns: [scraperRuns.runId],
			name: "RawEarthquakeEvents_ingestion_run_id_fkey"
		}),
	unique("unique_event").on(table.dateTime, table.latitude, table.longitude, table.depth, table.magnitude),
	pgPolicy("public map reads events", { as: "permissive", for: "select", to: ["anon", "authenticated"], using: sql`true` }),
]);

export const seisPredictionsV1 = pgTable("SeisPredictions_v1", {
	eventId: text("event_id").primaryKey().notNull(),
	predictionJson: jsonb("prediction_json").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	aftershock24H: doublePrecision("aftershock_24h").notNull().generatedAlwaysAs(sql`((prediction_json #>> '{predictions,aftershock_24h_probability}'::text[]))::double precision`),
	m5PlusAftershock: doublePrecision("m5_plus_aftershock").notNull().generatedAlwaysAs(sql`((prediction_json #>> '{predictions,m5_plus_aftershock_24h_probability}'::text[]))::double precision`),
	within10Km: doublePrecision("within_10km").notNull().generatedAlwaysAs(sql`((prediction_json #>> '{predictions,aftershock_distance_probabilities_24h,within_10km}'::text[]))::double precision`),
	between1025Km: doublePrecision("between_10_25km").notNull().generatedAlwaysAs(sql`((prediction_json #>> '{predictions,aftershock_distance_probabilities_24h,between_10_25km}'::text[]))::double precision`),
	between2550Km: doublePrecision("between_25_50km").notNull().generatedAlwaysAs(sql`((prediction_json #>> '{predictions,aftershock_distance_probabilities_24h,between_25_50km}'::text[]))::double precision`),
	beyond50Km: doublePrecision("beyond_50km").notNull().generatedAlwaysAs(sql`((prediction_json #>> '{predictions,aftershock_distance_probabilities_24h,beyond_50km}'::text[]))::double precision`),
	estMaxAftershock: doublePrecision("est_max_aftershock").notNull().generatedAlwaysAs(sql`((prediction_json #>> '{predictions,estimated_max_aftershock_magnitude_if_aftershock_24h}'::text[]))::double precision`),
	aftershock24HLikelihoodLevel: text("aftershock_24h_likelihood_level").notNull().generatedAlwaysAs(sql`(prediction_json #>> '{likelihoods,aftershock_24h_likelihood_level}'::text[])`),
	m5PlusLikelihoodLevel: text("m5_plus_likelihood_level").notNull().generatedAlwaysAs(sql`(prediction_json #>> '{likelihoods,m5_plus_aftershock_24h_likelihood_level}'::text[])`),
	aftershockMsg: text("aftershock_msg").notNull().generatedAlwaysAs(sql`(prediction_json #>> '{messages,aftershock_24h}'::text[])`),
	m5PlusMsg: text("m5_plus_msg").notNull().generatedAlwaysAs(sql`(prediction_json #>> '{messages,m5_plus_aftershock_24h}'::text[])`),
	distanceMsg: text("distance_msg").notNull().generatedAlwaysAs(sql`(prediction_json #>> '{messages,aftershock_distance_24h}'::text[])`),
	maxMagnitudeMsg: text("max_magnitude_msg").notNull().generatedAlwaysAs(sql`(prediction_json #>> '{messages,estimated_max_aftershock_magnitude_24h}'::text[])`),
}, (table) => [
	foreignKey({
			columns: [table.eventId],
			foreignColumns: [rawEarthquakeEvents.id],
			name: "SeisPredictions_event_id_fkey"
		}).onDelete("cascade"),
	pgPolicy("public map reads predictions", { as: "permissive", for: "select", to: ["anon", "authenticated"], using: sql`true` }),
]);

export const scraperRuns = pgTable("ScraperRuns", {
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	runId: bigint("run_id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity({ name: "ScraperRuns_run_id_seq", startWith: 1, increment: 1, minValue: 1, maxValue: 9223372036854775807 }),
	triggerType: text("trigger_type").default('scheduled').notNull(),
	status: text().notNull(),
	eventsFound: integer("events_found").default(0).notNull(),
	eventsInserted: integer("events_inserted").default(0).notNull(),
	errorMessage: text("error_message"),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	check("ScraperRuns_check", sql`(finished_at IS NULL) OR (finished_at >= started_at)`),
	check("ScraperRuns_events_found_check", sql`events_found >= 0`),
	check("ScraperRuns_events_inserted_check", sql`events_inserted >= 0`),
	check("ScraperRuns_status_check", sql`status = ANY (ARRAY['running'::text, 'completed'::text, 'failed'::text])`),
	check("ScraperRuns_trigger_type_check", sql`trigger_type = ANY (ARRAY['scheduled'::text, 'manual'::text, 'historical_import'::text])`),
]);

export const processingJobs = pgTable("ProcessingJobs", {
	jobId: text("job_id").primaryKey().notNull(),
	eventId: text("event_id").notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	scraperRunId: bigint("scraper_run_id", { mode: "number" }),
	status: text().notNull(),
	attemptCount: integer("attempt_count").default(0).notNull(),
	errorMessage: text("error_message"),
	startedAt: timestamp("started_at", { withTimezone: true, mode: 'string' }),
	finishedAt: timestamp("finished_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("processing_jobs_event_id_idx").using("btree", table.eventId.asc().nullsLast().op("text_ops")),
	index("processing_jobs_scraper_run_id_idx").using("btree", table.scraperRunId.asc().nullsLast().op("int8_ops")),
	foreignKey({
			columns: [table.eventId],
			foreignColumns: [rawEarthquakeEvents.id],
			name: "ProcessingJobs_event_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.scraperRunId],
			foreignColumns: [scraperRuns.runId],
			name: "ProcessingJobs_scraper_run_id_fkey"
		}),
	check("ProcessingJobs_attempt_count_check", sql`attempt_count >= 0`),
	check("ProcessingJobs_check", sql`(finished_at IS NULL) OR (started_at IS NULL) OR (finished_at >= started_at)`),
	check("ProcessingJobs_status_check", sql`status = ANY (ARRAY['queued'::text, 'running'::text, 'completed'::text, 'failed'::text])`),
]);
