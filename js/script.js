document.addEventListener('DOMContentLoaded', () => {
  const formulario = document.getElementById('formularioForo');
  const historialForo = document.getElementById('historialForo');

  formulario.addEventListener('submit', (event) => {
    event.preventDefault();

    const inputPregunta = document.getElementById('pregunta').value.trim();
    const inputRespuesta = document.getElementById('respuesta').value.trim();

    if (inputPregunta === '' || inputRespuesta === '') return;

    const nuevaPublicacion = document.createElement('div');
    nuevaPublicacion.classList.add('publicacion-tarjeta');

    nuevaPublicacion.innerHTML = `
      <h4>❓ Pregunta: ${escaparHTML(inputPregunta)}</h4>
      <p><strong>💡 Respuesta:</strong> ${escaparHTML(inputRespuesta)}</p>
    `;

    historialForo.insertBefore(nuevaPublicacion, historialForo.firstChild);
    formulario.reset();
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
