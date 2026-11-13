/* 通风与空调工程期末刷题站 — 无依赖、可直接部署至 GitHub Pages */
(() => {
  'use strict';
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const bank = window.QUESTION_BANK;
  if (!bank || !Array.isArray(bank.questions) || !bank.questions.length) {
    $('#main').innerHTML = '<div class="load-error"><h2>题库未能加载</h2><p>请检查 questions.js 是否与网页放在同一文件夹，并重新加载页面。</p></div>'; return;
  }
  const all = bank.questions;
  const byId = Object.fromEntries(all.map(q => [q.id, q]));
  const types = {single:'单选题', multiple:'多选题', judge:'判断题'};
  const labels = {home:'学习概览',practice:'专项练习',exam:'模拟考试',wrong:'我的错题',favorite:'我的收藏',library:'全部题库'};
  const KEY = 'hvac-study-v1';
  const emptyData = () => ({records:{}, favorites:[], wrong:[], history:[], session:null, exam:null});
  let data;
  try { data = {...emptyData(), ...JSON.parse(localStorage.getItem(KEY) || '{}')}; }
  catch { data = emptyData(); }
  data.records = data.records && typeof data.records === 'object' ? data.records : {};
  for (const k of ['favorites','wrong']) data[k] = Array.isArray(data[k]) ? data[k].filter(id => byId[id]) : [];
  data.history = Array.isArray(data.history) ? data.history : [];
  if (data.session && (!Array.isArray(data.session.ids) || !data.session.ids.every(id => byId[id]))) data.session = null;
  if (data.exam && (!Array.isArray(data.exam.ids) || !data.exam.ids.length || !data.exam.ids.every(id => byId[id]) || !Number.isFinite(data.exam.deadline))) data.exam = null;
  let view = 'home', session = null, selected = [], feedback = null, review = null, reviewIndex = 0;
  let typeFilter = 'all', unitFilter = 'all', order = 'sequence', libraryFilter = 'all', libraryUnit = 'all', search = '', saveWarned = false;
  let timerHandle, toastHandle;
  const canGrade = q => Array.isArray(q.answer) && q.answer.length > 0;
  const match = (a,b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');
  const shuffle = arr => { const a = [...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
  const valid = () => all.filter(canGrade);
  const answered = () => Object.keys(data.records).filter(id => byId[id]);
  const accuracy = () => { const r=Object.values(data.records);const total=r.reduce((s,x)=>s+(x.attempts||0),0);return total?Math.round(r.reduce((s,x)=>s+(x.correct||0),0)/total):0; };
  const percent = (a,b) => b ? Math.round(a/b*100) : 0;
  const badge = q => `<span class="badge ${q.type}">${types[q.type]}</span>`;
  const dateText = t => new Date(t).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false});
  function toast(msg) { clearTimeout(toastHandle);$('#toast').textContent=msg;$('#toast').classList.add('visible');toastHandle=setTimeout(()=>$('#toast').classList.remove('visible'),2600); }
  function save() { try { localStorage.setItem(KEY,JSON.stringify(data)); } catch { if(!saveWarned){saveWarned=true;toast('浏览器无法保存进度，请检查存储空间或隐私设置');} } }
  function navCounts(){ $('#wrong-count').textContent=data.wrong.length;$('#favorite-count').textContent=data.favorites.length; }
  function head(title,subtitle,extra=''){return `<div class="page-heading"><div><div class="eyebrow">HVAC / STUDY SPACE</div><h1>${title}</h1><p>${subtitle}</p></div>${extra}</div>`;}
  function modal(content) { $('#modal-content').innerHTML=content;$('#modal').showModal(); }
  function confirmAction(title,message,action,label='确认'){modal(`<h2>${title}</h2><p>${message}</p><div class="button-row"><button class="secondary" data-close>取消</button><button class="primary" id="modal-confirm">${label}</button></div>`);$('#modal-confirm').onclick=()=>{$('#modal').close();action();};}
  $('#modal').addEventListener('click',e=>{if(e.target.closest('[data-close]'))$('#modal').close();});
  function go(next){
    if (!labels[next]) next='home';
    if(next!==view&&(next==='wrong'||next==='favorite')){typeFilter='all';unitFilter='all';}
    view=next;review=null;feedback=null;selected=[];
    clearInterval(timerHandle);
    document.querySelectorAll('nav [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
    $('#page-label').textContent=labels[view];navCounts();
    if(next==='home') renderHome();
    else if(next==='exam'){if(data.exam)renderExam();else renderExamSetup();}
    else if(next==='library')renderLibrary();
    else startSession(next,typeFilter,order,next==='practice');
    window.scrollTo({top:0,behavior:'instant'});
  }
  function renderHome(){
    const done=answered().length, mastered=Object.values(data.records).filter(r=>r.lastCorrect).length;
    $('#main').innerHTML=head('给期末，多一份把握。',`通风与空调工程 · ${all.length} 道原文题目，按自己的节奏逐一掌握。`,`<div class="date-pill">${new Date().toLocaleDateString('zh-CN',{month:'long',day:'numeric',weekday:'long'})}</div>`)+`
      <section class="hero"><div><div class="eyebrow">A LITTLE PRACTICE, EVERY DAY</div><h2>${done?'保持节奏，继续向前。':'从第一题开始，\n把知识练成底气。'}</h2><p>${done?`已练习 ${done} 道题，还有 ${all.length-done} 道等你解锁。`:'循序渐进地练习，让每一个知识点都清晰起来。'}<br>单选 · 多选 · 判断，完整覆盖期末题库。</p><button class="primary" id="continue-study">${data.session?'继续上次练习':'开始顺序练习'} <span>→</span></button></div><div class="hero-art" aria-hidden="true"><div class="orbit"></div><div class="air-card"><span class="fan">✣</span><div class="air-lines"><i></i><i></i><i></i><i></i><i></i></div><div class="air-lines"><i></i><i></i><i></i><i></i><i></i></div></div><span class="art-tag">✓ 今日也是进步的一天</span></div></section>
      <section class="stats-grid" aria-label="学习统计"><div class="stat"><div class="stat-label">题库总量</div><div class="stat-value">${all.length}<small>题</small></div><div class="stat-detail">涵盖三种客观题型</div></div><div class="stat"><div class="stat-label">已练习题目</div><div class="stat-value">${done}<small>/ ${all.length}</small></div><div class="stat-detail">完成进度 ${percent(done,all.length)}%</div></div><div class="stat"><div class="stat-label">累计答题正确率</div><div class="stat-value">${accuracy()}<small>%</small></div><div class="stat-detail">${mastered} 道题最近一次答对</div></div><div class="stat"><div class="stat-label">待巩固错题</div><div class="stat-value">${data.wrong.length}<small>题</small></div><div class="stat-detail">复习答对后自动移出错题本</div></div></section>
      <div class="section-top"><h2>按题型，逐个突破</h2><span>选一个方向，开始专注练习</span></div><section class="type-grid">${Object.entries(types).map(([t,label],i)=>{const qs=all.filter(q=>q.type===t),n=qs.filter(q=>data.records[q.id]).length;return `<button class="type-card" data-type-start="${t}"><span class="type-symbol">${['A','☷','✓'][i]}</span><span class="type-title">${label}<span class="muted">↗</span></span><p>${qs.length} 道题 · ${['四选一，练熟每一个知识点','全面判断，选出所有正确选项','厘清概念，做出准确判断'][i]}</p><div class="progress-line"><i style="width:${percent(n,qs.length)}%"></i></div><div class="progress-caption"><span>已练 ${n} / ${qs.length}</span><span>${percent(n,qs.length)}%</span></div></button>`;}).join('')}</section>
      <div class="bottom-grid"><section class="panel"><h3>用一场考试，检验学习成果</h3><p>随机抽题、限时作答、交卷评分。找到还没掌握的地方，下次更有把握。</p><button class="secondary" data-view="exam">进入模拟考试 <span>→</span></button></section><section class="panel"><h3>让复习更有效</h3><div class="tip-list"><div class="tip-row"><b>01</b><span>先按题型练习，再用随机模式查漏补缺</span></div><div class="tip-row"><b>02</b><span>多选题需全部选对，确认后再提交答案</span></div><div class="tip-row"><b>03</b><span>收藏重点题目，定期回顾错题本</span></div></div></section></div>
      ${data.history.length?`<div class="section-top"><h2>最近的考试</h2><span>每一次检验，都看得见</span></div><section class="panel history-list">${data.history.slice(0,3).map(h=>`<div class="history-item"><span>${dateText(h.finishedAt)} · ${h.ids.length} 道题</span><span>答对 ${h.correct} 题</span><span class="history-score">${h.score}<small class="small muted"> 分</small></span></div>`).join('')}</section>`:''}`;
    $('#continue-study').onclick=()=>{typeFilter=data.session?.type||'all';unitFilter=data.session?.unit||'all';order=data.session?.order||'sequence';go('practice');};
  }
  function unitOptions(value){return '<option value="all">全部单元</option>'+(bank.units||[]).map(u=>`<option value="${u.number}" ${String(u.number)===String(value)?'selected':''}>单元 ${u.number} · ${esc(u.title)}</option>`).join('');}
  function poolFor(kind,type){let qs=kind==='wrong'?all.filter(q=>data.wrong.includes(q.id)):kind==='favorite'?all.filter(q=>data.favorites.includes(q.id)):all;if(type!=='all')qs=qs.filter(q=>q.type===type);return unitFilter==='all'?qs:qs.filter(q=>String(q.unit)===String(unitFilter));}
  function startSession(kind,type='all',sequence='sequence',resume=false){
    const qs=poolFor(kind,type);
    if(!qs.length){session={ids:[],index:0,kind,type,unit:unitFilter,order:sequence,answers:{}};renderPractice();return;}
    if(resume && data.session?.kind===kind && data.session.type===type && (data.session.unit||'all')===unitFilter && data.session.order===sequence){session=data.session;session.index=Math.max(0,Math.min(session.index||0,session.ids.length-1));session.answers ||= {};}
    else session={ids:(sequence==='random'?shuffle(qs):qs).map(q=>q.id),index:0,kind,type,unit:unitFilter,order:sequence,answers:{}};
    selected=[];feedback=null;saveSession();renderPractice();
  }
  function saveSession(){if(session?.kind==='practice'){data.session=session;save();}}
  function filterToolbar(){return `<div class="toolbar"><label for="type-filter">题型</label><select id="type-filter"><option value="all">全部题型</option>${Object.entries(types).map(([t,n])=>`<option value="${t}" ${typeFilter===t?'selected':''}>${n}</option>`).join('')}</select><select id="unit-filter" aria-label="筛选单元">${unitOptions(unitFilter)}</select><div class="segmented" aria-label="练习顺序"><button data-order="sequence" class="${order==='sequence'?'active':''}">顺序练习</button><button data-order="random" class="${order==='random'?'active':''}">随机练习</button></div><span class="small muted">${session.ids.length} 道题</span></div>`;}
  function renderPractice(){
    const intros={practice:'一道一道练习，逐步掌握每个知识点。',wrong:'把不确定的知识，再练扎实一点。答对后自动移出错题本。',favorite:'把重点留在这里，随时回顾。'};
    $('#main').innerHTML=head(labels[view],intros[view])+filterToolbar()+(!session.ids.length?emptyState(view):`<div class="practice-layout"><section class="panel question-panel" id="question-card"></section><aside class="panel palette" id="palette"></aside></div>`);
    $('#type-filter').value=typeFilter;
    $('#type-filter').onchange=e=>{typeFilter=e.target.value;startSession(view,typeFilter,order);};
    $('#unit-filter').onchange=e=>{unitFilter=e.target.value;startSession(view,typeFilter,order);};
    document.querySelectorAll('[data-order]').forEach(b=>b.onclick=()=>{order=b.dataset.order;startSession(view,typeFilter,order);});
    if(session.ids.length){loadPracticeAnswer();renderQuestion();renderPalette();}
  }
  function emptyState(kind){const text=kind==='wrong'?['当前筛选下没有待复习的错题','答错的题会自动收集在这里。也可以切换到全部题型、全部单元查看。']:kind==='favorite'?['当前筛选下没有收藏题目','点击「收藏本题」保存重点，也可以切换到全部题型、全部单元查看。']:['这个分类还没有题目','换一个题型试试。'];return `<div class="empty-state"><div class="empty-symbol">${kind==='favorite'?'☆':'✓'}</div><h2>${text[0]}</h2><p>${text[1]}</p><button class="primary" data-view="practice">去练习 →</button></div>`;}
  function loadPracticeAnswer(){const a=session.answers?.[session.ids[session.index]];selected=a?[...a.selected]:[];feedback=a?{correct:a.correct,ungraded:a.ungraded}:null;}
  function currentQuestion(){return byId[review?review.ids[reviewIndex]:view==='exam'&&data.exam?data.exam.ids[data.exam.index]:session?.ids[session.index]];}
  function renderQuestion(){
    const q=currentQuestion();if(!q)return;
    const isExam=view==='exam'&&!!data.exam&&!review, isReview=!!review;
    const i=isReview?reviewIndex:isExam?data.exam.index:session.index;
    const count=isReview?review.ids.length:isExam?data.exam.ids.length:session.ids.length;
    const reveal=isReview||!!feedback;
    const user=isReview?(review.answers[q.id]||[]):selected;
    const correct=canGrade(q)&&match(user,q.answer);
    $('#question-card').innerHTML=`<div class="question-meta"><div>${badge(q)}<span class="question-number">${i+1} / ${count} · 单元 ${q.unit} · 原题 ${q.number}</span></div><button class="star-button ${data.favorites.includes(q.id)?'saved':''}" id="toggle-favorite" aria-pressed="${data.favorites.includes(q.id)}">${data.favorites.includes(q.id)?'★ 已收藏':'☆ 收藏本题'}</button></div><p class="source-note" style="margin:0 0 14px">单元 ${q.unit} · ${esc(q.unitTitle||'')}</p><h2 class="question-stem">${esc(q.stem)}</h2><p class="question-hint">${q.type==='multiple'?(isExam?'多选题 · 选择所有正确选项，系统自动保存':'多选题 · 选择所有正确选项后，点击提交答案'):q.type==='judge'?'判断题 · 判断下列说法是否正确':'单选题 · 请选择一个正确答案'}${isExam?'；考试中暂不显示答案':''}</p><div class="option-list" role="group" aria-label="答案选项">${q.options.map(o=>{let cl=user.includes(o.key)?' selected':'';if(reveal&&canGrade(q)){if(q.answer.includes(o.key))cl=' correct';else if(user.includes(o.key))cl=' incorrect';}return `<button class="option ${q.type==='multiple'?'multiple-option':''}${cl}" data-option="${o.key}" ${reveal?'disabled':''} aria-pressed="${user.includes(o.key)}"><span class="option-key">${o.key}</span><span class="option-text">${esc(o.text)}</span>${reveal&&canGrade(q)&&q.answer.includes(o.key)?'<span class="option-status">正确答案</span>':''}</button>`;}).join('')}</div>
      ${reveal?(!canGrade(q)?`<div class="feedback neutral" role="status"><strong>原文答案待核实</strong><p>${esc(q.note||'本题不参与自动评分和模拟考试。')}</p></div>`:`<div class="feedback ${correct?'':'error'}" role="status"><strong>${correct?'✓ 回答正确，继续保持！':isReview&&!user.length?'本题未作答':'再巩固一次，你会记得更牢。'}</strong><div>正确答案：<b>${answerText(q,q.answer)}</b>　你的答案：${user.length?answerText(q,user):'未作答'}</div>${q.explanation?`<p>${esc(q.explanation)}</p>`:'<p>参考答案来自原文题库。</p>'}</div>`):''}
      <div class="question-actions"><button class="secondary" id="prev-question" ${i===0?'disabled':''}>← 上一题</button><div class="button-row">${!reveal&&!isExam?`<button class="primary" id="submit-answer" ${user.length?'':'disabled'}>${canGrade(q)?'提交答案':'查看原文备注'}</button>`:''}<button class="${reveal||isExam?'primary':'secondary'}" id="next-question" ${i===count-1?'disabled':''}>下一题 →</button></div></div><div class="key-tip">键盘快捷键：A–E 选择答案 · Enter 提交 / 下一题 · ← → 切换题目</div>${!isExam&&!isReview&&i===count-1?'<p class="source-note">已经到本轮最后一题。可在答题卡中回顾，或切换随机练习再巩固一次。</p>':''}`;
    $('#toggle-favorite').onclick=()=>{const index=data.favorites.indexOf(q.id);if(index>=0)data.favorites.splice(index,1);else data.favorites.push(q.id);save();navCounts();renderQuestion();toast(index>=0?'已取消收藏':'已加入收藏');};
    document.querySelectorAll('[data-option]').forEach(b=>b.onclick=()=>choose(b.dataset.option));
    if($('#submit-answer'))$('#submit-answer').onclick=submitPractice;
    $('#prev-question').onclick=()=>move(-1);$('#next-question').onclick=()=>move(1);
  }
  function answerText(q,a){return q.type==='judge'?a.map(k=>esc(q.options.find(o=>o.key===k)?.text||k)).join('、'):a.join('、');}
  function choose(key){if(review||feedback)return;const q=currentQuestion();if(!q||!q.options.some(o=>o.key===key))return;
    if(q.type==='multiple')selected=selected.includes(key)?selected.filter(k=>k!==key):[...selected,key];else selected=[key];
    if(view==='exam'&&data.exam){data.exam.answers[q.id]=[...selected];save();renderQuestion();renderPalette();}
    else if(q.type==='multiple'){renderQuestion();}else submitPractice();
  }
  function record(q,choices){if(!canGrade(q))return null;const correct=match(choices,q.answer);const previous=data.records[q.id]||{attempts:0,correct:0};data.records[q.id]={attempts:previous.attempts+1,correct:previous.correct+(correct?1:0),lastCorrect:correct,lastAnswer:[...choices],updatedAt:Date.now()};if(correct)data.wrong=data.wrong.filter(id=>id!==q.id);else if(!data.wrong.includes(q.id))data.wrong.push(q.id);return correct;}
  function submitPractice(){if(!selected.length||feedback||!session)return;const q=currentQuestion();const correct=record(q,selected);feedback={correct,ungraded:correct===null};session.answers[q.id]={selected:[...selected],...feedback};saveSession();save();navCounts();renderQuestion();renderPalette();}
  function move(delta){const n=review?review.ids.length:view==='exam'&&data.exam?data.exam.ids.length:session.ids.length;let index=review?reviewIndex:view==='exam'&&data.exam?data.exam.index:session.index;index+=delta;if(index<0||index>=n)return;setIndex(index);}
  function setIndex(index){if(review){reviewIndex=index;selected=review.answers[review.ids[index]]||[];feedback=null;}else if(view==='exam'&&data.exam){data.exam.index=index;selected=[...(data.exam.answers[data.exam.ids[index]]||[])];feedback=null;save();}else{session.index=index;loadPracticeAnswer();saveSession();}renderQuestion();renderPalette();}
  function renderPalette(){const qs=review?review.ids:view==='exam'&&data.exam?data.exam.ids:session.ids;const current=review?reviewIndex:view==='exam'&&data.exam?data.exam.index:session.index;const isExam=view==='exam'&&!!data.exam&&!review;const done=qs.filter(id=>review?review.answers[id]?.length:isExam?data.exam.answers[id]?.length:session.answers[id]).length;
    $('#palette').innerHTML=`<h3>${review?'试卷回顾':'答题卡'}</h3><p>${done} / ${qs.length} 题已作答${isExam?' · 点击序号切换题目':''}</p><div class="palette-grid">${qs.map((id,i)=>{let cl='';if(isExam){if(data.exam.answers[id]?.length)cl='answered';}else if(review){cl=match(review.answers[id]||[],byId[id].answer)?'done':'error';}else if(session.answers[id]){cl=session.answers[id].correct?'done':session.answers[id].ungraded?'answered':'error';}return `<button data-index="${i}" class="${cl} ${current===i?'current':''}" aria-label="第 ${i+1} 题${cl==='done'?'，答对':cl==='error'?'，答错':cl==='answered'?'，已答':'，未答'}" ${current===i?'aria-current="true"':''}>${i+1}</button>`;}).join('')}</div><div class="legend">${isExam?'<span><i></i>已作答</span>':'<span><i></i>答对</span><span><i class="red"></i>答错</span>'}<span><i class="blank"></i>未答</span></div>${isExam?'<button class="primary" id="finish-exam">交卷并查看成绩</button>':''}${review?'<button class="primary" id="back-result">返回成绩</button>':''}`;
    document.querySelectorAll('[data-index]').forEach(b=>b.onclick=()=>setIndex(Number(b.dataset.index)));
    if($('#finish-exam'))$('#finish-exam').onclick=confirmFinish;
    if($('#back-result'))$('#back-result').onclick=()=>renderResult(review);
  }
  function renderExamSetup(){
    clearInterval(timerHandle);review=null;
    $('#main').innerHTML=head('给自己，一次正式检验。','按考试节奏练习，交卷后统一查看成绩与答案。')+`<section class="exam-setup"><div class="exam-banner"><div class="eyebrow">MOCK EXAMINATION</div><h2>准备好了，就开始吧。</h2><p>从原文题库随机抽题，覆盖单选、多选与判断。<br>这是自测模拟，题量、时长和及格线由本站设置。</p></div><form class="exam-form" id="exam-form"><div class="form-grid"><div class="form-field"><label for="exam-count">考试题量</label><select id="exam-count">${[20,50,100].filter(n=>n<valid().length).map(n=>`<option value="${n}" ${n===50?'selected':''}>${n} 道题</option>`).join('')}<option value="${valid().length}">全部 ${valid().length} 题</option></select></div><div class="form-field"><label for="exam-minutes">答题时长</label><select id="exam-minutes"><option value="20">20 分钟</option><option value="45" selected>45 分钟</option><option value="60">60 分钟</option><option value="90">90 分钟</option><option value="120">120 分钟</option></select></div></div><div class="exam-rules"><b>考试规则</b><br>• 按题型比例随机抽题，各题等权，总分 100 分，80 分及格。<br>• 多选题需全部选对；漏选、多选、错选或未作答均不得分。<br>• 考试中不显示答案，交卷后可逐题回顾。<br>• 倒计时结束自动交卷。刷新或切换页面后仍按原定时间计时。${valid().length<all.length?'<br>• 原文答案有疑问的题目不参与模拟考试。':''}</div><button class="primary" type="submit">开始模拟考试 <span>→</span></button></form></section>`;
    $('#exam-form').onsubmit=e=>{e.preventDefault();const n=Number($('#exam-count').value),minutes=Number($('#exam-minutes').value);const qs=makeExam(n);data.exam={ids:qs.map(q=>q.id),index:0,answers:{},startedAt:Date.now(),deadline:Date.now()+minutes*60000,minutes};save();selected=[];feedback=null;renderExam();};
  }
  function makeExam(n){const pool=valid();n=Math.min(n,pool.length);const grouped=Object.keys(types).map(t=>({t,qs:shuffle(pool.filter(q=>q.type===t))}));let picked=[];for(const g of grouped){const k=Math.floor(n*g.qs.length/pool.length);picked.push(...g.qs.splice(0,k));}const rest=shuffle(grouped.flatMap(g=>g.qs));picked.push(...rest.slice(0,n-picked.length));return shuffle(picked);}
  function renderExam(){
    if(!data.exam){renderExamSetup();return;}review=null;feedback=null;selected=[...(data.exam.answers[data.exam.ids[data.exam.index]]||[])];
    $('#main').innerHTML=head('模拟考试','专注作答，交卷后查看成绩。作答会自动保存在当前浏览器。','<div class="timer" id="timer" role="timer"><small>剩余时间</small><span>--:--</span></div>')+'<div class="practice-layout"><section class="panel question-panel" id="question-card"></section><aside class="panel palette" id="palette"></aside></div>';
    renderQuestion();renderPalette();clearInterval(timerHandle);tick();if(data.exam)timerHandle=setInterval(tick,1000);
  }
  function tick(){if(!data.exam){clearInterval(timerHandle);return;}const seconds=Math.max(0,Math.ceil((data.exam.deadline-Date.now())/1000));const timer=$('#timer');if(timer){timer.querySelector('span').textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;timer.classList.toggle('urgent',seconds<=300);}if(!seconds){if($('#modal').open)$('#modal').close();finishExam(true);}}
  function confirmFinish(){const e=data.exam;if(!e)return;const done=e.ids.filter(id=>e.answers[id]?.length).length;confirmAction('确认交卷？',done<e.ids.length?`还有 ${e.ids.length-done} 道题未作答，交卷后这些题目计为 0 分。已完成 ${done} / ${e.ids.length} 题。`:`已经完成全部 ${e.ids.length} 道题，交卷后查看成绩和参考答案。`,()=>finishExam(false),'交卷并评分');}
  function finishExam(auto){if(!data.exam)return;clearInterval(timerHandle);const exam=data.exam;const finishedAt=Math.min(Date.now(),exam.deadline);let correct=0;exam.ids.forEach(id=>{if(record(byId[id],exam.answers[id]||[]))correct++;});const result={...exam,correct,score:Math.round(correct/exam.ids.length*100),finishedAt,auto,elapsedSeconds:Math.max(0,Math.round((finishedAt-exam.startedAt)/1000))};data.history.unshift(result);data.history=data.history.slice(0,20);data.exam=null;save();navCounts();view='exam';document.querySelectorAll('nav [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('#page-label').textContent=labels[view];renderResult(result);if(auto)toast('时间到，已自动交卷');}
  function renderResult(result){review=null;$('#main').innerHTML=head('这一次，收获了多少？','把考试变成一次查漏补缺，下一次会更有把握。')+`<section class="result-hero"><div class="eyebrow">EXAM COMPLETE</div><div class="score-value">${result.score}<small>/ 100 分</small></div><h2>${result.score>=80?'顺利通过，继续保持！':'再练一轮，离掌握更近一步。'}</h2><p>${result.auto?'计时结束，自动交卷':'已完成模拟考试'} · 及格线 80 分</p><div class="result-stats"><span><b>${result.correct}</b>题答对</span><span><b>${result.ids.length-result.correct}</b>题待巩固</span><span><b>${Math.floor(result.elapsedSeconds/60)} 分 ${result.elapsedSeconds%60} 秒</b></span></div><div class="exam-type-results">${Object.entries(types).map(([t,label])=>{const ids=result.ids.filter(id=>byId[id].type===t);return `<span>${label} ${ids.filter(id=>match(result.answers[id]||[],byId[id].answer)).length} / ${ids.length}</span>`;}).join('')}</div><div class="button-row" style="justify-content:center"><button class="primary" id="review-exam">查看试卷与答案 →</button><button class="secondary" id="retry-exam">再考一次</button></div></section><section class="panel"><h3>把这次的薄弱点，变成下一次的得分点</h3><p>答错和未作答的题目已经加入错题本。每道题完整答对后，会自动从错题本中移出。</p><button class="secondary" data-view="wrong">前往错题复习 →</button></section>`;
    $('#review-exam').onclick=()=>{review=result;reviewIndex=0;feedback=null;$('#main').innerHTML=head('试卷回顾','查看每一道题的作答和原文参考答案。')+'<div class="practice-layout"><section class="panel question-panel" id="question-card"></section><aside class="panel palette" id="palette"></aside></div>';renderQuestion();renderPalette();};$('#retry-exam').onclick=renderExamSetup;
  }
  function renderLibrary(){const qs=all.filter(q=>(libraryFilter==='all'||q.type===libraryFilter)&&(libraryUnit==='all'||String(q.unit)===String(libraryUnit))&&(!search||`${q.stem} ${q.options.map(o=>o.text).join(' ')}`.toLowerCase().includes(search.toLowerCase())));$('#main').innerHTML=head('所有题目，心中有数。','搜索知识点，快速找到你想练习的题目。')+`<div class="toolbar"><input class="search-input" type="search" id="library-search" aria-label="搜索题干与选项" placeholder="搜索题干、选项中的关键词…" value="${esc(search)}"><select id="library-type" aria-label="筛选题型"><option value="all">全部题型</option>${Object.entries(types).map(([t,n])=>`<option value="${t}" ${libraryFilter===t?'selected':''}>${n}</option>`).join('')}</select><select id="library-unit" aria-label="筛选单元">${unitOptions(libraryUnit)}</select><span class="small muted">${qs.length} 道题</span></div><div class="library-list">${qs.slice(0,100).map(q=>`<button class="library-item" data-open-question="${q.id}">${badge(q)}<span class="stem-preview">单元 ${q.unit} · 第 ${q.number} 题　${esc(q.stem)}</span><span class="muted">${data.records[q.id]?(data.records[q.id].lastCorrect?'✓ 最近答对':'待巩固'):'未练习'}　→</span></button>`).join('')||'<div class="empty-state"><h2>没有找到相关题目</h2><p>试试其他关键词或题型。</p></div>'}</div>${qs.length>100?'<p class="source-note">当前显示前 100 个结果，请输入更具体的关键词缩小范围。</p>':''}`;
    $('#library-search').oninput=e=>{const pos=e.target.selectionStart;search=e.target.value;renderLibrary();$('#library-search').focus();if(pos!==null)$('#library-search').setSelectionRange(pos,pos);};$('#library-type').onchange=e=>{libraryFilter=e.target.value;renderLibrary();};$('#library-unit').onchange=e=>{libraryUnit=e.target.value;renderLibrary();};
    document.querySelectorAll('[data-open-question]').forEach(b=>b.onclick=()=>{typeFilter='all';unitFilter='all';order='sequence';data.session=null;go('practice');session.index=session.ids.indexOf(b.dataset.openQuestion);loadPracticeAnswer();saveSession();renderQuestion();renderPalette();});
  }
  function showSettings(){modal(`<h2>数据与题库说明</h2><div class="settings-detail"><b>题库来源</b><br>${esc(bank.source||'通风与空调工程期末题库.docx')}<br>共 ${all.length} 题：${Object.entries(types).map(([t,n])=>`${n} ${all.filter(q=>q.type===t).length} 题`).join('，')}。<br>题目、选项和答案依据原文整理；本站不额外编造解析。${all.some(q=>q.note)?'<br>个别题目保留原文疑点说明，可在作答后查看。':''}<br><br><b>学习数据</b><br>进度、错题、收藏与最近 20 次考试仅保存在当前浏览器。更换设备、浏览器，或清理网站数据后不会自动同步。<br><br><b>计分说明</b><br>各题等权，总分 100 分，80 分及格。此为本站自测规则，不代表学校考试安排。</div><div class="button-row"><button class="danger-btn" id="reset-progress">清空学习记录</button><button class="primary" data-close>知道了</button></div>`);$('#reset-progress').onclick=()=>{$('#modal').close();confirmAction('清空学习记录？','这会清除本浏览器中的练习进度、错题、收藏及考试记录。清空后无法从本站恢复。',()=>{data=emptyData();save();session=null;go('home');toast('学习记录已清空');},'确认清空');};}
  $('#open-settings').onclick=showSettings;
  document.addEventListener('click',e=>{if(e.target.closest('[data-settings]')){showSettings();return;}const n=e.target.closest('[data-view]');if(n){go(n.dataset.view);return;}const t=e.target.closest('[data-type-start]');if(t){typeFilter=t.dataset.typeStart;unitFilter='all';order='sequence';go('practice');}});
  document.querySelector('.brand').onclick=e=>{e.preventDefault();go('home');};
  document.addEventListener('keydown',e=>{if($('#modal').open||e.ctrlKey||e.metaKey||e.altKey||/INPUT|SELECT|TEXTAREA/.test(e.target.tagName)||!$('#question-card'))return;const key=e.key.toUpperCase();if(/^[A-E]$/.test(key)){e.preventDefault();choose(key);}else if(e.key==='ArrowRight'){e.preventDefault();move(1);}else if(e.key==='ArrowLeft'){e.preventDefault();move(-1);}else if(e.key==='Enter'&&e.target.tagName!=='BUTTON'){e.preventDefault();if(!feedback&&!review&&!(view==='exam'&&data.exam))submitPractice();else move(1);}});
  document.addEventListener('visibilitychange',()=>{if(!document.hidden&&data.exam&&data.exam.deadline<=Date.now()){finishExam(true);}});
  window.addEventListener('storage',e=>{if(e.key===KEY&&e.newValue){try{data={...emptyData(),...JSON.parse(e.newValue)};go(view);}catch{}}});
  // 一个独立时钟保证切换到首页、错题或题库时，考试仍然按时交卷。
  setInterval(()=>{if(data.exam&&data.exam.deadline<=Date.now()){if($('#modal').open)$('#modal').close();finishExam(true);}},1000);
  go(data.exam?'exam':'home');
})();
