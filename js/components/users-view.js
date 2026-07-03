// Usuarios UI — UsersAdmin / UserEditor
function UsersAdmin({users,currentUser,onNew,onEdit,onDelete}){
  const list=Object.values(users||{}).sort((a,b)=>
    (ROLES.indexOf(a.role)+'_'+a.username).localeCompare(ROLES.indexOf(b.role)+'_'+b.username));
  return h('div',null,
    h('div',{className:'phead',style:{borderTop:'none'}},
      h('h3',null,'Gestión de usuarios'),
      h('span',{className:'sub'}, list.length+' CUENTA'+(list.length===1?'':'S')+' · ACCESO ADMIN')),
    h('div',{className:'gridwrap'},
      h('div',{className:'toolbar'},
        h('button',{className:'filterbtn on',onClick:onNew},'+ Nuevo usuario')),
      list.length===0
        ? h('div',{className:'empty'},'No hay usuarios todavía. Crea el primero.')
        : h('div',{className:'apgrid'},
            list.map(u=>h('div',{className:'apcard',key:u.username},
              h('div',{className:'crest'},
                h('div',null,
                  h('div',{className:'icao',style:{fontSize:16}}, u.username),
                  h('div',{className:'nm'}, u.name),
                  h('div',{className:'city'}, ROLE_LABEL[u.role]||u.role)),
                h('div',{className:'owntag'},
                  h('b',null, roleNeedsUnit(u.role)?(userUnits(u).join(' · ')||'—'):'—'),
                  u.active===false
                    ? h('span',{style:{color:'var(--red)'}},'INACTIVO')
                    : h('span',{style:{color:'var(--phos)'}},'ACTIVO'))),
              h('div',{className:'apfoot'},
                h('span',{className:'age'}, u.mustChangePassword?'⚠ debe cambiar contraseña':('Creado '+ageMin(u.createdAt))),
                h('span',{className:'editlink',onClick:()=>onEdit(u)},'Editar'),
                u.username!==currentUser.username && h('span',{className:'editlink rm',
                  onClick:()=>{ if(window.confirm('¿Eliminar al usuario "'+u.username+'"?')) onDelete(u.username); }},'Eliminar')))))
    )
  );
}

