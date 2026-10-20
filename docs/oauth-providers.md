# Connexion OAuth — Google, Facebook, Apple, Microsoft

OuestBourse accepte l’email et le mot de passe, et en plus les comptes
existants des fournisseurs ci-dessous. Chaque fournisseur n’apparaît sur
**Connexion** et **Créer un compte** (`Continuer avec …`) que si ses
variables d’environnement sont renseignées. Sans elles, les boutons sont
masqués et le reste de l’authentification ne change pas.

Aucune migration Prisma nouvelle n’accompagne ce changement. La table
`accounts` (modèle `Account`) est déjà créée par
`prisma/migrations/20260809190955_init`. Si cette migration est déjà
appliquée sur Supabase, **il n’y a rien à migrer**. Si la table `accounts`
n’existe pas encore :

```bash
npx prisma migrate deploy
```

## Comportement des comptes

- Première connexion OAuth : un utilisateur est créé. `emailVerified` est
  posé seulement si le fournisseur confirme l’adresse.
- Même email qu’un compte email + mot de passe : le fournisseur est lié à
  **cet** utilisateur (portefeuille, alertes, rôle conservés) **uniquement**
  si le fournisseur confirme l’email. Sinon la connexion est refusée
  (`Ce fournisseur n'a pas confirmé votre adresse email…`). Cela évite
  qu’un fournisseur qui n’a pas vérifié l’adresse prenne le compte.
- Facebook sans email (compte créé avec un numéro) : message
  `Ce compte ne fournit pas d'adresse email. Avec Facebook…`. Aucun
  utilisateur n’est créé.
- Les admins restent ceux dont `User.role` vaut `ADMIN`, ou dont l’email
  figure dans `ADMIN_EMAILS` (comparaison insensible à la casse).

`NEXTAUTH_URL` et `NEXTAUTH_SECRET` doivent déjà être définis. NextAuth v4
construit l’URL de callback à partir de `NEXTAUTH_URL`, pas du domaine
affiché dans la barre d’adresse. Enregistrez **les deux** domaines chez
chaque fournisseur, puis choisissez le domaine canonique :

```bash
NEXTAUTH_URL="https://ouestbourse-trading.app"
# ou, si la session doit rester sur le domaine Vercel :
# NEXTAUTH_URL="https://brwm-app.vercel.app"
```

Après la redirection du fournisseur, le cookie de session est posé sur
l’hôte de `NEXTAUTH_URL`. Les deux URLs de callback restent enregistrées
pour pouvoir changer de domaine canonique sans recréer l’application OAuth.

Développement local : `NEXTAUTH_URL="http://localhost:3000"`.

## URLs de callback à enregistrer

Remplacez `{origine}` par chacune de ces origines :

| Origine | Usage |
|---|---|
| `https://brwm-app.vercel.app` | Déploiement Vercel |
| `https://ouestbourse-trading.app` | Domaine du produit |
| `http://localhost:3000` | Développement |

| Fournisseur | Chemin (identique pour chaque origine) |
|---|---|
| Google | `/api/auth/callback/google` |
| Facebook | `/api/auth/callback/facebook` |
| Apple | `/api/auth/callback/apple` |
| Microsoft | `/api/auth/callback/azure-ad` |

Exemples exacts pour la production :

```text
https://brwm-app.vercel.app/api/auth/callback/google
https://ouestbourse-trading.app/api/auth/callback/google
https://brwm-app.vercel.app/api/auth/callback/facebook
https://ouestbourse-trading.app/api/auth/callback/facebook
https://brwm-app.vercel.app/api/auth/callback/apple
https://ouestbourse-trading.app/api/auth/callback/apple
https://brwm-app.vercel.app/api/auth/callback/azure-ad
https://ouestbourse-trading.app/api/auth/callback/azure-ad
```

Et en local :

```text
http://localhost:3000/api/auth/callback/google
http://localhost:3000/api/auth/callback/facebook
http://localhost:3000/api/auth/callback/apple
http://localhost:3000/api/auth/callback/azure-ad
```

Pas de barre oblique finale. Le schéma (`https` / `http`) fait partie de
l’URL : Google et Meta refusent une URL qui ne correspond pas caractère
pour caractère.

## Variables Vercel

Projet `brwm-app` → **Settings → Environment Variables**. Renseigner
**Production** (et Preview si les aperçus doivent proposer les boutons).
Les secrets ne se commitent pas. Après enregistrement, **redéployer** :
une fonction déjà chaude ne relit pas toujours les nouvelles variables.

