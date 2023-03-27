FROM node:16.10-slim

# This is where the application lives
WORKDIR /home/node/app

# Copy package files into the container
COPY server/package.json server/package-lock.json ./

# Now, install node modules inside the container
RUN npm ci

RUN mkdir ./site

# Copy the server code
COPY server/dist/ ./

# Copy the static site
COPY site/dist/ ./site

# Command to start the server
CMD ["node", "server.js"]
