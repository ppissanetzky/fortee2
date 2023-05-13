FROM node:18.16-slim

# This is where the application lives
WORKDIR /home/node/app

# Make the directory for the site
RUN mkdir ./site
COPY site/dist/ ./site/

# Copy package files into the container
COPY server/package.json server/package-lock.json ./

# This will cause npm to only install production packages
ENV NODE_ENV production

# Turn of the stupid npm update notification
RUN npm config set update-notifier false

# Now, install node modules inside the container
RUN npm ci

# Copy the server code
COPY server/dist/ ./

# Copy the SQL scripts
RUN mkdir ./database
COPY server/database/ ./database/

# The version - get it from build args and pass it in as an env variable
ARG FT2_VERSION
ENV FT2_VERSION=${FT2_VERSION}

# Command to start the server
CMD ["node", "server.js"]
