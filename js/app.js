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
  if (name === "resultados") loadResultIntoResultsTab();
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

btnLogout.addEventListener("click", () => setAuthed(false));

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
// Modelo Teachable Machine
// ===============================
let model = null;

// Elementos UI
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
const dxBox = document.getElementById("dxBox");

const resultsBox = document.getElementById("resultsBox");
const btnClearHistory = document.getElementById("btnClearHistory");

// carpeta del modelo
const MODEL_URL = "model/";

// ===============================
// Guías clínicas (TUS 5 CLASES)
// ===============================
const GUIDES = {
  "HEALTHY": {
    title: "Radiografía sin hallazgos patológicos evidentes (HEALTHY)",
    text: `
• La imagen no muestra alteraciones significativas según el modelo.
• Si el paciente está sin síntomas: seguimiento rutinario.
• Si hay síntomas persistentes (fiebre, tos, dolor torácico, falta de aire), una radiografía “normal” no descarta enfermedad temprana.
• Correlacionar con exploración clínica; considerar oximetría y seguimiento.
`
  },

  "PNEUMONIA": {
    title: "Sospecha de neumonía (PNEUMONIA)",
    text: `
• Correlacionar con fiebre, tos (seca o productiva), dolor torácico y dificultad respiratoria.
• Recomendación general: valoración médica para confirmar (viral vs bacteriana) y definir manejo.
• Medidas de soporte: reposo, hidratación, control de fiebre/dolor según indicación médica.
• Considerar oximetría (SpO₂), comorbilidades y edad para decidir si requiere manejo hospitalario.
• Antibióticos solo si un médico lo indica (cuando se sospecha origen bacteriano).
`
  },

  "PNEUMOTHORAX": {
    title: "Posible neumotórax (PNEUMOTHORAX)",
    text: `
• Puede presentarse con dolor torácico súbito y falta de aire.
• Puede ser URGENTE dependiendo de la extensión y la clínica.
• Recomendación general: evaluación inmediata si hay disnea, dolor intenso o empeoramiento rápido.
• El manejo puede ir desde observación hasta procedimientos (p. ej. drenaje), según valoración médica.
`
  },

  "EFFUSION": {
    title: "Posible derrame pleural (EFFUSION)",
    text: `
• Puede asociarse a infección, insuficiencia cardiaca, enfermedad renal/hepática u otras causas.
• Recomendación general: valoración médica para definir la causa y necesidad de estudios adicionales.
• En algunos casos puede requerirse ecografía/TC y/o drenaje diagnóstico/terapéutico.
• Vigilar síntomas: falta de aire, dolor pleurítico, fiebre.
`
  },

  "CARDIOMEGALY": {
    title: "Posible cardiomegalia (CARDIOMEGALY)",
    text: `
• Sugiere aumento del tamaño cardíaco, pero debe correlacionarse con técnica de la radiografía y clínica.
• Puede relacionarse con hipertensión, cardiomiopatía, insuficiencia cardiaca u otras causas.
• Recomendación general: valoración médica (idealmente cardiología) y estudios complementarios (ECG, ecocardiograma, etc.).
• Si hay disnea, hinchazón de piernas, fatiga marcada o dolor torácico: priorizar evaluación.
`
  }
};

const RED_FLAGS = `
⚠️ ACUDIR A URGENCIAS SI PRESENTA:
• Dificultad marcada para respirar o saturación baja
• Dolor o presión intensa en el pecho
• Confusión, somnolencia marcada o desmayo
• Coloración azulada en labios/piel
• Empeoramiento rápido de síntomas

Aviso: Esto es orientación general basada en una predicción de IA y NO sustituye valoración médica.
`;

