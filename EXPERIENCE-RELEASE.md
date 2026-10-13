# NAVO experience and identity release

The previous menu exposed separate registration and search screens alongside every operational module. The new shell has six horizontal destinations: Overview, Records, Actions, Assurance, Leadership and Administration. Subsections and form steps are horizontal. Records combines registration, global reference search, type/status/project/date filters, saved filters, export and 30-row pagination. Legacy reporting streams remain accessible and are deduplicated by record identity.

The executive dashboard shares the shell, uses restrained cards and inline vector graphics, keeps all three million-hour frequency panels, and collapses duplicate export controls. Partial initial data loads show a loading state instead of misleading zero rates.

A private RLS-protected reservation ledger makes references unique across cases, reports, inspections, actions, activities, HSSE records and monthly reviews. A projection of the same record shares its number; different records cannot. Drafts receive a number at creation and retain it on submission. Reservations survive deletion and reject collisions even after a sequence reset. Existing references remain intact.

Linked actions show current operational status, evidence workflow, deadlines and their own reference. Action details link back to the originating record. Legacy inspection answers and operational details are visible in the unified register. Existing workflows and project permissions remain enforced.

Validation: seven form paths; desktop top navigation; mobile width; type filters and pagination across legacy streams; action/source navigation; partial-data loading; SQL idempotence; project and medical privacy; same-identity upserts; discarded draft tombstones; client-supplied reference rejection; cross-family UUID and cross-table number collision rejection.

AI remains connected to Anthropic but requires provider credits to generate analyses. The UI reports this blocker and allows manual assessments. Predictive reporting baseline is workload estimation, not a calibrated probability of injury.
