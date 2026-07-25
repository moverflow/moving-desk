CREATE TABLE "stripe_events" (
	"id" varchar(255) PRIMARY KEY NOT NULL,
	"customer_id" varchar(255),
	"type" varchar(100) NOT NULL,
	"created" timestamp NOT NULL,
	"processed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX "stripe_events_customer_created_idx" ON "stripe_events" USING btree ("customer_id","created");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_tenant_number_idx" ON "invoices" USING btree ("tenant_id","number");