document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('download-form');
    const urlInput = document.getElementById('url-input');
    const submitButton = document.getElementById('submit-button');
    const statusMessage = document.getElementById('status-message');
    const downloadLinkContainer = document.getElementById('download-link-container');
    const progressBarContainer = document.createElement('div');
    progressBarContainer.style.width = '100%';
    progressBarContainer.style.backgroundColor = '#ddd';
    const progressBar = document.createElement('div');
    progressBar.style.width = '0%';
    progressBar.style.height = '20px';
    progressBar.style.backgroundColor = '#4CAF50';
    progressBar.style.textAlign = 'center';
    progressBar.style.lineHeight = '20px';
    progressBar.style.color = 'white';
    progressBarContainer.appendChild(progressBar);
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onopen = () => {
        console.log('Connected to WebSocket server');
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        switch (message.type) {
            case 'progress':
                progressBar.style.width = `${message.progress}%`;
                progressBar.textContent = `${message.progress}%`;
                statusMessage.textContent = 'Descargando...';
                break;
            case 'completed':
                submitButton.disabled = false;
                statusMessage.textContent = '¡Video listo para descargar!';
                const downloadLink = document.createElement('a');
                downloadLink.href = message.downloadUrl;
                downloadLink.textContent = 'Descargar Archivo';
                downloadLink.setAttribute('download', '');
                downloadLinkContainer.innerHTML = '';
                downloadLinkContainer.appendChild(downloadLink);
                progressBar.style.width = '0%';
                progressBar.textContent = '';
                progressBarContainer.remove();
                break;
            case 'error':
                showError(message.message);
                submitButton.disabled = false;
                progressBar.style.width = '0%';
                progressBar.textContent = '';
                progressBarContainer.remove();
                break;
        }
    };

    ws.onclose = () => {
        console.log('Disconnected from WebSocket server');
    };

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const url = urlInput.value.trim();
        if (!url) {
            showError('Por favor, introduce una URL.');
            return;
        }

        // Deshabilitar botón y mostrar estado
        submitButton.disabled = true;
        statusMessage.textContent = 'Iniciando descarga...';
        statusMessage.className = '';
        downloadLinkContainer.innerHTML = '';
        
        form.parentNode.insertBefore(progressBarContainer, form.nextSibling);
        progressBar.style.width = '0%';
        progressBar.textContent = '0%';

        ws.send(JSON.stringify({ type: 'download', url }));
    });

    function showError(message) {
        statusMessage.textContent = message;
        statusMessage.className = 'error';
    }
});
