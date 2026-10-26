# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Nature du dépôt

Tily est un terminal Windows organisé en **workspaces → onglets → panes** (splits imbriqués). Le dépôt contient les spécifications (`docs/specifications-terminal.md`) et **l'application** : hôte C# .NET 10 (WinUI 3, une WebView2 pour l'interface et une par pane navigateur) dans `src/`, interface React + TypeScript + Vite + Tailwind + Zustand dans `web/`, tests xUnit dans `tests/`, installeur Inno Setup dans `installer/`.

Tily (de *mitily*, « guetter » en malgache) s'appelait Dock jusqu'au 30 septembre 2026 : l'historique Git, les issues GitHub et les releases antérieures emploient encore ce nom.

Le backlog vit uniquement dans les issues GitHub de `MaximeRazafinjato/tily`. Les maquettes, le POC et le spike de la pile (commit `b1c6484`), ainsi que les anciens scripts de génération du backlog et du HTML des spécifications (commit `3fe18a5`), restent consultables dans l'historique Git. Toute évolution de l'application suit `docs/BACKEND_ARCHITECTURE.md`, `docs/FRONTEND_ARCHITECTURE.md` et `docs/TESTING.md`.

Tout le contenu est rédigé en **français**.

## Commandes

Application (racine du dépôt) :

```bash
dotnet build Tily.slnx                 # construit Core, Host (avec pnpm build du web si dist absent), Mcp et les tests
dotnet test Tily.slnx                  # tests xUnit, dont certains lancent un vrai Windows PowerShell 5.1
dotnet run --project src/Tily.Host     # lance Tily ; TILY_WEB_DEV_URL=http://localhost:5173 pour le serveur Vite
cd web && pnpm dev | pnpm build | pnpm lint
```

Toujours lancer `pnpm lint`, `pnpm build` (qui exécute `tsc -b`) et `dotnet test` avant de committer.

`TILY_DATA_DIR` remplace le dossier de données `%LOCALAPPDATA%\Tily` (session, préférences, états d'agents, profil WebView2) : l'utiliser pour lancer une instance isolée sans toucher à la session de l'utilisateur.

Toujours tester une modification dans l'application avant de l'annoncer terminée, en plus du lint, du build et des tests : lancer le build (`src/Tily.Host/bin/Debug/<tfm>/win-x64/Tily.exe`, qui embarque `web/dist`) dans une instance isolée par `TILY_DATA_DIR` avec `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=<port>`, piloter l'interface par le protocole DevTools (`Runtime.evaluate`, `chrome.webview.postMessage` avec `terminal.input` pour écrire dans un pane), vérifier par `Page.captureScreenshot`, puis fermer l'instance et supprimer son dossier de données. Un état d'agent se simule en écrivant `<TILY_DATA_DIR>/agents/<paneId>.json` (`{"agent":"claude","state":"waiting","message":…,"detail":…}`) pendant qu'un processus tourne dans le pane. Si un comportement ne peut pas être reproduit, le dire explicitement.

À la fin de chaque modification de l'application, toujours donner à l'utilisateur la commande prête à copier, en syntaxe PowerShell et jamais en syntaxe bash (son terminal est PowerShell : `VAR=valeur commande` y échoue), qui lance Tily depuis le worktree courant (chemins absolus) sur une instance isolée, pour qu'il teste à la main : `$env:TILY_DATA_DIR = "$env:TEMP\tily-<nom du worktree>"; dotnet run --project <worktree>\src\Tily.Host`, précédée de `pnpm --dir <worktree>\web build` si le web a changé depuis le dernier build (en Debug, `dotnet run` réutilise `web\dist` s'il existe).

Distribution :

```bash
scripts/build-installer.cmd            # publication autonome win-x64 puis installer/output/Tily-x.y.z-setup.exe (Inno Setup 6 requis)
scripts/build-installer.cmd beta 2.3.0-beta.1   # « Tily Beta » (icône bleue, installable à côté) : installer/output/TilyBeta-2.3.0-beta.1-setup.exe
gh release create v2.3.0-beta.1 installer/output/TilyBeta-2.3.0-beta.1-setup.exe --prerelease --target develop   # publie la bêta, depuis develop
node scripts/generate-icon.js          # régénère src/Tily.Host/Assets/Tily.ico, Tily.png et leurs variantes TilyBeta
```

