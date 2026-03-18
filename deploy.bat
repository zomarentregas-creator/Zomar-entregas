@echo off
REM ============================================================
REM  ZOMAR — Commit completo de todas as alterações desta sessão
REM  Executa na raiz do projeto: C:\Coding\ZOMAR\project
REM ============================================================

REM 1. Moeda MZN + responsividade mobile + Gmail + overflow fix

REM src/index.css — overflow-x global fix
copy /Y "Overview.tsx"           "src\components\entrepreneur\Overview.tsx"
copy /Y "DeliveryHistory.tsx"    "src\components\entrepreneur\DeliveryHistory.tsx"
copy /Y "SupportButton.tsx"      "src\components\shared\SupportButton.tsx"
copy /Y "EntrepreneurLayout.tsx" "src\components\EntrepreneurLayout.tsx"
copy /Y "DelivererLayout.tsx"    "src\components\DelivererLayout.tsx"
copy /Y "index.css"              "src\index.css"

REM Adicionar tudo ao git
git add src/index.css
git add src/components/entrepreneur/Overview.tsx
git add src/components/entrepreneur/DeliveryHistory.tsx
git add src/components/shared/SupportButton.tsx
git add src/components/EntrepreneurLayout.tsx
git add src/components/DelivererLayout.tsx

git commit -m "fix: MZN currency, mobile responsiveness, Gmail support, overflow-x fix

- Overview.tsx: replace BRL with MZN (Intl.NumberFormat pt-MZ), mobile-first grid (2col mobile / 4col desktop)
- DeliveryHistory.tsx: MZN formatting, horizontal filter scroll on mobile, compact stats cards
- SupportButton.tsx: new shared component extracted from layouts, Email now opens Gmail compose instead of mailto
- EntrepreneurLayout.tsx: import SupportButton, overflow-x-hidden, will-change-transform on sidebar, min-w-0 on main wrapper
- DelivererLayout.tsx: same fixes as EntrepreneurLayout
- index.css: html/body/#root overflow-x hidden + max-width 100vw to eliminate horizontal scroll"

git push

echo.
echo Commit concluido com sucesso!
pause