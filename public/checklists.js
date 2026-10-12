/* NAVO · default inspection checklist library. Each question: [text, critical, evidence required].
   Administrators edit, add and publish revisions in the Checklist builder; the edited library is stored in the database. */
"use strict";
const CL_DEF=[
 {id:"gen",name:"General HSE Site Inspection",platforms:["Construction","Non-Construction"],scoring:"percent",q:[
  ["Site access controlled and visitors inducted",0,0],["Housekeeping acceptable, walkways clear",0,1],["Barricades and signage in place at hazards",1,1],["PPE worn correctly by all workers",1,0],["First aid kit stocked and first aider available",0,0],
  ["Fire extinguishers inspected and accessible",1,0],["Emergency assembly point signed and clear",0,0],["Welfare facilities clean and adequate",0,0],["Waste segregated and removed",0,1],["Permits displayed at work locations",1,0]]},
 {id:"con",name:"Construction Safety Inspection",platforms:["Construction"],scoring:"percent",q:[
  ["Daily task risk assessment (STARRT) completed",1,1],["Open edges and floor openings protected",1,1],["Materials stored stable and secured",0,0],["Plant operators certified and cards valid",1,0],["Temporary electrics with RCD protection",1,0],
  ["Formwork and falsework inspected and tagged",1,1],["Exclusion zones under suspended loads",1,0],["Dust and noise controls in place",0,0],["Concrete pour plan and supervision",0,0],["Rebar caps fitted on protruding bars",0,0]]},
 {id:"ncw",name:"Non-Construction Workplace Inspection",platforms:["Non-Construction"],scoring:"percent",q:[
  ["Machine guards fitted and interlocks working",1,1],["Forklift routes marked, pedestrians separated",1,0],["Racking inspected and load signs posted",0,1],["Chemical storage labelled with SDS available",1,0],["LOTO applied on maintenance work",1,1],
  ["Noise areas signed, hearing protection used",0,0],["Lighting and ventilation adequate",0,0],["Food hygiene standards met (where applicable)",0,0],["Loading bay edge protection and dock locks",1,0],["Emergency stops tested",1,0]]},
 {id:"mwt",name:"HSE Management Walkthrough",platforms:["Construction","Non-Construction"],scoring:"percent",q:[
  ["HSE plan and risk register up to date",0,0],["Previous walkthrough actions closed",0,1],["Toolbox talks held and recorded",0,1],["Supervisors competent and present",0,0],["Workers able to explain their task risks",1,0],
  ["Stop work authority understood",1,0],["Incident lessons shared on site",0,0],["Contractor HSE performance reviewed",0,0]]},
 {id:"lwt",name:"Leadership Safety Walkthrough",platforms:["Construction","Non-Construction"],scoring:"percent",q:[
  ["Leader engaged with at least three workers",0,0],["Positive behaviour recognised",0,0],["At-risk behaviour discussed and corrected",1,0],["Critical risk controls verified in the field",1,1],["Welfare and fatigue discussed",0,0],["Commitments recorded with owners",0,1]]},
 {id:"wah",name:"Work at Height",platforms:["Construction","Non-Construction"],scoring:"percent",q:[
  ["Work at height permit issued and valid",1,1],["Full-body harness inspected and worn",1,0],["Anchor points rated and identified",1,1],["Guardrails, mid-rails and toe boards fitted",1,0],["Rescue plan in place",1,1],
  ["Tools tethered, drop zone barricaded",1,0],["Ladders inspected and secured",0,0],["Workers trained in work at height",0,1]]},
 {id:"scf",name:"Scaffolding",platforms:["Construction"],scoring:"percent",q:[
  ["Scaffold tag green and in date",1,1],["Base plates and sole boards in place",0,0],["Platforms fully boarded",1,0],["Guardrails and toe boards fitted",1,0],["Access ladder secured and extends 1 m",0,0],
  ["Ties and bracing as per design",1,1],["No overloading of materials",0,0],["Erected by competent scaffolders",0,1]]},
 {id:"lft",name:"Lifting Operations",platforms:["Construction","Non-Construction"],scoring:"percent",q:[
  ["Lift plan approved for the lift category",1,1],["Crane third-party certificate valid",1,1],["Operator and rigger certified",1,0],["Slings and shackles inspected and colour-coded",1,0],["Outriggers fully extended on mats",1,0],
  ["Exclusion zone and banksman in place",1,0],["Wind speed checked before lift",0,0],["Load chart available in cab",0,0]]},
 {id:"exc",name:"Excavation",platforms:["Construction"],scoring:"percent",q:[
  ["Excavation permit and utility scan done",1,1],["Shoring, benching or battering adequate",1,1],["Edge protection and barriers 1 m from edge",1,0],["Safe access and egress every 7.5 m",0,0],["Spoil kept back from edge",0,0],
  ["Daily inspection by competent person",0,1],["Atmosphere tested if deeper than 1.2 m",1,0],["Water ingress controlled",0,0]]},
 {id:"elc",name:"Electrical Safety",platforms:["Construction","Non-Construction"],scoring:"percent",q:[
  ["Distribution boards locked and labelled",1,0],["RCD protection tested",1,1],["Cables protected and routed safely",0,0],["Portable tools inspected and tagged",0,1],["LOTO applied on isolations",1,1],
  ["Only authorised electricians working on systems",1,0],["Earthing in place for generators",1,0],["No exposed live parts",1,0]]},
 {id:"ptw",name:"Permit to Work",platforms:["Construction","Non-Construction"],scoring:"percent",q:[
  ["Permit available at work location",1,0],["Permit scope matches work being done",1,0],["Isolations listed and verified",1,1],["Gas test recorded where required",1,1],["Permit signed by issuer and receiver",0,0],
  ["Workers briefed and signed on",0,1],["Simultaneous operations checked",1,0],["Permit closed out properly",0,0]]},
 {id:"cs",name:"Confined Space",platforms:["Construction","Non-Construction"],scoring:"percent",q:[
  ["Confined space entry permit valid",1,1],["Continuous gas monitoring",1,0],["Standby person at entry",1,0],["Rescue equipment and plan on site",1,1],["Ventilation provided",1,0],
  ["Entrants trained and medically fit",0,1],["Entry log maintained",0,0],["Isolation of energy sources",1,0]]},
 {id:"fire",name:"Fire Protection",platforms:["Construction","Non-Construction"],scoring:"percent",q:[
  ["Extinguishers inspected monthly",1,0],["Fire alarm tested",1,1],["Hot work permit and fire watch",1,0],["Escape routes clear and lit",1,0],["Flammables stored in approved cabinets",0,0],
  ["Fire hydrants and hoses accessible",0,0],["Fire drill held this quarter",0,1],["Smoking only in designated areas",0,0]]},
 {id:"env",name:"Environmental Inspection",platforms:["Construction","Non-Construction"],scoring:"percent",q:[
  ["Spill kits available and stocked",0,0],["Fuel and chemicals on secondary containment",1,0],["Waste segregated, manifests kept",0,1],["Dust suppression in use",0,0],["No discharge to drains or ground",1,0],
  ["Noise within permit limits",0,0],["Wildlife and vegetation protected",0,0],["Water use recorded",0,0]]},
 {id:"eqp",name:"Equipment and Machinery",platforms:["Construction","Non-Construction"],scoring:"percent",q:[
  ["Pre-use inspection checklist completed",1,1],["Third-party certificates valid",1,1],["Reversing alarm and camera working",1,0],["Seat belts used",1,0],["No fluid leaks",0,0],
  ["Guards on moving parts",1,0],["Operator competency card valid",1,0],["Maintenance records up to date",0,1]]},
 {id:"trf",name:"Traffic Management",platforms:["Construction","Non-Construction"],scoring:"percent",q:[
  ["Traffic management plan in place",1,1],["Pedestrian and vehicle routes separated",1,0],["Speed limits signed and enforced",0,0],["Banksmen used for reversing",1,0],["Road signs and barriers as per plan",0,0],
  ["Drivers' licences and fitness checked",0,1],["Lighting adequate at night",0,0],["Public interface protected",1,0]]},
 {id:"wel",name:"Welfare Facilities",platforms:["Construction","Non-Construction"],scoring:"percent",q:[
  ["Drinking water cooled and available",1,0],["Shaded rest areas provided",1,0],["Toilets clean and adequate number",0,0],["Washing facilities with soap",0,0],["Eating areas clean",0,0],
  ["Heat stress plan and work-rest cycle",1,1],["First aid room equipped",0,0],["Accommodation meets standards",0,1]]},
 {id:"csc",name:"Critical Safety Controls",platforms:["Construction","Non-Construction"],scoring:"percent",q:[
  ["Work at height: fall protection verified",1,1],["Lifting: lift plan and exclusion zone verified",1,1],["Energy isolation: LOTO verified",1,1],["Confined space: gas test and standby verified",1,1],["Moving equipment: separation verified",1,1],
  ["Excavation: support and edge protection verified",1,1],["Hazardous substances: controls verified",1,0],["Hot work: permit and fire watch verified",1,0]]}];
function clLib(){const c=L.checklists&&Array.isArray(L.checklists.list)?L.checklists.list:null;return c||CL_DEF.map(x=>({...x,rev:1,active:true,divisions:[],q:x.q.map(([t,c,e])=>({t,c:!!c,e:!!e,on:true}))}))}
function clById(id){return clLib().find(c=>c.id===id)}
