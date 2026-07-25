CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"type" varchar(40) NOT NULL,
	"title" varchar(255) NOT NULL,
	"body" text,
	"related_type" varchar(20),
	"related_id" uuid,
	"read_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notifications_tenant_created_idx" ON "notifications" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "notifications_tenant_read_at_idx" ON "notifications" USING btree ("tenant_id","read_at");--> statement-breakpoint
CREATE INDEX "notifications_tenant_related_idx" ON "notifications" USING btree ("tenant_id","type","related_id");