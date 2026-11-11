begin;
select plan(1);
select ok(true, 'pgTAP is installed and the test runner works');
select * from finish();
rollback;
