"use strict";

const DB_NAME = "mis-tickets-public";
const STORE = "purchases";
const DB_VERSION = 1;
const MAX_FILE = 12 * 1024 * 1024;
const money = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
const dateFormat = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", year: "numeric" });
const state = { view: "inicio", purchases: [], search: "", installPrompt: null, stream: null };

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const esc = (value = "") => String(value).replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
const formatDate = value => value ? dateFormat.format(new Date(`${value}T12:00:00`)) : "Sin fecha";
const today = () => new Date().toISOString().slice(0, 10);

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: "id", autoIncrement: true });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function dbAction(mode, action) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const store = tx.objectStore(STORE);
    const request = action(store);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

const getPurchases = () => dbAction("readonly", store => store.getAll());
const savePurchase = purchase => dbAction("readwrite", store => store.add(purchase));
const deletePurchase = id => dbAction("readwrite", store => store.delete(id));
const clearPurchases = () => dbAction("readwrite", store => store.clear());

function toast(message) {
  const node = $("#toast"); node.textContent = message; node.classList.add("show");
  clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove("show"), 2600);
}

function calcWarranty(date, years) {
  const value = new Date(`${date}T12:00:00`); value.setFullYear(value.getFullYear() + Number(years || 0));
  return value.toISOString().slice(0, 10);
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);
    if (file.size > MAX_FILE) return reject(new Error("El archivo supera el máximo de 12 MB."));
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type || "application/octet-stream", data: reader.result });
    reader.onerror = () => reject(new Error("No se pudo leer el archivo."));
    reader.readAsDataURL(file);
  });
}

function filtered() {
  const query = state.search.trim().toLocaleLowerCase("es");
  return state.purchases.filter(item => !query || [item.name, item.brand, item.store, item.category, item.serial, item.barcode].some(value => String(value || "").toLocaleLowerCase("es").includes(query)));
}

function purchaseCard(item) {
  return `<button class="purchase-card" data-detail="${item.id}"><span class="product-art">◇</span><span class="purchase-copy"><small>${esc(item.category || "Objeto")}</small><b>${esc(item.name)}</b><span>${esc(item.store)} · ${formatDate(item.purchaseDate)}</span></span><span class="price">${money.format(item.price || 0)}</span></button>`;
}

function searchBox() {
  return `<div class="search-row"><label class="search-box"><span>⌕</span><input id="searchInput" value="${esc(state.search)}" placeholder="Buscar producto, tienda o número de serie"></label></div>`;
}

function renderHome() {
  const list = filtered();
  return `<section class="page home-grid"><div><div class="hero-row"><div><p class="eyebrow">${new Intl.DateTimeFormat("es-ES", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</p><h2>Todo lo que compras,<br><span>siempre localizado.</span></h2></div><button class="fab" data-add aria-label="Añadir compra">+</button></div><div class="quick-actions"><button data-add><span class="blue">▥</span><p><b>Escanear producto</b><small>Código de barras o QR</small></p><em>›</em></button><button data-add-form><span class="orange">◉</span><p><b>Fotografiar ticket</b><small>Guardarlo antes de perderlo</small></p><em>›</em></button></div><div class="section-heading"><div><p class="eyebrow">Tu archivo</p><h3>Últimas compras</h3></div><button data-view="objetos">Ver todas ›</button></div>${searchBox()}<div class="purchase-list">${list.length ? list.slice(0, 8).map(purchaseCard).join("") : `<div class="empty"><strong>Tu archivo está preparado</strong><span>Añade tu primera compra para empezar.</span></div>`}</div></div><aside class="side"><article class="side-card"><span class="badge">En este dispositivo</span><h3>Tu inventario</h3><span class="stat">${state.purchases.length}</span><p>objetos registrados de forma privada.</p></article><article class="side-card blue-card"><span>☁</span><h3>Segunda copia en Drive</h3><p>Prepara una copia personal para cambiar de móvil con tranquilidad.</p><button class="secondary" data-drive>Configurar Google Drive</button></article><article class="side-card"><h3>Copia descargable</h3><p>Exporta periódicamente tu archivo mientras se completa la conexión con Drive.</p><button class="outline" data-export>Descargar copia</button></article></aside></section>`;
}

