CREATE TABLE "invoice_counters" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"last_number" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice_counters" ADD CONSTRAINT "invoice_counters_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;