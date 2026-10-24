-- NAVO HSE: let the server (service role) run the numbering and guard triggers.
-- Needed for reports sent without an account (QR reporting) and access requests. Safe to run more than once.
grant usage on schema navo_private to service_role;
grant execute on all functions in schema navo_private to service_role;
grant usage, select on all sequences in schema public to service_role;
