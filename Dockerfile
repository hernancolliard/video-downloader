# Imagen base oficial de Node
FROM node:20-slim

# Instalar dependencias necesarias
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    python3 \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Instalar yt-dlp
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp \
    && chmod a+rx /usr/local/bin/yt-dlp

# Directorio de trabajo
WORKDIR /app

# Instalar dependencias Node
COPY package*.json ./
RUN npm install --omit=dev

# Copiar el resto del proyecto
COPY . .

# Render usa PORT automáticamente
EXPOSE 3000

# ARRANQUE CORRECTO
CMD ["node", "server.js"]
