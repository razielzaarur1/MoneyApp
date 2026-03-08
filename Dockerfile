FROM node:22-bookworm

# התקנת דפדפן לסקרייפר
RUN apt-get update && apt-get install -y chromium fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf --no-install-recommends && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true

WORKDIR /app

# יצירת התיקיות מראש והענקת הרשאות למשתמש node (Non-root)
RUN mkdir -p /app/data /app/secrets && chown -R node:node /app

# שלב א': התקנת השרת - העתקה למשתמש הרגיל ולא ל-Root
COPY --chown=node:node package*.json ./
RUN npm install

# שלב ב': בניית האתר (Frontend)
COPY --chown=node:node frontend/package*.json ./frontend/
RUN cd frontend && npm install
COPY --chown=node:node frontend/ ./frontend/
RUN cd frontend && npm run build

# שלב ג': העתקת שאר קבצי השרת
COPY --chown=node:node . .

# מעבר למשתמש הלא-מועדף להגברת אבטחה
USER node

EXPOSE 3001
CMD ["npm", "start"]