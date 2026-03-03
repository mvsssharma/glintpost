-- Enable Row Level Security on all tables
-- Since the app uses direct Prisma connections (which bypass RLS),
-- this blocks unauthorized access via Supabase anon/public client.

ALTER TABLE "User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Account" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "VerificationToken" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrgSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Post" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PostTranslation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EngagementEvent" ENABLE ROW LEVEL SECURITY;
