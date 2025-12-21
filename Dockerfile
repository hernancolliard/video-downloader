# Imagen base oficial de Node
FROM node:20-slim

# Instalamos ffmpeg
RUN apt-get update && apt-get install -y ffmpeg

# Creamos directorio de trabajo
WORKDIR /app

# Copiamos archivos y dependencias
COPY package*.json ./
RUN npm install

COPY . .

# Exponemos el puerto
EXPOSE 3000

# Comando de inicio
CMD ["node", "index.js"]
