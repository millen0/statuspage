#!/bin/bash
# Script de Instalação do Sistema Automático de Tracking de Downtime

set -e

echo "🚀 Instalando Sistema Automático de Tracking de Downtime"
echo "=========================================================="
echo ""

# 1. Criar tabela de downtimes
echo "📊 Criando tabela service_downtimes..."
python3 auto-track-downtime.py --setup

# 2. Popular histórico do dia 15/02/2025 (se necessário)
echo ""
echo "📅 Deseja popular o histórico do dia 15/02/2025? (s/n)"
read -r response
if [[ "$response" =~ ^([sS][iI][mM]|[sS])$ ]]; then
    echo "⏳ Populando histórico..."
    python3 populate-downtime-from-alerts.py --populate
    echo "✅ Histórico populado!"
fi

# 3. Backup do monitor atual
echo ""
echo "💾 Fazendo backup do monitor atual..."
if [ -f "monitor.py" ]; then
    cp monitor.py monitor.py.backup.$(date +%Y%m%d_%H%M%S)
    echo "✅ Backup criado"
fi

# 4. Ativar novo monitor
echo ""
echo "🔄 Ativando monitor com tracking automático..."
echo "Escolha uma opção:"
echo "1) Substituir monitor.py (recomendado)"
echo "2) Criar link simbólico"
echo "3) Manter monitor atual (apenas testar)"
read -r option

case $option in
    1)
        cp monitor-with-tracking.py monitor.py
        echo "✅ Monitor substituído"
        ;;
    2)
        ln -sf monitor-with-tracking.py monitor.py
        echo "✅ Link simbólico criado"
        ;;
    3)
        echo "ℹ️  Monitor atual mantido"
        ;;
    *)
        echo "❌ Opção inválida"
        exit 1
        ;;
esac

# 5. Testar sistema
echo ""
echo "🧪 Testando sistema..."
python3 auto-track-downtime.py --status

# 6. Verificar cron
echo ""
echo "⏰ Verificando configuração do cron..."
if crontab -l | grep -q "monitor.py"; then
    echo "✅ Cron já configurado"
else
    echo "⚠️  Cron não encontrado. Configure com:"
    echo "   crontab -e"
    echo "   Adicione: * * * * * cd $(pwd) && python3 monitor.py >> monitor.log 2>&1"
fi

echo ""
echo "=========================================================="
echo "✨ Instalação concluída!"
echo ""
echo "📖 Próximos passos:"
echo "   1. Aguarde o próximo ciclo do monitor (1 minuto)"
echo "   2. Verifique logs: tail -f monitor.log"
echo "   3. Veja downtimes: python3 auto-track-downtime.py --status"
echo "   4. Acesse: https://status.piercloud.com/"
echo ""
echo "📚 Documentação completa: AUTO_DOWNTIME_TRACKING.md"
echo "=========================================================="
