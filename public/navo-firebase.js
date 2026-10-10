/* NAVO on Firebase: provides the same claude.use("db") / claude.use("user") interface the app uses,
   backed by Firebase Auth + Cloud Firestore. Access is enforced by firestore.rules on the server. */
(function(){
  firebase.initializeApp(window.NAVO_FIREBASE_CONFIG);
  const auth=firebase.auth(), fs=firebase.firestore();
  try{fs.enablePersistence({synchronizeTabs:true}).catch(()=>{})}catch(e){} // offline queue for site use
  let resolveAuthed; const authed=new Promise(r=>resolveAuthed=r);
  const mapErr=e=>({code:e&&e.code==="permission-denied"?"invalid_argument":e&&e.code==="resource-exhausted"?"quota_exceeded":"unavailable",message:e&&e.message||""});
  const wrapDoc=s=>({id:s.id,exists:s.exists,data:()=>s.exists?s.data():undefined,metadata:{fromCache:s.metadata.fromCache,hasPendingWrites:s.metadata.hasPendingWrites}});
  const guard=p=>p.catch(e=>{throw mapErr(e)});
  function docRef(r){return{id:r.id,path:r.path,get:async()=>wrapDoc(await guard(r.get())),set:d=>guard(r.set(d)),update:d=>guard(r.update(d)),delete:()=>guard(r.delete()),
    onSnapshot:(n,e)=>r.onSnapshot(s=>n(wrapDoc(s)),x=>e&&e(mapErr(x))),collection:p=>coll(r.collection(p))}}
  function query(q){return{where:(f,o,v)=>query(q.where(f,o,v)),orderBy:(f,d)=>query(q.orderBy(f,d||"asc")),limit:n=>query(q.limit(n)),
    get:async()=>{const s=await guard(q.get());const docs=s.docs.map(wrapDoc);return{docs,size:docs.length,empty:!docs.length,docChanges:()=>[],metadata:{}}},
    onSnapshot:(n,e)=>q.onSnapshot(s=>{const docs=s.docs.map(wrapDoc);n({docs,size:docs.length,empty:!docs.length,docChanges:()=>[],metadata:{fromCache:s.metadata.fromCache,hasPendingWrites:s.metadata.hasPendingWrites}})},x=>e&&e(mapErr(x)))}}
  function coll(c){return Object.assign(query(c),{path:c.path,doc:id=>docRef(id?c.doc(id):c.doc()),add:async d=>docRef(await guard(c.add(d)))})}
  const db={doc:p=>docRef(fs.doc(p)),collection:p=>coll(fs.collection(p))};
  const cache={};
  const user={
    me:async()=>{const u=auth.currentUser;return{id:u?u.uid:null,name:u?(u.displayName||u.email||""):"",email:u?u.email:null,isOwner:await user.isOwner(),canEdit:false,avatarUrl:"",color:"#0f4c45"}},
    id:async()=>auth.currentUser?auth.currentUser.uid:null,
    isOwner:async()=>{const u=auth.currentUser;if(!u)return false;const s=await fs.doc("admin/owner").get().catch(()=>null);return!!(s&&s.exists&&s.data().uid===u.uid)},
    canEdit:async()=>false, can:async()=>null,
    profiles:async ids=>{ids=[].concat(ids);const me=auth.currentUser&&auth.currentUser.uid;await Promise.all(ids.filter(i=>i&&!cache[i]).map(async i=>{const s=await fs.doc("people/"+i).get().catch(()=>null);cache[i]=s&&s.exists?s.data():{}}));
      return Object.fromEntries(ids.map(i=>[i,{id:i,name:(cache[i]&&(cache[i].name||cache[i].email))||"",email:cache[i]&&cache[i].email||null,isMe:i===me,avatarUrl:"",color:"#0f4c45",guest:false}]))},
    search:async q=>{const s=await fs.collection("people").limit(500).get().catch(()=>null);if(!s)return[];q=(q||"").toLowerCase();const me=auth.currentUser.uid;
      return s.docs.map(d=>({id:d.id,...d.data()})).filter(p=>!q||(p.name||"").toLowerCase().includes(q)||(p.email||"").toLowerCase().includes(q)).slice(0,8)
        .map(p=>{cache[p.id]=p;return{id:p.id,name:p.name||p.email,email:p.email,isMe:p.id===me,avatarUrl:"",color:"#0f4c45",guest:false}})}
  };
  window.claude={use:async n=>{await authed;return n==="db"?db:n==="user"?user:null}};

  // ---- sign-in screen ----
  const box=document.getElementById("login");const msg=t=>{document.getElementById("lg-msg").textContent=t};
  auth.onAuthStateChanged(async u=>{
    if(!u){box.hidden=false;return}
    box.hidden=true;
    const name=u.displayName||document.getElementById("lg-name").value.trim()||u.email;
    if(!u.displayName&&name)await u.updateProfile({displayName:name}).catch(()=>{});
    await fs.doc("people/"+u.uid).set({name,email:u.email||""},{merge:true}).catch(()=>{});
    const o=await fs.doc("admin/owner").get().catch(()=>null);
    if(o&&!o.exists)await fs.doc("admin/owner").set({uid:u.uid}).catch(()=>{}); // first person to sign in owns the system
    const ctr=document.querySelector(".ctrls");if(ctr&&!document.getElementById("signout")){const b=document.createElement("button");b.id="signout";b.className="btn";b.textContent="Sign out";b.onclick=()=>auth.signOut().then(()=>location.reload());ctr.appendChild(b)}
    resolveAuthed();
  });
  document.getElementById("lg-google").onclick=()=>auth.signInWithPopup(new firebase.auth.GoogleAuthProvider()).catch(e=>msg(e.message));
  document.getElementById("lg-form").onsubmit=async e=>{e.preventDefault();const em=document.getElementById("lg-email").value.trim(),pw=document.getElementById("lg-pass").value;
    try{await auth.signInWithEmailAndPassword(em,pw)}catch(x){if(x.code==="auth/user-not-found"||x.code==="auth/invalid-credential"||x.code==="auth/invalid-login-credentials"){
      if(!document.getElementById("lg-name").value.trim()){msg("New here? Add your full name, then press Sign in again to create your account.");document.getElementById("lg-name-wrap").hidden=false;return}
      try{await auth.createUserWithEmailAndPassword(em,pw)}catch(y){msg(y.message)}}else msg(x.message)}};
  document.getElementById("lg-reset").onclick=()=>{const em=document.getElementById("lg-email").value.trim();if(!em){msg("Type your email first.");return}auth.sendPasswordResetEmail(em).then(()=>msg("Password reset email sent.")).catch(e=>msg(e.message))};
})();
