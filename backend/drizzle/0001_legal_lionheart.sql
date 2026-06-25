ALTER TABLE "tenants" ALTER COLUMN "settings" SET DEFAULT '{"timezone":"America/New_York","baseRates":{"studio":280,"1br":380,"2br":480,"3br":620,"house":850},"packingFee":120}'::jsonb;--> statement-breakpoint
ALTER TABLE "clients" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
CREATE UNIQUE INDEX "clients_tenant_phone_idx" ON "clients" USING btree ("tenant_id","phone");--> statement-breakpoint
CREATE INDEX "clients_tenant_name_idx" ON "clients" USING btree ("tenant_id","name");--> statement-breakpoint
CREATE INDEX "crews_tenant_active_idx" ON "crews" USING btree ("tenant_id","active");--> statement-breakpoint
CREATE INDEX "invoices_tenant_status_idx" ON "invoices" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "invoices_order_id_idx" ON "invoices" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "orders_tenant_move_date_idx" ON "orders" USING btree ("tenant_id","move_date");--> statement-breakpoint
CREATE INDEX "orders_tenant_status_idx" ON "orders" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "orders_client_id_idx" ON "orders" USING btree ("client_id","tenant_id");--> statement-breakpoint
CREATE INDEX "orders_crew_move_date_idx" ON "orders" USING btree ("crew_id","move_date");--> statement-breakpoint
CREATE INDEX "users_tenant_id_idx" ON "users" USING btree ("tenant_id");