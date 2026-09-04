
require('dotenv').config();
const {validateEnvironment}=require('./services/env');
validateEnvironment();
const express=require('express'),cors=require('cors'),helmet=require('helmet'),rateLimit=require('express-rate-limit'),path=require('path');
const app=express();
app.set('trust proxy',1);
app.use(helmet({crossOriginResourcePolicy:{policy:'cross-origin'}}));
app.use(cors());app.use(express.json({limit:'2mb'}));app.use(rateLimit({windowMs:15*60*1000,max:400}));
app.use(express.static(path.join(__dirname,'..','public')));

app.get('/api/health',(req,res)=>res.json({ok:true,service:'POLICE PASS v12.1',version:'12.1.0'}));
app.get('/api/ready',async(req,res)=>{
  try{
    const {q}=require('./db');
    await q('select 1 as ok');
    res.json({ok:true,database:'ready'});
  }catch(e){
    res.status(503).json({ok:false,database:'unavailable'});
  }
});

app.use('/api/auth',require('./routes/auth'));
app.use('/api',require('./routes/study'));
app.use('/api/ai',require('./routes/ai'));
app.use('/api',require('./routes/adaptive'));
app.use('/api/admin',require('./routes/admin'));
app.use((err,req,res,next)=>{console.error(err);res.status(500).json({error:'internal_server_error'})});
app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'..','public','index.html')));
app.listen(Number(process.env.PORT||3000),()=>console.log('POLICE PASS v12.1 running'));
