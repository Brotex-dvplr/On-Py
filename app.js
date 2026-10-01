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
function loadScript(src){return new Promise((resolve,reject)=>{const script=document.createElement("script");script.src=src;script.async=true;script.onload=resolve;script.onerror=()=>reject(new Error("بارگیری نشد: "+src));document.head.appendChild(script)})}
async function boot(){
  $("#pythonStatus").textContent="در حال بارگیری موتور پایتون…";
  $("#runtimeStatus").textContent="لطفاً کمی صبر کن";
  $("#runBtn").disabled=true;
  const failures=[];
  for(const source of PYODIDE_SOURCES){
    try{
      if(typeof window.loadPyodide!=="function") await loadScript(source.script);
      if(typeof window.loadPyodide!=="function") throw new Error("فایل موتور پایتون بارگیری شد اما loadPyodide در دسترس نیست.");
      pyodide=await window.loadPyodide({indexURL:source.base});
      $("#pythonStatus").textContent="Python آماده است ✓";
      $("#runtimeStatus").textContent="محیط آماده";
      $("#output").textContent="محیط پایتون آماده است. برای اجرا روی «اجرای کد» بزن.";
      $("#runBtn").disabled=false;
      return;
    }catch(e){
      failures.push(e.message||String(e));
      pyodide=null;
      $("#pythonStatus").textContent="تلاش برای اتصال جایگزین…";
    }
  }
  $("#pythonStatus").textContent="بارگذاری پایتون ناموفق بود";
  $("#runtimeStatus").textContent="اتصال را بررسی کن";
  $("#output").textContent="موتور پایتون از هیچ‌کدام از منابع بارگیری نشد. اتصال اینترنت، فیلترشکن یا محدودیت شبکه را بررسی کن و سپس صفحه را تازه‌سازی کن.\n\nجزئیات:\n"+failures.join("\n");
  $("#runBtn").disabled=false;
}
function setupEditor(){editor=CodeMirror.fromTextArea($("#editor"),{mode:"python",theme:"material-darker",lineNumbers:true,indentUnit:4,tabSize:4,indentWithTabs:false,lineWrapping:false,autocorrect:false,extraKeys:{"Ctrl-Enter":run,"Cmd-Enter":run,"Ctrl-S":save,"Cmd-S":save}});editor.on("change",markDirty);renderFiles()}
async function run(){if(!pyodide){$("#output").textContent="محیط پایتون آماده نشده است. وضعیت بارگیری را در بالای پنل خروجی بررسی کن؛ اگر ناموفق بود، اینترنت یا محدودیت CDN را بررسی و صفحه را تازه‌سازی کن.";return}files[current]=editor.getValue();$("#output").textContent="در حال اجرا…";$("#errors").textContent="هنوز خطایی ثبت نشده است.";$("#runtimeStatus").textContent="در حال اجرا…";try{pyodide.setStdout({batched:s=>{const out=$("#output");if(out.textContent==="در حال اجرا…")out.textContent="";out.textContent+=s+"\n"}});pyodide.setStderr({batched:s=>{$("#errors").textContent+=($("#errors").textContent.startsWith("هنوز")?"":"\n")+s}});$("#output").textContent="";await pyodide.runPythonAsync(files[current]);if(!$("#output").textContent)$("#output").textContent="برنامه اجرا شد؛ خروجی متنی تولید نشد.";$("#runtimeStatus").textContent="اجرا تمام شد ✓";document.querySelector('[data-tab="output"]').click()}catch(e){$("#errors").textContent=String(e);$("#runtimeStatus").textContent="خطا در اجرا";document.querySelector('[data-tab="errors"]').click()}}
document.querySelectorAll("[data-tab]").forEach(b=>b.onclick=()=>{document.querySelectorAll("[data-tab]").forEach(x=>x.classList.toggle("active",x===b));$("#output").classList.toggle("hidden",b.dataset.tab!=="output");$("#errors").classList.toggle("hidden",b.dataset.tab!=="errors")});
$("#runBtn").onclick=run;$("#saveBtn").onclick=save;$("#clearBtn").onclick=()=>{$("#output").textContent="";$("#errors").textContent="هنوز خطایی ثبت نشده است."};$("#themeBtn").onclick=()=>document.body.classList.toggle("light");
$("#newFile").onclick=()=>{const name=prompt("نام فایل جدید (مثلاً helper.py):");if(!name)return;if(!/^[\w.-]+\.py$/i.test(name)){alert("نام فایل باید با .py تمام شود و از حروف انگلیسی، عدد، نقطه یا خط تیره استفاده کند.");return}if(files[name]){alert("این فایل وجود دارد.");return}files[current]=editor.getValue();files[name]="# فایل جدید\n";switchFile(name);markDirty()};
$("#newProject").onclick=()=>{if(!confirm("پروژه فعلی را با یک پروژه خالی جایگزین کنیم؟ ابتدا در صورت نیاز ذخیره کن."))return;files={"main.py":"# پروژه جدید On-py\nprint('Hello, world!')"};switchFile("main.py");markDirty()};
try{const saved=JSON.parse(localStorage.getItem(STORAGE));if(saved&&saved.files&&Object.keys(saved.files).length){files=saved.files;current=saved.current in files?saved.current:Object.keys(saved.files)[0];$("#editor").value=files[current]}}catch(e){}
setupEditor();switchFile(current);boot();
window.addEventListener("beforeunload",e=>{if(dirty){e.preventDefault();e.returnValue=""}});