function renderObjects() {
  const list = filtered();
  const activeWarranty = state.purchases.filter(item => item.warrantyEnd >= today()).length;
  return `<section class="page"><header class="screen-title"><div><p class="eyebrow">Inventario</p><h2>Todos tus objetos</h2><p>Consulta cada compra, su garantía y documentación.</p></div><button class="primary" data-add>+ Añadir objeto</button></header><div class="summary-grid"><article><strong>${state.purchases.length}</strong><small>Objetos registrados</small></article><article><strong>${activeWarranty}</strong><small>Con garantía activa</small></article><article><strong>${state.purchases.filter(item => item.receipt).length}</strong><small>Tickets guardados</small></article></div>${searchBox()}<div class="objects-grid">${list.length ? list.map(item => `<button class="object-card" data-detail="${item.id}"><span class="product-art">◇</span><b>${esc(item.name)}</b><span>${esc(item.brand || "Sin marca")}</span><footer><span>${esc(item.store)}</span><strong>${money.format(item.price || 0)}</strong></footer></button>`).join("") : `<div class="empty"><strong>No hay objetos</strong><span>Añade tu primera compra.</span></div>`}</div></section>`;
}

function renderTickets() {
  return `<section class="page"><header class="screen-title"><div><p class="eyebrow">Documentos</p><h2>Tickets y facturas</h2><p>Ordenados desde la compra más reciente.</p></div><button class="primary" data-add-form>+ Fotografiar ticket</button></header><div class="tickets-list">${state.purchases.length ? state.purchases.map(item => `<article class="ticket-card"><span class="ticket-icon ${item.receipt ? "" : "missing"}">▤</span><p><small>${formatDate(item.purchaseDate)}</small><b>${esc(item.store)}</b><span>${esc(item.name)} · ${money.format(item.price || 0)}</span></p><button class="outline" ${item.receipt ? `data-open-receipt="${item.id}"` : "disabled"}>${item.receipt ? "Abrir" : "Sin ticket"}</button></article>`).join("") : `<div class="empty"><strong>No hay tickets guardados</strong><span>Fotografía el primero para tenerlo localizado.</span></div>`}</div></section>`;
}

function renderSettings() {
  const drive = JSON.parse(localStorage.getItem("mis-tickets-drive") || "null");
  return `<section class="page"><header class="screen-title"><div><p class="eyebrow">Configuración</p><h2>Ajustes</h2><p>Controla tus copias y la instalación.</p></div></header><div class="settings-list"><article class="setting-card"><i>▣</i><p><small>Almacenamiento</small><b>Datos en este dispositivo</b><small>La aplicación usa una base privada del navegador.</small></p><span class="badge">Activo</span></article><article class="setting-card"><i>☁</i><p><small>Copia adicional</small><b>Google Drive</b><small>${drive ? `Preferencias guardadas · carpeta ${esc(drive.folder)}` : "Pendiente de configuración"}</small></p><button class="outline" data-drive>Configurar</button></article><article class="setting-card"><i>⇩</i><p><small>Seguridad</small><b>Exportar copia completa</b><small>Descarga compras y documentos en un archivo JSON.</small></p><button class="outline" data-export>Descargar</button></article><article class="setting-card"><i>⇧</i><p><small>Restauración</small><b>Importar una copia</b><small>Recupera un archivo exportado anteriormente.</small></p><button class="outline" data-import>Importar</button></article><article class="setting-card"><i>＋</i><p><small>Aplicación</small><b>Instalar Mis Tickets</b><small>Añádela a la pantalla de inicio del móvil.</small></p><button class="outline" id="installButton">Instalar</button></article><article class="setting-card"><i>?</i><p><small>Ayuda</small><b>Ver bienvenida de nuevo</b><small>Revisa cómo funciona el guardado y Drive.</small></p><button class="outline" id="showWelcome">Abrir</button></article></div></section>`;
}

function render() {
  const view = $("#view");
  view.innerHTML = state.view === "inicio" ? renderHome() : state.view === "objetos" ? renderObjects() : state.view === "tickets" ? renderTickets() : renderSettings();
  $$('[data-view]').forEach(button => button.classList.toggle("active", button.dataset.view === state.view));
}

function setView(view) { state.view = view; state.search = ""; render(); $("#view").focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "smooth" }); }

function openPurchase(showForm = false) {
  stopScanner();
  $("#purchaseStart").hidden = showForm; $("#purchaseForm").hidden = !showForm;
  $("#purchaseForm").reset(); $("#purchaseForm [name=purchaseDate]").value = today(); $("#receiptLabel").textContent = "Añadir ticket o factura"; $("#formError").hidden = true;
  $("#purchaseDialog").showModal();
}

