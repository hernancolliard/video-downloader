document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('download-form');
    const urlInput = document.getElementById('url-input');
    const submitButton = document.getElementById('submit-button');
    const statusMessage = document.getElementById('status-message');
    const downloadLinkContainer = document.getElementById('download-link-container');

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const url = urlInput.value.trim();
        if (!url) {
            showError('Por favor, introduce una URL.');
            return;
        }

        // Deshabilitar botón y mostrar estado
        submitButton.disabled = true;
        statusMessage.textContent = 'Iniciando descarga... Esto puede tardar varios minutos.';
        statusMessage.className = '';
        downloadLinkContainer.innerHTML = '';

        try {
            const response = await fetch('/download', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ url }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Error desconocido en el servidor.' }));
                throw new Error(errorData.error || `Error del servidor: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.success) {
                statusMessage.textContent = '¡Video listo para descargar!';
                const downloadLink = document.createElement('a');
                downloadLink.href = data.downloadUrl;
                downloadLink.textContent = 'Descargar Archivo';
                downloadLink.setAttribute('download', ''); // Opcional: para forzar la descarga
                downloadLinkContainer.appendChild(downloadLink);
            } else {
                showError(data.error);
            }

        } catch (error) {
            console.error('Error en el script del cliente:', error);
            showError(error.message || 'No se pudo conectar con el servidor.');
        } finally {
            // Habilitar el botón de nuevo
            submitButton.disabled = false;
        }
    });

    function showError(message) {
        statusMessage.textContent = message;
        statusMessage.className = 'error';
    }
});
