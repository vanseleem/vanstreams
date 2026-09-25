FROM node:20-alpine

WORKDIR /app

# Copy package files first (for better caching)
COPY package*.json ./

# Install ALL dependencies from package.json
RUN npm install

# Copy application code
COPY index.js ./

ENV PORT=7860
EXPOSE 7860

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s \
  CMD wget -qO- http://localhost:7860/manifest.json | grep -q '"id"' || exit 1

CMD ["node", "index.js"]