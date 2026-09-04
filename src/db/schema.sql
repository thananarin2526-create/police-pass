
create table if not exists users(
 id bigserial primary key,
 name text not null,
 email text unique not null,
 password_hash text not null,
 role text not null default 'student' check(role in ('student','editor','reviewer','admin')),
 plan text not null default 'FREE',
 created_at timestamptz default now()
);

create table if not exists exam_cycles(
 id bigserial primary key,
 code text unique not null,
 name text not null,
 official_source_url text,
 verified_note text,
 status text not null default 'draft',
 created_at timestamptz default now()
);

create table if not exists subjects(
 id text primary key,
 name text not null,
 sort_order int default 0
);

create table if not exists topics(
 id bigserial primary key,
 subject_id text references subjects(id) on delete cascade,
 name text not null,
 sort_order int default 0,
 unique(subject_id,name)
);

create table if not exists questions(
 id bigserial primary key,
 stable_key text not null,
 version_no int not null default 1,
 exam_cycle_id bigint references exam_cycles(id),
 subject_id text references subjects(id),
 topic text,
 difficulty text,
 question_text text not null,
 option_a text not null,
 option_b text not null,
 option_c text not null,
 option_d text not null,
 correct_option int not null check(correct_option between 0 and 3),
 explanation text,
 source_note text,
 source_url text,
 status text not null default 'draft' check(status in ('draft','review','published','outdated','rejected')),
 reviewed_by bigint references users(id),
 reviewed_at timestamptz,
 created_at timestamptz default now(),
 unique(stable_key,version_no)
);

create table if not exists attempts(
 id bigserial primary key,
 user_id bigint references users(id) on delete cascade,
 question_id bigint references questions(id),
 answer_index int not null,
 is_correct boolean not null,
 mode text default 'practice',
 answered_at timestamptz default now()
);

create table if not exists blueprints(
 id bigserial primary key,
 code text unique not null,
 name text not null,
 total_questions int not null,
 duration_minutes int not null,
 status text default 'published'
);

create table if not exists blueprint_rules(
 id bigserial primary key,
 blueprint_id bigint references blueprints(id) on delete cascade,
 subject_id text references subjects(id),
 question_count int not null
);

create table if not exists knowledge_items(
 id bigserial primary key,
 subject_id text references subjects(id),
 topic text,
 title text not null,
 content text not null,
 source_note text,
 source_url text,
 approved boolean default false,
 created_at timestamptz default now()
);

create table if not exists ai_logs(
 id bigserial primary key,
 user_id bigint references users(id) on delete cascade,
 user_message text not null,
 answer_text text not null,
 citations_json jsonb,
 grounded boolean default true,
 created_at timestamptz default now()
);

create table if not exists review_queue(
 id bigserial primary key,
 question_id bigint references questions(id) on delete cascade,
 submitted_by bigint references users(id),
 submitted_at timestamptz default now(),
 reviewed_by bigint references users(id),
 decision text,
 note text,
 reviewed_at timestamptz
);

create index if not exists idx_questions_subject on questions(subject_id);
create index if not exists idx_questions_status on questions(status);
create index if not exists idx_attempts_user on attempts(user_id);


-- v12 Adaptive Learning
create table if not exists bookmarks(
 user_id bigint references users(id) on delete cascade,
 question_id bigint references questions(id) on delete cascade,
 created_at timestamptz default now(),
 primary key(user_id,question_id)
);
create table if not exists study_plans(
 id bigserial primary key,
 user_id bigint references users(id) on delete cascade,
 start_date date not null,
 end_date date not null,
 target_questions_per_day int not null default 30,
 created_at timestamptz default now()
);
create table if not exists study_plan_days(
 id bigserial primary key,
 study_plan_id bigint references study_plans(id) on delete cascade,
 day_no int not null,
 study_date date not null,
 subject_id text references subjects(id),
 topic text,
 target_questions int not null,
 status text not null default 'pending',
 unique(study_plan_id,day_no)
);
create table if not exists question_sessions(
 id bigserial primary key,
 user_id bigint references users(id) on delete cascade,
 mode text not null,
 started_at timestamptz default now(),
 finished_at timestamptz
);
create table if not exists question_session_items(
 session_id bigint references question_sessions(id) on delete cascade,
 question_id bigint references questions(id),
 position int not null,
 primary key(session_id,question_id)
);
create index if not exists idx_bookmarks_user on bookmarks(user_id);
create index if not exists idx_plan_days_date on study_plan_days(study_date);
