# Atualização Automática de Incidents na Timeline

## ✅ Implementado

Quando um admin edita um incident em https://status.piercloud.com/area/incidents, as seguintes atualizações acontecem **AUTOMATICAMENTE**:

### 1. Mudanças que Aparecem Imediatamente

#### Título, Descrição e Severity
- ✅ Qualquer mudança no **título** é refletida instantaneamente
- ✅ Qualquer mudança na **descrição** é refletida instantaneamente
- ✅ Qualquer mudança na **severity** (critical, major, minor) é refletida instantaneamente

#### Status
- ✅ Mudança de status cria **automaticamente** um update na timeline
- ✅ O update aparece na página de histórico
- ✅ Notificação é enviada ao Slack

### 2. Updates Automáticos por Status

Quando o admin muda o status, um update é criado automaticamente com a seguinte mensagem:

| Status Novo | Mensagem Automática |
|-------------|---------------------|
| **Investigating** | "We are investigating this issue." |
| **Identified** | "The issue has been identified and a fix is being implemented." |
| **Monitoring** | "The issue has been fixed and we are monitoring the results." |
| **Resolved** | "This incident has been resolved." |

### 3. Exemplo de Fluxo

#### Passo 1: Admin cria incident
```
Status: investigating
```
**Timeline mostra:**
```
Investigating - [descrição inicial]
Mar 20, 10:00 UTC
```

#### Passo 2: Admin muda status para "identified"
```
Status: investigating → identified
```
**Timeline mostra:**
```
Identified - The issue has been identified and a fix is being implemented.
Mar 20, 11:21 UTC

Investigating - [descrição inicial]
Mar 20, 10:00 UTC
```

#### Passo 3: Admin adiciona update manual (opcional)
```
POST /api/admin/incidents/{id}/updates
{
  "message": "We are continuing to work on a fix for this issue.",
  "status": "update"
}
```
**Timeline mostra:**
```
Update - We are continuing to work on a fix for this issue.
Mar 20, 15:30 UTC

Identified - The issue has been identified and a fix is being implemented.
Mar 20, 11:21 UTC

Investigating - [descrição inicial]
Mar 20, 10:00 UTC
```

#### Passo 4: Admin muda status para "resolved"
```
Status: identified → resolved
```
**Timeline mostra:**
```
Resolved - This incident has been resolved.
Mar 21, 08:45 UTC

Update - We are continuing to work on a fix for this issue.
Mar 20, 15:30 UTC

Identified - The issue has been identified and a fix is being implemented.
Mar 20, 11:21 UTC

Investigating - [descrição inicial]
Mar 20, 10:00 UTC
```

### 4. Campos Especiais

#### resolved_at
- ✅ Quando o status muda para "resolved", o campo `resolved_at` é automaticamente preenchido
- ✅ Este timestamp é usado para ordenar incidents resolvidos

#### updated_at
- ✅ Sempre atualizado quando qualquer campo do incident é modificado
- ✅ Usado para rastrear a última modificação

### 5. Visibilidade

#### is_visible
- ✅ Controla se o incident aparece na página pública
- ✅ Pode ser alterado via toggle no backoffice
- ✅ Incidents não visíveis não aparecem em `/history`

### 6. Notificações

Quando o status muda:
- ✅ Notificação enviada ao Slack automaticamente
- ✅ Mensagem inclui o novo status e a mensagem do update

## Resumo

**SIM!** Todas as mudanças feitas no backoffice aparecem automaticamente na página de histórico:

1. ✅ Título e descrição → Atualização imediata
2. ✅ Severity → Atualização imediata  
3. ✅ Status → Cria update automático na timeline
4. ✅ Visibilidade → Controla se aparece na página pública

**Não é necessário fazer nada manualmente!** O sistema cuida de tudo automaticamente.

## Para Adicionar Updates Personalizados

Se o admin quiser adicionar updates personalizados (além dos automáticos), pode usar:

1. **Via API** (já implementado):
   ```bash
   POST /api/admin/incidents/{id}/updates
   {
     "message": "Mensagem personalizada aqui",
     "status": "update"
   }
   ```

2. **Via Backoffice** (precisa implementar UI):
   - Botão "Add Update" em cada incident
   - Modal para escrever mensagem personalizada
   - Escolher status do update

## Testando

1. Acesse https://status.piercloud.com/area/incidents
2. Edite um incident existente
3. Mude o status de "investigating" para "identified"
4. Salve
5. Acesse https://status.piercloud.com/history
6. Veja o novo update aparecer na timeline automaticamente!
