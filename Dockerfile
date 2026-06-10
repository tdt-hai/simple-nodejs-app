FROM node:18-alpine

WORKDIR /usr/src/app

COPY package*.json package-lock.json ./

RUN npm install --production --registry=https://registry.npmjs.org/

# Copy toàn bộ mã nguồn vào container
COPY . .

# Port mặc định ứng dụng sẽ chạy
EXPOSE 8080

# Lệnh khởi chạy ứng dụng
CMD ["npm", "start"]
