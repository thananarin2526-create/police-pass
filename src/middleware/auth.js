
const {verify}=require('../services/security');
function auth(req,res,next){const h=req.headers.authorization||'';if(!h.startsWith('Bearer '))return res.status(401).json({error:'unauthorized'});try{req.user=verify(h.slice(7));next()}catch(e){res.status(401).json({error:'invalid_token'})}}
function staff(req,res,next){if(!['editor','reviewer','admin'].includes(req.user?.role))return res.status(403).json({error:'staff_only'});next()}
function reviewer(req,res,next){if(!['reviewer','admin'].includes(req.user?.role))return res.status(403).json({error:'reviewer_only'});next()}
module.exports={auth,staff,reviewer};
