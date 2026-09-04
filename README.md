# POLICE PASS v12.1 – 1,000 Questions & Adaptive Learning Edition

## สิ่งที่เพิ่มจาก v11
- Adaptive question session
- พยายามหลีกเลี่ยงข้อที่ผู้เรียนตอบถูกแล้ว
- Wrong-answer notebook
- Bookmark
- 30-day Study Plan จากหัวข้ออ่อน
- Daily question target เพิ่มตามช่วงของแผน
- Streak API
- Question Bank Manifest 1,000 records

## สำคัญเรื่อง 1,000 Questions
v12 ไม่หลอกว่ามี “ข้อสอบคุณภาพ 1,000 ข้อ” ทั้งที่ยังไม่ได้ตรวจ

ภายในประกอบด้วย:
- 50 curated/published questions จาก v11
- 950 review-required content candidates

950 รายการถูกเก็บเป็น production queue และมีสถานะว่าต้องตรวจโดยมนุษย์ก่อนเผยแพร่
แนวทางนี้เหมาะกว่าการปั๊มคำถามซ้ำแล้วเปิดขายทันที

## Official exam context
ระบบรองรับ Exam Cycle และ Source/Version governance
ข้อมูลวิชา/น้ำหนักคะแนน/จำนวนข้อจริงของแต่ละปีต้องผูกกับประกาศทางการก่อนเปิดใช้เป็น Official Blueprint

## Run
docker compose up --build
เปิด http://localhost:3000

Admin demo:
admin@policepass.local
admin1234

## Production next
- เพิ่มข้อ curated จริงเป็น 300 → 600 → 1,000
- Mock session server timer
- Answer palette
- spaced repetition
- adaptive difficulty แบบ Bayesian/IRT ภายหลัง
- payment + entitlement
- verified official exam blueprint
- LLM tutor with approved knowledge citations


## Railway
ดู `RAILWAY_DEPLOY.md` สำหรับขั้นตอน Deploy และ Environment Variables ที่ต้องตั้ง
