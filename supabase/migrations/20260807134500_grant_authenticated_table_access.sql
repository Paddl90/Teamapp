-- PostgreSQL privileges and RLS are separate layers. These grants allow
-- authenticated requests to reach the policies defined on each table.
-- The policies still decide which rows and operations are permitted.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
