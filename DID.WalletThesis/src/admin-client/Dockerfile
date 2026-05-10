# Stage 1 — build Angular app
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npx ng build --configuration production

# Stage 2 — serve with nginx
FROM nginx:1.27-alpine AS final

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/admin-client/browser /usr/share/nginx/html

EXPOSE 80
