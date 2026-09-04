
function requireEnv(name){
  const v=process.env[name];
  if(!v) throw new Error(`Missing required environment variable: ${name}`);
  return v;
}
function validateEnvironment(){
  const prod=process.env.NODE_ENV==='production';
  requireEnv('DATABASE_URL');
  requireEnv('JWT_ACCESS_SECRET');
  if(prod){
    const secret=process.env.JWT_ACCESS_SECRET||'';
    if(secret.length<32 || /change-this|replace-with|secret/i.test(secret)){
      throw new Error('JWT_ACCESS_SECRET is too weak for production. Use a random value of at least 32 characters.');
    }
    const adminPass=process.env.ADMIN_SEED_PASSWORD||'';
    if(adminPass && adminPass.length<12){
      throw new Error('ADMIN_SEED_PASSWORD must be at least 12 characters in production.');
    }
  }
}
module.exports={validateEnvironment};
