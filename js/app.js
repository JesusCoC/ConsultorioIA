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

btnLogout?.addEventListener("click", () => setAuthed(false));

loginForm?.addEventListener("submit", (e) => {
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

// NUEVO: caja de orientación (si no existe, no truena)
const dxBox = document.getElementById("dxBox");

// IMPORTANTE:
// - Si el modelo va en tu proyecto: "model/"
// - Si lo hospedas: URL que termine en "/"
const MODEL_URL = "model/";

// ===============================
// Orientación clínica (por clase)
// Ajusta los nombres EXACTOS a tus clases de Teachable Machine
// ===============================
const GUIDES = {
  "Normal": {
    title: "Sin hallazgos evidentes en la radiografía",
    text:
`• Si no hay síntomas: seguimiento rutinario.
• Si hay fiebre/tos/dolor torácico: una radiografía normal no descarta enfermedad temprana; considerar valoración clínica y seguimiento.
• Vigilar evolución y saturación de oxígeno si hay síntomas.`
  },
  "Neumonía": {
    title: "Sospecha de neumonía",
    text:
`• Correlacionar con fiebre, tos, expectoración, dolor torácico o falta de aire.
• Mantener hidratación y control de fiebre/dolor según indicación médica.
• Considerar oximetría (SpO₂) y factores de riesgo (edad, comorbilidades).
• Antibióticos solo si un médico lo indica (cuando se sospecha origen bacteriano).`
  },
  "COVID-19": {
    title: "Hallazgos compatibles con infección respiratoria viral",
    text:
`• Correlacionar con síntomas y pruebas diagnósticas según protocolo.
• Medidas generales: reposo, hidratación, control de síntomas.
• Vigilar saturación de oxígeno y evolución clínica.
• Considerar aislamiento si hay sospecha/confirmación activa.`
  },
  "Tuberculosis": {
    title: "Sospecha de tuberculosis pulmonar",
    text:
`• No se confirma solo con radiografía: requiere estudios específicos (baciloscopía/cultivo/pruebas moleculares).
• Si hay tos ≥3 semanas, pérdida de peso, sudoración nocturna o sangre en esputo: priorizar valoración médica.
• Considerar medidas para reducir contagio hasta descartar.`
  },
  "Neumotórax": {
    title: "Posible neumotórax",
    text:
`• Puede ser urgente si hay dolor súbito en pecho o falta de aire.
• Requiere valoración inmediata para confirmar y decidir manejo (observación/drenaje).`
  },
  "Derrame pleural": {
    title: "Posible derrame pleural",
    text:
`• Puede relacionarse con infección, insuficiencia cardiaca u otras causas.
• Suele requerir evaluación y, en algunos casos, drenaje/estudios del líquido.`
  },
  "Edema pulmonar": {
    title: "Posible edema pulmonar",
    text:
`• Puede asociarse a insuficiencia cardiaca u otras causas y puede ser una emergencia.
• Si hay falta de aire importante (sobre todo súbita o al acostarse), acudir a atención urgente.`
  }
};

const RED_FLAGS =
`⚠️ ACUDIR A URGENCIAS SI HAY:
• Dificultad marcada para respirar
• Dolor/ presión intensa en el pecho
• Confusión o somnolencia excesiva
• Coloración azulada en labios/piel
• Empeoramiento rápido de síntomas

Aviso: orientación informativa basada en IA, no sustituye valoración médica.`;

function renderGuide(className){
  if (!dxBox) return; // si no existe en HTML, no hacemos nada

  const guide = GUIDES[className];
  if(!guide){
    dxBox.textContent = "No hay guía configurada para esta categoría (ajusta los nombres de clases).";
    return;
  }

  dxBox.innerHTML =
`<div style="font-weight:900; margin-bottom:8px;">${guide.title}</div>
<div style="white-space:pre-wrap; line-height:1.45;">${guide.text}</div>
<div style="margin-top:10px; padding:10px 12px; border-radius:14px; border:1px solid rgba(255,90,122,.28); background: rgba(255,90,122,.08); white-space:pre-wrap;">${RED_FLAGS}</div>`;
}

// ===============================
// Cargar modelo
// ===============================
async function loadModel(){
  try{
    modelBadge && (modelBadge.textContent = "Modelo: cargando…");
    model = await tmImage.load(MODEL_URL + "model.json", MODEL_URL + "metadata.json");
    const total = model.getTotalClasses();
    modelBadge && (modelBadge.textContent = `Modelo: listo (${total} clases)`);
    updateButtons();
  }catch(err){
    console.error(err);
    modelBadge && (modelBadge.textContent = "Modelo: error al cargar");
  }
}
loadModel();

// ===============================
// UI helpers
// ===============================
function updateButtons(){
  const hasImg = !!previewImg?.src;
  if (btnPredict) btnPredict.disabled = !(model && hasImg);
  if (btnClearImg) btnClearImg.disabled = !hasImg;
}

function resetResults(){
  if (predTop) predTop.classList.add("hidden");
  if (topName) topName.textContent = "—";
  if (topConf) topConf.textContent = "—";
  if (predList) predList.textContent = "Aún no hay resultados.";
  if (goResults) goResults.disabled = true;
  localStorage.removeItem("lastPrediction");
  if (dxBox) dxBox.textContent = "Aún no hay orientación. Analiza una radiografía.";
}

function setPreviewFromFile(file){
  if (!file) return;
  if (!file.type.startsWith("image/")){
    predList && (predList.textContent = "Ese archivo no es una imagen.");
    return;
  }

  // revocar anterior blob
  if (previewImg?.src && previewImg.src.startsWith("blob:")) {
    URL.revokeObjectURL(previewImg.src);
  }

  const url = URL.createObjectURL(file);
  previewImg.src = url;
  previewImg.style.display = "block";

  if (fileMeta){
    fileMeta.textContent = `${file.name} • ${(file.size/1024/1024).toFixed(2)} MB`;
  }

  resetResults();
  predList && (predList.textContent = "Listo. Presiona “Analizar con IA”.");
  updateButtons();
}

// ===============================
// Drag & Drop + Click
// ===============================
dropzone?.addEventListener("click", () => fileInput?.click());

dropzone?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") fileInput?.click();
});

