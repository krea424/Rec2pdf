# Use official Node.js image as base
FROM node:20

# Install system dependencies
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ffmpeg \
        pandoc \
        texlive-latex-extra \
        python3 \
        python3-pip \
        git \
    && rm -rf /var/lib/apt/lists/*

# Install Whisper via pip
RUN pip3 install --no-cache-dir --break-system-packages openai-whisper

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy rest of the backend source
COPY . .

# Expose default port (optional depending on app)
EXPOSE 3000

# Set the default command
CMD ["npm", "start"]
