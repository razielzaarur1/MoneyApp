FROM node:22-bookworm

# התקנת דפדפן לסקרייפר
RUN apt-get update && apt-get install -y chromium fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf --no-install-recommends && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# שלב א': התקנת השרת
COPY package*.json ./
RUN npm install

# שלב ב': בניית האתר (Frontend)
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install
COPY frontend/ ./frontend/
RUN cd frontend && npm run build

# שלב ג': העתקת שאר קבצי השרת
COPY . .

EXPOSE 3001
CMD ["npm", "start"]