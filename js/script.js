document.addEventListener('DOMContentLoaded', () => {
  const $ = (id) => document.getElementById(id);

  const formulario = $('formularioForo');
  const historialForo = $('historialForo');
  const inputPregunta = $('pregunta');
  if (!formulario || !historialForo || !inputPregunta) return;

  const inputNombre = $('nombre');
  const inputColor = $('color');
  const datosUsuario = $('datosUsuario');
  const perfilGuardado = $('perfilGuardado');
  const perfilNombre = $('perfilNombre');
  const botonCambiar = $('cambiarPerfil');

  const CLAVE_PERFIL = 'foroPerfil';

  // --- 1) CONEXIÓN CON SUPABASE ---
  // Rellena esto con los datos reales de Settings -> API en Supabase
  const SUPABASE_URL = "https://TU_PROYECTO.supabase.co"; 
  const SUPABASE_ANON_KEY = "TU_API_KEY_ANONIMA_COMPLETA"; 

  // Inicialización correcta para la versión de script cargada en HTML
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // --- 2) IDENTIFICADOR ANÓNIMO ÚNICO ---
  function obtenerOEnviarIdAnonimo() {
    let idAnonimo = localStorage.getItem('foroUsuarioAnonimoId');
    if (!idAnonimo) {
      idAnonimo = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
      localStorage.setItem('foroUsuarioAnonimoId', idAnonimo);
    }
    return idAnonimo;
  }
  const miIdAnonimo = obtenerOEnviarIdAnonimo();

  // --- 3) FUNCIONES DE SEGURIDAD Y VISTA ---
  function escaparHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function colorSeguro(valor) {
    return /^#[0-9a-fA-F]{6}$/.test(valor) ? valor : '#ff6b81';
  }

  function crearTarjeta(mensaje) {
    const color = colorSeguro(mensaje.color);
    const tarjeta = document.createElement('div');
    tarjeta.classList.add('publicacion-tarjeta');
    
    const esMio = mensaje.usuario_anonimo_id === miIdAnonimo ? ' (Tú)' : '';

    tarjeta.innerHTML = `
      <h4 style="color:${color}">❓ ${escaparHTML(mensaje.nombre)}${esMio}:</h4>
      <p style="color:${color}">${escaparHTML(mensaje.texto)}</p>
    `;
    return tarjeta;
  }

  // --- 4) CARGAR MENSAJES DESDE SUPABASE ---
  async function cargarMensajes() {
    try {
      const { data: mensajes, error } = await supabase
        .from('mensajes')
        .select('*')
        .order('creado_en', { ascending: false });

      if (error) throw error;

      historialForo.innerHTML = ''; 
      if (mensajes) {
        mensajes.forEach(mensaje => {
          historialForo.appendChild(crearTarjeta(mensaje));
        });
      }
    } catch (err) {
      console.error('Error al descargar mensajes:', err.message);
    }
  }

  // Descargar los mensajes al abrir la web
  cargarMensajes();

  // --- 5) GESTIÓN DE PERFIL LOCAL ---
  function leerLocal(clave) {
    try { return JSON.parse(localStorage.getItem(clave)); } catch (e) { return null; }
  }
  function guardarLocal(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); } catch (e) {}
  }

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

  const perfilInicial = leerLocal(CLAVE_PERFIL);
  if (perfilInicial && perfilInicial.nombre) mostrarPerfil(perfilInicial);

  if (botonCambiar) {
    botonCambiar.addEventListener('click', () => {
      if (datosUsuario) datosUsuario.hidden = false;
      if (perfilGuardado) perfilGuardado.hidden = true;
      if (inputNombre) inputNombre.focus();
    });
  }

  // --- 6) ENVIAR NUEVO MENSAJE A SUPABASE ---
  formulario.addEventListener('submit', async (event) => {
    // Esto detiene el reinicio de la página pase lo que pase de forma inmediata
    event.preventDefault();

    const texto = inputPregunta.value.trim();
    const nombre = inputNombre ? inputNombre.value.trim() : 'Anónimo';
    const color = inputColor ? inputColor.value : '#ff6b81';

    if (texto === '' || nombre === '') return;

    guardarLocal(CLAVE_PERFIL, { nombre, color });
    mostrarPerfil({ nombre, color });

    try {
      const { error } = await supabase
        .from('mensajes')
        .insert([
          { 
            nombre: nombre, 
            color: color, 
            texto: texto,
            usuario_anonimo_id: miIdAnonimo 
          }
        ]);

      if (error) throw error;

      inputPregunta.value = '';
      cargarMensajes(); 
    } catch (err) {
      alert('⚠️ Error al publicar en la nube: ' + err.message);
    }
  });
});