| Variable | Fournisseur | Obligatoire pour afficher le bouton |
|---|---|---|
| `GOOGLE_CLIENT_ID` | Google | oui, avec le secret |
| `GOOGLE_CLIENT_SECRET` | Google | oui |
| `FACEBOOK_CLIENT_ID` | Meta | oui, avec le secret |
| `FACEBOOK_CLIENT_SECRET` | Meta | oui |
| `APPLE_CLIENT_ID` | Apple (Services ID) | oui, avec les 3 autres |
| `APPLE_TEAM_ID` | Apple | oui |
| `APPLE_KEY_ID` | Apple | oui |
| `APPLE_PRIVATE_KEY` | Apple, contenu PEM du fichier `.p8` | oui |
| `AZURE_AD_CLIENT_ID` | Microsoft | oui, avec le secret |
| `AZURE_AD_CLIENT_SECRET` | Microsoft | oui |
| `AZURE_AD_TENANT_ID` | Microsoft | non, défaut `common` |

Alias lus si les noms `AZURE_AD_*` sont absents : `MICROSOFT_CLIENT_ID`,
`MICROSOFT_CLIENT_SECRET`, `MICROSOFT_TENANT_ID`.

`NEXTAUTH_URL` et `NEXTAUTH_SECRET` restent requis (voir `.env.example`).

## Google (Gmail)

