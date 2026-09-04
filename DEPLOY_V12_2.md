# POLICE PASS v12.2 – Admin Question Center

## อัปเดตบน GitHub โดยไม่ลบฐานข้อมูลเดิม
อัปโหลด/แทนที่ไฟล์ต่อไปนี้ใน repo `police-pass`

- package.json
- src/server.js
- src/routes/admin.js
- src/db/migrate.js   (ไฟล์ใหม่)
- public/index.html
- public/app.js
- question_import_template_v12_2.csv (ไม่บังคับ แต่แนะนำ)

Railway จะติดตั้ง dependency `csv-parse` ระหว่าง build และ redeploy อัตโนมัติ

## Start Command
ให้คง:
`node src/server.js`

ห้ามกลับไปใช้ `init.js && seed.js && server.js` ในตอนนี้

`server.js` v12.2 จะรัน migration แบบ idempotent อัตโนมัติ เช่นเพิ่ม created_by/updated_at
โดยไม่ลบข้อมูลเดิม

## หลัง Deploy
1. ตรวจ Deploy Logs ต้องเห็น:
   - DB migration v12.2 complete
   - POLICE PASS v12.2 running
2. Ctrl+F5
3. Login Admin ใหม่
4. เปิด `Question Center`
5. เพิ่มข้อ -> Save Draft -> ส่งตรวจ
6. เปิด `Review Queue` -> อนุมัติ
7. ข้อที่ Published เท่านั้นจะถูกสุ่มในหน้าฝึก

## CSV
คอลัมน์ตาม `question_import_template_v12_2.csv`
ทุกแถวถูกนำเข้าเป็น `draft` และต้องผ่าน Review ก่อน Publish
