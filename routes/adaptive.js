
const express=require('express');
const {q,pool}=require('../db');
const {auth}=require('../middleware/auth');
const {chooseDifficulty,dailyTarget}=require('../services/adaptive');
const router=express.Router();

router.use(auth);

router.post('/adaptive/session',async(req,res,next)=>{
 const client=await pool.connect();
 try{
  const subject=req.body?.subject||null;
  const limit=Math.max(5,Math.min(30,Number(req.body?.limit||10)));
  const stat=(await client.query(`select count(*)::int attempts,
    coalesce(round(100.0*count(*) filter(where a.is_correct)/nullif(count(*),0)),0)::int accuracy
    from attempts a join questions q on q.id=a.question_id
    where a.user_id=$1 and ($2::text is null or q.subject_id=$2)`,[req.user.id,subject])).rows[0];
  const difficulty=chooseDifficulty(stat.accuracy,stat.attempts);
  await client.query('BEGIN');
  const s=(await client.query("insert into question_sessions(user_id,mode) values($1,'adaptive') returning id",[req.user.id])).rows[0];
  const rows=(await client.query(`select q.id,q.stable_key,q.subject_id,q.topic,q.difficulty,q.question_text,
    q.option_a,q.option_b,q.option_c,q.option_d
    from questions q
    where q.status='published'
      and ($1::text is null or q.subject_id=$1)
      and not exists(select 1 from attempts a where a.user_id=$2 and a.question_id=q.id and a.is_correct=true)
    order by case when q.difficulty=$3 then 0 else 1 end, random()
    limit $4`,[subject,req.user.id,difficulty,limit])).rows;
  let finalRows=rows;
  if(finalRows.length<limit){
    const used=finalRows.map(x=>x.id);
    const more=(await client.query(`select q.id,q.stable_key,q.subject_id,q.topic,q.difficulty,q.question_text,
      q.option_a,q.option_b,q.option_c,q.option_d from questions q
      where q.status='published' and ($1::text is null or q.subject_id=$1)
      and not(q.id=any($2::bigint[])) order by random() limit $3`,
      [subject,used,limit-finalRows.length])).rows;
    finalRows=finalRows.concat(more);
  }
  for(let i=0;i<finalRows.length;i++)
    await client.query('insert into question_session_items(session_id,question_id,position) values($1,$2,$3)',[s.id,finalRows[i].id,i+1]);
  await client.query('COMMIT');
  res.json({session_id:s.id,recommended_difficulty:difficulty,questions:finalRows.map(x=>({...x,options:[x.option_a,x.option_b,x.option_c,x.option_d]}))});
 }catch(e){try{await client.query('ROLLBACK')}catch{};next(e)}finally{client.release()}
});

router.get('/wrong-notebook',async(req,res,next)=>{
 try{
  const r=await q(`select q.id,q.stable_key,q.subject_id,q.topic,q.question_text,
    count(*) filter(where not a.is_correct)::int wrong_count,
    max(a.answered_at) last_wrong
    from attempts a join questions q on q.id=a.question_id
    where a.user_id=$1 and a.is_correct=false
    group by q.id order by wrong_count desc,last_wrong desc limit 200`,[req.user.id]);
  res.json(r.rows);
 }catch(e){next(e)}
});

router.post('/bookmarks/:questionId',async(req,res,next)=>{
 try{await q('insert into bookmarks(user_id,question_id) values($1,$2) on conflict do nothing',[req.user.id,req.params.questionId]);res.json({ok:true})}catch(e){next(e)}
});
router.delete('/bookmarks/:questionId',async(req,res,next)=>{
 try{await q('delete from bookmarks where user_id=$1 and question_id=$2',[req.user.id,req.params.questionId]);res.json({ok:true})}catch(e){next(e)}
});
router.get('/bookmarks',async(req,res,next)=>{
 try{res.json((await q(`select q.id,q.stable_key,q.subject_id,q.topic,q.question_text,b.created_at
  from bookmarks b join questions q on q.id=b.question_id where b.user_id=$1 order by b.created_at desc`,[req.user.id])).rows)}catch(e){next(e)}
});

router.post('/study-plan/30-day',async(req,res,next)=>{
 const client=await pool.connect();
 try{
  const start=req.body?.start_date||new Date().toISOString().slice(0,10);
  const weak=(await client.query(`select q.subject_id,q.topic,count(a.id)::int attempts,
    coalesce(round(100.0*count(a.id) filter(where a.is_correct)/nullif(count(a.id),0)),0)::int accuracy
    from attempts a join questions q on q.id=a.question_id where a.user_id=$1
    group by q.subject_id,q.topic order by accuracy asc,attempts desc limit 12`,[req.user.id])).rows;
  const defaults=[
   {subject_id:'math',topic:'ร้อยละ'},{subject_id:'thai',topic:'ใจความสำคัญ'},
   {subject_id:'english',topic:'Present Simple'},{subject_id:'computer',topic:'Cybersecurity'},
   {subject_id:'law',topic:'การวิเคราะห์โจทย์'}
  ];
  const focus=weak.length?weak:defaults;
  await client.query('BEGIN');
  const plan=(await client.query(`insert into study_plans(user_id,start_date,end_date,target_questions_per_day)
    values($1,$2,$2::date+29,30) returning *`,[req.user.id,start])).rows[0];
  for(let d=1;d<=30;d++){
    const f=focus[(d-1)%focus.length];
    await client.query(`insert into study_plan_days(study_plan_id,day_no,study_date,subject_id,topic,target_questions)
      values($1,$2,$3::date+($2-1),$4,$5,$6)`,[plan.id,d,start,f.subject_id,f.topic,dailyTarget(d)]);
  }
  await client.query('COMMIT');
  const days=(await client.query('select * from study_plan_days where study_plan_id=$1 order by day_no',[plan.id])).rows;
  res.json({plan,days});
 }catch(e){try{await client.query('ROLLBACK')}catch{};next(e)}finally{client.release()}
});

router.get('/study-plan/latest',async(req,res,next)=>{
 try{
  const p=(await q('select * from study_plans where user_id=$1 order by id desc limit 1',[req.user.id])).rows[0];
  if(!p)return res.json(null);
  p.days=(await q('select * from study_plan_days where study_plan_id=$1 order by day_no',[p.id])).rows;
  res.json(p);
 }catch(e){next(e)}
});

router.get('/streak',async(req,res,next)=>{
 try{
  const days=(await q(`select distinct answered_at::date d from attempts where user_id=$1 order by d desc limit 90`,[req.user.id])).rows.map(x=>String(x.d).slice(0,10));
  let streak=0;
  let cur=new Date();
  const set=new Set(days);
  for(let i=0;i<90;i++){const ds=cur.toISOString().slice(0,10);if(set.has(ds)){streak++;cur.setUTCDate(cur.getUTCDate()-1)}else if(i===0){cur.setUTCDate(cur.getUTCDate()-1)}else break}
  res.json({streak});
 }catch(e){next(e)}
});
module.exports=router;
