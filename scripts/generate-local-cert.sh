#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CERT_DIR="$ROOT_DIR/certs"
KEY_FILE="$CERT_DIR/localhost-key.pem"
CERT_FILE="$CERT_DIR/localhost-cert.pem"
CONFIG_FILE="$CERT_DIR/localhost.cnf"

mkdir -p "$CERT_DIR"

cat > "$CONFIG_FILE" <<'EOF'
[req]
default_bits = 2048
prompt = no
default_md = sha256
x509_extensions = v3_req
distinguished_name = dn

[dn]
C = ZA
ST = Gauteng
L = Local
O = TCG Index
OU = Local Dev
CN = localhost

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = localhost
IP.1 = 127.0.0.1
IP.2 = ::1
EOF

openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout "$KEY_FILE" \
  -out "$CERT_FILE" \
  -days 3650 \
  -config "$CONFIG_FILE"

echo "Generated local HTTPS certificate:"
echo "  Key:  $KEY_FILE"
echo "  Cert: $CERT_FILE"
