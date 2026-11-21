#!/usr/bin/env bash
# Corporate Chat — DEP-01.3 | Verificação de segurança do servidor publicado
#
# No servidor (verificação completa):
#   sudo bash deploy/scripts/verificar-seguranca.sh
#
# De qualquer computador com bash (Git Bash no Windows), só a parte externa:
#   bash deploy/scripts/verificar-seguranca.sh --externo 15-228-10-20.sslip.io
#
# Resultado: PASS / AVISO / FALHA por item. Termina com código 1 se houver FALHA.

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROJECT="${CORPORATE_CHAT_PROJECT:-corporate-chat-deploy}"
ENV_FILE="${ROOT}/deploy/.env"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/corporate-chat}"

pass=0; warn=0; failc=0
ok()   { printf '  PASS   %s\n' "$*"; pass=$((pass + 1)); }
aviso(){ printf '  AVISO  %s\n' "$*"; warn=$((warn + 1)); }
falha(){ printf '  FALHA  %s\n' "$*"; failc=$((failc + 1)); }
secao(){ printf '\n== %s\n' "$*"; }
check(){ local desc="$1"; shift; if "$@" >/dev/null 2>&1; then ok "${desc}"; else falha "${desc}"; fi; }

externo=""
if [[ "${1:-}" == "--externo" ]]; then
    externo="${2:-}"
    [[ -n "${externo}" ]] || { echo "Informe o domínio: --externo <dominio>" >&2; exit 2; }
fi

env_value() { grep -E "^$1=" "${ENV_FILE}" 2>/dev/null | tail -n 1 | cut -d= -f2- | tr -d '"'"'"; }

# Porta TCP aberta? (sem nmap; usa /dev/tcp do bash)
port_open() { timeout 4 bash -c "exec 3<>/dev/tcp/$1/$2" 2>/dev/null; }

verificar_https() {
    local domain="$1"

    secao "HTTPS e cabeçalhos (${domain})"
    local headers
    headers="$(curl -sS -D - -o /dev/null --max-time 10 "https://${domain}/" 2>/dev/null | tr -d '\r')"
    if [[ -z "${headers}" ]]; then
        falha "https://${domain}/ não respondeu"
        return
    fi
    ok "https://${domain}/ responde com certificado válido"

    local health
    health="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "https://${domain}/api/v1/health")"
    [[ "${health}" == "200" ]] && ok "API /api/v1/health = 200" || falha "API /api/v1/health = ${health}"

    local redirect
    redirect="$(curl -s -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 10 "http://${domain}/")"
    [[ "${redirect}" =~ ^30[178]\ https:// ]] && ok "HTTP redireciona para HTTPS (${redirect%% *})" || falha "HTTP não redireciona para HTTPS (${redirect})"

    for header in strict-transport-security content-security-policy x-frame-options x-content-type-options referrer-policy; do
        grep -qi "^${header}:" <<< "${headers}" && ok "Cabeçalho ${header}" || falha "Cabeçalho ${header} ausente"
    done
    grep -qi '^server:' <<< "${headers}" && aviso "Cabeçalho Server exposto" || ok "Cabeçalho Server oculto"

    if command -v openssl >/dev/null 2>&1; then
        local end days
        end="$(echo | openssl s_client -servername "${domain}" -connect "${domain}:443" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
        if [[ -n "${end}" ]]; then
            days=$(( ( $(date -d "${end}" +%s) - $(date +%s) ) / 86400 ))
            (( days >= 14 )) && ok "Certificado válido por mais ${days} dias" || aviso "Certificado expira em ${days} dias (o Caddy renova sozinho; confira os logs do proxy)"
        fi
    fi

    secao "Portas vistas de fora (${domain})"
    for p in 80 443; do port_open "${domain}" "${p}" && ok "Porta ${p} aberta (esperado)" || falha "Porta ${p} fechada"; done
    for p in 3000 3101 5432 27017; do port_open "${domain}" "${p}" && falha "Porta ${p} ACESSÍVEL de fora" || ok "Porta ${p} fechada"; done
}

# ---------------------------------------------------------------
# Modo externo
# ---------------------------------------------------------------
if [[ -n "${externo}" ]]; then
    printf 'Corporate Chat — verificação externa de %s\n' "${externo}"
    verificar_https "${externo}"
    printf '\nResumo: %d PASS, %d AVISO, %d FALHA\n' "${pass}" "${warn}" "${failc}"
    (( failc == 0 ))
    exit $?
fi

# ---------------------------------------------------------------
# Modo servidor
# ---------------------------------------------------------------
[[ "${EUID}" -eq 0 ]] || { echo "Execute no servidor com sudo." >&2; exit 2; }
cd "${ROOT}"
COMPOSE=(docker compose -p "${PROJECT}" --env-file "${ENV_FILE}" -f docker-compose.deploy.yml -f docker-compose.aws.yml)
printf 'Corporate Chat — verificação de segurança do servidor (%s)\n' "$(hostname)"

secao "Acesso ao servidor"
sshd_conf="$(sshd -T 2>/dev/null)"
grep -q '^passwordauthentication no' <<< "${sshd_conf}" && ok "SSH sem senha (só chave)" || falha "SSH aceita senha"
grep -q '^permitrootlogin no' <<< "${sshd_conf}" && ok "SSH sem login de root" || falha "SSH permite root"
check "fail2ban protegendo o SSH" fail2ban-client status sshd

secao "Firewall local (ufw)"
ufw_status="$(ufw status 2>/dev/null)"
grep -q '^Status: active' <<< "${ufw_status}" && ok "ufw ativo" || falha "ufw inativo"
extra="$(grep -E 'ALLOW' <<< "${ufw_status}" | grep -vE '^(22|80|443)(/tcp|/udp)? ' | grep -vE '^(22|80|443)(/tcp|/udp)? \(v6\)' || true)"
[[ -z "${extra}" ]] && ok "ufw libera só 22, 80 e 443" || falha "ufw libera outras portas: $(tr '\n' ';' <<< "${extra}")"

secao "Portas em escuta"
listeners="$(ss -tlnH 2>/dev/null | awk '{print $4}')"
public_bad="$(grep -E '^(0\.0\.0\.0|\[::\]|\*):(3000|3101|5432|27017)$' <<< "${listeners}" || true)"
[[ -z "${public_bad}" ]] && ok "API e bancos não escutam em interface pública" || falha "Escutando publicamente: $(tr '\n' ' ' <<< "${public_bad}")"
grep -qE '^127\.0\.0\.1:3101$' <<< "${listeners}" && ok "API de manutenção só em 127.0.0.1:3101" || aviso "127.0.0.1:3101 não encontrado (API parada?)"

secao "Contêineres"
for service in postgres mongodb api proxy; do
    state="$("${COMPOSE[@]}" ps --format '{{.Service}} {{.State}} {{.Health}}' 2>/dev/null | awk -v s="${service}" '$1 == s {print $2, $3}')"
    case "${state}" in
        "running healthy"|"running ") ok "${service}: ${state% }" ;;
        "") falha "${service}: não encontrado" ;;
        *) falha "${service}: ${state}" ;;
    esac
