import { relations } from "drizzle-orm/relations";
import { scraperRuns, rawEarthquakeEvents, seisPredictionsV1, processingJobs } from "./schema";

export const rawEarthquakeEventsRelations = relations(rawEarthquakeEvents, ({one, many}) => ({
	scraperRun: one(scraperRuns, {
		fields: [rawEarthquakeEvents.ingestionRunId],
		references: [scraperRuns.runId]
	}),
	seisPredictionsV1s: many(seisPredictionsV1),
	processingJobs: many(processingJobs),
}));

export const scraperRunsRelations = relations(scraperRuns, ({many}) => ({
	rawEarthquakeEvents: many(rawEarthquakeEvents),
	processingJobs: many(processingJobs),
}));

export const seisPredictionsV1Relations = relations(seisPredictionsV1, ({one}) => ({
	rawEarthquakeEvent: one(rawEarthquakeEvents, {
		fields: [seisPredictionsV1.eventId],
		references: [rawEarthquakeEvents.id]
	}),
}));

export const processingJobsRelations = relations(processingJobs, ({one}) => ({
	rawEarthquakeEvent: one(rawEarthquakeEvents, {
		fields: [processingJobs.eventId],
		references: [rawEarthquakeEvents.id]
	}),
	scraperRun: one(scraperRuns, {
		fields: [processingJobs.scraperRunId],
		references: [scraperRuns.runId]
	}),
}));