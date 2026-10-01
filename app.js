const $=s=>document.querySelector(s);
let pyodide=null, current="main.py", files={"main.py":$("#editor").value}, editor=null, dirty=false;
const STORAGE="onpy-project-v1";
const PYODIDE_SOURCES=[
  {script:"https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js",base:"https://cdn.jsdelivr.net/pyodide/v0.27.7/full/"},
  {script:"https://unpkg.com/pyodide@0.27.7/pyodide.js",base:"https://unpkg.com/pyodide@0.27.7/"}
];
function markDirty(){dirty=true;$("#saveStatus").textContent="تغییرات ذخیره نشده";$("#saveStatus").style.color="#f5bd4f"}
function renderFiles(){const root=$("#fileList");root.innerHTML="";Object.keys(files).forEach(name=>{const el=document.createElement("div");el.className="file"+(name===current?" active":"");el.textContent="🐍  "+name;el.onclick=()=>switchFile(name);root.append(el)})}
function switchFile(name){if(editor)files[current]=editor.getValue();current=name;if(editor)editor.setValue(files[name]||"");else $("#editor").value=files[name]||"";$("#activeFile").textContent=name;renderFiles();dirty=false;$("#saveStatus").textContent="ذخیره محلی"}
function save(){files[current]=editor.getValue();try{localStorage.setItem(STORAGE,JSON.stringify({files,current}));dirty=false;$("#saveStatus").textContent="ذخیره شد ✓";$("#saveStatus").style.color="var(--green)";$("#runtimeStatus").textContent="ذخیره محلی انجام شد"}catch(e){showError("ذخیره‌سازی ناموفق: "+e.message)}}
function showError(s){$("#errors").textContent=s;document.querySelector('[data-tab="errors"]').click()}
function loadScript(src){
  return new Promise((resolve,reject)=>{
    const script=document.createElement("script");
    script.src=src;
    script.async=true;
    script.onload=()=>resolve(script);
    script.onerror=()=>{script.remove();reject(new Error("بارگیری فایل موتور ناموفق بود: "+src));};
    document.head.appendChild(script);
  });
}
async function boot(){
  const status=$("#pythonStatus"), runtime=$("#runtimeStatus"), runBtn=$("#runBtn"), output=$("#output");
  status.textContent="در حال بارگیری موتور پایتون…";
  runtime.textContent="در حال اتصال به منبع اول";
  runBtn.disabled=true;
  const failures=[];
  for(let i=0;i<PYODIDE_SOURCES.length;i++){
    const source=PYODIDE_SOURCES[i];
    try{
      // پاک‌سازی loader قبلی تا تلاش بعدی واقعاً از CDN جایگزین استفاده کند.
      try{delete window.loadPyodide;}catch(_){window.loadPyodide=undefined;}
      const oldScripts=[...document.scripts].filter(s=>s.src===source.script);
      oldScripts.forEach(s=>s.remove());
      status.textContent="بارگیری پایتون ("+(i+1)+"/"+PYODIDE_SOURCES.length+")…";
      runtime.textContent="در حال دریافت فایل‌های موتور؛ ممکن است چند لحظه طول بکشد";
      await loadScript(source.script);
      if(typeof window.loadPyodide!=="function") throw new Error("فایل بارگیری شد اما تابع loadPyodide پیدا نشد.");
      pyodide=await window.loadPyodide({indexURL:source.base});
      status.textContent="Python آماده است ✓";
      runtime.textContent="محیط آماده";
      output.textContent="محیط پایتون آماده است. برای اجرا روی «اجرای کد» بزن.";
      runBtn.disabled=false;
      return;
    }catch(e){
      failures.push("منبع "+(i+1)+": "+(e?.stack||e?.message||String(e)));
      pyodide=null;
      try{delete window.loadPyodide;}catch(_){window.loadPyodide=undefined;}
    }
  }
  status.textContent="بارگذاری پایتون ناموفق بود";
  runtime.textContent="اتصال را بررسی کن";
  output.textContent="موتور پایتون بارگیری نشد. این خطا معمولاً به مسدود بودن CDN، اینترنت یا فایل‌های WASM مربوط است.\n\nجزئیات فنی برای عیب‌یابی:\n"+failures.join("\n\n");
  runBtn.disabled=false;
}
function setupEditor(){editor=CodeMirror.fromTextArea($("#editor"),{mode:"python",theme:"material-darker",lineNumbers:true,indentUnit:4,tabSize:4,indentWithTabs:false,lineWrapping:false,autocorrect:false,extraKeys:{"Ctrl-Enter":run,"Cmd-Enter":run,"Ctrl-S":save,"Cmd-S":save}});editor.on("change",markDirty);renderFiles()}
async function run(){
  files[current]=editor.getValue();
  $("#output").textContent="در حال اجرا…";
  $("#errors").textContent="هنوز خطایی ثبت نشده است.";
  $("#runtimeStatus").textContent="در حال اجرا…";
  try{
    if(pyodide){
      pyodide.setStdout({batched:s=>{const out=$("#output");if(out.textContent==="در حال اجرا…")out.textContent="";out.textContent+=s+"\n"}});
      pyodide.setStderr({batched:s=>{$("#errors").textContent+=($("#errors").textContent.startsWith("هنوز")?"":"\n")+s}});
      $("#output").textContent="";
      await pyodide.runPythonAsync(files[current]);
      if(!$("#output").textContent)$("#output").textContent="برنامه اجرا شد؛ خروجی متنی تولید نشد.";
      $("#runtimeStatus").textContent="اجرا در مرورگر تمام شد ✓";
      document.querySelector('[data-tab="output"]').click();
      return;
    }
    const response=await fetch("http://127.0.0.1:8765/run",{
      method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({code:files[current]})
    });
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||"اجراکننده محلی خطا داد.");
    $("#output").textContent=result.stdout||"(خروجی متنی تولید نشد)";
    $("#errors").textContent=result.stderr||"خطایی ثبت نشد.";
    $("#runtimeStatus").textContent="اجرا با Python سیستم ✓";
    document.querySelector('[data-tab="'+(result.stderr?"errors":"output")+'"]').click();
  }catch(e){
    $("#errors").textContent=String(e)+"\n\nاگر موتور مرورگر آماده نیست، اجراکننده محلی را طبق راهنمای README اجرا کن.";
    $("#runtimeStatus").textContent="خطا در اجرا";
    document.querySelector('[data-tab="errors"]').click();
  }
}
async function connectLocalPython(){
  $("#runtimeStatus").textContent="در حال بررسی Python محلی…";
  try{
    const r=await fetch("http://127.0.0.1:8765/health",{cache:"no-store"});
    const data=await r.json();
    if(!r.ok||!data.python)throw new Error(data.error||"Python پیدا نشد.");
    pyodide=null;
    $("#pythonStatus").textContent="Python محلی متصل ✓";
    $("#runtimeStatus").textContent="Python "+data.version+" · روی همین کامپیوتر";
    $("#output").textContent="به Python نصب‌شده روی کامپیوتر متصل شدی. حالا کد را اجرا کن.";
    $("#runBtn").disabled=false;
  }catch(e){
    $("#runtimeStatus").textContent="اتصال محلی برقرار نشد";
    showError("اجراکننده محلی پاسخ نداد. ابتدا Python 3 را نصب و فایل onpy_runner.py را اجرا کن.\n\n"+e.message);
  }
}
document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===b));$("#output").classList.toggle("hidden",b.dataset.tab!=="output");$("#errors").classList.toggle("hidden",b.dataset.tab!=="errors")});
$("#runBtn").onclick=run;$("#localPythonBtn").onclick=connectLocalPython;$("#saveBtn").onclick=save;$("#clearBtn").onclick=()=>{$("#output").textContent="";$("#errors").textContent="هنوز خطایی ثبت نشده است."};$("#themeBtn").onclick=()=>document.body.classList.toggle("light");
$("#newFile").onclick=()=>{const name=prompt("نام فایل جدید (مثلاً helper.py):");if(!name)return;if(!/^[\w.-]+\.py$/i.test(name)){alert("نام فایل باید با .py تمام شود و از حروف انگلیسی، عدد، نقطه یا خط تیره استفاده کند.");return}if(files[name]){alert("این فایل وجود دارد.");return}files[current]=editor.getValue();files[name]="# فایل جدید\n";switchFile(name);markDirty()};
$("#newProject").onclick=()=>{if(!confirm("پروژه فعلی را با یک پروژه خالی جایگزین کنیم؟ ابتدا در صورت نیاز ذخیره کن."))return;files={"main.py":"# پروژه جدید On-py\nprint('Hello, world!')"};switchFile("main.py");markDirty()};
try{const saved=JSON.parse(localStorage.getItem(STORAGE));if(saved&&saved.files&&Object.keys(saved.files).length){files=saved.files;current=saved.current in files?saved.current:Object.keys(saved.files)[0];$("#editor").value=files[current]}}catch(e){}
setupEditor();switchFile(current);boot();
window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue=""}});
