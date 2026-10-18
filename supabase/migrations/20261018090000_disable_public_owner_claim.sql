-- Ownership must be provisioned by a trusted operator, never by the first
-- authenticated account to reach a public RPC.
drop function if exists public.claim_owner();
