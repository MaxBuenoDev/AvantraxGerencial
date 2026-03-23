# Supabase (Inventário + Embarcados)

Este projeto salva e carrega os 2 arquivos (`inventario_de_patio.xlsx` e `embarcados.xlsx`) no Supabase usando:

- 1 bucket do Supabase Storage: `avantrax-files`
- 2 tabelas (metadados): `public.inventario_uploads` e `public.embarcados_uploads`

## 1) Criar tabelas + bucket + policies

No Supabase Dashboard → **SQL Editor**, execute o script:

- `supabase/schema.sql`

> Observação: o script cria policies **públicas** (anon) para leitura/insert nas tabelas e no bucket.  
> Se o seu app ficar público na internet, ajuste a segurança (Auth/RLS) antes.

## 2) Configurar variáveis no projeto

Crie um `.env.local` (já está no `.gitignore`) baseado em `.env.example`:

- `VITE_SUPABASE_URL=...`
- `VITE_SUPABASE_ANON_KEY=...`

## 3) Como funciona no app

- Ao clicar em **INICIAR DASHBOARD**, os arquivos são:
  1) lidos no navegador (para renderizar),
  2) enviados para o Supabase Storage,
  3) e o metadado do upload é salvo na tabela correspondente.
- Ao abrir a página, se houver upload salvo no Supabase, o dashboard tenta **baixar e abrir automaticamente** os últimos arquivos.

