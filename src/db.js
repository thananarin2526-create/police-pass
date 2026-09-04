
const {Pool}=require('pg');
const isProd=process.env.NODE_ENV==='production';
const pool=new Pool({
  connectionString:process.env.DATABASE_URL,
  ssl:isProd && process.env.PGSSL_DISABLE!=='true' ? {rejectUnauthorized:false} : undefined
});
async function q(t,p=[]){return pool.query(t,p)}
module.exports={pool,q};
