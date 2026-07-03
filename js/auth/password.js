// Password hashing — randSalt / hashPassword
/* ---- Hash de contraseñas (Web Crypto, SHA-256 con sal por usuario) ---- */
function randSalt(){
  const a=new Uint8Array(16); crypto.getRandomValues(a);
  return [...a].map(b=>b.toString(16).padStart(2,'0')).join('');
}
async function hashPassword(pw,salt){
  const data=new TextEncoder().encode((salt||'')+':'+pw);
  const buf=await crypto.subtle.digest('SHA-256',data);
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