function showForm() { stopScanner(); $("#purchaseStart").hidden = true; $("#purchaseForm").hidden = false; }

async function startScanner() {
  const scanner = $("#scanner"); scanner.hidden = false;
  try {
    if (!("BarcodeDetector" in window)) throw new Error("Este navegador no permite el escaneo directo. Escribe el código manualmente.");
    state.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
    const video = $("#scannerVideo"); video.srcObject = state.stream; await video.play();
    const detector = new BarcodeDetector({ formats: ["ean_13", "ean_8", "upc_a", "upc_e", "code_128", "qr_code"] });
    const scan = async () => {
      if (!state.stream) return;
      try { const result = await detector.detect(video); if (result[0]?.rawValue) { showForm(); $("#purchaseForm [name=barcode]").value = result[0].rawValue; return; } } catch (_) {}
      requestAnimationFrame(scan);
    }; scan();
  } catch (error) { $("#scannerMessage").textContent = error.message; }
}

function stopScanner() { state.stream?.getTracks().forEach(track => track.stop()); state.stream = null; const scanner = $("#scanner"); if (scanner) scanner.hidden = true; }

async function submitPurchase(event) {
  event.preventDefault();
  const form = event.currentTarget; const data = new FormData(form); const error = $("#formError");
  try {
    const receipt = await readFile($("#receiptInput").files[0]);
    const purchase = { name: data.get("name").trim(), brand: data.get("brand").trim(), category: data.get("category").trim(), store: data.get("store").trim(), price: Number(data.get("price") || 0), purchaseDate: data.get("purchaseDate"), warrantyEnd: calcWarranty(data.get("purchaseDate"), data.get("warrantyYears")), returnEnd: data.get("returnEnd"), barcode: data.get("barcode").trim(), serial: data.get("serial").trim(), receipt, createdAt: new Date().toISOString() };
    purchase.id = await savePurchase(purchase); state.purchases.unshift(purchase); $("#purchaseDialog").close(); render(); toast("Compra guardada en este dispositivo");
  } catch (err) { error.textContent = err.message || "No se pudo guardar la compra."; error.hidden = false; }
}

function showDetail(id) {
  const item = state.purchases.find(value => value.id === Number(id)); if (!item) return;
  $("#detailContent").innerHTML = `<div class="detail-hero">◇</div><p class="pill">${esc(item.category || "Objeto")}</p><h2>${esc(item.name)}</h2><p class="lead">${esc(item.brand || "Sin marca")}</p><div class="detail-price"><span>Precio de compra</span><b>${money.format(item.price || 0)}</b></div><div class="detail-grid"><article><small>Comprado</small><b>${formatDate(item.purchaseDate)}</b></article><article><small>Tienda</small><b>${esc(item.store)}</b></article><article><small>Garantía hasta</small><b>${formatDate(item.warrantyEnd)}</b></article><article><small>Ticket</small><b>${item.receipt ? "Guardado" : "No adjuntado"}</b></article></div>${item.serial ? `<p class="notice">Número de serie: <b>${esc(item.serial)}</b></p>` : ""}<div class="detail-actions"><button class="primary" ${item.receipt ? `data-open-receipt="${item.id}"` : "disabled"}>Ver ticket</button><button class="outline" data-delete="${item.id}">Eliminar</button></div>`;
  $("#detailDialog").showModal();
}

