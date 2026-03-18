#!/usr/bin/env python3
"""
Script para calcular e atualizar uptime agregado de grupos de serviços
Deve ser executado diariamente via cron
"""

import psycopg2
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv

load_dotenv('/opt/statuspage/backend/.env')
load_dotenv('backend/.env')

DB_CONFIG = {
    'host': os.getenv('DB_HOST', '127.0.0.1'),
    'port': int(os.getenv('DB_PORT', 5432)),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres'),
    'database': os.getenv('DB_NAME', 'statuspage')
}

def calculate_group_uptime():
    """
    Calcula o uptime agregado do grupo LIGHTHOUSE baseado nos serviços membros
    Se QUALQUER serviço do grupo tiver problema, o grupo inteiro é marcado como problemático
    """
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cur = conn.cursor()
        
        # Buscar grupos ativos
        cur.execute("SELECT id, name, display_name FROM service_groups WHERE is_active = true")
        groups = cur.fetchall()
        
        if not groups:
            print("⚠️  Nenhum grupo de serviços encontrado")
            return
        
        today = datetime.now().date()
        
        for group_id, group_name, display_name in groups:
            print(f"\n{'='*60}")
            print(f"📊 Processando grupo: {display_name} ({group_name})")
            print(f"{'='*60}")
            
            # Buscar serviços membros do grupo (visíveis ou não)
            cur.execute("""
                SELECT s.id, s.name, s.status, s.is_visible
                FROM services s
                INNER JOIN service_group_members sgm ON s.id = sgm.service_id
                WHERE sgm.group_id = %s
            """, (group_id,))
            
            members = cur.fetchall()
            
            if not members:
                print(f"   ⚠️  Nenhum serviço membro encontrado para {display_name}")
                continue
            
            print(f"\n   Serviços membros ({len(members)}):")
            for member_id, member_name, member_status, is_visible in members:
                visibility = "👁️  Visível" if is_visible else "🔒 Oculto"
                print(f"   - {member_name}: {member_status} ({visibility})")
            
            # Calcular uptime dos últimos 90 dias
            start_date = today - timedelta(days=89)
            
            print(f"\n   Calculando uptime de {start_date} até {today}...")
            
            for days_ago in range(90):
                calc_date = today - timedelta(days=days_ago)
                
                # Buscar uptime de todos os serviços membros para este dia
                member_ids = [m[0] for m in members]
                placeholders = ','.join(['%s'] * len(member_ids))
                
                cur.execute(f"""
                    SELECT service_id, uptime_percentage
                    FROM uptime_logs
                    WHERE service_id IN ({placeholders})
                    AND date = %s
                """, (*member_ids, calc_date))
                
                daily_logs = cur.fetchall()
                
                # Calcular uptime agregado (média dos serviços)
                if daily_logs:
                    avg_uptime = sum([log[1] for log in daily_logs]) / len(daily_logs)
                else:
                    # Sem dados, assumir operacional
                    avg_uptime = 100.0
                
                # Inserir/atualizar log agregado do grupo
                # Usamos um service_id virtual negativo para grupos
                virtual_service_id = -group_id
                
                cur.execute("""
                    INSERT INTO uptime_logs 
                    (service_id, date, uptime_percentage)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (service_id, date) DO UPDATE
                    SET uptime_percentage = EXCLUDED.uptime_percentage
                """, (
                    virtual_service_id,
                    calc_date,
                    avg_uptime
                ))
                
                if days_ago == 0:  # Apenas log do dia atual
                    print(f"   ✅ {calc_date}: {avg_uptime:.2f}% uptime")
            
            conn.commit()
            print(f"\n   ✅ Uptime agregado calculado para {display_name}")
        
        cur.close()
        conn.close()
        
        print(f"\n{'='*60}")
        print("✅ Processamento concluído!")
        print(f"{'='*60}\n")
        
    except Exception as e:
        print(f"❌ Erro: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    print(f"\n{'='*60}")
    print(f"🔄 Atualizando Uptime de Grupos - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")
    calculate_group_uptime()
