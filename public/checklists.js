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


/* Synergi-style lookup lists */
const CAUSES={Immediate:{"Substandard acts":["01 Operating equipment without authority","02 Failure to inform / warn","03 Failure to secure / isolate","04 Operating at improper speed","05 Making critical HSEQ devices inoperative","06 Using defective tool / equipment","07 Improper operation of tool / equipment","08 Servicing equipment in operation","09 Using incorrect material","10 Failing to use PPE properly","11 Improper loading","12 Improper placement","13 Improper lifting","14 Improper position for task","15 Improper behaviour","16 Under the influence of medicine / alcohol / drugs","17 Failure to follow procedure / instruction","18 Failure to identify hazard","19 Substandard act by external party"],
 "Substandard conditions":["20 Inadequate floor / surface","21 Defective tool / equipment","22 Incorrect / inadequate tool","23 Inadequate integrity of equipment","24 Inadequate operational mode","25 Failure to detect / measure","26 Improper measurement / signal conversion","27 Incorrect material","28 Incorrect composition of material / gas","29 Inadequate guard / barrier","30 Inadequate PPE","31 Congestion / restricted space","32 Inadequate warning system","33 Flammable / explosive atmosphere","34 Unauthorised hazardous materials","35 Poor housekeeping","36 Noise","37 Radiation","38 Illumination","39 Vibration","40 Temperature extreme","41 Pressure extreme","42 Inadequate ventilation","43 Inadequate information","44 Other hazardous condition","45 Hazard from external source","46 Adverse weather"]},
 Root:{"Personal factors":["01 Inadequate physical capability","02 Inadequate mental capability","03 Physical stress","04 Mental stress","05 Lack of knowledge","06 Lack of skill","07 Improper motivation"],
 "Job / system factors":["08 Unclear organisational structure","09 Inadequate leadership","10 Inadequate supervision / coaching","11 Inadequate change management","12 Inadequate supply chain management","13 Inadequate maintenance / inspection","14 Excessive wear / tear","15 Inadequate tool / equipment","16 Inadequate product","17 Inadequate work standards","18 Inadequate communication / information"]}};
const RCA_METHODS=["5 Whys","BowTie","Event Tree Analysis","Fault Tree Analysis","Fishbone","None"];
const ACTION_TYPES=["Immediate","Corrective","Preventative","Coordination","Administrative"];
const LOSS_CLASS={"Class A":"Class A – Fatality / permanent impairment (FPI)","Class B":"Class B – Lost time injury (LTI)","Class C":"Class C – Medical treatment (MTC) or restricted work (RWC)","Class D":"Class D – First aid"};
const DUE_COL={"Overdue":"#E00000","Due today":"#EE8A00","Due this week":"#F6D09E","Due next week":"#FFCC00","Not due":"#4FB7E6","No deadline":"#9AD8F0","Closed within due date":"#3A8530","Closed after due date":"#B8E2A8"};
function dueStatus(due,closedAt){const day=864e5;if(closedAt)return!due?"Closed within due date":closedAt<=due+day?"Closed within due date":"Closed after due date";if(!due)return"No deadline";const now=Date.now();const d0=new Date();d0.setHours(0,0,0,0);const t0=d0.getTime();
 if(due<t0)return"Overdue";if(due<t0+day)return"Due today";const wk=t0+(7-d0.getDay())*day;if(due<wk)return"Due this week";if(due<wk+7*day)return"Due next week";return"Not due"}
function duePill(due,closedAt){const s=dueStatus(due,closedAt);const c=DUE_COL[s];const dark=["Overdue","Closed within due date","Due today"].includes(s);return`<span class="pill" style="background:${c};color:${dark?"#fff":"#222"}">${s}</span>`}
// Synergi PTW inspection questions
(function(){const p=CL_DEF.find(c=>c.id==="ptw");if(p)p.q=[["Specified time, date, validity and extensions correct?",1,0],["Scope of work, equipment, area and work order clearly identified?",1,0],["PTW / JHA / MSRA cover all hazards, and controls implemented?",1,1],["Names and signatories correct and legible?",0,0],["All attachments and certificates posted with the PTW?",0,1],["Isolations checked and fit for purpose?",1,1],["All LOTO per isolation list and filled correctly?",1,1],["All personnel signed the toolbox talk?",0,1],["All personnel aware of PTW / JHA / attachments?",0,0],["Cross-referenced PTWs, SIMOPs and isolation points considered?",1,0],["Any deviation from PTW / JHA / MSRA / work order? (Safe = none)",1,0],["All personnel trained and certified?",1,1],["Tools and equipment certified, suitable and in good condition?",1,0],["Housekeeping satisfactory?",0,0],["Any other observations or workforce concerns? (Safe = none)",0,0]]})();
