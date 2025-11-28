#!/bin/bash
set -e

echo "Pulling latest code..."
git pull origin main

echo "Building React frontend..."
npm install
npm run build

echo "Updating Nginx static files..."
rm -rf /var/www/bitbeats/dist/*
cp -r dist/* /var/www/bitbeats/dist/

echo "Rebuilding and restarting backend container..."
docker compose up -d --build api

echo "Running Prisma migrations..."
docker compose exec api npx prisma migrate deploy

echo "Deployment Success!"
