/* ==========================================================
   ADIUR FEMENINO — CONTROL CENTRALIZADO DE PERMISOS
   Inicio de sesión local. Esto restringe la interfaz, pero NO
   sustituye reglas de seguridad de Firestore.
========================================================== */
(function () {
  "use strict";

  const SESSION_KEY = "usuarioADIUR";
  const LOGIN_URL = "Loing.html";
  const DIVISION_FIJA = { toto: "Sub 16", bianca: "Sub 14" };
  const PAGINAS_BIANCA = new Set([
    "pagina principal.html",
    "partidos.html",
    "calendario.html",
    "gimnasio.html",
    "testeos.html"
  ]);
  const normalizar = value => String(value ?? "")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[\s._-]+/g, "").trim();

  let usuario = "";
  try { usuario = String(localStorage.getItem(SESSION_KEY) || "").trim(); }
  catch (_) { usuario = ""; }

  if (!usuario) {
    if (!/^(index|loing)\.html$/i.test(location.pathname.split("/").pop() || "")) {
      location.replace(LOGIN_URL);
    }
    return;
  }

  const u = normalizar(usuario);
  const rol = ["fran", "francisco", "franciscoperezbasla"].includes(u)
    ? "admin"
    : u === "toto" ? "ct_s16"
    : ["bianca", "biancadominguez"].includes(u) ? "jugadora_s14"
    : "desconocido";

  if (rol === "desconocido") {
    try { localStorage.removeItem(SESSION_KEY); } catch (_) {}
    location.replace(LOGIN_URL);
    return;
  }

  const pagina = decodeURIComponent(location.pathname.split("/").pop() || "")
    .toLowerCase();
  if (rol === "jugadora_s14" && !PAGINAS_BIANCA.has(pagina)) {
    location.replace("Pagina Principal.html");
    return;
  }

  const divisionPermitida = DIVISION_FIJA[rol] || null;
  const nombreRol = rol === "admin" ? "Administrador"
    : rol === "ct_s16" ? "CT S16" : "Jugadora S14";

  function actualizarPerfil() {
    const nombre = rol === "jugadora_s14" ? "Bianca Domínguez" : usuario;
    ["nombreUsuario", "nombrePerfil", "saludoUsuario"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = nombre;
    });
    ["avatarUsuario", "avatarPerfil"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = (nombre.trim()[0] || "U").toUpperCase();
    });
    ["rolUsuario", "rolPerfil"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = nombreRol;
    });
  }

  function categoriaDeTexto(value) {
    const s = String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
    return ["sub 10", "sub 12", "sub 14", "sub 16", "primera"].includes(s)
      ? s.replace(/^./, c => c.toUpperCase()) : null;
  }

  function fijarSelectoresDivision(root = document) {
    if (!divisionPermitida) return;
    root.querySelectorAll("select").forEach(select => {
      const options = Array.from(select.options || []);
      const categorias = options.map(o => ({ option: o, categoria: categoriaDeTexto(o.value) || categoriaDeTexto(o.textContent) }))
        .filter(x => x.categoria);
      if (!categorias.length) return;
      const existe = categorias.some(x => x.categoria === divisionPermitida);
      if (!existe) return;
      categorias.forEach(({ option, categoria }) => {
        if (categoria !== divisionPermitida) option.remove();
      });
      Array.from(select.options).forEach(option => {
        const texto = (option.value + " " + option.textContent).toLowerCase();
        if (/todas las divisiones|todas las categorias|todas las categorías|^todas$/.test(texto.trim())) option.remove();
      });
      const cambioNecesario = select.value !== divisionPermitida;
      select.value = divisionPermitida;
      select.disabled = true;
      select.setAttribute("aria-label", "División fijada por permisos: " + divisionPermitida);
      select.dataset.adiurDivisionProcesada = "1";
      if (cambioNecesario) select.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  const nombresAjeno = new Set();
  function esSelectorJugadora(select) {
    const id = (select.id + " " + select.name + " " + select.getAttribute("aria-label")).toLowerCase();
    return /jugadora|jugador|atleta|plantel/.test(id);
  }
  function filtrarSelectoresBianca(root = document) {
    if (rol !== "jugadora_s14") return;
    root.querySelectorAll("select").forEach(select => {
      if (!esSelectorJugadora(select)) return;
      Array.from(select.options || []).forEach(option => {
        const t = option.textContent.trim();
        if (!t || /seleccion|todas|ninguna|bianca/i.test(t)) return;
        nombresAjeno.add(t.toLocaleLowerCase("es-AR"));
        option.remove();
      });
      const bianca = Array.from(select.options || []).find(o => /bianca/i.test(o.textContent));
      if (bianca) select.value = bianca.value;
      select.disabled = true;
    });
  }

  const PALABRAS_BORRADO = /eliminar|borrar|suprimir|quitar|dar de baja/i;
  const PALABRAS_CAMBIO = /guardar|agregar|añadir|nuevo|crear|editar|modificar|actualizar|importar|cargar|registrar|duplicar|publicar|aplicar|restaurar|reset|save|submit|enviar|confirmar/i;
  const PALABRAS_NAVEGACION = /cerrar|cancelar|volver|abrir|ver|filtrar|buscar|siguiente|anterior|mes|semana|dia|día|imprimir|descargar|mostrar|ocultar|menu|menú|perfil|sesion|sesión|inicio|pizarra|calendario/i;

  function textoControl(el) {
    return [
      el.textContent, el.value, el.getAttribute("aria-label"),
      el.title, el.id, el.name, el.className, el.getAttribute("data-accion"),
      el.getAttribute("data-action"), el.getAttribute("data-operacion"), el.getAttribute("onclick")
    ].filter(Boolean).join(" ").toLowerCase();
  }
  function esControlSoloLecturaPermitido(el) {
    const t = textoControl(el);
    if (el.matches("a, [role=tab]")) return true;
    if (el.matches("button")) {
      return !PALABRAS_CAMBIO.test(t) && !PALABRAS_BORRADO.test(t);
    }
    if (el.matches("select")) {
      return !esSelectorJugadora(el) && !Array.from(el.options || []).some(o => categoriaDeTexto(o.value) || categoriaDeTexto(o.textContent));
    }
    if (el.matches("input")) {
      return el.type === "search" || /buscar|filtro|fecha|mes|semana|orden|busqueda|búsqueda/i.test(t);
    }
    return false;
  }

  function aplicarSoloLectura(root = document) {
    if (rol !== "jugadora_s14") return;
    root.querySelectorAll("button, input, select, textarea, [contenteditable=true]").forEach(el => {
      if (esControlSoloLecturaPermitido(el)) return;
      if (el.matches("input, textarea, select")) {
        el.disabled = true;
        el.readOnly = true;
      } else if (el.matches("[contenteditable=true]")) {
        el.setAttribute("contenteditable", "false");
      } else {
        el.disabled = true;
        el.setAttribute("aria-disabled", "true");
      }
      el.classList.add("adiur-solo-lectura");
    });
    root.querySelectorAll("form").forEach(form => {
      form.addEventListener("submit", bloquearAccion, true);
    });
  }

  function bloquearAccion(event) {
    if (rol === "admin") return;
    if (rol === "jugadora_s14" && event.type === "submit") {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }
    const target = event.target;
    const control = target.closest?.("button, input[type=submit], input[type=button]");
    if (!control) return;
    const t = textoControl(control);
    if (rol === "jugadora_s14" && !esControlSoloLecturaPermitido(control)) {
      event.preventDefault(); event.stopImmediatePropagation();
    } else if (rol === "ct_s16" && PALABRAS_BORRADO.test(t)) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }

  function ocultarRegistrosDeOtrasJugadoras() {
    if (rol !== "jugadora_s14" || !["partidos.html", "gimnasio.html", "testeos.html"].includes(pagina)) return;
    const nombres = Array.from(nombresAjeno).filter(n => n.length >= 4);
    if (!nombres.length) return;
    document.querySelectorAll("tr, [data-jugadora], .rutina-card, .jugadora-card, .registro-card, .tarjeta-jugadora").forEach(item => {
      const texto = (item.innerText || item.textContent || "").toLocaleLowerCase("es-AR");
      if (nombres.some(nombre => texto.includes(nombre))) item.hidden = true;
    });
  }

  function aplicarPermisos() {
    document.querySelectorAll('a[href]').forEach(a => {
      const destino = (a.getAttribute('href') || '').split(/[?#]/)[0].toLowerCase();
      if (/^(biblioteca|biblioteca de ejercicios|multimedia|lesiones)\.html$/.test(destino)) {
        a.hidden = true;
        a.removeAttribute('href');
        a.setAttribute('aria-disabled', 'true');
      }
    });
    actualizarPerfil();
    fijarSelectoresDivision();
    filtrarSelectoresBianca();
    ocultarRegistrosDeOtrasJugadoras();
    aplicarSoloLectura();
    if (rol === "ct_s16") {
      document.querySelectorAll("button, a, [role=button]").forEach(el => {
        if (PALABRAS_BORRADO.test(textoControl(el))) {
          el.hidden = true;
          el.setAttribute("aria-hidden", "true");
        }
      });
    }
    if (rol === "jugadora_s14") {
      document.querySelectorAll("a[href]").forEach(a => {
        const href = (a.getAttribute("href") || "").split("?")[0].toLowerCase();
        if (/^(jugadoras|asistencia|planificacion|calculadora|informes|estadisticas|pizarra|pruebas|tiempos|encuestas)\.html$/.test(href)) a.remove();
      });
      document.querySelectorAll("[data-ocultar-bianca]").forEach(el => el.remove());
    }
  }

  document.addEventListener("click", bloquearAccion, true);
  document.addEventListener("submit", bloquearAccion, true);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", aplicarPermisos, { once: true });
  } else {
    aplicarPermisos();
  }

  const observer = new MutationObserver(records => {
    let changed = false;
    for (const record of records) {
      if (record.type === "childList" && (record.addedNodes.length || record.removedNodes.length)) changed = true;
    }
    if (changed) aplicarPermisos();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });

  window.ADIUR_PERMISOS = Object.freeze({
    usuario: rol === "jugadora_s14" ? "Bianca Domínguez" : usuario,
    rol,
    division: divisionPermitida,
    puedeEditar: rol !== "jugadora_s14",
    puedeEliminar: rol === "admin",
    paginasBianca: Array.from(PAGINAS_BIANCA)
  });
})();