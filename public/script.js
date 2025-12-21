document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('download-form');
    const urlInput = document.getElementById('url-input');
    const cookieInput = document.getElementById('cookie-input');
    const submitButton = document.getElementById('submit-button');
    const statusMessage = document.getElementById('status-message');
    const downloadLinkContainer = document.getElementById('download-link-container');
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onopen = () => {
        console.log('Connected to WebSocket server');
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        switch (message.type) {
            case 'info':
                submitButton.disabled = false;
                statusMessage.textContent = '¡Tu enlace de descarga está listo!';
                const downloadLink = document.createElement('a');
                downloadLink.href = message.downloadUrl;
                // Sanitizar nombre de archivo
                const fileName = message.title.replace(/[^a-zA-Z0-9\._-]/g, '_') + '.' + message.ext;
                downloadLink.textContent = `Descargar ${fileName}`;
                downloadLink.setAttribute('download', fileName);
                downloadLinkContainer.innerHTML = '';
                downloadLinkContainer.appendChild(downloadLink);
                break;
            case 'error':
                showError(message.message);
                submitButton.disabled = false;
                break;
        }
    };

    ws.onclose = () => {
        console.log('Disconnected from WebSocket server');
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const url = urlInput.value.trim();
        const cookies = cookieInput.value.trim();
        const proxy = document.getElementById('proxy-input').value.trim();
        if (!url) {
            showError('Por favor, introduce una URL.');
            return;
        }

        // Deshabilitar botón y mostrar estado
        submitButton.disabled = true;
        statusMessage.textContent = 'Descargando...';
        statusMessage.className = '';
        downloadLinkContainer.innerHTML = '';

        const audioOnlyCheckbox = document.getElementById('audio-only-checkbox');
        const downloadType = audioOnlyCheckbox.checked ? 'audio' : 'video';

        ws.send(JSON.stringify({ type: 'download', url, cookies, proxy, downloadType }));
    });

    function showError(message) {
        statusMessage.textContent = message;
        statusMessage.className = 'error';
    }
});