dropzone?.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});
dropzone?.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropzone.classList.add("dragover");
});
dropzone?.addEventListener("dragleave", () => {
  dropzone.classList.remove("dragover");
});
dropzone?.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("dragover");
  const file = e.dataTransfer.files?.[0];
  if (file) setPreviewFromFile(file);
});

fileInput?.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (file) setPreviewFromFile(file);
});

// ===============================
// Quitar imagen
// ===============================
btnClearImg?.addEventListener("click", () => {
  if (previewImg?.src && previewImg.src.startsWith("blob:")) {
    URL.revokeObjectURL(previewImg.src);
  }

  if (fileInput) fileInput.value = "";
  if (previewImg){
    previewImg.removeAttribute("src");
    previewImg.style.display = "none";
  }
  if (fileMeta) fileMeta.textContent = "";
  resetResults();
  updateButtons();
});

// ===============================
// Predicción
// ===============================
btnPredict?.addEventListener("click", async () => {
  if (!model) return;
  if (!previewImg?.src) return;

  predList && (predList.textContent = "Analizando…");

  try{
    const prediction = await model.predict(previewImg, false);
    prediction.sort((a,b) => b.probability - a.probability);

    const top = prediction[0];

    if (predTop) predTop.classList.remove("hidden");
    if (topName) topName.textContent = top.className;
    if (topConf) topConf.textContent = `Confianza: ${(top.probability*100).toFixed(2)}%`;

    // lista completa
    let text = "";
    for (const p of prediction){
      text += `• ${p.className}: ${(p.probability*100).toFixed(2)}%\n`;
    }
    predList && (predList.textContent = text.trim());

    // orientación por clase
    renderGuide(top.className);

    localStorage.setItem("lastPrediction", JSON.stringify(prediction));
    if (goResults) goResults.disabled = false;

  }catch(err){
    console.error(err);
    predList && (predList.textContent = "Error al analizar. Revisa consola (F12).");
  }
});

// Placeholder ir a resultados
goResults?.addEventListener("click", () => showTab("resultados"));