function openReceipt(id) {
  const receipt = state.purchases.find(item => item.id === Number(id))?.receipt;
  if (!receipt) return toast("Esta compra no tiene documento.");
  const [header, body] = receipt.data.split(","); const type = /data:([^;]+)/.exec(header)?.[1] || receipt.type; const bytes = Uint8Array.from(atob(body), char => char.charCodeAt(0)); const url = URL.createObjectURL(new Blob([bytes], { type }));
  window.open(url, "_blank", "noopener"); setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function exportBackup() {
  const payload = { app: "Mis Tickets", version: 1, exportedAt: new Date().toISOString(), purchases: state.purchases };
  const url = URL.createObjectURL(new Blob([JSON.stringify(payload)], { type: "application/json" })); const link = document.createElement("a"); link.href = url; link.download = `mis-tickets-copia-${today()}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast("Copia descargada");
}

async function importBackup(file) {
  try {
    const payload = JSON.parse(await file.text()); if (payload.app !== "Mis Tickets" || !Array.isArray(payload.purchases)) throw new Error("El archivo no es una copia válida de Mis Tickets.");
    if (!confirm(`Se reemplazarán los datos actuales por ${payload.purchases.length} compras. ¿Continuar?`)) return;
    await clearPurchases();
    for (const item of payload.purchases) { const copy = { ...item }; delete copy.id; copy.id = await savePurchase(copy); }
    state.purchases = (await getPurchases()).sort((a, b) => String(b.purchaseDate).localeCompare(String(a.purchaseDate))); render(); toast("Copia restaurada correctamente");
  } catch (error) { toast(error.message || "No se pudo importar la copia"); }
}

function openDrive() {
  const saved = JSON.parse(localStorage.getItem("mis-tickets-drive") || "null");
  $("#driveAutomatic").checked = saved?.automatic ?? true; $("#driveFolder").value = saved?.folder || "Mis Tickets"; $("#driveDialog").showModal();
}

document.addEventListener("click", async event => {
  const button = event.target.closest("button"); if (!button) return;
  if (button.dataset.view) return setView(button.dataset.view);
  if (button.hasAttribute("data-add")) return openPurchase(false);
  if (button.hasAttribute("data-add-form")) return openPurchase(true);
  if (button.dataset.openForm !== undefined) return showForm();
  if (button.id === "scanProduct") return startScanner();
  if (button.id === "scannerManual") return showForm();
  if (button.id === "formBack") { $("#purchaseStart").hidden = false; $("#purchaseForm").hidden = true; return; }
  if (button.dataset.close) { stopScanner(); return $("#" + button.dataset.close).close(); }
  if (button.dataset.detail) return showDetail(button.dataset.detail);
  if (button.dataset.openReceipt) return openReceipt(button.dataset.openReceipt);
  if (button.dataset.delete) { if (confirm("¿Eliminar esta compra y su ticket?")) { await deletePurchase(Number(button.dataset.delete)); state.purchases = state.purchases.filter(item => item.id !== Number(button.dataset.delete)); $("#detailDialog").close(); render(); toast("Compra eliminada"); } return; }
  if (button.hasAttribute("data-drive") || button.id === "driveStatus") return openDrive();
  if (button.hasAttribute("data-export")) return exportBackup();
  if (button.hasAttribute("data-import")) return $("#importInput").click();
  if (button.id === "showWelcome") return $("#welcomeDialog").showModal();
  if (button.id === "welcomeLater") { localStorage.setItem("mis-tickets-welcome", "seen"); return $("#welcomeDialog").close(); }
  if (button.id === "welcomeDrive") { localStorage.setItem("mis-tickets-welcome", "seen"); $("#welcomeDialog").close(); return setTimeout(openDrive, 150); }
  if (button.id === "saveDrivePreferences") { localStorage.setItem("mis-tickets-drive", JSON.stringify({ automatic: $("#driveAutomatic").checked, folder: $("#driveFolder").value.trim() || "Mis Tickets" })); $("#driveDialog").close(); render(); return toast("Preferencias de Drive guardadas"); }
  if (button.id === "installButton") { if (state.installPrompt) { state.installPrompt.prompt(); await state.installPrompt.userChoice; state.installPrompt = null; } else toast("En Chrome, abre el menú y pulsa “Instalar aplicación”."); }
});

document.addEventListener("input", event => { if (event.target.id === "searchInput") { state.search = event.target.value; render(); const input = $("#searchInput"); input.focus(); input.setSelectionRange(input.value.length, input.value.length); } });
$("#purchaseForm").addEventListener("submit", submitPurchase);
$("#receiptInput").addEventListener("change", event => $("#receiptLabel").textContent = event.target.files[0]?.name || "Añadir ticket o factura");
$("#importInput").addEventListener("change", event => { if (event.target.files[0]) importBackup(event.target.files[0]); event.target.value = ""; });
$$('dialog').forEach(dialog => dialog.addEventListener("close", stopScanner));
window.addEventListener("beforeinstallprompt", event => { event.preventDefault(); state.installPrompt = event; });

async function init() {
  state.purchases = (await getPurchases()).sort((a, b) => String(b.purchaseDate).localeCompare(String(a.purchaseDate)));
  render();
  if (!localStorage.getItem("mis-tickets-welcome")) $("#welcomeDialog").showModal();
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("./sw.js").catch(() => {});
}

init().catch(() => { $("#view").innerHTML = `<section class="page"><div class="empty"><strong>No se pudo abrir el almacenamiento</strong><span>Comprueba que el navegador permita guardar datos del sitio.</span></div></section>`; });
