
const express=require('express');const {q}=require('../db');const {auth}=require('../middleware/auth');const router=express.Router();
router.post('/tutor',auth,async(req,res,next)=>{
 try{
  const message=String(req.body?.message||'').trim();
  if(!message)return res.status(400).json({error:'empty_message'});
  const words=message.split(/\s+/).filter(x=>x.length>1).slice(0,6);
  let rows=[];
  for(const w of words){
    const r=(await q(`select id,title,content,source_note,source_url,subject_id,topic from knowledge_items
      where approved=true and (title ilike $1 or content ilike $1 or topic ilike $1) limit 4`,['%'+w+'%'])).rows;
    rows.push(...r);
  }
  const seen=new Set();rows=rows.filter(x=>!seen.has(x.id)&&seen.add(x.id)).slice(0,5);
  if(!rows.length){
    const answer='ยังไม่พบเนื้อหาที่ผ่านการอนุมัติสำหรับคำถามนี้ ระบบจึงไม่เดาคำตอบ กรุณาเลือกหัวข้ออื่นหรือแจ้งผู้ดูแลเพิ่มแหล่งข้อมูล';
    await q('insert into ai_logs(user_id,user_message,answer_text,citations_json,grounded) values($1,$2,$3,$4,true)',[req.user.id,message,answer,[]]);
    return res.json({answer,citations:[],grounded:true});
  }
  const answer=rows.map((x,i)=>`${i+1}) ${x.title}: ${x.content}`).join('\\n');
  const citations=rows.map(x=>({title:x.title,source_note:x.source_note,source_url:x.source_url,topic:x.topic}));
  await q('insert into ai_logs(user_id,user_message,answer_text,citations_json,grounded) values($1,$2,$3,$4,true)',[req.user.id,message,answer,citations]);
  res.json({answer,citations,grounded:true,note:'v11 ใช้ retrieval จาก Knowledge Base ที่อนุมัติแล้ว ยังไม่ได้ต่อ LLM ภายนอก'});
 }catch(e){next(e)}
});
module.exports=router;
