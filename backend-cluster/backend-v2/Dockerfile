 FROM node:22-alpine

 # Set working directory
 WORKDIR /app

 # Install system dependencies including Yarn
 RUN apk add --no-cache git yarn

 # Copy package files
 COPY package.json yarn.lock* ./

 # Install dependencies (generate lockfile if needed)
 # Note: Peer dependency warnings for @as-integrations/koa are expected and non-blocking
 # promptfoo (devDependency, used only by manual `yarn eval:*`) pulls in
 # Playwright, which otherwise downloads ~650MB of browser binaries that this
 # container never runs.
 ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
 # Clean the yarn download cache in the same layer -- otherwise it's baked into
 # the image permanently (was ~9.3GB of the ~20GB image; real node_modules is ~3GB).
 RUN yarn install && yarn cache clean

 # Copy source code
 COPY . .

 # Expose port
 EXPOSE 4104

 # Set environment variables
 ENV NODE_ENV=production
 ENV PORT=4104

 # Start the application
 CMD ["yarn", "start"]

