# POLICE PASS v12.1 – Railway Ready

## สิ่งที่แก้เพื่อขึ้น Railway
- เพิ่ม `railway.json`
- เพิ่ม `/api/health` และ `/api/ready`
- ตรวจ `DATABASE_URL` และ `JWT_ACCESS_SECRET` ตอนเริ่มระบบ
- Production บังคับ JWT secret อย่างน้อย 32 ตัวอักษร
- ตัด Demo Admin password ตายตัวออกจาก production seed
- Admin แรกสร้างผ่าน Environment Variables
- เพิ่ม `.gitignore`
- PostgreSQL production รองรับ SSL
- Start command init DB + seed + start app

## Variables ที่ต้องตั้งบน Railway Web Service
DATABASE_URL=<Reference จาก PostgreSQL service>
NODE_ENV=production
JWT_ACCESS_SECRET=<random secret ยาว 32+ ตัวอักษร>
ADMIN_SEED_EMAIL=<อีเมล admin ของคุณ>
ADMIN_SEED_PASSWORD=<รหัสผ่าน admin อย่างน้อย 12 ตัว>
ADMIN_SEED_NAME=System Admin

ปกติ Railway จะ inject PORT ให้เอง แอปอ่าน `process.env.PORT`

## ขั้นตอน
1. แตก ZIP
2. สร้าง GitHub repository
3. อัปโหลดไฟล์ภายในโฟลเดอร์นี้ทั้งหมด
4. Railway > New Project > Deploy from GitHub Repo
5. เพิ่ม PostgreSQL ใน Project
6. ที่ Web Service เพิ่ม Variables ด้านบน
7. ให้ `DATABASE_URL` อ้างอิงจาก PostgreSQL service
8. Deploy
9. ตรวจ `/api/health`
10. ตรวจ `/api/ready`
11. Generate Domain แล้วเปิดหน้าเว็บ

## หมายเหตุความปลอดภัย
- อย่า commit `.env`
- อย่าใช้รหัสผ่าน admin ตัวอย่าง
- เมื่อสร้าง admin สำเร็จแล้ว สามารถลบ ADMIN_SEED_PASSWORD จาก Variables ได้ แต่ seed จะไม่สร้าง admin ใหม่ถ้าบัญชีเดิมมีอยู่แล้ว
- v12.1 ยังเป็น launch candidate ไม่ใช่ production-complete: auth refresh/logout/email verification, billing, mock integrity และ entitlement ยังควรทำต่อก่อนเปิดขายจริง
