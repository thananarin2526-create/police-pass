
const express=require('express');const {q}=require('../db');const {auth,staff,reviewer}=require('../middleware/auth');const router=express.Router();
router.use(auth);

router.get('/review-queue',staff,async(req,res,next)=>{
 try{res.json((await q(`select rq.id queue_id,q.id question_id,q.stable_key,q.question_text,q.status,rq.submitted_at
 from review_queue rq join questions q on q.id=rq.question_id where rq.decision is null order by rq.id`)).rows)}catch(e){next(e)}
});

router.post('/questions/:id/submit-review',staff,async(req,res,next)=>{
 try{
  await q("update questions set status='review' where id=$1",[req.params.id]);
  await q('insert into review_queue(question_id,submitted_by) values($1,$2)',[req.params.id,req.user.id]);
  res.json({ok:true});
 }catch(e){next(e)}
});

router.post('/review/:queueId/decision',reviewer,async(req,res,next)=>{
 try{
  const {decision,note}=req.body||{};
  if(!['published','rejected'].includes(decision))return res.status(400).json({error:'invalid_decision'});
  const row=(await q('select * from review_queue where id=$1 and decision is null',[req.params.queueId])).rows[0];
  if(!row)return res.status(404).json({error:'queue_not_found'});
  await q('begin');
  await q('update review_queue set decision=$1,note=$2,reviewed_by=$3,reviewed_at=now() where id=$4',[decision,note||'',req.user.id,row.id]);
  await q('update questions set status=$1,reviewed_by=$2,reviewed_at=now() where id=$3',[decision,req.user.id,row.question_id]);
  await q('commit');
  res.json({ok:true});
 }catch(e){try{await q('rollback')}catch{};next(e)}
});

router.get('/content-stats',staff,async(req,res,next)=>{
 try{
  const r=await q(`select status,count(*)::int count from questions group by status order by status`);
  const k=(await q('select count(*)::int c from knowledge_items where approved=true')).rows[0].c;
  res.json({questions:r.rows,approved_knowledge:k});
 }catch(e){next(e)}
});
module.exports=router;
