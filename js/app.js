// ===============================
// Config (login) - prototipo
// ===============================
const ONLY_USER = "jesusc";
const ONLY_PASS = "its";

// ===============================
// Tabs
// ===============================
const tabButtons = document.querySelectorAll(".tab");
const tabViews = {
  login: document.getElementById("tab-login"),
  analizar: document.getElementById("tab-analizar"),
  resultados: document.getElementById("tab-resultados"),
};

function showTab(name){
  tabButtons.forEach(b => b.classList.toggle("active", b.dataset.tab === name));
  Object.entries(tabViews).forEach(([k, el]) => el.classList.toggle("show", k === name));
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
    loginMsg.style.color = "green";
    setAuthed(true);
  } else {
    loginMsg.textContent = "Usuario o contraseña incorrectos.";
    loginMsg.style.color = "crimson";
    setAuthed(false);
  }
});

// Mantener sesión si recargas
setAuthed(localStorage.getItem("authed") === "1");

// ===============================
// Teachable Machine (Image)
// ===============================
let model = null;
let maxPredictions = 0;

const modelStatus = document.getElementById("modelStatus");
const fileInput = document.getElementById("fileInput");
const previewImg = document.getElementById("previewImg");
const btnPredict = document.getElementById("btnPredict");
const predOut = document.getElementById("predOut");
const goResults = document.getElementById("goResults");

// IMPORTANTE:
// Deja tu modelo en /model/ (model.json, metadata.json, weights.bin)
const MODEL_URL = "model/"; // carpeta

async function loadModel(){
  try{
    modelStatus.textContent = "Modelo: cargando...";
    model = await tmImage.load(MODEL_URL + "model.json", MODEL_URL + "metadata.json");
    maxPredictions = model.getTotalClasses();
    modelStatus.textContent = `Modelo: cargado (${maxPredictions} clases).`;
    // Si ya hay imagen, habilita analizar
    btnPredict.disabled = !previewImg.src;
  }catch(err){
    console.error(err);
    modelStatus.textContent = "Modelo: error al cargar. Revisa la carpeta /model/";
  }
}

loadModel();

// Vista previa de imagen
fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  const url = URL.createObjectURL(file);
  previewImg.src = url;
  previewImg.style.display = "block";
  predOut.textContent = "Listo. Ahora puedes analizar con IA.";

  btnPredict.disabled = !model; // solo si el modelo ya cargó
});

// Analizar
btnPredict.addEventListener("click", async () => {
  if (!model) {
    predOut.textContent = "El modelo aún no está cargado.";
    return;
  }
  if (!previewImg.src) {
    predOut.textContent = "Primero sube una imagen.";
    return;
  }

  predOut.textContent = "Analizando...";
  const prediction = await model.predict(previewImg, false);

  // Ordenar por probabilidad desc
  prediction.sort((a,b) => b.probability - a.probability);

  const top = prediction[0];
  let text = `Resultado (top): ${top.className}\nConfianza: ${(top.probability*100).toFixed(2)}%\n\nDetalles:\n`;
  for (const p of prediction){
    text += `- ${p.className}: ${(p.probability*100).toFixed(2)}%\n`;
  }

  predOut.textContent = text;

  // Guardar para la pestaña de resultados (la armamos después)
  localStorage.setItem("lastPrediction", JSON.stringify(prediction));
  goResults.disabled = false;
});

// (placeholder) ir a resultados
goResults.addEventListener("click", () => {
  // aún no la construimos, pero dejamos el flujo listo
  showTab("resultados");
});