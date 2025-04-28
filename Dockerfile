FROM node:20.14.0-alpine

WORKDIR /app

# Install dependencies first
COPY package*.json ./
RUN npm install

# Install additional dependencies
RUN npm install swagger-ui-express swagger-jsdoc cors @types/swagger-ui-express @types/swagger-jsdoc @types/cors

# Copy Prisma schema
COPY prisma ./prisma/

# Generate Prisma Client
RUN npx prisma generate

# Copy the rest of the application
COPY . .

# Generate Prisma Client again to ensure it's up to date
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "dev"] 