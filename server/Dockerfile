FROM node:22-alpine
RUN apk add --no-cache python3 py3-pip && \
    pip3 install --break-system-packages reportlab
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev --prefer-offline
COPY . .
EXPOSE 3001
CMD ["node", "index.js"]
