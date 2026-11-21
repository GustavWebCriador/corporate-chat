#!/usr/bin/env bash
# Corporate Chat — DEP-01.1 | Preparação do servidor (Ubuntu Server 24.04 LTS)
#
# Executado uma única vez pelo cloud-init na criação da instância EC2
# (ver deploy/aws/cloud-init.yaml). Também pode ser executado manualmente:
#
#   sudo bash deploy/aws/bootstrap-servidor.sh
#
# O script é idempotente: rodar de novo não duplica configurações.
# Ele NÃO instala a aplicação e NÃO contém segredos.

set -euo pipefail

APP_USER="${APP_USER:-ubuntu}"
APP_DIR="${APP_DIR:-/opt/corporate-chat}"
SWAP_SIZE_MB="${SWAP_SIZE_MB:-2048}"
MARKER="/var/lib/corporate-chat/bootstrap.done"

log() { printf '[DEP-01.1] %s\n' "$*"; }

if [[ "${EUID}" -ne 0 ]]; then
    echo "Execute como root (sudo)." >&2
    exit 1
fi

export DEBIAN_FRONTEND=noninteractive

# Espera o apt ser liberado (as atualizações automáticas rodam no primeiro boot)
# e mantém os arquivos de configuração atuais em caso de conflito.
APT=(apt-get -y -o DPkg::Lock::Timeout=600 -o Dpkg::Options::=--force-confold)

# ---------------------------------------------------------------
# 1. Pacotes básicos e atualizações automáticas de segurança
# ---------------------------------------------------------------
log "Atualizando pacotes..."
"${APT[@]}" update
"${APT[@]}" upgrade
"${APT[@]}" install ca-certificates curl git jq ufw fail2ban python3-systemd unattended-upgrades

cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

# ---------------------------------------------------------------
# 2. Memória de troca (swap)
#    A t4g.small tem 2 GB; o build do frontend e o MongoDB
#    precisam de folga para não serem encerrados por falta de memória.
# ---------------------------------------------------------------
if ! swapon --show | grep -q '/swapfile'; then
    log "Criando swap de ${SWAP_SIZE_MB} MB..."
    fallocate -l "${SWAP_SIZE_MB}M" /swapfile || dd if=/dev/zero of=/swapfile bs=1M count="${SWAP_SIZE_MB}"
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
fi
grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab

cat > /etc/sysctl.d/99-corporate-chat.conf <<'EOF'
vm.swappiness = 10
EOF
sysctl --system >/dev/null

# ---------------------------------------------------------------
# 3. SSH somente com chave, sem login de root
#    O prefixo 10- garante precedência: o sshd usa o primeiro valor lido.
# ---------------------------------------------------------------
log "Endurecendo o SSH..."
cat > /etc/ssh/sshd_config.d/10-corporate-chat.conf <<'EOF'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin no
MaxAuthTries 3
X11Forwarding no
EOF
mkdir -p /run/sshd
sshd -t
# No 24.04 o SSH é ativado por socket: cada nova conexão já lê a configuração.
systemctl try-reload-or-restart ssh.service || true

cat > /etc/fail2ban/jail.d/corporate-chat.local <<'EOF'
[sshd]
enabled  = true
backend  = systemd
maxretry = 5
findtime = 10m
bantime  = 1h
EOF
systemctl enable --now fail2ban
systemctl restart fail2ban

# ---------------------------------------------------------------
# 4. Firewall local (o Security Group da AWS é a primeira barreira)
# ---------------------------------------------------------------
log "Configurando o firewall local (ufw)..."
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP (certificado e redirecionamento)'
ufw allow 443/tcp comment 'HTTPS'
ufw allow 443/udp comment 'HTTP/3'
ufw --force enable

# ---------------------------------------------------------------
# 5. Docker Engine + Compose (repositório oficial)
# ---------------------------------------------------------------
if ! command -v docker >/dev/null 2>&1; then
    log "Instalando Docker..."
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    chmod a+r /etc/apt/keyrings/docker.asc
    # shellcheck disable=SC1091
    codename="$(. /etc/os-release && echo "${VERSION_CODENAME}")"
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu ${codename} stable" \
        > /etc/apt/sources.list.d/docker.list
    "${APT[@]}" update
    "${APT[@]}" install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
fi

mkdir -p /etc/docker
cat > /etc/docker/daemon.json <<'EOF'
{
  "log-driver": "local",
  "log-opts": { "max-size": "10m", "max-file": "3" },
  "live-restore": true
}
EOF
systemctl enable docker
systemctl restart docker

if id "${APP_USER}" >/dev/null 2>&1; then
    usermod -aG docker "${APP_USER}"
fi

# ---------------------------------------------------------------
# 6. Diretório da aplicação e dos backups
# ---------------------------------------------------------------
mkdir -p "${APP_DIR}" /var/backups/corporate-chat
if id "${APP_USER}" >/dev/null 2>&1; then
    chown "${APP_USER}:${APP_USER}" "${APP_DIR}"
    chown "${APP_USER}:${APP_USER}" /var/backups/corporate-chat
fi
chmod 750 /var/backups/corporate-chat

mkdir -p "$(dirname "${MARKER}")"
date -u +%Y-%m-%dT%H:%M:%SZ > "${MARKER}"

log "Servidor preparado. Docker: $(docker --version)"
log "Próximo passo: docs/deploy/DEP-01-2-PUBLICACAO.md"
