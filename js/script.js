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

  const CLAVE = 'foroPerfil';

  // --- Guardar y leer el perfil (nombre + color) en este navegador ---
  function leerPerfil() {
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE));
      if (guardado && guardado.nombre) return guardado;
    } catch (e) {}
    return null;
  }

  function guardarPerfil(perfil) {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(perfil));
    } catch (e) {}
  }

  // Si ya hay perfil: rellena los campos y los esconde
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

  // Botón "Cambiar": vuelve a mostrar nombre y color
  botonCambiar.addEventListener('click', () => {
    datosUsuario.hidden = false;
    perfilGuardado.hidden = true;
    inputNombre.focus();
  });

  // --- Enviar mensaje ---
  formulario.addEventListener('submit', (event) => {
    event.preventDefault();

    const texto = inputPregunta.value.trim();
    const nombre = inputNombre.value.trim();
    const color = inputColor.value;

    if (texto === '' || nombre === '') return;

    guardarPerfil({ nombre, color });
    mostrarPerfil({ nombre, color });

    const nuevaPublicacion = document.createElement('div');
    nuevaPublicacion.classList.add('publicacion-tarjeta');

    nuevaPublicacion.innerHTML = `
      <h4 style="color:${color}">🤗 ${escaparHTML(nombre)}:</h4>
      <p style="color:${color}">${escaparHTML(texto)}</p>
    `;

    historialForo.insertBefore(nuevaPublicacion, historialForo.firstChild);
    inputPregunta.value = '';
  });

  function escaparHTML(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
});