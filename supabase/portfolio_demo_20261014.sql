-- Additive and repeatable demonstration evidence; never deletes or resets identities.
begin;
do $$
declare p record; n int:=0; j int; m int; t bigint; rid uuid; aid uuid; state int; lat double precision; lng double precision;
begin
 for p in select * from public.projects where id like 'demo-%' order by id loop
  n:=n+1; state:=n%3;
  if p.latitude is null then
   case lower(p.country) when 'bahrain' then lat:=26.20;lng:=50.56; when 'ksa' then lat:=24.71;lng:=46.68; when 'oman' then lat:=23.58;lng:=58.39; when 'qatar' then lat:=25.28;lng:=51.52; when 'uae' then lat:=25.20;lng:=55.27; when 'kuw' then lat:=29.37;lng:=47.98; else lat:=24.71;lng:=46.68; end case;
   update public.projects set latitude=lat+((n%4)-1.5)*0.04,longitude=lng+((n%3)-1)*0.045,location_label='Illustrative project position · '||p.country,location_mode='demo' where id=p.id and latitude is null;
  end if;
  if exists(select 1 from public.hsse_records where project=p.id and kind='monthly' and data->>'sampleBatch'='portfolio-20261014') then continue; end if;
  for m in 5..10 loop
   t:=(extract(epoch from make_timestamptz(2026,m,10,12,0,0,'Asia/Riyadh'))*1000)::bigint;
   insert into public.hsse_records(project,kind,ts,data) values(p.id,'monthly',t,jsonb_build_object('month','2026-'||lpad(m::text,2,'0'),'empHours',180000,'conHours',120000,'empHead',coalesce(p.headcount,100),'conHead',40,'trainHours',160,'trainHoursExt',20,'trainPlan',160,'ccChecks',80,'drills',1,'diesel',12000,'water',240,'nhDisposed',12,'hzDisposed',1,'spill',0,'sampleBatch','portfolio-20261014'));
  end loop;
  for j in 1..24 loop
   t:=(extract(epoch from timestamptz '2026-10-14 09:00:00+03')*1000)::bigint-(j*86400000);
   rid:=gen_random_uuid();
   insert into public.reports(id,project,rt,kind,cat,dept,loc,description,safe,ts,event_ts,status,risk_assessment)
   values(rid,p.id,case when j%4=0 then 'Good practice' else 'Hazard' end,case when j%4=0 then 'Safe behaviour' else 'Unsafe Condition' end,
    (array['Work at Height','Moving Equipment','Lifting Operations','Hazardous Substances'])[1+(j%4)],'HSE','Demonstration work area',
    case when j%4=0 then 'DEMO: verified barriers and safe working practice' when state=1 then 'DEMO: critical equipment guarding requires immediate correction' when state=2 then 'DEMO: housekeeping and access route need follow-up' else 'DEMO: observation corrected and verified by site supervisor' end,
    'Yes',t,t,case when state=0 or j%4=0 then 'Closed' else 'Open' end,
    jsonb_build_object('likelihood',case when state=1 then 4 when state=2 then 2 else 1 end,'severity',case when state=1 then 5 when state=2 then 3 else 2 end,'residualLikelihood',1,'residualSeverity',2));
   if j%4<>0 then
    insert into public.actions(project,title,owner,due,priority,report,source_id,source,ts,closed_at,status,evidence)
    values(p.id,'DEMO: verify corrective controls for observation','Demonstration Site Supervisor',case when state=1 then t+3*86400000 when state=2 then 1792490400000 else t+7*86400000 end,case when state=1 then 'High' else 'Normal' end,rid,rid::text,'report',t,case when state=0 then t+2*86400000 else null end,case when state=0 then 'Closed' else 'Assigned' end,case when state=0 then 'Demonstration verification of installed controls' else null end);
   end if;
  end loop;
  if state=1 then
   insert into public.reports(project,rt,kind,cat,dept,loc,description,ts,event_ts,status,severity,lost_days)
   values(p.id,'Incident','Injury','Moving Equipment','HSE','Demonstration facility','DEMO: recordable injury scenario for dashboard validation',1791882000000,1791882000000,'Open','Medical Treatment',0);
  end if;
  for j in 1..4 loop
   t:=1791968400000-j*86400000;
   insert into public.inspections(project,tpl,items,fails,ts,status,score,area,answers)
   values(p.id,'Demonstration critical controls',3,case when state=0 then 0 else 1 end,t,case when state=0 then 'Closed' else 'Findings recorded' end,case when state=0 then 100 else 67 end,'Demonstration facility',
    jsonb_build_object('checklist','gen','rev',1,'a',jsonb_build_object('0',jsonb_build_object('q','Machine guard and isolation verified','c',state=1,'v',case when state=0 then 'Yes' else 'No' end),'1',jsonb_build_object('q','Emergency access available','c',true,'v','Yes'),'2',jsonb_build_object('q','PPE and housekeeping suitable','c',false,'v','Yes'))));
  end loop;
  insert into public.hsse_records(project,kind,ts,data) values(p.id,'walk',1791968400000,jsonb_build_object('title','DEMO: leadership safety walkthrough','positives','["Correct isolation applied","Access route clear","PPE in use","Good housekeeping"]'::jsonb,'negatives',case when state=0 then '[]'::jsonb else '[{"text":"Follow up on site controls"}]'::jsonb end,'critical','[]'::jsonb,'notes','Demonstration leadership evidence'));
  insert into public.hsse_records(project,kind,ts,data) values(p.id,'training',1791882000000,jsonb_build_object('course','DEMO: critical risk and emergency readiness','hours',12,'attendees',30,'expiry',1823418000000));
  insert into public.hsse_records(project,kind,ts,data) values(p.id,'audit',1791795600000,jsonb_build_object('title','DEMO: HSSE management assurance review','type','Internal','status','Completed','notes','Illustrative audit evidence'));
  for j in 1..14 loop
   insert into public.activities(project,type,date,count,ts) values(p.id,(array['Together to Zero Harm program BSL','Proactive event reporting-Near miss','HSSE Leadership Walkthrough','Inter divisions/projects & facilities tour','Leadership meeting & lessons learned','Project HSSE Committee meeting','Subcontractor mobilisation Kick-off meeting','Proactive risk management workshop','Emergency Planning/Drills','HSSE Campaign/Training/Toolbox','HSSE management performance review','Workers/Staff Accommodation Visit','Divisions/Projects Audits (Internal/external)','Reward / Recognition'])[j],1791968400000-j*86400000,1,1791968400000-j*86400000);
  end loop;
 end loop;
end $$;
commit;
