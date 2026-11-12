document.addEventListener("DOMContentLoaded", async () => {
  const $ = (id) => document.getElementById(id);

  const cargando = $("cargandoForo");
  const cajaLogin = $("cajaLogin");
  const formLogin = $("formLogin");
  const errorLogin = $("errorLogin");
  const zonaForo = $("zonaForo");
  const miNombre = $("miNombre");
  const botonSalir = $("salir");
  const botonEditar = $("editarPerfil");
  const formPerfil = $("formPerfil");
  const inputPerfilNombre = $("perfilNombreInput");
  const inputPerfilColor = $("perfilColorInput");
  const errorPerfil = $("errorPerfil");
  const botonCancelarPerfil = $("cancelarPerfil");
  const bannerRespuesta = $("respondiendo");
  const textoRespuesta = $("respondiendoTexto");
  const botonCancelar = $("cancelarRespuesta");
  const formulario = $("formularioForo");
  const inputTexto = $("pregunta");
  const errorForo = $("errorForo");
  const historial = $("historialForo");

  // ---------- Utilidades ----------
  const mostrarError = (el, texto) => {
    el.textContent = texto;
    el.hidden = false;
  };
  const limpiarError = (el) => {
    el.textContent = "";
    el.hidden = true;
  };
  const colorSeguro = (v) => (/^#[0-9a-fA-F]{6}$/.test(v) ? v : "#ff6b81");
  const formatearFecha = (iso) => {
    try {
      return new Date(iso).toLocaleString("es-ES", {
        dateStyle: "short",
        timeStyle: "short",
      });
    } catch (e) {
      return "";
    }
  };

  // ---------- Recordar por dónde ibas al recargar ----------
  // El navegador no puede volver a tu posición porque el foro se dibuja después.
  // Por eso la guardamos nosotros y la restauramos cuando el foro ya está listo.
  const CLAVE_SCROLL = "foroScroll";
  if ("scrollRestoration" in history) history.scrollRestoration = "manual";

  let esperandoFrame = false;
  function guardarScroll() {
    try {
      sessionStorage.setItem(CLAVE_SCROLL, String(Math.round(window.scrollY)));
    } catch (e) {}
  }
  window.addEventListener(
    "scroll",
    () => {
      if (esperandoFrame) return;
      esperandoFrame = true;
      requestAnimationFrame(() => {
        guardarScroll();
        esperandoFrame = false;
      });
    },
    { passive: true },
  );
  window.addEventListener("pagehide", guardarScroll);

  function restaurarScroll() {
    let y = 0;
    try {
      y = Number(sessionStorage.getItem(CLAVE_SCROLL)) || 0;
    } catch (e) {}
    if (y > 0) requestAnimationFrame(() => window.scrollTo(0, y));
  }

  // ---------- 0) Comprobar la configuración ----------
  const cfg = window.FORO_CONFIG || {};
  const sinConfigurar =
    !cfg.url ||
    !cfg.key ||
    cfg.url.startsWith("PEGA") ||
    cfg.key.startsWith("PEGA");

  if (!window.supabase || sinConfigurar) {
    cargando.hidden = true;
    cajaLogin.hidden = false;
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

  let perfiles = {}; // id -> { id, nombre, color }
  let yo = null; // mi perfil
  let respondiendoA = null; // { id, nombre }
  let ultimaFirma = "";
  let temporizador = null;
  let canal = null;

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
    detenerActualizacion();
    yo = null;
    ultimaFirma = "";
    historial.replaceChildren();
    cerrarPerfil();
    cargando.hidden = true;
    zonaForo.hidden = true;
    cajaLogin.hidden = false;
  }

  async function iniciar() {
    try {
      const { data } = await cliente.auth.getSession();
      const usuario = data && data.session ? data.session.user : null;
      if (!usuario) {
        mostrarLogin();
        return;
      }

      await cargarPerfiles();

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
      pintarMiPerfil();

      cargando.hidden = true;
      cajaLogin.hidden = true;
      zonaForo.hidden = false;

      await cargarMensajes(true);
      iniciarActualizacion();
      restaurarScroll();
    } catch (e) {
      mostrarLogin();
      mostrarError(
        errorLogin,
        "No se pudo conectar con el foro. Revisa tu conexión.",
      );
    }
  }

  function pintarMiPerfil() {
    miNombre.textContent = yo.nombre;
    miNombre.style.color = colorSeguro(yo.color);
  }

  // ---------- 2) Mantener el foro al día (sin gastar datos de más) ----------
  function iniciarActualizacion() {
    detenerActualizacion();
    // Mensajes al instante (si activaste Realtime en Supabase)
    try {
      canal = cliente
        .channel("foro-mensajes")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "mensajes" },
          () => cargarMensajes(false),
        )
        .subscribe();
    } catch (e) {}
    // Respaldo: revisa cada minuto, solo si la pestaña está a la vista
    temporizador = setInterval(() => {
      if (!document.hidden) cargarMensajes(false);
    }, 60000);
  }

  function detenerActualizacion() {
    clearInterval(temporizador);
    temporizador = null;
    if (canal) {
      try {
        cliente.removeChannel(canal);
      } catch (e) {}
      canal = null;
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && yo) cargarMensajes(false);
  });

  // ---------- 3) Leer perfiles y mensajes ----------
  async function cargarPerfiles() {
    const res = await cliente.from("perfiles").select("id, nombre, color");
    const nuevos = {};
    (res.data || []).forEach((p) => {
      nuevos[p.id] = p;
    });
    perfiles = nuevos;
    if (yo && perfiles[yo.id]) yo = perfiles[yo.id];
  }

  async function cargarMensajes(forzar) {
    const [, resMensajes] = await Promise.all([
      cargarPerfiles(),
      cliente
        .from("mensajes")
        .select("id, creado_en, autor_id, texto, responde_a")
        .order("creado_en", { ascending: false })
        .limit(300),
    ]);

    if (resMensajes.error) {
      mostrarError(errorForo, "No se pudieron cargar los mensajes.");
      return;
    }
    limpiarError(errorForo);

    const datos = resMensajes.data || [];
    // Si no cambió nada (ni mensajes, ni nombres, ni colores), no se vuelve a dibujar
    const firma =
      datos.map((m) => m.id).join(",") +
      "|" +
      Object.values(perfiles)
        .map((p) => p.id + p.nombre + p.color)
        .join(",");
    if (!forzar && firma === ultimaFirma) return;
    ultimaFirma = firma;

    if (yo && perfiles[yo.id]) {
      yo = perfiles[yo.id];
      pintarMiPerfil();
    }
    dibujar(datos);
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

    const fragmento = document.createDocumentFragment(); // se arma aparte y se pega de una vez
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
      fragmento.appendChild(tarjeta);
    });
    historial.replaceChildren(fragmento);
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

  // ---------- 4) Cambiar mi nombre y mi color ----------
  botonEditar.addEventListener("click", () => {
    if (!yo) return;
    inputPerfilNombre.value = yo.nombre;
    inputPerfilColor.value = colorSeguro(yo.color);
    limpiarError(errorPerfil);
    formPerfil.hidden = false;
    botonEditar.hidden = true;
    inputPerfilNombre.focus();
  });

  function cerrarPerfil() {
    formPerfil.hidden = true;
    botonEditar.hidden = false;
    limpiarError(errorPerfil);
  }
  botonCancelarPerfil.addEventListener("click", cerrarPerfil);

  formPerfil.addEventListener("submit", async (e) => {
    e.preventDefault();
    limpiarError(errorPerfil);
    if (!yo) return;

    const nombre = inputPerfilNombre.value.trim();
    const color = colorSeguro(inputPerfilColor.value);
    if (!nombre) {
      mostrarError(errorPerfil, "Escribe un nombre.");
      return;
    }

    const boton = formPerfil.querySelector('button[type="submit"]');
    boton.disabled = true;

    // .select() devuelve la fila cambiada: si viene vacía, Supabase no dejó guardar
    const { data, error } = await cliente
      .from("perfiles")
      .update({ nombre, color })
      .eq("id", yo.id)
      .select();

    boton.disabled = false;

    if (error) {
      mostrarError(
        errorPerfil,
        error.code === "23505"
          ? "Ese nombre ya lo usa otra persona. Elige otro."
          : "No se pudo guardar. Inténtalo otra vez.",
      );
      return;
    }
    if (!data || !data.length) {
      mostrarError(
        errorPerfil,
        'Supabase no permitió el cambio. Falta ejecutar el SQL de "editar mi perfil".',
      );
      return;
    }

    perfiles[yo.id] = data[0];
    yo = data[0];
    pintarMiPerfil();
    cerrarPerfil();
    await cargarMensajes(true); // los mensajes ya escritos se ven con el nombre y color nuevos
  });

  // ---------- 5) Responder ----------
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

  // ---------- 6) Enviar ----------
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
