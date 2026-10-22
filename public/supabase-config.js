// Supabase project values (Supabase dashboard > Project Settings > API Keys).
// The publishable key is meant to be public: access is protected by the Row Level Security rules in supabase/.
// Never put a secret / service_role key in this file.
//
// Two environments:
//   production — the live site (navo-hse.vercel.app and any custom domain listed in PRODUCTION_HOSTS)
//   staging    — every other address (Vercel preview links, localhost). It uses the staging project below once it is filled in.
(function () {
  const PRODUCTION = { url: "https://gvktcleqiidtmgqxbzsy.supabase.co", anonKey: "sb_publishable_9N-3NV87mniwgZB0dw3IVA_bqK3ppNb" };
  const STAGING = { url: "", anonKey: "" }; // fill in from the staging Supabase project (docs/RUNBOOK.md → Staging)
  const PRODUCTION_HOSTS = ["navo-hse.vercel.app"];
  const live = PRODUCTION_HOSTS.includes(location.hostname);
  const useStaging = !live && STAGING.url && STAGING.anonKey;
  window.NAVO_ENV = live ? "production" : useStaging ? "staging" : "preview-on-live-data";
  window.NAVO_SUPABASE_CONFIG = useStaging ? STAGING : PRODUCTION;
})();
