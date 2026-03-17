#!/bin/bash
# Execute este comando na EC2

cd /opt/statuspage && \
git pull origin master && \
echo "" && \
echo "========================================" && \
echo "✅ Código atualizado!" && \
echo "========================================" && \
echo "" && \
echo "Arquivos novos:" && \
ls -la update-group-uptime.py deploy-lighthouse-grouping.sh 2>/dev/null && \
echo "" && \
echo "Executando deploy..." && \
echo "" && \
bash deploy-lighthouse-grouping.sh
