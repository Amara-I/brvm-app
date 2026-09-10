// ── Content-Security-Policy — étape 9 (checklist de conformité) ────────────
// Point de départ raisonnable, PAS une politique durcie au maximum :
//   - `script-src 'unsafe-inline' 'unsafe-eval'` reste nécessaire pour le
//     moment (React dev overlay, Recharts qui injecte des styles/scripts
//     inline pour ses SVG). À remplacer par une politique à base de nonces
//     dès que le rendu réel du dashboard aura été validé face à une CSP
//     stricte (cf. COMPLIANCE_CHECKLIST.md — non fait ici pour ne pas risquer
//     de casser silencieusement les graphiques Recharts sans navigateur pour
//     vérifier visuellement dans cet environnement).
//   - `frame-ancestors 'none'` interdit l'inclusion de l'app dans une
//     `<iframe>` tierce (protection clickjacking, redondante avec
//     `X-Frame-Options` ci-dessous mais recommandée par les deux en parallèle
//     pour compatibilité navigateurs).
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // HSTS : n'a d'effet que servi en HTTPS (Vercel le fait automatiquement en
  // production) ; inoffensif en dev HTTP (le navigateur l'ignore alors).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
  async redirects() {
    // Termes déplacés vers « Indicateurs avancés (peu adaptés) »
    const advanced = [
      "ichimoku-kinko-hyo",
      "retracement-de-fibonacci",
      "theorie-des-vagues-d-elliott",
    ];
    return advanced.map((slug) => ({
      source: `/education/technique/${slug}`,
      destination: `/education/technique-avancee/${slug}`,
      permanent: true,
    }));
  },
};

export default nextConfig;
