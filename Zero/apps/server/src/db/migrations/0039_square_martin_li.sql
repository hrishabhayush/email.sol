CREATE TABLE "mail0_email_wallet" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"wallet_address" text NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mail0_email_wallet_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "email_wallet_email_idx" ON "mail0_email_wallet" USING btree ("email");--> statement-breakpoint
CREATE INDEX "email_wallet_wallet_address_idx" ON "mail0_email_wallet" USING btree ("wallet_address");--> statement-breakpoint
CREATE INDEX "email_wallet_verified_idx" ON "mail0_email_wallet" USING btree ("verified");