/* ---------------- Editor de usuario (crear / editar) ---------------- */
function UserEditor({rec,currentUser,airports,onClose,onCreate,onSave}){
  const isNew=!rec;
  const [username,setUsername]=useState(rec?rec.username:'');
  const [name,setName]=useState(rec?rec.name:'');
  const [role,setRole]=useState(rec?rec.role:'unit');
  const [units,setUnits]=useState(rec?userUnits(rec):[]);
  const [active,setActive]=useState(rec?rec.active!==false:true);
  const [password,setPassword]=useState('');
  const [err,setErr]=useState(''); const [busy,setBusy]=useState(false);
  const needUnit=roleNeedsUnit(role);   // unidad (varias) y general (una) se asignan a unidad(es)
  const multi=role==='unit';            // el usuario de unidad puede gestionar varias
  // unidades disponibles = aeródromos del catálogo (dedup por propietario)
  const unitOpts=Array.from(new Map(
    (airports||[]).map(a=>[a.owner,{code:a.owner,label:a.icao+' · '+a.name}])).values());
  // si el usuario ya tenía unidades que ya no están en el catálogo, las conservamos como opción
  units.forEach(u=>{ if(u && !unitOpts.some(o=>o.code===u)) unitOpts.unshift({code:u,label:u+' · (fuera de catálogo)'}); });
  const roleHelp =
    role==='admin'  ? 'Acceso total: gestiona usuarios y edita cualquier unidad del país.' :
    role==='unit'   ? 'Edita pistas/STAR/aprox de TODAS sus unidades asignadas (una o varias).' :
    role==='sector' ? 'Solo visualización operativa (sin edición de datos).' :
                      'Solo accede al Briefing de turno de su unidad asignada.';
  const submit=async()=>{
    setBusy(true); setErr('');
    const r=isNew
      ? await onCreate({username:username.trim(),name:name.trim(),role,units,password})
      : await onSave(rec.username,{name:name.trim(),role,units,active,password:password||undefined});
    setBusy(false);
    if(r&&r.error) setErr(r.error);
  };
  return h('div',{className:'scrim',onClick:e=>{if(e.target.className==='scrim')onClose();}},
    h('div',{className:'drawer'},
      h('div',{className:'dhead'},
        h('div',{className:'icao',style:{fontSize:18}}, isNew?'NUEVO':rec.username),
        h('div',null,
          h('div',{style:{fontFamily:'var(--mono)',fontSize:11,color:'var(--ink-dim)',letterSpacing:'.04em'}}, isNew?'Crear cuenta':'Editar cuenta'),
          h('div',{style:{fontFamily:'var(--mono)',fontSize:9.5,color:'var(--ink-faint)',marginTop:3,letterSpacing:'.1em'}},'CONTROL DE ACCESO')),
        h('button',{className:'x',onClick:onClose},'✕')),
      h('div',{className:'dbody'},
        isNew && h('div',{className:'field'},
          h('label',null,'Usuario ',h('span',{className:'hint'},'3-32 · letras, números, _ o -')),
          h('input',{value:username,autoCapitalize:'none',autoCorrect:'off',spellCheck:false,
            style:{textTransform:'none',fontSize:14},onChange:e=>setUsername(e.target.value)})),
        h('div',{className:'field'},
          h('label',null,'Nombre para mostrar'),
          h('input',{value:name,placeholder:'Ej. R. Soto',style:{fontSize:14},onChange:e=>setName(e.target.value)})),
        h('div',{className:'field'},
          h('label',null,'Rol'),
          h('select',{value:role,onChange:e=>setRole(e.target.value)},
            ROLES.map(r=>h('option',{key:r,value:r},ROLE_LABEL[r])))),
        needUnit && h('div',{className:'field'},
          h('label',null, multi?'Unidades asignadas ':'Unidad asignada ',
            h('span',{className:'hint'}, multi?'una o varias del catálogo':'unidades del catálogo')),
          unitOpts.length===0
            ? h('div',{style:{fontFamily:'var(--mono)',fontSize:11,color:'var(--amber)',
                border:'1px solid var(--amber-deep)',padding:'10px 12px',lineHeight:1.5}},
                'No hay unidades en el catálogo. Crea primero un aeródromo en el módulo Catálogo.')
            : multi
              ? h('div',{style:{display:'flex',flexDirection:'column',gap:6,maxHeight:200,overflowY:'auto',
                  border:'1px solid var(--line)',padding:'8px 10px'}},
                  unitOpts.map(o=>h('label',{key:o.code,style:{display:'flex',alignItems:'center',gap:8,cursor:'pointer',
                    fontFamily:'var(--mono)',fontSize:12,color:'var(--ink)',userSelect:'none'}},
                    h('input',{type:'checkbox',checked:units.includes(o.code),
                      style:{width:14,height:14,accentColor:'var(--phos)',cursor:'pointer'},
                      onChange:e=>setUnits(prev=> e.target.checked ? [...prev,o.code] : prev.filter(x=>x!==o.code))}),
                    o.label)))
              : h('select',{value:units[0]||'',onChange:e=>setUnits(e.target.value?[e.target.value]:[])},
                  h('option',{value:''},'— Selecciona unidad —'),
                  unitOpts.map(o=>h('option',{key:o.code,value:o.code},o.label)))),
        !isNew && h('div',{className:'field'},
          h('label',null,'Estado de la cuenta'),
          h('div',{className:'seg'},
            h('button',{className:active?'on':'',onClick:()=>setActive(true)},'Activo'),
            h('button',{className:!active?'on':'',onClick:()=>setActive(false)},'Inactivo'))),
        h('div',{className:'field'},
          h('label',null, isNew?'Contraseña inicial':'Restablecer contraseña ',
            !isNew&&h('span',{className:'hint'},'vacío = sin cambio')),
          h('input',{type:'password',value:password,style:{fontSize:14},
            placeholder: isNew?'mínimo 6 caracteres':'nueva contraseña (opcional)',
            onChange:e=>setPassword(e.target.value)})),
        h('div',{style:{fontFamily:'var(--mono)',fontSize:10,color:'var(--ink-faint)',lineHeight:1.6,
          border:'1px solid var(--line-soft)',padding:'10px 12px'}}, roleHelp),
        err && h('div',{style:{fontFamily:'var(--mono)',fontSize:11,color:'var(--red)',marginTop:12}},'⚠ '+err)
      ),
      h('div',{className:'dfoot'},
        h('button',{className:'btn ghost',style:{flex:1},onClick:onClose},'Cancelar'),
        h('button',{className:'btn primary',style:{flex:2},disabled:busy,onClick:submit},
          busy?'Guardando…':(isNew?'Crear usuario':'Guardar cambios')))
    )
  );
}
