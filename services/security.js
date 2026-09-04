
const jwt=require('jsonwebtoken'),bcrypt=require('bcryptjs');
function sign(u){return jwt.sign({id:u.id,role:u.role,name:u.name},process.env.JWT_ACCESS_SECRET,{expiresIn:'12h'})}
function verify(t){return jwt.verify(t,process.env.JWT_ACCESS_SECRET)}
function hp(p){return bcrypt.hashSync(p,12)}
function cp(p,h){return bcrypt.compareSync(p,h)}
module.exports={sign,verify,hp,cp};
