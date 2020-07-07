from node
workdir /usr/src/app
copy package*.json ./
run npm install
copy . .
cmd ["node", "bin/www"]
