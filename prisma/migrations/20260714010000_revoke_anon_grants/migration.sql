-- Revoke all privileges on the public schema from Supabase's `anon` and
-- `authenticated` roles.
--
-- Glintpost does not use a Supabase client: every query goes through Prisma on a
-- direct connection as the table owner. Those two roles therefore need no access
-- at all. Supabase grants them SELECT on public tables by default, and pg_graphql
-- reflects anything they can SELECT into the public GraphQL schema — which leaks
-- the schema shape (User, Session, VerificationToken, ...) to anyone holding the
-- public anon key, even with RLS enabled. Revoking USAGE on the schema removes
-- the tables from the GraphQL/PostgREST surface entirely.
--
-- The ALTER DEFAULT PRIVILEGES statements are the durable half: without them, the
-- next table created by `postgres` re-acquires the default grants and the lint
-- comes back.
--
-- Guarded on role existence so this is a no-op on plain Postgres (self-hosted
-- Docker), where `anon` and `authenticated` do not exist.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
     AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN

    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;
    REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM anon, authenticated;
    REVOKE USAGE ON SCHEMA public FROM anon, authenticated;

    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
      REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

    -- Default privileges are per-granting-role: the unqualified form above only
    -- covers the role running this migration. Name `postgres` explicitly too,
    -- since that is the role Prisma creates tables as.
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
      REVOKE ALL ON TABLES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
      REVOKE ALL ON SEQUENCES FROM anon, authenticated;
    ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
      REVOKE ALL ON FUNCTIONS FROM anon, authenticated;

  END IF;
END
$$;
