
const express=require('express');
const {parse}=require('csv-parse/sync');
const {q,pool}=require('../db');
const {auth,staff,reviewer}=require('../middleware/auth');
const router=express.Router();

router.use(auth);

function cleanQuestion(body={}){
  const correct=Number(body.correct_option);
  return {
    stable_key:String(body.stable_key||'').trim(),
    subject_id:String(body.subject_id||'').trim(),
    topic:String(body.topic||'').trim(),
    difficulty:String(body.difficulty||'medium').trim().toLowerCase(),
    question_text:String(body.question_text||'').trim(),
    option_a:String(body.option_a||'').trim(),
    option_b:String(body.option_b||'').trim(),
    option_c:String(body.option_c||'').trim(),
    option_d:String(body.option_d||'').trim(),
    correct_option:correct,
    explanation:String(body.explanation||'').trim(),
    source_note:String(body.source_note||'').trim(),
    source_url:String(body.source_url||'').trim()||null
  };
}
function validateQuestion(x){
  if(!x.stable_key||!x.subject_id||!x.question_text) return 'missing_required_fields';
  if(!x.option_a||!x.option_b||!x.option_c||!x.option_d) return 'missing_options';
  if(!Number.isInteger(x.correct_option)||x.correct_option<0||x.correct_option>3) return 'invalid_correct_option';
  if(!['easy','medium','hard'].includes(x.difficulty)) return 'invalid_difficulty';
  return null;
}

router.get('/questions',staff,async(req,res,next)=>{
 try{
  const status=req.query.status||null;
  const subject=req.query.subject||null;
  const search=(req.query.search||'').trim()||null;
  const limit=Math.max(1,Math.min(200,Number(req.query.limit||100)));
  const offset=Math.max(0,Number(req.query.offset||0));
  const r=await q(`select q.*,s.name subject_name,
    uc.name created_by_name,ur.name reviewed_by_name
    from questions q
    left join subjects s on s.id=q.subject_id
    left join users uc on uc.id=q.created_by
    left join users ur on ur.id=q.reviewed_by
    where ($1::text is null or q.status=$1)
      and ($2::text is null or q.subject_id=$2)
      and ($3::text is null or q.question_text ilike '%'||$3||'%' or q.stable_key ilike '%'||$3||'%')
    order by q.updated_at desc nulls last,q.id desc limit $4 offset $5`,
    [status,subject,search,limit,offset]);
  const count=(await q(`select count(*)::int c from questions q
    where ($1::text is null or q.status=$1)
      and ($2::text is null or q.subject_id=$2)
      and ($3::text is null or q.question_text ilike '%'||$3||'%' or q.stable_key ilike '%'||$3||'%')`,
    [status,subject,search])).rows[0].c;
  res.json({items:r.rows,total:count});
 }catch(e){next(e)}
});

router.get('/questions/:id',staff,async(req,res,next)=>{
 try{
  const row=(await q('select * from questions where id=$1',[req.params.id])).rows[0];
  if(!row)return res.status(404).json({error:'question_not_found'});
  res.json(row);
 }catch(e){next(e)}
});

router.post('/questions',staff,async(req,res,next)=>{
 try{
  const x=cleanQuestion(req.body);
  const err=validateQuestion(x); if(err)return res.status(400).json({error:err});
  const version=Number(req.body?.version_no||1);
  const examCycle=req.body?.exam_cycle_id||null;
  const row=(await q(`insert into questions(
    stable_key,version_no,exam_cycle_id,subject_id,topic,difficulty,question_text,
    option_a,option_b,option_c,option_d,correct_option,explanation,source_note,source_url,
    status,created_by,updated_by,updated_at)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'draft',$16,$16,now())
    returning *`,
    [x.stable_key,version,examCycle,x.subject_id,x.topic,x.difficulty,x.question_text,
     x.option_a,x.option_b,x.option_c,x.option_d,x.correct_option,x.explanation,x.source_note,x.source_url,req.user.id])).rows[0];
  res.status(201).json(row);
 }catch(e){
  if(e.code==='23505')return res.status(409).json({error:'stable_key_version_exists'});
  next(e);
 }
});

router.patch('/questions/:id',staff,async(req,res,next)=>{
 try{
  const current=(await q('select * from questions where id=$1',[req.params.id])).rows[0];
  if(!current)return res.status(404).json({error:'question_not_found'});
  if(current.status==='published' && req.user.role!=='admin')return res.status(409).json({error:'published_question_locked'});
  const x=cleanQuestion({...current,...req.body});
  const err=validateQuestion(x); if(err)return res.status(400).json({error:err});
  const row=(await q(`update questions set stable_key=$1,subject_id=$2,topic=$3,difficulty=$4,
    question_text=$5,option_a=$6,option_b=$7,option_c=$8,option_d=$9,correct_option=$10,
    explanation=$11,source_note=$12,source_url=$13,
    status=case when status='published' then 'draft' else status end,
    updated_by=$14,updated_at=now()
    where id=$15 returning *`,
    [x.stable_key,x.subject_id,x.topic,x.difficulty,x.question_text,
     x.option_a,x.option_b,x.option_c,x.option_d,x.correct_option,
     x.explanation,x.source_note,x.source_url,req.user.id,req.params.id])).rows[0];
  res.json(row);
 }catch(e){
  if(e.code==='23505')return res.status(409).json({error:'stable_key_version_exists'});
  next(e);
 }
});

