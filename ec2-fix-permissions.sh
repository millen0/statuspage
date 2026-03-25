#!/bin/bash

echo "Corrigindo permissões..."
sudo chown -R ubuntu:ubuntu /opt/statuspage

echo "Limpando builds antigos..."
rm -rf /opt/statuspage/frontend/public-page/dist
rm -rf /opt/statuspage/frontend/backoffice/dist

echo "✅ Pronto! Agora execute o deploy novamente"
