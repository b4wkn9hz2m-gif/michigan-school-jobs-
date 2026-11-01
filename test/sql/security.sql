-- Each check raises if the security rules don't behave as expected.
grant usage on schema public, auth to authenticated;
grant all on all tables in schema public to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-000000000001'), ('00000000-0000-0000-0000-000000000002');

create function pg_temp.expect_error(stmt text, label text) returns void language plpgsql as $$
begin
  execute stmt;
  raise exception 'FAILED (should have been blocked): %', label;
exception when others then
  if sqlerrm like 'FAILED%' then raise; end if;
  raise notice 'ok   blocked: % (%)', label, sqlerrm;
end $$;

create function pg_temp.as_user(n int) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.sub', '00000000-0000-0000-0000-00000000000' || n, false);
  perform set_config('request.jwt.role', 'authenticated', false);
end $$;

set role authenticated;
select null from pg_temp.as_user(1);
insert into employers (owner_id, name, org_type, contact_email) values ('00000000-0000-0000-0000-000000000001', 'Test SD', 'district', 'a@b.co');
insert into jobs (employer_id, title, county, job_type, categories, description) select id, 'Teacher', 'Kent', 'Full Time', '{Teaching}', 'desc' from employers;
select null from pg_temp.expect_error($$update employers set plan = 'agency'$$, 'employer upgrades own plan');
select null from pg_temp.expect_error($$update employers set verified = true$$, 'employer verifies self');
select null from pg_temp.expect_error($$update jobs set featured_until = now() + interval '30 days'$$, 'employer features own job');
select null from pg_temp.expect_error($$update jobs set status = 'active'$$, 'employer activates own job');
select null from pg_temp.expect_error($$insert into jobs (employer_id, title, county, job_type, categories, description, status) select id, 'X', 'Kent', 'Full Time', '{Teaching}', 'x', 'active' from employers$$, 'employer inserts an active job');
update jobs set title = 'Teacher (updated)';
do $$ begin if (select title from jobs) <> 'Teacher (updated)' then raise exception 'FAILED: employer could not edit own job'; end if; raise notice 'ok   employer edits own job'; end $$;

select null from pg_temp.as_user(2);
do $$ begin if (select count(*) from jobs) <> 0 then raise exception 'FAILED: pending job visible to others'; end if; raise notice 'ok   pending job hidden from others'; end $$;
select null from pg_temp.expect_error($$insert into jobs (employer_id, title, county, job_type, categories, description) select id, 'Hack', 'Kent', 'Full Time', '{Teaching}', 'x' from employers$$, 'user posts to another org');

-- Supabase's service_role bypasses RLS; emulate with the superuser plus the service_role claim.
reset role;
select set_config('request.jwt.role', 'service_role', false);
update jobs set status = 'active';
set role authenticated;
select null from pg_temp.as_user(2);
do $$ begin if (select count(*) from jobs) <> 1 then raise exception 'FAILED: active job not public'; end if; raise notice 'ok   admin-activated job is public'; end $$;
insert into applications (job_id, applicant_id) select id, '00000000-0000-0000-0000-000000000002' from jobs;
insert into resumes (user_id, full_name, email, content) values ('00000000-0000-0000-0000-000000000002', 'Jo', 'jo@x.co', 'My resume');
select null from pg_temp.as_user(1);
do $$ begin if (select count(*) from resumes) <> 1 or (select count(*) from applications) <> 1 then raise exception 'FAILED: employer cannot see applicant'; end if; raise notice 'ok   employer sees applicant + resume'; end $$;
reset role;
select 'ALL SECURITY CHECKS PASSED' as result;
