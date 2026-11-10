document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  const formulario = $('formularioForo');
  const historialForo = $('historialForo');
  const inputPregunta = $('pregunta');
  if (!formulario || !historialForo || !inputPregunta) return;

  // Estos elementos son opcionales: si faltan en tu HTML, el historial sigue funcionando
  const inputNombre = $('nombre');
  const inputColor = $('color');
  const datosUsuario = $('datosUsuario');
  const perfilGuardado = $('perfilGuardado');
  const perfilNombre = $('perfilNombre');
  const botonCambiar = $('cambiarPerfil');

  const CLAVE_PERFIL = 'foroPerfil';
  const CLAVE_HISTORIAL = 'foroHistorial';
  const CLAVE_ULTIMO_USO = 'foroUltimoUso';
  const MAXIMO_MENSAJES = 200;
  const DIAS_PARA_BORRAR = 30;   // cambia este número si quieres otro plazo
  const MS_POR_DIA = 24 * 60 * 60 * 1000;

  // ---------- ¿Puede este navegador guardar datos? ----------
  function puedeGuardar() {
    try {
      localStorage.setItem('__prueba', '1');
      localStorage.removeItem('__prueba');
      return true;
    } catch (e) {
      return false;
    }
  }

  function avisar(texto) {
    let aviso = $('avisoForo');
    if (!aviso) {
      aviso = document.createElement('p');
      aviso.id = 'avisoForo';
      aviso.className = 'aviso-foro';
      historialForo.parentNode.insertBefore(aviso, historialForo);
    }
    aviso.textContent = texto;
  }

  const guardadoDisponible = puedeGuardar();
  if (!guardadoDisponible) {
    avisar('⚠️ Este navegador no deja guardar el historial (modo incógnito, bloqueo de datos o página abierta de forma restringida). Los mensajes se perderán al recargar.');
  }

  // ---------- Leer y guardar ----------
  function leer(clave) {
    try {
      return JSON.parse(localStorage.getItem(clave));
    } catch (e) {
      return null;
    }
  }

  function guardar(clave, valor) {
    try {
      localStorage.setItem(clave, JSON.stringify(valor));
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------- Caducidad: se borra si pasan 30 días sin usar la página ----------
  function borrarSiCaduco() {
    const ultimoUso = Number(leer(CLAVE_ULTIMO_USO)) || null;
    if (ultimoUso && Date.now() - ultimoUso > DIAS_PARA_BORRAR * MS_POR_DIA) {
      try { localStorage.removeItem(CLAVE_HISTORIAL); } catch (e) {}
    }
    guardar(CLAVE_ULTIMO_USO, Date.now());   // abrir o escribir reinicia el plazo
  }

  // ---------- Tarjetas ----------
  function escaparHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Solo acepta colores tipo #aabbcc
  function colorSeguro(valor) {
    return /^#[0-9a-fA-F]{6}$/.test(valor) ? valor : '#ff6b81';
  }

  function crearTarjeta(mensaje) {
    const color = colorSeguro(mensaje.color);
    const tarjeta = document.createElement('div');
    tarjeta.classList.add('publicacion-tarjeta');
    tarjeta.innerHTML = `
      <h4 style="color:${color}">❓ ${escaparHTML(mensaje.nombre)}:</h4>
      <p style="color:${color}">${escaparHTML(mensaje.texto)}</p>
    `;
    return tarjeta;
  }

  // ---------- 1) Al abrir: mostrar el historial guardado (lo más nuevo arriba) ----------
  borrarSiCaduco();

  let historial = leer(CLAVE_HISTORIAL);
  if (!Array.isArray(historial)) historial = [];

  for (let i = historial.length - 1; i >= 0; i--) {
    historialForo.appendChild(crearTarjeta(historial[i]));
  }

  // ---------- 2) Perfil (nombre + color) ----------
  function mostrarPerfil(perfil) {
    if (!inputNombre || !inputColor) return;
    inputNombre.value = perfil.nombre;
    inputColor.value = perfil.color;
    if (perfilNombre) {
      perfilNombre.textContent = perfil.nombre;
      perfilNombre.style.color = perfil.color;
    }
    if (datosUsuario) datosUsuario.hidden = true;
    if (perfilGuardado) perfilGuardado.hidden = false;
  }

  const perfilInicial = leer(CLAVE_PERFIL);
  if (perfilInicial && perfilInicial.nombre) mostrarPerfil(perfilInicial);

  if (botonCambiar) {
    botonCambiar.addEventListener('click', () => {
      if (datosUsuario) datosUsuario.hidden = false;
      if (perfilGuardado) perfilGuardado.hidden = true;
      if (inputNombre) inputNombre.focus();
    });
  }

  // ---------- 3) Enviar mensaje ----------
  formulario.addEventListener('submit', (event) => {
    event.preventDefault();

    const texto = inputPregunta.value.trim();
    const nombre = inputNombre ? inputNombre.value.trim() : 'Anónimo';
    const color = inputColor ? inputColor.value : '#ff6b81';

    if (texto === '' || nombre === '') return;

    guardar(CLAVE_PERFIL, { nombre, color });
    mostrarPerfil({ nombre, color });

    const mensaje = { nombre, color, texto };
    historial.push(mensaje);
    if (historial.length > MAXIMO_MENSAJES) historial.shift();

    if (guardar(CLAVE_HISTORIAL, historial)) {
      guardar(CLAVE_ULTIMO_USO, Date.now());
    } else {
      avisar('⚠️ No se pudo guardar este mensaje en el navegador. Se perderá al recargar.');
    }

    historialForo.insertBefore(crearTarjeta(mensaje), historialForo.firstChild);
    inputPregunta.value = '';
  });
});