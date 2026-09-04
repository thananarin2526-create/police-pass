
const express=require('express');const {q}=require('../db');const {auth}=require('../middleware/auth');const router=express.Router();

router.get('/subjects',async(req,res,next)=>{try{res.json((await q('select * from subjects order by sort_order')).rows)}catch(e){next(e)}});
router.get('/topics',async(req,res,next)=>{try{res.json((await q('select * from topics where ($1::text is null or subject_id=$1) order by subject_id,sort_order,name',[req.query.subject||null])).rows)}catch(e){next(e)}});
router.get('/cycles',async(req,res,next)=>{try{res.json((await q("select * from exam_cycles where status='active' order by id desc")).rows)}catch(e){next(e)}});

router.get('/questions',auth,async(req,res,next)=>{
 try{
  const subject=req.query.subject||null,topic=req.query.topic||null,limit=Math.max(1,Math.min(50,Number(req.query.limit||1)));
  const r=await q(`select id,stable_key,version_no,subject_id,topic,difficulty,question_text,option_a,option_b,option_c,option_d
    from questions where status='published'
    and ($1::text is null or subject_id=$1)
    and ($2::text is null or topic=$2)
    order by random() limit $3`,[subject,topic,limit]);
  res.json(r.rows.map(x=>({...x,options:[x.option_a,x.option_b,x.option_c,x.option_d]})));
 }catch(e){next(e)}
});

router.post('/attempts',auth,async(req,res,next)=>{
 try{
  const {question_id,answer_index,mode}=req.body||{};
  const r=await q("select correct_option,explanation from questions where id=$1 and status='published'",[question_id]);
  if(!r.rowCount)return res.status(404).json({error:'question_not_found'});
  const ok=Number(answer_index)===r.rows[0].correct_option;
  await q('insert into attempts(user_id,question_id,answer_index,is_correct,mode) values($1,$2,$3,$4,$5)',[req.user.id,question_id,Number(answer_index),ok,mode||'practice']);
  res.json({correct:ok,correct_option:r.rows[0].correct_option,explanation:r.rows[0].explanation});
 }catch(e){next(e)}
});

router.get('/blueprints',auth,async(req,res,next)=>{
 try{
  const b=(await q("select * from blueprints where status='published' order by id")).rows;
  for(const x of b)x.rules=(await q('select br.*,s.name subject_name from blueprint_rules br join subjects s on s.id=br.subject_id where br.blueprint_id=$1 order by br.id',[x.id])).rows;
  res.json(b);
 }catch(e){next(e)}
});

router.post('/blueprints/:code/start',auth,async(req,res,next)=>{
 try{
  const bp=(await q("select * from blueprints where code=$1 and status='published'",[req.params.code])).rows[0];
  if(!bp)return res.status(404).json({error:'blueprint_not_found'});
  const rules=(await q('select * from blueprint_rules where blueprint_id=$1',[bp.id])).rows;
  let items=[];
  for(const rule of rules){
    const r=(await q("select id,stable_key,subject_id,topic,difficulty,question_text,option_a,option_b,option_c,option_d from questions where status='published' and subject_id=$1 order by random() limit $2",[rule.subject_id,rule.question_count])).rows;
    items.push(...r.map(x=>({...x,options:[x.option_a,x.option_b,x.option_c,x.option_d]})));
  }
  res.json({blueprint:bp,questions:items});
 }catch(e){next(e)}
});

router.get('/analytics',auth,async(req,res,next)=>{
 try{
  const total=(await q('select count(*)::int total,count(*) filter(where is_correct)::int correct from attempts where user_id=$1',[req.user.id])).rows[0];
  const by=(await q(`select s.name subject_name,q.subject_id,count(a.id)::int total,count(a.id) filter(where a.is_correct)::int correct,
    round(100.0*count(a.id) filter(where a.is_correct)/greatest(count(a.id),1))::int accuracy
    from attempts a join questions q on q.id=a.question_id join subjects s on s.id=q.subject_id
    where a.user_id=$1 group by s.name,q.subject_id order by accuracy asc`,[req.user.id])).rows;
  res.json({total,by_subject:by});
 }catch(e){next(e)}
});
module.exports=router;
