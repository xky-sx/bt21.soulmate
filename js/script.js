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
  // Reemplaza estas dos cadenas con los datos reales de tu proyecto (Settings -> API)
  const SUPABASE_URL = "https://TU_PROYECTO.supabase.co";
  const SUPABASE_ANON_KEY = "TU_API_KEY_ANONIMA";
  
  const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // --- 2) IDENTIFICADOR ANÓNIMO ÚNICO ---
  // Genera un identificador único para este navegador para saber qué mensajes le pertenecen
  function obtenerOEnviarIdAnonimo() {
    let idAnonimo = localStorage.getItem('foroUsuarioAnonimoId');
    if (!idAnonimo) {
      // Generador simple de UUID v4 en JavaScript
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
    
    // Si el mensaje fue escrito por este mismo dispositivo, le añadimos un distintivo visual (Opcional)
    const esMio = mensaje.usuario_anonimo_id === miIdAnonimo ? ' (Tú)' : '';

    tarjeta.innerHTML = `
      <h4 style="color:${color}">❓ ${escaparHTML(mensaje.nombre)}${esMio}:</h4>
      <p style="color:${color}">${escaparHTML(mensaje.texto)}</p>
    `;
    return tarjeta;
  }

  // --- 4) CARGAR MENSAJES DESDE SUPABASE ---
  async function cargarMensajes() {
    const { data: mensajes, error } = await supabase
      .from('mensajes')
      .select('*')
      .order('creado_en', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error al descargar mensajes:', error.message);
      return;
    }

    historialForo.innerHTML = ''; // Limpiar la interfaz
    mensajes.forEach(mensaje => {
      historialForo.appendChild(crearTarjeta(mensaje));
    });
  }

  // Descargar los mensajes al cargar la página por primera vez
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
    event.preventDefault();

    const texto = inputPregunta.value.trim();
    const nombre = inputNombre ? inputNombre.value.trim() : 'Anónimo';
    const color = inputColor ? inputColor.value : '#ff6b81';

    if (texto === '' || nombre === '') return;

    guardarLocal(CLAVE_PERFIL, { nombre, color });
    mostrarPerfil({ nombre, color });

    // Guardar en la base de datos de Supabase sin necesidad de Login
    const { error } = await supabase
      .from('mensajes')
      .insert([
        { 
          nombre: nombre, 
          color: color, 
          texto: texto,
          usuario_anonimo_id: miIdAnonimo // Vincula el mensaje a este navegador
        }
      ]);

    if (error) {
      alert('⚠️ Error al publicar tu mensaje en la nube: ' + error.message);
    } else {
      inputPregunta.value = '';
      cargarMensajes(); // Recargar el foro para ver el mensaje reflejado inmediatamente
    }
  });
});
