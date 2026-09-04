
const {q}=require('../db');

async function migrate(){
  await q(`alter table questions add column if not exists created_by bigint references users(id)`);
  await q(`alter table questions add column if not exists updated_by bigint references users(id)`);
  await q(`alter table questions add column if not exists updated_at timestamptz default now()`);
  await q(`alter table review_queue add column if not exists note text`);
  await q(`create index if not exists idx_questions_topic on questions(topic)`);
  await q(`create index if not exists idx_questions_difficulty on questions(difficulty)`);
  await q(`create unique index if not exists uq_review_queue_pending
           on review_queue(question_id) where decision is null`);
  console.log('DB migration v12.2 complete');
}
module.exports={migrate};
