/* NAVO professional inspection library.
   Each checklist: id, name, category, platforms, sections. Each question: [text, critical, evidence].
   critical = a failed answer is a critical control gap (high priority, 3-day action).
   evidence = photo or note expected when the answer is At risk.
   The library is the default; administrators can still edit and publish revisions in the Checklist builder. */
'use strict';
const NV_CL = [
 /* ---------------- CONSTRUCTION ---------------- */
 { id: 'pro-site', name: 'General Site HSE Inspection', category: 'Construction · General', platforms: ['Construction'], sections: [
  ['Site set-up & access', [
   ['Site perimeter fenced and secured; gates controlled', 0, 0],
   ['Visitors and new workers inducted and recorded before access', 0, 1],
   ['Site HSE notice board current (policy, emergency numbers, permits in force)', 0, 0],
   ['Segregated pedestrian routes separated from plant and vehicles', 1, 1]]],
  ['Housekeeping', [
   ['Walkways, stairs and access routes clear of materials and debris', 0, 1],
   ['Materials stacked stable, not above safe height, away from edges', 0, 1],
   ['Waste segregated and removed; skips not overfilled', 0, 0],
   ['Protruding rebar capped; nails and sharp edges removed', 0, 1]]],
  ['Signage & barricades', [
   ['Hazard areas barricaded with hard barriers where a fall or strike can occur', 1, 1],
   ['Safety signs posted at hazards, in the workforce languages', 0, 0],
   ['Openings and edges covered or protected and marked', 1, 1]]],
  ['People & PPE', [
   ['Required PPE worn correctly (helmet, boots, vest, glasses, gloves)', 1, 0],
   ['Task-specific PPE in use (harness, respirator, face shield, hearing)', 1, 1],
   ['Supervisor present and aware of the day’s high-risk activities', 0, 0],
   ['Toolbox talk delivered today and attendance recorded', 0, 1]]],
  ['Emergency preparedness', [
   ['Emergency assembly point marked and routes clear', 0, 0],
   ['First aid kit stocked; trained first aider identified on shift', 0, 0],
   ['Fire extinguishers in place, inspected and accessible', 1, 1],
   ['Emergency contact numbers and rescue plan known by supervisors', 0, 0]]]] },

 { id: 'pro-wah', name: 'Work at Height & Fall Protection', category: 'Construction · High risk', platforms: ['Construction', 'Non-Construction'], sections: [
  ['Planning', [
   ['Work at height avoided where reasonably practicable (ground assembly, MEWP)', 0, 0],
   ['Permit / method statement covers the task and is at the workface', 1, 1],
   ['Rescue plan in place and rescue equipment available', 1, 1]]],
  ['Collective protection', [
   ['Edges protected with guardrails (top, mid rail, toe board)', 1, 1],
   ['Floor openings covered, secured and marked', 1, 1],
   ['Safety nets or catch platforms installed where specified', 0, 0]]],
  ['Personal fall arrest', [
   ['Full body harness inspected, tagged and correctly fitted', 1, 1],
   ['Lanyard anchored to a certified anchor point above the user', 1, 1],
   ['100% tie-off maintained during transfer (twin lanyard)', 1, 0],
   ['Fall clearance adequate for the lanyard/shock absorber used', 1, 0]]],
  ['Ladders & MEWPs', [
   ['Ladders used only for short-duration light work; secured and in good condition', 0, 1],
   ['MEWP inspected, operator certified, harness clipped in basket', 1, 1],
   ['Exclusion zone below the work area; tools tethered', 1, 0]]]] },

 { id: 'pro-scaff', name: 'Scaffolding', category: 'Construction · High risk', platforms: ['Construction', 'Non-Construction'], sections: [
  ['Status & inspection', [
   ['Scaffold tagged (green) and inspected within the last 7 days', 1, 1],
   ['Erected and altered only by competent scaffolders', 1, 0],
   ['Red-tagged / incomplete scaffolds barricaded and not used', 1, 1]]],
  ['Structure', [
   ['Base plates and sole boards on firm level ground', 1, 1],
   ['Ties and bracing installed as per design', 1, 0],
   ['Platforms fully boarded, boards secured, no gaps', 1, 1],
   ['Guardrails and toe boards on all open sides', 1, 1]]],
  ['Access & use', [
   ['Safe access by ladder or stair tower; ladder extends 1 m above landing', 0, 1],
   ['Platform not overloaded; materials within the rated load', 0, 0],
   ['Scaffold clear of overhead power lines', 1, 0]]]] },

 { id: 'pro-exc', name: 'Excavation & Trenching', category: 'Construction · High risk', platforms: ['Construction'], sections: [
  ['Before digging', [
   ['Excavation permit issued; underground services located and marked', 1, 1],
   ['Utility drawings checked; cable avoidance tool used', 1, 0]]],
  ['Stability', [
   ['Sides shored, sloped or benched per depth and soil type', 1, 1],
   ['Spoil and materials at least 1 m from the edge', 0, 0],
   ['Daily inspection by competent person recorded', 0, 1],
   ['Water ingress controlled; no undermining of adjacent structures', 1, 0]]],
  ['Edges & access', [
   ['Hard barriers and signage around the excavation', 1, 1],
   ['Ladder access within 7.5 m of any worker in trenches over 1.2 m', 1, 0],
   ['Stop blocks for vehicles approaching the edge', 1, 0]]],
  ['Atmosphere', [
   ['Gas test done where fumes or low oxygen are possible', 1, 1]]]] },

 { id: 'pro-lift', name: 'Lifting Operations & Cranes', category: 'Construction · High risk', platforms: ['Construction', 'Non-Construction'], sections: [
  ['Planning', [
   ['Lift plan approved; critical lifts reviewed by engineer', 1, 1],
   ['Ground bearing capacity verified; outriggers on mats', 1, 1],
   ['Weather / wind speed within crane limits', 1, 0]]],
  ['Equipment', [
   ['Crane third-party certificate valid; daily checks completed', 1, 1],
   ['Lifting accessories certified, tagged, colour-coded and inspected', 1, 1],
   ['Load moment indicator and limit switches working', 1, 0]]],
  ['People', [
   ['Operator and rigger/signaller certified and identified', 1, 1],
   ['Exclusion zone barricaded; no one under suspended load', 1, 1],
   ['Tag lines used to control the load', 0, 0],
   ['Clear communication (radio / agreed signals) between signaller and operator', 0, 0]]]] },

 { id: 'pro-elec', name: 'Electrical Safety & Temporary Power', category: 'Construction · High risk', platforms: ['Construction', 'Non-Construction'], sections: [
  ['Distribution', [
   ['Distribution boards closed, labelled and locked; RCD/ELCB fitted and tested', 1, 1],
   ['Temporary cables routed overhead or protected; not in water', 0, 1],
   ['Industrial plugs and sockets; no exposed conductors or taped joints', 1, 1]]],
  ['Equipment', [
   ['Portable tools inspected and tagged (colour code current)', 0, 1],
   ['Generators earthed and fuel stored safely', 0, 0]]],
  ['Isolation', [
   ['Work on electrical systems only under permit with LOTO applied', 1, 1],
   ['Only authorised electricians work on live panels', 1, 0],
   ['Overhead power line clearances marked with goal posts', 1, 1]]]] },

 { id: 'pro-hot', name: 'Hot Work', category: 'Construction · High risk', platforms: ['Construction', 'Non-Construction'], sections: [
  ['Permit', [
   ['Hot work permit valid and displayed at the workface', 1, 1],
   ['Gas test done where flammables may be present', 1, 1]]],
  ['Fire prevention', [
   ['Combustibles removed or covered within 11 m', 1, 1],
   ['Fire watch assigned with extinguisher; stays 30 min after work', 1, 0],
   ['Fire blankets / screens protect people and materials nearby', 0, 0]]],
  ['Equipment', [
   ['Gas cylinders upright, secured, caps on, flashback arrestors fitted', 1, 1],
   ['Welding cables and earth clamps in good condition', 0, 0],
   ['Welders wear correct PPE (shield, gloves, FR clothing)', 0, 0]]]] },

 { id: 'pro-cse', name: 'Confined Space Entry', category: 'Construction · High risk', platforms: ['Construction', 'Non-Construction'], sections: [
  ['Authorisation', [
   ['Confined space permit issued and in date', 1, 1],
   ['Entrants, standby and supervisor trained and named on the permit', 1, 0]]],
  ['Atmosphere', [
   ['Gas test before entry and continuous monitoring (O2, LEL, H2S, CO)', 1, 1],
   ['Ventilation in place and effective', 1, 0],
   ['All energy sources and lines isolated and locked', 1, 1]]],
  ['Rescue', [
   ['Standby person at the entry at all times', 1, 0],
   ['Rescue equipment (tripod, winch, harness, BA) ready at the entry', 1, 1],
   ['Entry / exit log maintained', 0, 1]]]] },

 { id: 'pro-ptw', name: 'Permit to Work & Energy Isolation (LOTO)', category: 'Construction · High risk', platforms: ['Construction', 'Non-Construction'], sections: [
  ['Permit quality', [
   ['Permit covers the actual task, location and time', 1, 1],
   ['Risk assessment / JSA attached and briefed to the crew', 1, 1],
   ['Permit signed by issuer, receiver and area authority', 1, 0],
   ['Simultaneous operations identified and coordinated', 0, 0]]],
  ['Isolation', [
   ['Isolation points identified on the permit', 1, 0],
   ['Locks and tags applied by each worker; key control in place', 1, 1],
   ['Zero-energy verified (try-out) before work', 1, 0]]],
  ['Close-out', [
   ['Permit closed out and area returned safe', 0, 1]]]] },

 { id: 'pro-plant', name: 'Plant, Vehicles & Traffic Management', category: 'Construction · High risk', platforms: ['Construction', 'Non-Construction'], sections: [
  ['Traffic plan', [
   ['Traffic management plan in place; routes, speed limits and parking marked', 1, 1],
   ['Banksman used for reversing and blind areas', 1, 0],
   ['Pedestrians separated from moving plant', 1, 1]]],
  ['Equipment', [
   ['Plant third-party certified; daily pre-use checklist completed', 1, 1],
   ['Reverse alarm, beacon, mirrors, cameras and seat belts working', 1, 0],
   ['No passengers unless a seat is provided', 0, 0]]],
  ['Operators', [
   ['Operators licensed and authorised for the equipment', 1, 1],
   ['Fatigue and driving hours managed', 0, 0]]]] },

 { id: 'pro-tools', name: 'Hand & Power Tools', category: 'Construction · General', platforms: ['Construction', 'Non-Construction'], sections: [
  ['Condition', [
   ['Tools inspected, tagged and free from damage', 0, 1],
   ['Guards fitted on grinders and saws; correct disc for RPM', 1, 1],
   ['Homemade or modified tools not in use', 0, 0]]],
  ['Use', [
   ['Right tool for the job; used per manufacturer instructions', 0, 0],
   ['Eye, face and hand protection worn', 0, 0],
   ['Tools stored safely after use', 0, 0]]]] },

 { id: 'pro-fire', name: 'Fire Prevention & Protection', category: 'Construction · General', platforms: ['Construction', 'Non-Construction'], sections: [
  ['Prevention', [
   ['Flammable materials stored in approved areas with signage', 1, 1],
   ['No smoking enforced outside designated areas', 0, 0],
   ['Electrical overload and heat sources controlled', 0, 0]]],
  ['Protection', [
   ['Extinguishers right type, inspected monthly, unobstructed', 1, 1],
   ['Fire alarm / detection working where installed', 1, 0],
   ['Escape routes and exits clear and signed', 1, 1],
   ['Fire drill completed within the planned period', 0, 1]]]] },

 { id: 'pro-coshh', name: 'Hazardous Substances & Gas Cylinders', category: 'Construction · General', platforms: ['Construction', 'Non-Construction'], sections: [
  ['Control', [
   ['Chemical inventory and SDS available at the point of use', 0, 1],
   ['Containers labelled; no unlabelled decanting', 0, 1],
   ['COSHH / chemical risk assessment briefed to users', 0, 0],
   ['Correct PPE and RPE worn for the substance', 1, 0]]],
  ['Storage', [
   ['Stored with secondary containment and segregation of incompatibles', 1, 1],
   ['Gas cylinders upright, chained, caps on; full and empty separated', 1, 1],
   ['Spill kit available and stocked', 0, 0]]]] },

 { id: 'pro-form', name: 'Formwork, Concrete & Rebar', category: 'Construction · General', platforms: ['Construction'], sections: [
  ['Formwork', [
   ['Formwork and falsework designed and checked before pour', 1, 1],
   ['Props plumb, braced and on firm bases', 1, 0],
   ['Striking only after approval', 0, 0]]],
  ['Concrete & rebar', [
   ['Pump boom and pipelines secured; exclusion zone during pumping', 1, 0],
   ['Rebar ends capped; rebar cages stable and braced', 1, 1],
   ['Cement skin and eye protection in use', 0, 0]]]] },

 { id: 'pro-demo', name: 'Demolition', category: 'Construction · High risk', platforms: ['Construction'], sections: [
  ['Planning', [
   ['Demolition plan and engineering survey approved', 1, 1],
   ['Services disconnected and asbestos / hazardous material survey done', 1, 1]]],
  ['Control', [
   ['Exclusion zone and debris protection in place', 1, 1],
   ['Structure stability maintained during sequence', 1, 0],
   ['Dust and noise controls applied', 0, 0]]]] },

 { id: 'pro-heat', name: 'Heat Stress Management', category: 'Construction · Health', platforms: ['Construction', 'Non-Construction'], sections: [
  ['Planning', [
   ['Heat index monitored and work/rest regime applied', 1, 1],
   ['Midday work ban observed (summer hours)', 1, 0],
   ['New and returning workers acclimatised', 0, 0]]],
  ['Welfare', [
   ['Cool drinking water available within reach of every crew', 1, 1],
   ['Shaded / cooled rest areas provided', 0, 1],
   ['Workers and supervisors trained to recognise heat illness', 0, 0]]]] },

 { id: 'pro-env', name: 'Environmental Management', category: 'Construction · Environment', platforms: ['Construction', 'Non-Construction'], sections: [
  ['Waste', [
   ['Waste segregated (general, recyclable, hazardous) and labelled', 0, 1],
   ['Hazardous waste stored, manifested and disposed by licensed carrier', 1, 1]]],
  ['Pollution', [
   ['Fuel and oil stored on drip trays / bunded areas', 1, 1],
   ['No evidence of spills to soil, drains or sea', 1, 1],
   ['Dust suppression applied on haul roads and stockpiles', 0, 0],
   ['Noise and working hours within permit limits', 0, 0]]],
  ['Resources', [
   ['Water and energy use monitored; leaks reported', 0, 0]]]] },

 { id: 'pro-welfare', name: 'Welfare & Labour Accommodation', category: 'Construction · Health', platforms: ['Construction', 'Non-Construction'], sections: [
  ['Facilities', [
   ['Toilets and washing facilities clean and adequate for headcount', 0, 1],
   ['Eating areas clean, shaded and separated from work', 0, 0],
   ['Drinking water potable and tested', 1, 1]]],
  ['Accommodation', [
   ['Rooms not overcrowded; ventilation and AC working', 0, 1],
   ['Fire detection, extinguishers and exits in accommodation', 1, 1],
   ['Grievance mechanism available and known by workers', 0, 0]]]] },

 /* ---------------- NON-CONSTRUCTION ---------------- */
 { id: 'pro-wh', name: 'Warehouse & Logistics', category: 'Non-Construction', platforms: ['Non-Construction'], sections: [
  ['Storage', [
   ['Racking inspected, load signs displayed, no damaged uprights', 1, 1],
   ['Heavy items stored low; no overhanging loads', 0, 0],
   ['Aisles and fire exits clear', 1, 1]]],
  ['Material handling', [
   ['Forklift drivers licensed; pre-use checks completed', 1, 1],
   ['Pedestrian walkways marked and separated from forklifts', 1, 0],
   ['Loading bays: wheel chocks / dock locks used', 1, 0],
   ['Manual handling aids available and used', 0, 0]]]] },

 { id: 'pro-shop', name: 'Workshop & Maintenance', category: 'Non-Construction', platforms: ['Non-Construction', 'Construction'], sections: [
  ['Machinery', [
   ['Machine guards in place and interlocks working', 1, 1],
   ['Emergency stops working and accessible', 1, 0],
   ['LOTO applied for maintenance and cleaning', 1, 1]]],
  ['Workplace', [
   ['Compressed air, hoses and pressure vessels certified', 1, 1],
   ['Floors free from oil and slip hazards', 0, 0],
   ['Local exhaust ventilation working for fumes and dust', 0, 0]]]] },

 { id: 'pro-office', name: 'Office & Facility', category: 'Non-Construction', platforms: ['Non-Construction', 'Construction'], sections: [
  ['Workplace', [
   ['Workstations ergonomic (chair, screen height, lighting)', 0, 0],
   ['Cables managed; no trailing leads or overloaded sockets', 0, 1],
   ['Floors, stairs and handrails in good condition', 0, 0]]],
  ['Emergency', [
   ['Fire exits signed, lit and unobstructed', 1, 1],
   ['Fire wardens and first aiders named and posted', 0, 0],
   ['Evacuation drill done in the planned period', 0, 1]]]] },

 { id: 'pro-food', name: 'Food Production Facility', category: 'Non-Construction', platforms: ['Non-Construction'], sections: [
  ['Hygiene', [
   ['Hand washing stations stocked and used', 0, 0],
   ['Hair nets, gloves and clean uniforms worn', 0, 0],
   ['Temperature records for cold and hot holding in range', 1, 1]]],
  ['Safety', [
   ['Slicers, mixers and conveyors guarded', 1, 1],
   ['Cold store doors open from inside; alarm working', 1, 0],
   ['Cleaning chemicals labelled and stored apart from food', 1, 1],
   ['Floors dry; anti-slip footwear worn', 0, 0]]]] },

 { id: 'pro-plantops', name: 'Batching, Readymix & Precast Plant', category: 'Non-Construction', platforms: ['Non-Construction'], sections: [
  ['Process', [
   ['Conveyors guarded with pull-cord stops', 1, 1],
   ['Silo and mixer entry only under confined space permit', 1, 1],
   ['Dust collection and filters working', 0, 0]]],
  ['Yard', [
   ['Precast units stored on stable racks / dunnage', 1, 1],
   ['Truck movements controlled with marked routes and banksman', 1, 0],
   ['Gantry crane certified and operators authorised', 1, 1]]]] },

 /* ---------------- SYSTEM & LEADERSHIP ---------------- */
 { id: 'pro-con', name: 'Contractor HSE Management Review', category: 'Management system', platforms: ['Construction', 'Non-Construction'], sections: [
  ['Documents', [
   ['Contractor HSE plan approved and current', 0, 1],
   ['Risk assessments and method statements for active work', 1, 1],
   ['Competency certificates valid for critical roles', 1, 1]]],
  ['Performance', [
   ['Incidents reported and investigated within required time', 1, 0],
   ['Corrective actions closed by due date', 0, 1],
   ['Toolbox talks and HSE meetings held as planned', 0, 1]]]] },

 { id: 'pro-walk', name: 'Leadership Safety Walk', category: 'Leadership', platforms: ['Construction', 'Non-Construction'], sections: [
  ['Engagement', [
   ['Leader engaged with at least three workers about their task risks', 0, 0],
   ['Safe behaviour recognised', 0, 0],
   ['At-risk behaviour discussed and corrected on the spot', 1, 0]]],
  ['Controls', [
   ['Critical controls for the day’s high-risk work verified in the field', 1, 1],
   ['Welfare, heat and fatigue discussed with crews', 0, 0],
   ['Commitments recorded with owner and date', 0, 1]]]] },
];

/* Normalise to the builder format: q = [{t, c, e, on, s}] with a section label on every question. */
const NV_CL_LIB = NV_CL.map(c => ({
  id: c.id, name: c.name, category: c.category, platforms: c.platforms, scoring: 'percent', rev: 1, active: true, divisions: [],
  q: c.sections.flatMap(([s, qs]) => qs.map(([t, cr, ev]) => ({ t, c: !!cr, e: !!ev, on: true, s }))),
}));

/* Library = published revisions first, then every professional checklist that has not been published yet. */
clLib = function () {
  const pub = L.checklists && Array.isArray(L.checklists.list) ? L.checklists.list : [];
  const ids = new Set(pub.map(c => c.id));
  return [...pub, ...NV_CL_LIB.filter(c => !ids.has(c.id))];
};
clById = function (id) { return clLib().find(c => c.id === id); };
