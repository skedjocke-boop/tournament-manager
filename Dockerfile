# Använd en lättviktig version av Node.js
FROM node:20-alpine

# Sätt arbetskatalogen inuti containern
WORKDIR /app

# Kopiera beroenden och installera dem
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install

# Generera Prisma-klienten (Viktigt för SQLite)
RUN npx prisma generate

# Kopiera resten av koden
COPY . .

# Bygg Next.js-applikationen
RUN npm run build

# Exponera port 3000
EXPOSE 3000

# Startkommandot när containern vaknar
CMD ["npm", "run", "start"]
