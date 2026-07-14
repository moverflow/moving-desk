ALTER TABLE "orders" ADD COLUMN "contract_status" varchar(20) DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "contract_token" uuid;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "contract_signed_at" timestamp;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "contract_signed_name" varchar(255);--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "contract_signature_url" text;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_contract_token_unique" UNIQUE("contract_token");