1. Ouvrir [Google Cloud Console](https://console.cloud.google.com/) et
   créer ou choisir un projet, par exemple `OuestBourse`.
2. **APIs & Services → OAuth consent screen** (ou **Google Auth platform →
   Audience / Branding** selon la console).
   - Type d’utilisateurs : **External**.
   - Nom de l’application : `OuestBourse`.
   - Email d’assistance et email développeur : une adresse que vous lisez.
   - Domaine autorisé : `ouestbourse-trading.app` (un domaine dont vous
     pouvez prouver la propriété). Google n’accepte pas `vercel.app` comme
     domaine autorisé de l’écran de consentement.
   - Scopes : laisser `openid`, `email` et `profile` (non sensibles). Ne pas
     ajouter d’autres scopes.
3. Tant que l’application est en **Testing**, seuls les utilisateurs de test
   (max. 100) peuvent se connecter. Pour ouvrir à tout le monde :
   **Publier l’application** (production). Ces trois scopes ne demandent en
   général pas de validation supplémentaire ; Google peut afficher un écran
   « application non vérifiée » tant que la validation de marque n’est pas
   faite.
4. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Type : **Web application**.
   - Nom : `OuestBourse Web`.
   - **Authorized JavaScript origins** :
     - `https://brwm-app.vercel.app`
     - `https://ouestbourse-trading.app`
     - `http://localhost:3000`
   - **Authorized redirect URIs** : les trois URLs `…/api/auth/callback/google`
     listées plus haut.
5. Si la console refuse `https://brwm-app.vercel.app/api/auth/callback/google`
   parce que `vercel.app` n’est pas un domaine autorisé, n’enregistrez que
   le callback `https://ouestbourse-trading.app/api/auth/callback/google`
   (plus localhost) et fixez `NEXTAUTH_URL` sur
   `https://ouestbourse-trading.app`. Le domaine Vercel continue de servir
   le site ; la session OAuth sera émise sur le domaine canonique.
6. Copier **Client ID** → `GOOGLE_CLIENT_ID` et **Client secret** →
   `GOOGLE_CLIENT_SECRET`.

## Facebook (Meta)

1. Ouvrir [Meta for Developers](https://developers.facebook.com/apps/creation/).
2. Cas d’usage : **Authenticate and request data from users with Facebook
   Login** (Facebook Login). Nom de l’application : `OuestBourse`.
3. **Facebook Login → Settings** (Paramètres) :
   - **Valid OAuth Redirect URIs** : les URLs `…/api/auth/callback/facebook`
     de production et, si vous testez en local, celle de localhost.
   - **Client OAuth login** : Oui.
   - **Web OAuth login** : Oui.
   - **Enforce HTTPS** : Oui (localhost en http reste accepté par Meta pour
     le développement).
4. **App settings → Basic** :
   - **App ID** → `FACEBOOK_CLIENT_ID`.
   - **App secret** (Show) → `FACEBOOK_CLIENT_SECRET`.
   - **Privacy Policy URL** :
     `https://ouestbourse-trading.app/mentions-legales`
     (ou `https://brwm-app.vercel.app/mentions-legales`).
   - **App domains** : `ouestbourse-trading.app` et `brvm-app.vercel.app`.
5. Permissions utilisées : `email` et `public_profile` (demandées par
   l’application, pas à cocher côté visiteur au-delà de l’écran Facebook).
6. En mode **Development**, seuls les rôles de l’app (administrateurs,
   développeurs, testeurs) peuvent se connecter. Ajoutez les testeurs dans
   **App roles**.
7. Pour tout le monde : basculer l’app en **Live**. Si Meta exige un accès
   avancé pour `email` : **App Review → Permissions and Features → email →
   Request advanced access**. En attendant, l’accès standard suffit pour les
   rôles de l’app.
8. Un compte Facebook sans email confirmé ne transmet pas d’adresse.
   OuestBourse affiche alors le message français prévu et ne crée pas de
   compte.

## Apple (facultatif)

Compte [Apple Developer](https://developer.apple.com/account) (programme
payant) requis. Le secret client n’est pas collé tel quel : OuestBourse
signe un JWT à partir de la clé `.p8` à chaque démarrage d’instance (durée
150 jours, sous le maximum de 6 mois imposé par Apple).

1. **Certificates, Identifiers & Profiles → Identifiers → Services IDs**.
   Créer un identifiant, par exemple `app.ouestbourse.web`. C’est
   `APPLE_CLIENT_ID`.
2. Activer **Sign in with Apple → Configure**.
   - Domaines : `ouestbourse-trading.app` et `brvm-app.vercel.app`.
   - **Return URLs** : les URLs `…/api/auth/callback/apple` des deux domaines.
   - Apple demande un fichier de vérification de domaine ; suivez l’assistant
     (téléchargement du fichier, dépôt sur le domaine, puis vérification).
3. **Keys → +**, cocher **Sign in with Apple**, enregistrer, télécharger le
   fichier `.p8` (une seule fois). Le **Key ID** est `APPLE_KEY_ID`.
4. **Membership** : le **Team ID** est `APPLE_TEAM_ID`.
5. Ouvrir le `.p8` dans un éditeur. Coller tout le PEM, en-têtes
   `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` compris, dans
   `APPLE_PRIVATE_KEY`. Sur Vercel, les retours à la ligne peuvent être de
   vrais sauts de ligne ou la séquence `\n`. Ne jamais committer ce fichier.

Apple n’envoie le nom qu’à la première autorisation, dans un champ que le
flux standard ne conserve pas. Le nom reste modifiable dans le profil
OuestBourse. L’email (réel ou relais privé `privaterelay.appleid.com`) est
vérifié par Apple.

## Microsoft (facultatif)

1. [Inscriptions d’applications Entra](https://entra.microsoft.com/)
   (portail Azure → **Microsoft Entra ID → App registrations → New
   registration**).
2. Nom : `OuestBourse`.
3. Types de comptes pris en charge : **Accounts in any organizational
   directory and personal Microsoft accounts**. C’est ce qui correspond au
   locataire `common` (comptes Outlook, Hotmail, Live et comptes
   professionnels).
4. URI de redirection : **Web**, puis une URL
   `…/api/auth/callback/azure-ad`. Ajoutez les autres origines ensuite
   dans **Authentication → Redirect URIs**.
5. **Certificates & secrets → New client secret**. Copier la **Value** (pas
   le Secret ID) → `AZURE_AD_CLIENT_SECRET`. Elle expire : notez la date et
   renouvelez-la avant.
6. **Overview → Application (client) ID** → `AZURE_AD_CLIENT_ID`.
7. `AZURE_AD_TENANT_ID` = `common` (ou omettre la variable).
8. **Token configuration → Add optional claim → ID → email**, si le jeton
   ne contient pas déjà `email`. Enregistrer l’API Microsoft Graph si
   l’assistant le propose (`openid`, `profile`, `email` délégués).

Sans claim `email` confirmé, un compte Microsoft dont l’adresse existe déjà
en email + mot de passe n’est **pas** lié (message de protection). Une
première inscription reste possible ; l’email n’est marqué vérifié que si
Microsoft confirme l’adresse (`email`, `email_verified` ou `xms_edov`).

## Vérifier

1. Redéployer après avoir enregistré les variables.
2. Ouvrir `/connexion` et `/inscription` : les boutons des fournisseurs
   configurés sont visibles, les autres non.
3. Créer un compte avec Google (ou Facebook) : arrivée sur `/portefeuille`,
   email indiqué confirmé dans le profil.
4. Avec un compte email + mot de passe déjà créé sur la **même** adresse
   confirmée : le bouton du fournisseur ouvre le même utilisateur (le
   portefeuille déjà saisi est toujours là).
5. Facebook sans email : le message français s’affiche sur `/connexion`,
   aucun nouveau compte.
