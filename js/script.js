document.addEventListener("DOMContentLoaded", async () => {
  const $ = (id) => document.getElementById(id);

  const cajaLogin = $("cajaLogin");
  const formLogin = $("formLogin");
  const errorLogin = $("errorLogin");
  const zonaForo = $("zonaForo");
  const miNombre = $("miNombre");
  const botonSalir = $("salir");
  const bannerRespuesta = $("respondiendo");
  const textoRespuesta = $("respondiendoTexto");
  const botonCancelar = $("cancelarRespuesta");
  const formulario = $("formularioForo");
  const inputTexto = $("pregunta");
  const errorForo = $("errorForo");
  const historial = $("historialForo");

  // ---------- 0) Comprobar la configuración ----------
  const cfg = window.FORO_CONFIG || {};
  const sinConfigurar =
    !cfg.url ||
    !cfg.key ||
    cfg.url.startsWith("PEGA") ||
    cfg.key.startsWith("PEGA");

  if (!window.supabase || sinConfigurar) {
    mostrarError(
      errorLogin,
      !window.supabase
        ? "No se pudo cargar Supabase. Revisa tu conexión a internet."
        : "Falta configurar js/config.js con la URL y la clave pública de tu proyecto.",
    );
    formLogin.querySelector("button").disabled = true;
    return;
  }

  const cliente = window.supabase.createClient(cfg.url, cfg.key);

  let perfiles = {}; // id -> { nombre, color }
  let yo = null; // { id, nombre, color }
  let respondiendoA = null; // { id, nombre }
  let ultimaFirma = "";
  let temporizador = null;

  // ---------- Utilidades ----------
  function mostrarError(el, texto) {
    el.textContent = texto;
    el.hidden = false;
  }
  function limpiarError(el) {
    el.textContent = "";
    el.hidden = true;
  }
  // Solo acepta colores tipo #aabbcc
  function colorSeguro(valor) {
    return /^#[0-9a-fA-F]{6}$/.test(valor) ? valor : "#ff6b81";
  }
  function formatearFecha(iso) {
    try {
      return new Date(iso).toLocaleString("es-ES", {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch (e) {
      return "";
    }
  }

  // ---------- 1) Entrar y salir ----------
  formLogin.addEventListener("submit", async (e) => {
    e.preventDefault();
    limpiarError(errorLogin);
    const boton = formLogin.querySelector("button");
    boton.disabled = true;

    const { error } = await cliente.auth.signInWithPassword({
      email: $("loginEmail").value.trim(),
      password: $("loginPass").value,
    });

    boton.disabled = false;
    if (error) {
      mostrarError(errorLogin, "Correo o contraseña incorrectos.");
      return;
    }
    $("loginPass").value = "";
    await iniciar();
  });

  botonSalir.addEventListener("click", async () => {
    await cliente.auth.signOut();
    mostrarLogin();
  });

  function mostrarLogin() {
    clearInterval(temporizador);
    yo = null;
    ultimaFirma = "";
    historial.replaceChildren();
    zonaForo.hidden = true;
    cajaLogin.hidden = false;
  }

  async function iniciar() {
    const { data } = await cliente.auth.getSession();
    const usuario = data && data.session ? data.session.user : null;
    if (!usuario) {
      mostrarLogin();
      return;
    }

    // Cargar los perfiles (nombre y color los puso el dueño en Supabase)
    const res = await cliente.from("perfiles").select("id, nombre, color");
    perfiles = {};
    (res.data || []).forEach((p) => {
      perfiles[p.id] = p;
    });

    if (!perfiles[usuario.id]) {
      await cliente.auth.signOut();
      mostrarLogin();
      mostrarError(
        errorLogin,
        "Tu cuenta todavía no tiene nombre registrado en el foro.",
      );
      return;
    }

    yo = perfiles[usuario.id];
    miNombre.textContent = yo.nombre;
    miNombre.style.color = colorSeguro(yo.color);

    cajaLogin.hidden = true;
    zonaForo.hidden = false;

    await cargarMensajes(true);
    clearInterval(temporizador);
    temporizador = setInterval(() => cargarMensajes(false), 20000); // mira si hay mensajes nuevos
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && yo) cargarMensajes(false);
  });

  // ---------- 2) Leer mensajes ----------
  async function cargarMensajes(forzar) {
    const { data, error } = await cliente
      .from("mensajes")
      .select("id, creado_en, autor_id, texto, responde_a")
      .order("creado_en", { ascending: false })
      .limit(300);

    if (error) {
      mostrarError(errorForo, "No se pudieron cargar los mensajes.");
      return;
    }
    limpiarError(errorForo);

    const firma = (data || []).map((m) => m.id).join(",");
    if (!forzar && firma === ultimaFirma) return; // no hay nada nuevo
    ultimaFirma = firma;
    dibujar(data || []);
  }

  function dibujar(mensajes) {
    const ids = new Set(mensajes.map((m) => m.id));
    const respuestasDe = {};
    const principales = [];

    mensajes.forEach((m) => {
      if (m.responde_a && ids.has(m.responde_a)) {
        (respuestasDe[m.responde_a] = respuestasDe[m.responde_a] || []).push(m);
      } else {
        principales.push(m);
      }
    });

    historial.replaceChildren();
    principales.forEach((m) => {
      const tarjeta = crearTarjeta(m, false);

      const lista = (respuestasDe[m.id] || []).sort((a, b) =>
        a.creado_en.localeCompare(b.creado_en),
      );
      if (lista.length) {
        const caja = document.createElement("div");
        caja.className = "respuestas";
        lista.forEach((r) => caja.appendChild(crearTarjeta(r, true)));
        tarjeta.appendChild(caja);
      }
      historial.appendChild(tarjeta);
    });
  }

  function crearTarjeta(m, esRespuesta) {
    const autor = perfiles[m.autor_id] || {
      nombre: "Alguien",
      color: "#ff6b81",
    };
    const color = colorSeguro(autor.color);

    const caja = document.createElement("div");
    caja.className = esRespuesta ? "respuesta" : "publicacion-tarjeta";

    const titulo = document.createElement("h4");
    titulo.style.color = color;
    titulo.textContent = (esRespuesta ? "↳ " : "❓ ") + autor.nombre + ":";
    const fecha = document.createElement("span");
    fecha.className = "pub-meta";
    fecha.textContent = formatearFecha(m.creado_en);
    titulo.appendChild(fecha);

    const texto = document.createElement("p");
    texto.style.color = color;
    texto.textContent = m.texto; // textContent: el texto nunca rompe la página

    caja.append(titulo, texto);

    if (!esRespuesta) {
      const boton = document.createElement("button");
      boton.type = "button";
      boton.className = "btn-responder";
      boton.textContent = "Responder";
      boton.addEventListener("click", () => empezarRespuesta(m, autor.nombre));
      caja.appendChild(boton);
    }
    return caja;
  }

  // ---------- 3) Responder ----------
  function empezarRespuesta(m, nombre) {
    respondiendoA = { id: m.id, nombre };
    const resumen = m.texto.length > 60 ? m.texto.slice(0, 60) + "…" : m.texto;
    textoRespuesta.textContent = "Respondiendo a " + nombre + ": " + resumen;
    bannerRespuesta.hidden = false;
    inputTexto.focus();
    formulario.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function cancelarRespuesta() {
    respondiendoA = null;
    bannerRespuesta.hidden = true;
  }
  botonCancelar.addEventListener("click", cancelarRespuesta);

  // ---------- 4) Enviar ----------
  formulario.addEventListener("submit", async (e) => {
    e.preventDefault();
    limpiarError(errorForo);

    const texto = inputTexto.value.trim();
    if (!texto || !yo) return;

    const boton = formulario.querySelector('button[type="submit"]');
    boton.disabled = true;

    // autor_id lo pone Supabase con la cuenta que inició sesión: no se puede enviar como otra persona
    const { error } = await cliente.from("mensajes").insert({
      texto,
      responde_a: respondiendoA ? respondiendoA.id : null,
    });

    boton.disabled = false;
    if (error) {
      mostrarError(
        errorForo,
        "No se pudo enviar el mensaje. Inténtalo otra vez.",
      );
      return;
    }
    inputTexto.value = "";
    cancelarRespuesta();
    await cargarMensajes(true);
  });

  // ---------- Al abrir la página: ¿ya había entrado antes? ----------
  await iniciar();
});
