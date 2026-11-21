/*
 * PROXY REVERSO (DEP-01.2)
 *
 * Em produção a API fica atrás de um proxy HTTPS (Caddy). Sem esta
 * configuração, o Express enxerga o IP do proxy em todas as requisições
 * e o limite de tentativas (login e solicitação de cadastro) passaria a
 * ser compartilhado por todos os usuários.
 *
 * TRUST_PROXY:
 * - ausente, vazio, "false" ou "0": não confia em proxy (padrão local/CI);
 * - número inteiro de 1 a 10: quantidade de proxies confiáveis à frente
 *   da API. No deploy AWS há exatamente um (Caddy), portanto "1".
 *
 * "true" não é aceito de propósito: confiar em qualquer cabeçalho
 * X-Forwarded-For permitiria que um cliente escolhesse o próprio IP
 * e escapasse do limite de tentativas.
 */

const MAX_PROXY_HOPS =
    10;


function getTrustProxySetting(
    value = process.env.TRUST_PROXY
) {
    if (
        value === undefined ||
        value === null
    ) {
        return false;
    }


    const normalized =
        String(value)
            .trim()
            .toLowerCase();


    if (
        normalized === "" ||
        normalized === "false" ||
        normalized === "0"
    ) {
        return false;
    }


    if (
        /^[0-9]+$/.test(
            normalized
        )
    ) {
        const hops =
            Number(
                normalized
            );

        if (
            hops >= 1 &&
            hops <= MAX_PROXY_HOPS
        ) {
            return hops;
        }
    }


    throw new Error(
        "TRUST_PROXY deve ser false ou o número de proxies à frente da API (1 a 10)."
    );
}


module.exports = {
    getTrustProxySetting,
};