router.post('/questions/:id/submit-review',staff,async(req,res,next)=>{
 const client=await pool.connect();
 try{
  await client.query('BEGIN');
  const row=(await client.query('select * from questions where id=$1 for update',[req.params.id])).rows[0];
  if(!row){await client.query('ROLLBACK');return res.status(404).json({error:'question_not_found'});}
  if(row.status==='published'){await client.query('ROLLBACK');return res.status(409).json({error:'already_published'});}
  await client.query("update questions set status='review',updated_by=$2,updated_at=now() where id=$1",[row.id,req.user.id]);
  await client.query(`insert into review_queue(question_id,submitted_by)
    values($1,$2) on conflict do nothing`,[row.id,req.user.id]);
  await client.query('COMMIT');
  res.json({ok:true});
 }catch(e){try{await client.query('ROLLBACK')}catch{};next(e)}finally{client.release()}
});

router.get('/review-queue',staff,async(req,res,next)=>{
 try{
  res.json((await q(`select rq.id queue_id,q.id question_id,q.stable_key,q.question_text,q.subject_id,
    q.topic,q.difficulty,q.status,q.option_a,q.option_b,q.option_c,q.option_d,q.correct_option,
    q.explanation,q.source_note,q.source_url,rq.submitted_at,u.name submitted_by_name
    from review_queue rq join questions q on q.id=rq.question_id
    left join users u on u.id=rq.submitted_by
    where rq.decision is null order by rq.id`)).rows)
 }catch(e){next(e)}
});

router.post('/review/:queueId/decision',reviewer,async(req,res,next)=>{
 const client=await pool.connect();
 try{
  const {decision,note}=req.body||{};
  if(!['published','rejected'].includes(decision))return res.status(400).json({error:'invalid_decision'});
  await client.query('BEGIN');
  const row=(await client.query('select * from review_queue where id=$1 and decision is null for update',[req.params.queueId])).rows[0];
  if(!row){await client.query('ROLLBACK');return res.status(404).json({error:'queue_not_found'});}
  await client.query('update review_queue set decision=$1,note=$2,reviewed_by=$3,reviewed_at=now() where id=$4',
    [decision,note||'',req.user.id,row.id]);
  await client.query('update questions set status=$1,reviewed_by=$2,reviewed_at=now(),updated_by=$2,updated_at=now() where id=$3',
    [decision,req.user.id,row.question_id]);
  await client.query('COMMIT');
  res.json({ok:true});
 }catch(e){try{await client.query('ROLLBACK')}catch{};next(e)}finally{client.release()}
});

router.post('/questions/:id/outdate',reviewer,async(req,res,next)=>{
 try{
  const row=(await q("update questions set status='outdated',updated_by=$2,updated_at=now() where id=$1 returning id,status",
    [req.params.id,req.user.id])).rows[0];
  if(!row)return res.status(404).json({error:'question_not_found'});
  res.json(row);
 }catch(e){next(e)}
});

router.post('/import-csv',staff,async(req,res,next)=>{
 const text=String(req.body?.csv_text||'');
 if(!text.trim())return res.status(400).json({error:'empty_csv'});
 let records;
 try{
  records=parse(text,{columns:true,skip_empty_lines:true,trim:true,bom:true});
 }catch(e){return res.status(400).json({error:'csv_parse_error',detail:e.message});}
 if(records.length>1000)return res.status(400).json({error:'too_many_rows'});
 const valid=[],errors=[];
 for(let i=0;i<records.length;i++){
  const r=records[i];
  const x=cleanQuestion(r);
  const err=validateQuestion(x);
  if(err){errors.push({row:i+2,error:err,stable_key:x.stable_key});continue;}
  valid.push({row:i+2,x,version_no:Number(r.version_no||1),exam_cycle_id:r.exam_cycle_id||null});
 }
 const client=await pool.connect();
 let inserted=0;
 try{
  await client.query('BEGIN');
  for(const item of valid){
    try{
      await client.query(`insert into questions(stable_key,version_no,exam_cycle_id,subject_id,topic,difficulty,
       question_text,option_a,option_b,option_c,option_d,correct_option,explanation,source_note,source_url,status,
       created_by,updated_by,updated_at)
       values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,'draft',$16,$16,now())`,
       [item.x.stable_key,item.version_no,item.exam_cycle_id,item.x.subject_id,item.x.topic,item.x.difficulty,
        item.x.question_text,item.x.option_a,item.x.option_b,item.x.option_c,item.x.option_d,item.x.correct_option,
        item.x.explanation,item.x.source_note,item.x.source_url,req.user.id]);
      inserted++;
    }catch(e){
      if(e.code==='23505'){errors.push({row:item.row,error:'duplicate_stable_key_version',stable_key:item.x.stable_key});}
      else throw e;
    }
  }
  await client.query('COMMIT');
  res.json({ok:true,inserted,errors,total:records.length});
 }catch(e){try{await client.query('ROLLBACK')}catch{};next(e)}finally{client.release()}
});

router.get('/content-stats',staff,async(req,res,next)=>{
 try{
  const statuses=(await q(`select status,count(*)::int count from questions group by status order by status`)).rows;
  const subjects=(await q(`select s.id,s.name,count(q.id)::int total,
    count(q.id) filter(where q.status='published')::int published
    from subjects s left join questions q on q.subject_id=s.id
    group by s.id,s.name,s.sort_order order by s.sort_order`)).rows;
  const k=(await q('select count(*)::int c from knowledge_items where approved=true')).rows[0].c;
  res.json({questions:statuses,subjects,approved_knowledge:k});
 }catch(e){next(e)}
});

module.exports=router;
