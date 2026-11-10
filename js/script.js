document.addEventListener('DOMContentLoaded', () => {
  const formulario = document.getElementById('formularioForo');
  const historialForo = document.getElementById('historialForo');
  if (!formulario || !historialForo) return;

  const inputNombre = document.getElementById('nombre');
  const inputColor = document.getElementById('color');
  const inputPregunta = document.getElementById('pregunta');
  const datosUsuario = document.getElementById('datosUsuario');
  const perfilGuardado = document.getElementById('perfilGuardado');
  const perfilNombre = document.getElementById('perfilNombre');
  const botonCambiar = document.getElementById('cambiarPerfil');

  const CLAVE_PERFIL = 'foroPerfil';
  const CLAVE_HISTORIAL = 'foroHistorial';
  const CLAVE_ULTIMO_USO = 'foroUltimoUso';
  const MAXIMO_MENSAJES = 200;
  const DIAS_PARA_BORRAR = 30;   // cambia este número si quieres otro plazo
  const MS_POR_DIA = 24 * 60 * 60 * 1000;

  // ---------- Perfil (nombre + color) ----------
  function leerPerfil() {
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE_PERFIL));
      if (guardado && guardado.nombre) return guardado;
    } catch (e) {}
    return null;
  }

  function guardarPerfil(perfil) {
    try {
      localStorage.setItem(CLAVE_PERFIL, JSON.stringify(perfil));
    } catch (e) {}
  }

  function mostrarPerfil(perfil) {
    inputNombre.value = perfil.nombre;
    inputColor.value = perfil.color;
    perfilNombre.textContent = perfil.nombre;
    perfilNombre.style.color = perfil.color;
    datosUsuario.hidden = true;
    perfilGuardado.hidden = false;
  }

  const perfilInicial = leerPerfil();
  if (perfilInicial) mostrarPerfil(perfilInicial);

  botonCambiar.addEventListener('click', () => {
    datosUsuario.hidden = false;
    perfilGuardado.hidden = true;
    inputNombre.focus();
  });

  // ---------- Caducidad: se borra si pasan 30 días sin usar la página ----------
  function leerUltimoUso() {
    try {
      const valor = Number(localStorage.getItem(CLAVE_ULTIMO_USO));
      return valor > 0 ? valor : null;
    } catch (e) {
      return null;
    }
  }

  function marcarUso() {
    try {
      localStorage.setItem(CLAVE_ULTIMO_USO, String(Date.now()));
    } catch (e) {}
  }

  function borrarSiCaduco() {
    const ultimoUso = leerUltimoUso();
    if (ultimoUso && Date.now() - ultimoUso > DIAS_PARA_BORRAR * MS_POR_DIA) {
      try {
        localStorage.removeItem(CLAVE_HISTORIAL);
      } catch (e) {}
    }
    marcarUso();   // abrir la página cuenta como "usarla": el plazo empieza de nuevo
  }

  borrarSiCaduco();

  // ---------- Historial (se guarda en este navegador) ----------
  function leerHistorial() {
    try {
      const lista = JSON.parse(localStorage.getItem(CLAVE_HISTORIAL));
      if (Array.isArray(lista)) return lista;
    } catch (e) {}
    return [];
  }

  function guardarHistorial(lista) {
    try {
      localStorage.setItem(CLAVE_HISTORIAL, JSON.stringify(lista));
    } catch (e) {}
  }

  function crearTarjeta(mensaje) {
    const tarjeta = document.createElement('div');
    tarjeta.classList.add('publicacion-tarjeta');
    tarjeta.innerHTML = `
      <h4 style="color:${escaparColor(mensaje.color)}">❓ ${escaparHTML(mensaje.nombre)}:</h4>
      <p style="color:${escaparColor(mensaje.color)}">${escaparHTML(mensaje.texto)}</p>
    `;
    return tarjeta;
  }

  // Al abrir la página: muestra todo lo guardado (lo más nuevo arriba)
  const historial = leerHistorial();
  for (let i = historial.length - 1; i >= 0; i--) {
    historialForo.appendChild(crearTarjeta(historial[i]));
  }

  // ---------- Enviar mensaje ----------
  formulario.addEventListener('submit', (event) => {
    event.preventDefault();

    const texto = inputPregunta.value.trim();
    const nombre = inputNombre.value.trim();
    const color = inputColor.value;

    if (texto === '' || nombre === '') return;

    guardarPerfil({ nombre, color });
    mostrarPerfil({ nombre, color });

    const mensaje = { nombre, color, texto };
    historial.push(mensaje);
    if (historial.length > MAXIMO_MENSAJES) historial.shift();
    guardarHistorial(historial);
    marcarUso();

    historialForo.insertBefore(crearTarjeta(mensaje), historialForo.firstChild);
    inputPregunta.value = '';
  });

  // ---------- Seguridad: evita que el texto rompa la página ----------
  function escaparHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Solo acepta colores tipo #aabbcc
  function escaparColor(valor) {
    return /^#[0-9a-fA-F]{6}$/.test(valor) ? valor : '#ff6b81';
  }
});