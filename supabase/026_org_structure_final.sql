-- NAVO HSE: organisation structure exactly as agreed with the client (Oct 2026). Safe to run more than once.
-- Construction platform (Bahrain, KSA, UAE):
--   Contracting (Construction, Infrastructure, Asphalt), MEP, Asphalt, Plant (Central Garage, Quarry, Yard),
--   Industrial Service, Landscapes
-- Non-Construction platform:
--   Precast & Readymix, Food, Logistics, Sand plant, Ice plant, Scafform, Commercial (Heavy equipment dealer/showroom)
insert into public.settings (id, data) values ('structure', '{}'::jsonb) on conflict (id) do nothing;
update public.settings set data = jsonb_set(jsonb_set(data, '{countries}', '["Bahrain", "KSA", "UAE"]'::jsonb), '{platforms}', '[
  {"name": "Construction", "businesses": [
    {"name": "Contracting", "clusters": ["Construction", "Infrastructure", "Asphalt"]},
    {"name": "MEP", "clusters": []},
    {"name": "Asphalt", "clusters": []},
    {"name": "Plant", "clusters": ["Central Garage", "Quarry", "Yard"]},
    {"name": "Industrial Service", "clusters": []},
    {"name": "Landscapes", "clusters": []}]},
  {"name": "Non-Construction", "businesses": [
    {"name": "Precast & Readymix", "clusters": []},
    {"name": "Food", "clusters": []},
    {"name": "Logistics", "clusters": []},
    {"name": "Sand plant", "clusters": []},
    {"name": "Ice plant", "clusters": []},
    {"name": "Scafform", "clusters": []},
    {"name": "Commercial (Heavy equipment dealer/showroom)", "clusters": []}]}
]'::jsonb) where id = 'structure';
update public.projects set division = 'Industrial Service' where division in ('NIS', 'Industrial Services');
update public.projects set division = 'Commercial (Heavy equipment dealer/showroom)' where division in ('Commercial (heavy equipment)', 'Commercial');
update public.projects set cluster = 'Quarry' where cluster in ('Quary');