La version vient de la propriété `Version` de `src/Tily.Host/Tily.Host.csproj` ; chaque version est publiée en release GitHub avec son installeur. La branche `develop` sert aux bêtas, publiées en pré-releases GitHub (`--prerelease`) que seule Tily Beta suit avant le merge dans `main`. Une bêta prend sa version en argument (`x.y.z-beta.n`, incrémenter `n` à chaque bêta) et non dans le `.csproj` ; tag `v<version>` et installeur `TilyBeta-<version>-setup.exe` obligatoires pour la mise à jour intégrée. Les captures du README sont dans `docs/images/`.

## Spécification

La spécification décrit l'application telle qu'elle est, au présent : ni statut (retenu, proposé), ni date, ni historique des décisions, ni matrice de recette, ni tableau des raccourcis (ils sont dans l'application), ni référence aux issues GitHub, où vit tout le suivi. Toute évolution de l'application la met à jour dans le même changement ; une question encore ouverte devient une issue GitHub, pas une section de la spec.

Décisions déjà tranchées à ne pas rouvrir : Leader = Ctrl + Espace (délai 5 s), palette = Ctrl + P, shell par défaut = Windows PowerShell 5.1 (pour retrouver le profil existant, `pwsh` n'est pas supposé équivalent), agent suivi = Claude Code (`claude`), projets = premier niveau du dossier des projets (`C:\Files\Projects` par défaut, réglage `ProjectsRoot`) hors `worktrees`, recherche dans les terminaux (Ctrl + Maj + F dans le pane, recherche dans tous les terminaux depuis la palette).

## Application (`src/`, `web/`, `tests/`)

- `src/Tily.Core` : terminaux ConPTY et Job Objects (`Terminal`, `Native`), shells et intégration OSC 7 (`Shell`), session et texte des panes (`Session`, `%LOCALAPPDATA%\Tily\session.json`), préférences (`Settings`), sélecteur de projets (`Projects`), actions contextuelles et éditeur (`Context`), explorateur de fichiers (`Files`), vue Git avec annulation (`Git`), worktrees natifs (`Worktrees`), états d'agents et hooks Claude Code (`Agents`), serveur MCP de Tily : named pipe par instance et déclaration dans `~/.claude.json` (`Mcp`), journal console et réseau des panes navigateur lu par le protocole DevTools (`Browser`), mises à jour depuis les releases GitHub (`Updates`), MR/PR GitHub et GitLab par les CLI `gh` et `glab` (`Forge`), raccourcis clavier personnalisés (`Shortcuts`), journal de la barre de statut (`StatusLog`). L'hôte valide toute session avant de l'écrire.
- `src/Tily.Host` : fenêtre WinUI 3 non empaquetée, une WebView2 pour toute l'interface plus une par pane navigateur (profil WebView2 `browser`, `BrowserFeed`), aucun `KeyboardAccelerator`, pont JSON `HostBridge` et flux associés dans `Bridge/` (contrat dans `docs/BACKEND_ARCHITECTURE.md`, types miroir dans `web/src/bridge/messages.ts`), script de hook `hooks/tily-agent-state.ps1`.
- `src/Tily.Mcp` : `tily-mcp.exe`, serveur MCP stdio lancé par Claude Code dans un pane, qui relaie ses outils à son instance de Tily ; référencé par l'hôte, il est publié à côté de `Tily.exe` et partage son runtime.
- `web/` : modèle pur dans `src/model`, stores Zustand, une instance xterm.js par pane conservée hors React (`terminalRegistry`), raccourcis interceptés dans xterm.js (Leader Ctrl + Espace, Ctrl + P), composants un par fichier, tokens Tailwind `tily-*`. Enums TypeScript autorisés (`erasableSyntaxOnly` désactivé).

## Environnement local

Le profil PowerShell de l'utilisateur fournit les fonctions worktree `wtr`/`rmwt`, décrites dans la section 10 de la spec. Tily gère les worktrees en natif (`src/Tily.Core/Worktrees` : liste, création avec ports aléatoires, `pnpm install` et base répliquée, suppression) avec le comportement de `wtr`/`rmwt` ; ces fonctions restent chargées par le profil, utilisables au terminal avec les mêmes chemins, et l'interface suit leurs effets. Ne pas simuler WezTerm avec de fausses variables d'environnement.
