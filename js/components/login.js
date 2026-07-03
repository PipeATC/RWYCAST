// Login — Login / ForcePassword
function Login({onLogin}){
  const [username,setUsername]=useState('');
  const [password,setPassword]=useState('');
  const [remember,setRemember]=useState(false);
  const [err,setErr]=useState('');
  const [busy,setBusy]=useState(false);
  const submit=async()=>{
    if(!username.trim()||!password||busy) return;
    setBusy(true); setErr('');
    const r=await onLogin(username.trim(),password,remember);
    setBusy(false);
    if(r&&r.error) setErr(r.error);
  };
  return h('div',{className:'login'},
    h('div',{className:'loginbox'},
      h('div',{className:'lh'}, GLYPH,
        h('b',null,'RWYCAST'),
        h('small',null,'SISTEMA OPERACIONAL ATC · CHILE')),
      h('div',{className:'lb'},
        h('div',{className:'lead'},'Acceso con credenciales asignadas. Tu perfil define las unidades y acciones disponibles.'),
        h('div',{className:'field'},
          h('label',null,'Usuario'),
          h('input',{value:username,placeholder:'usuario',autoCapitalize:'none',autoCorrect:'off',spellCheck:false,
            style:{textTransform:'none',fontSize:14},
            onChange:e=>setUsername(e.target.value),
            onKeyDown:e=>{if(e.key==='Enter')document.getElementById('pw-in')&&document.getElementById('pw-in').focus();}})),
        h('div',{className:'field'},
          h('label',null,'Contraseña'),
          h('input',{id:'pw-in',type:'password',value:password,placeholder:'••••••••',
            style:{fontSize:14},
            onChange:e=>setPassword(e.target.value),
            onKeyDown:e=>{if(e.key==='Enter')submit();}})),
        h('label',{style:{display:'flex',alignItems:'center',gap:8,cursor:'pointer',marginBottom:14,
            fontFamily:'var(--mono)',fontSize:11,color:'var(--ink-dim)',letterSpacing:'.04em',userSelect:'none'}},
          h('input',{type:'checkbox',checked:remember,style:{width:14,height:14,accentColor:'var(--phos)',cursor:'pointer'},
            onChange:e=>setRemember(e.target.checked)}),
          'Mantener sesión iniciada'),
        err && h('div',{style:{fontFamily:'var(--mono)',fontSize:11,color:'var(--red)',marginBottom:14,letterSpacing:'.03em'}},'⚠ '+err),
        h('button',{className:'btn primary',style:{width:'100%'},disabled:busy||!username.trim()||!password,
          onClick:submit}, busy?'Verificando…':'Iniciar sesión')
      )
    )
  );
}

/* ---------------- Cambio de contraseña obligatorio ---------------- */
function ForcePassword({user,onSubmit,onLogout}){
  const [p1,setP1]=useState(''); const [p2,setP2]=useState('');
  const [err,setErr]=useState(''); const [busy,setBusy]=useState(false);
  const submit=async()=>{
    if(p1.length<6) return setErr('Mínimo 6 caracteres');
    if(p1!==p2) return setErr('Las contraseñas no coinciden');
    setBusy(true); setErr('');
    const r=await onSubmit(p1); setBusy(false);
    if(r&&r.error) setErr(r.error);
  };
  return h('div',{className:'login'},
    h('div',{className:'loginbox'},
      h('div',{className:'lh'}, GLYPH,
        h('b',null,'RWYCAST'),
        h('small',null,'CAMBIO DE CONTRASEÑA REQUERIDO')),
      h('div',{className:'lb'},
        h('div',{className:'lead'},'Hola '+user.name+'. Define una nueva contraseña para continuar.'),
        h('div',{className:'field'},
          h('label',null,'Nueva contraseña'),
          h('input',{type:'password',value:p1,placeholder:'mínimo 6 caracteres',style:{fontSize:14},
            onChange:e=>setP1(e.target.value)})),
        h('div',{className:'field'},
          h('label',null,'Repetir contraseña'),
          h('input',{type:'password',value:p2,style:{fontSize:14},
            onChange:e=>setP2(e.target.value),onKeyDown:e=>{if(e.key==='Enter')submit();}})),
        err && h('div',{style:{fontFamily:'var(--mono)',fontSize:11,color:'var(--red)',marginBottom:14}},'⚠ '+err),
        h('button',{className:'btn primary',style:{width:'100%',marginBottom:10},disabled:busy,onClick:submit},
          busy?'Guardando…':'Guardar y continuar'),
        h('button',{className:'btn ghost',style:{width:'100%'},onClick:onLogout},'Cancelar y salir')
      )
    )
  );
}
