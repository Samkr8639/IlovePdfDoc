FROM node:20-bookworm-slim

# Install LibreOffice Writer, Tesseract OCR with Indic and English language packs, and metric-compatible fonts
RUN apt-get update && apt-get install -y --no-install-recommends \
    libreoffice-writer \
    tesseract-ocr \
    tesseract-ocr-eng \
    tesseract-ocr-hin \
    tesseract-ocr-mar \
    tesseract-ocr-tam \
    tesseract-ocr-tel \
    tesseract-ocr-ben \
    tesseract-ocr-guj \
    tesseract-ocr-kan \
    tesseract-ocr-mal \
    tesseract-ocr-pan \
    tesseract-ocr-urd \
    tesseract-ocr-osd \
    fonts-crosextra-carlito \
    fonts-crosextra-caladea \
    fonts-liberation2 \
    fonts-dejavu-core \
    fonts-noto-core \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    && fc-cache -f \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV SOFFICE_PATH=/usr/bin/soffice

COPY package*.json ./
COPY packages/contracts/package*.json ./packages/contracts/
COPY apps/api/package*.json ./apps/api/

RUN npm ci --omit=dev

COPY packages/contracts ./packages/contracts
COPY apps/api ./apps/api

RUN npm run build --prefix packages/contracts
RUN npm run build --prefix apps/api

EXPOSE 4000

USER node

CMD ["node", "apps/api/dist/server.js"]
