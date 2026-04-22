# ZOMAR - Infraestrutura de Confiança para Entregas

Sistema de entregas conectando empreendedores a entregadores verificados.

## Funcionalidades Implementadas (MVP)

### Autenticação
- ✅ Registro de usuário com email e senha
- ✅ Login com email e senha
- ✅ Seleção de papel (Empreendedor ou Entregador)
- ✅ Gerenciamento de sessão

### Dashboard do Empreendedor
- ✅ **Visão Geral**: Estatísticas e resumo das entregas
- ✅ **Nova Entrega**: Criação de entregas protegidas (requer plano ativo)
- ✅ **Entregas Ativas**: Acompanhamento em tempo real
- ✅ **Histórico**: Placeholder para histórico de entregas
- ✅ **Proteção RIZOMA**: Gestão de assinatura e planos

### Sistema de Planos
- ✅ Plano Básico (R$ 79,90): 10 entregas/mês, cobertura até R$ 1.000
- ✅ Plano Profissional (R$ 199,90): 50 entregas/mês, cobertura até R$ 5.000
- ✅ Ativação de planos (simulada)
- ✅ Monitoramento de uso

### Banco de Dados (Supabase)
- ✅ Perfis de usuários com papéis (entrepreneur/deliveryman)
- ✅ Sistema de planos e assinaturas
- ✅ Entregas com códigos únicos
- ✅ Checkpoints de entrega
- ✅ Sistema de avaliações
- ✅ Registro de problemas
- ✅ Row Level Security (RLS) completo

## Setup do Projeto

### 1. Pré-requisitos
- Node.js 18+ instalado
- Conta no Supabase

### 2. Configuração do Supabase

1. Crie um novo projeto no [Supabase](https://supabase.com)

2. O schema do banco de dados já foi criado automaticamente via migração

3. Obtenha suas credenciais:
   - URL do projeto
   - Anon key (chave pública)

### 3. Configuração do Ambiente

1. Copie o arquivo de exemplo:
```bash
cp .env.example .env
```

2. Edite o arquivo `.env` com suas credenciais do Supabase:
```
VITE_SUPABASE_URL=sua-url-do-supabase
VITE_SUPABASE_ANON_KEY=sua-anon-key-do-supabase
```

### 4. Instalação e Execução

```bash
# Instalar dependências
npm install

# Executar em modo de desenvolvimento
npm run dev

# Build para produção
npm run build
```

## Estrutura do Banco de Dados

### Tabelas Principais

1. **profiles**: Perfis de usuários com papéis
   - Campos: id, user_id, role, name, company, trust_score, etc.

2. **plans**: Planos de assinatura disponíveis
   - Plano Básico e Plano Profissional pré-configurados

3. **subscriptions**: Assinaturas ativas dos empreendedores
   - Controle de uso mensal de entregas

4. **deliveries**: Entregas criadas no sistema
   - Estados: created, accepted, in_progress, completed, problem

5. **delivery_checkpoints**: Pontos de controle da entrega
   - Rastreamento detalhado do progresso

6. **delivery_ratings**: Avaliações de entregas concluídas
   - Escala de 1 a 5 estrelas

7. **delivery_problems**: Problemas reportados
   - Estados: open, investigating, resolved

## Fluxo de Uso

### Para Empreendedores

1. **Registro**: Criar conta com email e senha
2. **Seleção de Papel**: Escolher "Empreendedor"
3. **Ativar Plano**: Selecionar e ativar um plano de proteção
4. **Criar Entrega**: Preencher dados da entrega (origem, destino, valor, etc.)
5. **Acompanhar**: Ver status em tempo real nas entregas ativas
6. **Avaliar**: Após conclusão, avaliar o entregador

### Para Entregadores

1. **Registro**: Criar conta com email e senha
2. **Seleção de Papel**: Escolher "Entregador"
3. **Ver Disponíveis**: Listar entregas disponíveis
4. **Aceitar**: Aceitar uma entrega
5. **Executar**: Seguir checkpoints (coleta → em trânsito → entrega)
6. **Concluir**: Marcar como concluída

## Segurança

- Autenticação via Supabase Auth
- Row Level Security (RLS) em todas as tabelas
- Validação de ownership em todas as operações
- Políticas restritivas por tipo de usuário

## Tecnologias Utilizadas

- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Backend/Database**: Supabase (PostgreSQL)
- **Autenticação**: Supabase Auth
- **Icons**: Lucide React

## Próximos Passos (Pós-MVP)

- [ ] Dashboard completo do entregador
- [ ] Sistema de checkpoints com geolocalização
- [ ] Chat em tempo real entre empreendedor e entregador
- [ ] Sistema de pagamento integrado (Stripe)
- [ ] Notificações push
- [ ] Relatórios avançados
- [ ] Sistema de verificação de entregadores
- [ ] App mobile (React Native)

## Suporte

Para dúvidas ou problemas, consulte a documentação do Supabase ou abra uma issue.
