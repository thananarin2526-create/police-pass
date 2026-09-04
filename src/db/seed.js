
require('dotenv').config();const fs=require('fs'),path=require('path'),bcrypt=require('bcryptjs');const {pool,q}=require('../db');
(async()=>{
 try{
  const subjects=[['math','คณิตศาสตร์ / ความสามารถทั่วไป',1],['thai','ภาษาไทย',2],['english','ภาษาอังกฤษ',3],['computer','คอมพิวเตอร์',4],['law','กฎหมายและการวิเคราะห์ข้อกฎหมาย',5]];
  for(const s of subjects)await q('insert into subjects(id,name,sort_order) values($1,$2,$3) on conflict(id) do nothing',s);

  const topics=JSON.parse(fs.readFileSync(path.join(__dirname,'../../content/topics.json'),'utf8'));
  for(const [sid,arr] of Object.entries(topics))for(let i=0;i<arr.length;i++)await q('insert into topics(subject_id,name,sort_order) values($1,$2,$3) on conflict(subject_id,name) do nothing',[sid,arr[i],i+1]);

  const adminEmail=(process.env.ADMIN_SEED_EMAIL||'').trim().toLowerCase();
  const adminPassword=(process.env.ADMIN_SEED_PASSWORD||'').trim();
  const adminName=(process.env.ADMIN_SEED_NAME||'System Admin').trim();
  let admin={id:null};
  if(adminEmail && adminPassword){
    admin=(await q('select id from users where lower(email)=lower($1)',[adminEmail])).rows[0];
    if(!admin)admin=(await q("insert into users(name,email,password_hash,role,plan) values($1,$2,$3,'admin','PRO') returning id",[adminName,adminEmail,bcrypt.hashSync(adminPassword,12)])).rows[0];
  } else {
    admin=(await q("select id from users where role='admin' order by id limit 1")).rows[0]||{id:null};
    if(process.env.NODE_ENV==='production') console.warn('ADMIN_SEED_EMAIL/PASSWORD not set: no demo admin will be created.');
  }

  const cycle=(await q("select id from exam_cycles where code='NCO-2569'")).rows[0];
  let cycleId=cycle?.id;
  if(!cycleId){
    cycleId=(await q(`insert into exam_cycles(code,name,official_source_url,verified_note,status)
      values('NCO-2569','นักเรียนนายสิบตำรวจ ประจำปีงบประมาณ พ.ศ. 2569',
      'https://school8.education.police.go.th/',
      'ข้อมูลที่ seed นี้ยืนยันเฉพาะการเปิดรับสมัครระดับ ม.6/ปวช.หรือเทียบเท่า และจำนวนรวม 6,000 อัตราตามแหล่งตำรวจทางการ ไม่กำหนดวิชา/น้ำหนักคะแนนโดยเดา',
      'active') returning id`)).rows[0].id;
  }

  const qs=JSON.parse(fs.readFileSync(path.join(__dirname,'../../content/questions_v1.json'),'utf8'));
  for(const b of qs){
    await q(`insert into questions(stable_key,version_no,exam_cycle_id,subject_id,topic,difficulty,question_text,option_a,option_b,option_c,option_d,correct_option,explanation,source_note,status,reviewed_by,reviewed_at)
      values($1,1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now())
      on conflict(stable_key,version_no) do nothing`,
      [b.stable_key,cycleId,b.subject_id,b.topic,b.difficulty,b.question_text,...b.options,b.correct_option,b.explanation,b.source_note,b.status,admin.id]);
  }

  const ks=JSON.parse(fs.readFileSync(path.join(__dirname,'../../content/knowledge_v1.json'),'utf8'));
  for(const k of ks){
    const exists=await q('select id from knowledge_items where title=$1',[k.title]);
    if(!exists.rowCount)await q('insert into knowledge_items(subject_id,topic,title,content,source_note,source_url,approved) values($1,$2,$3,$4,$5,$6,$7)',
      [k.subject_id,k.topic,k.title,k.content,k.source_note,k.source_url||null,k.approved]);
  }

  const bp=JSON.parse(fs.readFileSync(path.join(__dirname,'../../content/blueprints.json'),'utf8'));
  for(const [code,b] of Object.entries(bp)){
    let row=(await q('select id from blueprints where code=$1',[code])).rows[0];
    if(!row)row=(await q("insert into blueprints(code,name,total_questions,duration_minutes,status) values($1,$2,$3,$4,\'published\') returning id",[code,b.name,b.total_questions,b.duration_minutes])).rows[0];
    for(const rule of b.rules){
      const ex=await q('select id from blueprint_rules where blueprint_id=$1 and subject_id=$2',[row.id,rule.subject_id]);
      if(!ex.rowCount)await q('insert into blueprint_rules(blueprint_id,subject_id,question_count) values($1,$2,$3)',[row.id,rule.subject_id,rule.question_count]);
    }
  }
  console.log('Seed complete: 50 questions + knowledge + blueprints');
 }catch(e){console.error(e);process.exitCode=1}finally{await pool.end()}
})();