function buildGuideHTML(className){
  const guide = GUIDES[className];
  if(!guide){
    return `
      <div style="font-weight:900; margin-bottom:8px;">Orientación general</div>
      <div style="white-space:pre-wrap; line-height:1.5;">
        • No hay guía configurada para la clase: ${className}
        • Verifica que el nombre de clase sea EXACTO.
      </div>
      <div style="margin-top:12px; padding:12px; border-radius:14px; border:1px solid rgba(255,90,122,.28); background: rgba(255,90,122,.08); white-space:pre-wrap;">
        ${RED_FLAGS}
      </div>
    `;
  }

  return `
    <div style="font-weight:900; margin-bottom:8px;">${guide.title}</div>
    <div style="white-space:pre-wrap; line-height:1.5;">${guide.text}</div>
    <div style="margin-top:12px; padding:12px; border-radius:14px; border:1px solid rgba(255,90,122,.28); background: rgba(255,90,122,.08); white-space:pre-wrap;">
      ${RED_FLAGS}
    </div>
  `;
}

function renderGuide(className){
  dxBox.innerHTML = buildGuideHTML(className);
}

function saveResultToStorage(top){
  const payload = {
    topClass: top.className,
    topProb: top.probability,
    guideHTML: buildGuideHTML(top.className),
    savedAt: new Date().toISOString()
  };
  localStorage.setItem("lastDx", JSON.stringify(payload));
}

function loadResultIntoResultsTab(){
  const raw = localStorage.getItem("lastDx");
  if(!raw){
    resultsBox.textContent = "Aún no hay resultados guardados. Realiza un análisis primero.";
    return;
  }

  const data = JSON.parse(raw);
  const pct = (data.topProb * 100).toFixed(2);
  const dateStr = new Date(data.savedAt).toLocaleString();

  resultsBox.innerHTML = `
    <div style="margin-bottom:12px;">
      <strong>Resultado principal:</strong> ${data.topClass}<br>
      <strong>Confianza:</strong> ${pct}%<br>
      <span style="font-size:12px; opacity:.7;">Guardado: ${dateStr}</span>
    </div>
    ${data.guideHTML}
  `;
}

// ===============================
// Cargar modelo
// ===============================
async function loadModel(){
  try{
    modelBadge.textContent = "Modelo: cargando…";
    model = await tmImage.load(MODEL_URL + "model.json", MODEL_URL + "metadata.json");
    const total = model.getTotalClasses();
    modelBadge.textContent = `Modelo: listo (${total} clases)`;
    updateButtons();
  }catch(err){
    console.error(err);
    modelBadge.textContent = "Modelo: error al cargar";
  }
}
loadModel();

// ===============================
// Helpers
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
  dxBox.textContent = "Aún no hay orientación. Analiza una radiografía.";
  goResults.disabled = true;
}

function setPreviewFromFile(file){
  if (!file) return;
  if (!file.type.startsWith("image/")){
    predList.textContent = "Ese archivo no es una imagen.";
    return;
  }

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

  try{
    const prediction = await model.predict(previewImg, false);
    prediction.sort((a,b) => b.probability - a.probability);

    const top = prediction[0];

    predTop.classList.remove("hidden");
    topName.textContent = top.className;
    topConf.textContent = `Confianza: ${(top.probability*100).toFixed(2)}%`;

    let text = "";
    for (const p of prediction){
      text += `• ${p.className}: ${(p.probability*100).toFixed(2)}%\n`;
    }
    predList.textContent = text.trim();

    // orientación + guardar
    renderGuide(top.className);
    saveResultToStorage(top);

    localStorage.setItem("lastPrediction", JSON.stringify(prediction));
    goResults.disabled = false;

  }catch(err){
    console.error(err);
    predList.textContent = "Error al analizar. Revisa consola (F12).";
  }
});

// Ir a Resultados
goResults.addEventListener("click", () => showTab("resultados"));

// Borrar resultado
btnClearHistory.addEventListener("click", () => {
  localStorage.removeItem("lastDx");
  loadResultIntoResultsTab();
});

// ===============================
// Logout
// ===============================
btnLogout.addEventListener("click", () => setAuthed(false));