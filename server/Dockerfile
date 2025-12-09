# Use the official lightweight Node.js 18 image.
FROM node:18-slim

# Create and change to the app directory.
WORKDIR /usr/src/app

# Copy application dependency manifests to the container image.
COPY package*.json ./

# Install production dependencies.
# If you have native dependencies, you'll need extra tools using 'apt-get install' here.
RUN npm install --only=production

# Copy local code to the container image.
COPY . .

# Run the web service on container startup.
# Using 'npm start' or 'node index.js'
CMD [ "node", "index.js" ]