done
for service in postgres mongodb; do
    published="$("${COMPOSE[@]}" port "${service}" 5432 2>/dev/null; "${COMPOSE[@]}" port "${service}" 27017 2>/dev/null)"
    [[ -z "${published}" ]] && ok "${service} sem porta publicada" || falha "${service} publicado em ${published}"
done

secao "Configuração e segredos"
if [[ -f "${ENV_FILE}" ]]; then
    [[ "$(stat -c '%a' "${ENV_FILE}")" == "600" ]] && ok "deploy/.env com permissão 600" || falha "deploy/.env com permissão $(stat -c '%a' "${ENV_FILE}") (use chmod 600)"
    grep -q 'SUBSTITUIR' "${ENV_FILE}" && falha "deploy/.env contém SUBSTITUIR_*" || ok "Sem valores de exemplo no deploy/.env"
    grep -qE '^DEV_SEED_PASSWORD=.+' "${ENV_FILE}" && falha "DEV_SEED_PASSWORD presente em produção" || ok "Sem senha de seed em produção"
    git -C "${ROOT}" ls-files --error-unmatch deploy/.env >/dev/null 2>&1 && falha "deploy/.env está versionado no git!" || ok "deploy/.env fora do git"
else
    falha "deploy/.env não encontrado"
fi
seed_users="$("${COMPOSE[@]}" exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -A -t -c "SELECT count(*) FROM users WHERE email LIKE '"'"'%@corporatechat.local'"'"'"' 2>/dev/null | tr -d '[:space:]')"
[[ "${seed_users}" == "0" ]] && ok "Nenhum usuário de desenvolvimento (@corporatechat.local)" || falha "Usuários de desenvolvimento encontrados: ${seed_users:-?}"
admins="$("${COMPOSE[@]}" exec -T postgres sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -X -A -t -c "SELECT count(*) FROM users WHERE is_admin AND status = '"'"'ACTIVE'"'"'"' 2>/dev/null | tr -d '[:space:]')"
[[ "${admins}" =~ ^[1-9][0-9]*$ ]] && ok "Administradores ativos: ${admins}" || falha "Nenhum administrador ativo"

secao "Atualizações e recursos"
grep -q 'Unattended-Upgrade "1"' /etc/apt/apt.conf.d/20auto-upgrades 2>/dev/null && ok "Atualizações automáticas de segurança ativas" || falha "Atualizações automáticas desativadas"
[[ -f /var/run/reboot-required ]] && aviso "Reinicialização pendente após atualização (sudo reboot fora do horário de uso)" || ok "Sem reinicialização pendente"
swapon --show 2>/dev/null | grep -q . && ok "Swap ativo" || aviso "Swap inativo"
disk="$(df --output=pcent / | tail -n 1 | tr -dc '0-9')"
(( disk < 80 )) && ok "Disco em ${disk}%" || aviso "Disco em ${disk}% (limpe imagens: docker image prune)"

secao "Backup"
latest="$(find "${BACKUP_DIR}" -maxdepth 1 -name "${PROJECT}-*.manifest.json" -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -n 1 | cut -d' ' -f2-)"
if [[ -n "${latest}" ]]; then
    age_h=$(( ( $(date +%s) - $(stat -c %Y "${latest}") ) / 3600 ))
    (( age_h <= 26 )) && ok "Último backup há ${age_h} h ($(basename "${latest}"))" || falha "Último backup há ${age_h} h"
    [[ "$(stat -c '%a' "${BACKUP_DIR}")" =~ ^7[0-5]0$ ]] && ok "Pasta de backup restrita ($(stat -c '%a' "${BACKUP_DIR}"))" || falha "Pasta de backup com permissão $(stat -c '%a' "${BACKUP_DIR}")"
else
    falha "Nenhum backup em ${BACKUP_DIR}"
fi
systemctl is-active --quiet corporate-chat-backup.timer && ok "Timer de backup diário ativo" || falha "Timer corporate-chat-backup inativo"

domain="$(env_value CHAT_DOMAIN)"
[[ -n "${domain}" ]] && verificar_https "${domain}" || falha "CHAT_DOMAIN não definido"

printf '\nResumo: %d PASS, %d AVISO, %d FALHA\n' "${pass}" "${warn}" "${failc}"
(( failc == 0 ))
