# Imagen base oficial de Node
FROM node:20-slim

# Instalar dependencias necesarias para yt-dlp y ffmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    ca-certificates \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Descargar e instalar yt-dlp
# Usamos la última versión estable directamente de GitHub
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Creamos directorio de trabajo
WORKDIR /app

# Copiamos archivos y dependencias
COPY package*.json ./
RUN npm install --omit=dev

# Copiamos el resto de los archivos de la aplicación
COPY . .

# Exponemos el puerto
EXPOSE 3000

# Comando de inicio
CMD ["node", "index.js"]