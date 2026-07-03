// Zulu clock — nowZ / clockZ / ageMin
function nowZ(){const d=new Date();const p=n=>String(n).padStart(2,'0');return p(d.getUTCHours())+p(d.getUTCMinutes())+p(d.getUTCSeconds())+'Z';}
function clockZ(){const d=new Date();const p=n=>String(n).padStart(2,'0');return {hms:p(d.getUTCHours())+':'+p(d.getUTCMinutes())+':'+p(d.getUTCSeconds()), utc:p(d.getUTCHours())+':'+p(d.getUTCMinutes()), local:p(d.getHours())+':'+p(d.getMinutes())};}
function ageMin(ts){if(!ts)return '—';const m=Math.floor((Date.now()-ts)/60000);if(m<1)return 'hace <1 min';if(m<60)return 'hace '+m+' min';return 'hace '+Math.floor(m/60)+'h '+(m%60)+'m';}
