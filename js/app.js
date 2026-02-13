// ===============================
// Config (login) - prototipo
// ===============================
const ONLY_USER = "jesusc";
const ONLY_PASS = "its";

// ===============================
// Tabs
// ===============================
const tabButtons = document.querySelectorAll(".tab");
const views = {
  login: document.getElementById("tab-login"),
  analizar: document.getElementById("tab-analizar"),
  resultados: document.getElementById("tab-resultados"),
};

function showTab(name){
  tabButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  Object.entries(views).forEach(([k, el]) => el.classList.toggle("show", k === name));
}

tabButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    if (btn.disabled) return;
    showTab(btn.dataset.tab);
  });
});

// ===============================
// Auth (simple)
// ===============================
const loginForm = document.getElementById("loginForm");
const loginMsg = document.getElementById("loginMsg");
const btnLogout = document.getElementById("btnLogout");

function setAuthed(isAuthed){
  localStorage.setItem("authed", isAuthed ? "1" : "0");
  document.querySelector('[data-tab="analizar"]').disabled = !isAuthed;
  document.querySelector('[data-tab="resultados"]').disabled = !isAuthed;
  btnLogout.hidden = !isAuthed;
  if (isAuthed) showTab("analizar");
  else showTab("login");
}

btnLogout.addEventListener("click", () => {
  setAuthed(false);
});

loginForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const u = document.getElementById("user").value.trim();
  const p = document.getElementById("pass").value;

  if (u === ONLY_USER && p === ONLY_PASS){
    loginMsg.textContent = "Acceso concedido.";
    loginMsg.style.color = "#3ddc97";
    setAuthed(true);
  } else {
    loginMsg.textContent = "Usuario o contraseña incorrectos.";
    loginMsg.style.color = "#ff5a7a";
    setAuthed(false);
  }
});

// mantener sesión al recargar
setAuthed(localStorage.getItem("authed") === "1");

// ===============================
// Teachable Machine (Image)
// ===============================
let model = null;

const modelBadge = document.getElementById("modelBadge");
const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");

const btnPredict = document.getElementById("btnPredict");
const btnClearImg = document.getElementById("btnClearImg");
const goResults = document.getElementById("goResults");

const previewImg = document.getElementById("previewImg");
const fileMeta = document.getElementById("fileMeta");

const predTop = document.getElementById("predTop");
const topName = document.getElementById("topName");
const topConf = document.getElementById("topConf");
const predList = document.getElementById("predList");

// IMPORTANTE: si tu modelo va local, deja "model/"
// si lo hospedas, pon una URL que termine en "/"
const MODEL_URL = "model/";

// Cargar modelo
async function loadModel(){
  try{
    modelBadge.textContent = "Modelo: cargando…";
    modelBadge.style.borderColor = "rgba(255,255,255,.12)";
    model = await tmImage.load(MODEL_URL + "model.json", MODEL_URL + "metadata.json");
    const total = model.getTotalClasses();
    modelBadge.textContent = `Modelo: listo (${total} clases)`;
    modelBadge.style.borderColor = "rgba(61,220,151,.35)";
    updateButtons();
  }catch(err){
    console.error(err);
    modelBadge.textContent = "Modelo: error al cargar";
    modelBadge.style.borderColor = "rgba(255,90,122,.35)";
  }
}

loadModel();

// ===============================
// Utilidades UI
// ===============================
function updateButtons(){
  const hasImg = !!previewImg.src;
  btnPredict.disabled = !(model && hasImg);
  btnClearImg.disabled = !hasImg;
}

function resetResults(){
  predTop.classList.add("hidden");
  topName.textContent = "—";
  topConf.textContent = "—";
  predList.textContent = "Aún no hay resultados.";
  goResults.disabled = true;
  localStorage.removeItem("lastPrediction");
}

function setPreviewFromFile(file){
  if (!file) return;
  if (!file.type.startsWith("image/")){
    predList.textContent = "Ese archivo no es una imagen.";
    return;
  }

  // revocar anterior blob para no gastar memoria
  if (previewImg.src && previewImg.src.startsWith("blob:")) {
    URL.revokeObjectURL(previewImg.src);
  }

  const url = URL.createObjectURL(file);
  previewImg.src = url;
  previewImg.style.display = "block";

  fileMeta.textContent = `${file.name} • ${(file.size/1024/1024).toFixed(2)} MB`;
  resetResults();
  predList.textContent = "Listo. Presiona “Analizar con IA”.";
  updateButtons();
}

// ===============================
// Drag & Drop + Click
// ===============================
dropzone.addEventListener("click", () => fileInput.click());

dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") fileInput.click();
});

dropzone.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});
dropzone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});
dropzone.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragover");
});
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  const file = e.dataTransfer.files?.[0];
  if (file) setPreviewFromFile(file);
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) setPreviewFromFile(file);
});

// ===============================
// Quitar imagen
// ===============================
btnClearImg.addEventListener("click", () => {
  if (previewImg.src && previewImg.src.startsWith("blob:")) {
    URL.revokeObjectURL(previewImg.src);
  }

  fileInput.value = "";
  previewImg.removeAttribute("src");
  previewImg.style.display = "none";
  fileMeta.textContent = "";
  resetResults();
  updateButtons();
});

// ===============================
// Predicción
// ===============================
btnPredict.addEventListener("click", async () => {
  if (!model) return;
  if (!previewImg.src) return;

  predList.textContent = "Analizando…";

  const prediction = await model.predict(previewImg, false);
  prediction.sort((a,b) => b.probability - a.probability);

  const top = prediction[0];
  renderGuide(top.className);
  predTop.classList.remove("hidden");
  topName.textContent = top.className;
  topConf.textContent = `Confianza: ${(top.probability*100).toFixed(2)}%`;

  let text = "";
  for (const p of prediction){
    text += `• ${p.className}: ${(p.probability*100).toFixed(2)}%\n`;
  }
  predList.textContent = text.trim();

  localStorage.setItem("lastPrediction", JSON.stringify(prediction));
  goResults.disabled = false;
});

// Placeholder ir a resultados
goResults.addEventListener("click", () => {
  showTab("resultados");
});