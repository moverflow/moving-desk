ALTER TABLE "invites" ADD COLUMN "role" varchar(20) DEFAULT 'dispatcher' NOT NULL;--> statement-breakpoint
ALTER TABLE "invites" ADD COLUMN "crew_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "crew_id" uuid;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_crew_id_crews_id_fk" FOREIGN KEY ("crew_id") REFERENCES "public"."crews"("id") ON DELETE no action ON UPDATE no action;