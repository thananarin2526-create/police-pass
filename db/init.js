
require('dotenv').config();const fs=require('fs'),path=require('path');const {pool}=require('../db');
(async()=>{try{await pool.query(fs.readFileSync(path.join(__dirname,'schema.sql'),'utf8'));console.log('DB initialized')}catch(e){console.error(e);process.exitCode=1}finally{await pool.end()}})();
