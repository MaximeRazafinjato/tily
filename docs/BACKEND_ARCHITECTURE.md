# Architecture backend (hôte C#)

L'hôte est une application C# .NET 10 avec une fenêtre WinUI 3 (Windows App SDK, non empaquetée). Une WebView2 porte toute l'interface ; chaque pane navigateur a la sienne, et une popup de connexion dimensionnée (MSAL par exemple) s'ouvre dans une fenêtre WebView2 à part (spec, §14). L'hôte ne porte aucune interface métier : il gère la fenêtre, les terminaux, la persistance et les services locaux. L'interface entière est dans `web/`.

Chaque section donne le rôle d'un dossier, ses invariants et ses choix non évidents. Signatures, constantes, bornes et champs se lisent dans le code.

## Projets

| Projet | Rôle |
| --- | --- |
| `src/Tily.Core` | Bibliothèque testable sans interface, un dossier par domaine. Aucune dépendance WinUI. Dépendances externes : `Microsoft.Data.SqlClient` (réplication d'une base SQL Server de worktree) et `System.Security.Cryptography.Pkcs`, épinglée pour corriger une faille de la version qu'apporte SqlClient. |
| `src/Tily.Host` | `Tily.exe` (assembly `Tily`) : fenêtre WinUI 3, WebView2, pont hôte / web. Le moins de logique possible. |
| `src/Tily.Mcp` | `tily-mcp.exe` : serveur MCP stdio (`ModelContextProtocol.Core`) que Claude Code lance dans un pane. Il vérifie les arguments de chaque outil puis le relaie à son instance de Tily par le pipe de `Tily.Core/Mcp` ; une capture revient à Claude en image PNG. Hors de Tily (sans `TILY_PANE_ID`), il ne déclare ni outil ni instruction : rien n'entre dans le contexte de Claude. Il s'arrête quand Claude Code ferme son entrée standard. Publié à côté de `Tily.exe`, il partage son runtime et lit sa version sur le `Tily.dll` voisin. |
| `tests/Tily.Core.Tests` | Tests xUnit de `Tily.Core` (voir `docs/TESTING.md`). |

`Directory.Build.props` fixe `Nullable`, `ImplicitUsings`, x64, `win-x64` et la constante `TILY_BETA` quand `Channel=beta`.

## Tily.Core

Règles communes : tout fichier écrit passe par `AtomicFile` ; un fichier de réglages absent reçoit un gabarit, un champ absent prend sa valeur par défaut, un JSON illisible donne les défauts sans être réécrit ; toute erreur destinée à l'utilisateur est en français.

### Native/

Déclarations P/Invoke seules, sans logique : ConPTY, processus, Job Objects, fenêtre, shell Windows, Restart Manager. Tily utilise uniquement la ConPTY de Windows.

### Terminal/

Une pseudo-console par pane : `TerminalSession` assemble ConPTY, processus et Job Object autour d'un thread de lecture ; `TerminalManager` tient une session par pane.

- Le shell est créé suspendu, rattaché à un Job Object `JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE`, puis repris : aucun descendant n'y échappe, et fermer le pane termine tout l'arbre, enfants détachés compris.
- `STARTF_USESTDHANDLES` avec des handles vides : le shell n'hérite pas des entrées / sorties de Tily.
- `SetConsoleCtrlHandler(NULL, FALSE)` juste avant `CreateProcessW` : un Tily lancé par un script qui ignore Ctrl + C transmettrait sinon cet état au shell et à ses programmes.
- La commande initiale est écrite au premier OSC 7 pour PowerShell (prompt prêt), aussitôt pour les autres shells ; elle n'est jamais persistée.
- `Activity` (confirmation de fermeture), `Probes` (noms et PID des processus du Job Object, pour les agents) et `MissingDirectories` (dossiers courants disparus) interrogent les sessions vivantes.

### Shell/

Profils de shells (`ShellCatalog` : PowerShell 5.1 par défaut, PowerShell 7, CMD, Git Bash ; chemins dans `shells.json`), intégration PowerShell, lecture du dossier courant (`OscCwdParser`) et chemins déposés.

- Shell introuvable : erreur qui cite le chemin et le fichier de configuration, jamais de repli silencieux vers un autre shell.
- L'intégration PowerShell est un wrapper de prompt passé par `-EncodedCommand`, sans toucher au profil. Il émet OSC 7 (dans le système de fichiers seulement) et `OSC 6973` (`exec`, `done` avec durée et succès, `prompt` avec la hauteur de l'invite), lus par xterm.js. Il lit `$?` en premier et le rétablit par un `Write-Error` ignoré avant le prompt d'origine, comme VS Code, et reste compatible avec `Set-StrictMode`. Seuls PowerShell 5.1 et 7 rapportent leur dossier courant.
- `DroppedPaths` protège un chemin selon le shell ; pour PowerShell, entre guillemets simples, les apostrophes typographiques sont doublées comme les droites, car PowerShell les traite comme des apostrophes. Un chemin sans blanc (espaces insécables comprises) ni caractère spécial reste nu.

### Session/

Modèle de session (workspaces, onglets, splits, panes terminal ou navigateur, onglets fermés, notes, favoris), sa validation et sa persistance (`SessionRepository`, `session.json`), texte des terminaux (`PaneTextRepository`), écriture atomique.

- `AtomicFile` écrit un `.tmp`, le force sur le disque (`Flush(true)`) puis le renomme : une coupure de courant ne laisse jamais un fichier vide.
- `SessionValidator` refuse une session incohérente (identifiants actifs, splits, ratios, profondeur, note trop longue) mais ramène à une valeur sûre ce qui ne mérite pas de perdre la session : valeur inconnue, largeur, liste trop longue, adresse invalide.
- `session.json` est copié en `session.previous.json` avant chaque écriture. Un fichier illisible ou invalide est mis en quarantaine (`nom.corrompu-<horodatage>.ext`) et signalé, jamais écrasé en silence ; l'avant-dernier enregistrement est restauré s'il est valide, sinon la session initiale.
- Le texte des terminaux est à part de la disposition : un fichier par pane dans `text`, écrit atomiquement. `Save` n'écrit que les panes reçus, supprime ceux absents de la liste à garder et ignore un pane qui ferait dépasser la limite globale. Les formats antérieurs sont convertis à la lecture ; la version de session reste 2 pour qu'une version antérieure de Tily relise encore la disposition.

### Settings/

`SettingsService` agrège neuf fichiers de réglages : `shells.json`, `editor.json`, `persistence.json`, `projects.json`, `notifications.json`, `git.json`, `updates.json`, `appearance.json`, `shortcuts.json`. S'y ajoute `worktree-projects.json` (dépôt et dossier des worktrees par projet), hors export. Chaque fichier a son dépôt dans le dossier de son domaine.

- Les fichiers restent éditables à la main : l'écran Paramètres n'est qu'une autre façon de les écrire.
- `Save` valide tout (shell inconnu, éditeur vide, chemins relatifs, base des worktrees, raccourcis) avant d'écrire quoi que ce soit. `SaveAppearance` n'écrit que `appearance.json`.
- `Snapshot` rend les shells, les chemins des fichiers et des avertissements non bloquants : shell, éditeur (`CommandLocator` : chemin, `PATH` avec `PATHEXT`, App Paths), son `.wav`, dossier des projets ou des worktrees introuvables.
- Import : version 1 ; `shells`, `editor`, `persistence` et `projectsRoot` obligatoires, autres clés (`shortcuts` comprise) facultatives. `Import` valide sans rien écrire et signale chaque valeur de persistance ramenée dans sa plage. L'export ne contient jamais la session, le texte ni les dossiers par projet.

### Appearance/

Couleurs de l'interface (spec, §3, « Couleurs »).

- `AccentTheme` calcule en OKLCH, à partir d'une seule couleur d'accent, les tokens `tily-*` teintés (luminosité fixe, saturation proportionnelle à celle de l'accent), le thème xterm.js et les couleurs de la barre de titre ; l'accent est borné en luminosité et en saturation, une couleur hors gamut sRGB perd de la saturation sans changer de teinte. Les couleurs d'état, de diff, de voies Git et de syntaxe restent dans `index.css`.
- `AccentResolver` construit le thème de la couleur de Tily, sinon du défaut du canal (`AccentPresets`), et donne le projet et la couleur de projet de chaque dossier (`ProjectsOf`), qui ne surligne qu'un nom. Le projet d'un dossier se lit sans lancer `git` (`GitContext.MainRepositoryRoot`) : dépôt principal d'un worktree, puis dossier de premier niveau de la racine des projets, sinon racine du dépôt hors de cette racine.

### Context/

Contexte Git d'un dossier (`GitContext`, qui donne aussi le dépôt principal d'un worktree) et actions locales (`LocalActions`) : Explorateur, éditeur (`editor.json`), liens.

- `GitContext` lit `.git`, `gitdir:` et `HEAD` sans lancer `git` : appelé à chaque `context.query` et pour chaque pane de `tily_layout`, il doit rester instantané.
- La sélection dans l'Explorateur passe par `SHOpenFolderAndSelectItems`, sans ligne de commande : virgules et espaces ne gênent pas, contrairement à `explorer /select,`.
- L'éditeur est lancé par le shell Windows (`UseShellExecute`, fenêtre masquée), ce qui résout `code.cmd` et les App Paths ; chaque argument est entre guillemets doubles. La famille VS Code reçoit `-g chemin:ligne:colonne`.
- `OpenLink` ouvre `http` / `https` (`RequireWebLink`), et `file:` seulement pour un document local existant d'un type limité, jamais sur un partage réseau (`RequireLocalDocument`) ; tout autre schéma est refusé.
- `PathFallback` rend l'ancêtre existant le plus proche d'un chemin disparu, sinon le dossier utilisateur.

### Projects/

`ProjectCatalog` liste les projets du sélecteur (spec, §9) : premier niveau de la racine des projets, hors `worktrees` et dossiers cachés, puis les worktrees, marqués comme `[wt]` dans le sélecteur WezTerm. `ProjectsSettingsRepository` lit `projects.json`.

- Racine inaccessible : liste vide et message, jamais d'exception vers le web.
- Le dossier des worktrees réglé est retiré des projets s'il est dans la racine. Un dossier mémorisé pour un projet n'apporte que ses vrais worktrees (`.git` fichier).

### Files/

Explorateur de fichiers et aperçu (spec, §3).

- `FileExplorer.List` ne lève jamais et liste tout (`.git` et fichiers cachés compris), avec un plafond et le total réel.
- Création et renommage exigent un nom valide (`RequireValidName`, aussi utilisé pour les worktrees) et n'écrasent jamais un élément ; un renommage de casse est accepté.
- Corbeille par `SHFileOperationW`, annulable, sans confirmation Windows puisque le web a confirmé.
- `ProjectFiles` (palette) : `git ls-files` sans supprimés, sous-modules ni dépôts imbriqués ; hors dépôt, parcours du disque limité en temps et en nombre.
- Une image d'aperçu n'est jamais lue : elle est servie par `https://tily.files/…?v=<date de modification>`, pour contourner le cache. Le texte est plafonné, décodé selon le BOM, sinon en UTF-8 strict avec repli Latin-1 ; un fichier binaire est refusé ; la version est lue avant le contenu.
- `TextFileWriter.Save` refuse un fichier modifié ou supprimé après sa lecture, sauf `force`, et garde l'encodage et les fins de ligne détectés.
- `PreviewAddress` refuse `..`. `PreviewLinks` envoie http(s) au navigateur, un fichier à l'aperçu s'il est lisible, sinon à l'éditeur, un dossier à son README.

### Git/

Vue Git du panneau de droite (spec, §10) : `GitRunner` lance `git`, `GitStateReader` assemble l'état, les classes `Git*Commands` portent les opérations, `GitUndo` les annule.

- `git` vient du `PATH`, sinon de `Program Files\Git\cmd`. Trouvé dans le `cmd` de Git pour Windows, il est remplacé par `mingw64\bin\git.exe` avec l'environnement que posait le lanceur : un processus de moins par commande, hooks et `ssh` inchangés.
- Toujours `ArgumentList`. Seul l'affichage est neutralisé (`core.quotepath`, `color.ui`), plus `--no-optional-locks` pour qu'une lecture n'écrive jamais l'index ; `GIT_TERMINAL_PROMPT=0`, `GIT_EDITOR=true` et `GIT_MERGE_AUTOEDIT=no` empêchent toute attente de saisie. Configuration, hooks et gestionnaire d'identifiants de l'utilisateur s'appliquent.
- Les chemins passent par `--pathspec-from-file` avec `--literal-pathspecs` : ni limite de longueur, ni caractère de motif. `LC_ALL=C` seulement pour `for-each-ref`, dont le suivi est analysé.
- L'état est lu en parallèle ; `ReadWorkingTree` ne relit que `status`, ou rend `null` si HEAD, son amont ou l'opération en cours ont bougé. L'historique place l'arbre de travail en tête et chaque stash au-dessus de son commit de départ, et marque les commits qu'un push publierait en avance rapide.
- Un diff staged ou unstaged porte l'empreinte SHA-256 de son texte brut (`fingerprint`) ; décodé sans perte, il porte aussi ce texte (`patch`) pour « Copier le diff ».
- Toute opération destructrice exige `confirmed` côté hôte (`GitPaths.RequireConfirmation`), même si le web a déjà demandé.
- Lignes choisies : le diff brut est relu et refusé si son empreinte a changé, puis un patch partiel est reconstruit et appliqué par `git apply` (`--cached`, `--reverse`) ; l'abandon de lignes s'annule comme celui d'un fichier.
- Push avec `--porcelain` pour reconnaître un refus. `--force-with-lease` n'est accepté qu'après un refus de la même branche, avec confirmation. `PushUpTo` pousse une branche non courante, entière ou jusqu'à un commit, sans jamais proposer de push forcé.
- Pull `--no-rebase` si aucune stratégie n'est configurée, pour qu'un pull divergent n'échoue pas. Rebase jamais interactif. Cherry-pick et revert d'un merge par `-m 1`.
- Marquer résolu est refusé tant que des marqueurs de conflit restent (code `conflictMarkers`) ; une branche non mergée renvoie `notMerged` ; ces codes ouvrent une confirmation côté web.
- Stash de fichiers choisis : les autres fichiers staged quittent l'index le temps du stash puis y reviennent. `.gitignore` : chemins ancrés, caractères de motif échappés. Noms validés par `git check-ref-format` ; une référence qui commence par `-` est refusée.
- Suppression groupée : tout est vérifié avant la première suppression, branche courante refusée ; stashes supprimés du plus ancien au plus récent pour que les indices restants ne bougent pas.
- `GitUndoJournal` garde en mémoire la dernière opération par dépôt. `GitUndo` la défait : reset `--soft` après un commit, `--keep` après un merge, un pull, un rebase, un cherry-pick ou un revert, `read-tree` après un reset mixed, `stash create` pris avant un reset hard, `stash store` pour un stash supprimé, blobs sauvegardés pour un abandon. Elle est refusée si le dépôt a changé ou si un push a publié les commits ; les branches distantes supprimées ne sont pas restaurées.
- `GitAutoFetchSchedule` espace les fetchs automatiques par dépôt ; un fetch manuel réussi compte.

### Forge/

MR/PR GitHub et GitLab par les CLI `gh` et `glab` (spec, §10), derrière `ForgeService` et `IForgeProvider` (un fournisseur par hébergeur).

- Aucun jeton n'est saisi ni stocké : l'authentification est celle de la CLI. CLI absente : message avec la commande d'installation puis `auth login`.
- Hébergeur déduit de `origin` : GitHub pour `github.com` ; GitLab pour `gitlab.com`, un hôte `gitlab.*` ou un hôte déclaré dans la configuration de glab ; tout autre hôte est refusé.
- CLI lancées par `ArgumentList`, sans console ni invite, avec un délai de garde ; un corps JSON passe par l'entrée standard (`--input -`). `ForgeErrors` traduit les échecs : connexion, réseau, droits, limites, refus de l'hébergeur.
- MR/PR d'une branche gardées en cache, plus longtemps pour un échec. `Creatable` seulement si la branche n'a aucune MR/PR ouverte et n'est ni la base des worktrees ni la branche par défaut de `origin`.
- Formulaire : lectures parallèles, un échec partiel devient un avertissement. Cible par défaut : base des worktrees si elle est sur `origin` et diffère de la source, sinon branche par défaut de l'hébergeur.
- Création : branche non publiée refusée sans push demandé. Un échec après la création (assigné, labels, reviewers) ne l'annule pas : il devient un avertissement.
- Modification : MR/PR fusionnée ou fermée et changement de branche source refusés ; seul ce qui a changé est envoyé. Sur GitHub, l'échec de la requête principale arrête tout ; les échecs suivants deviennent des avertissements.

### Worktrees/

Gestion native des worktrees, au comportement de `wtr` / `rmwt` (spec, §10) : `WorktreeCreator`, `WorktreeRemover`, réplication de base (`IDatabaseReplicator`) et corbeille (`WorktreeTrash`).

- Hors du sélecteur de projets, le projet d'un dépôt est le dossier de premier niveau de la racine qui contient son dépôt principal.
- `ClaudeLaunchCommand` construit la commande `claude` tapée dans Windows PowerShell 5.1 : premier message ramené à une ligne et borné, échappé pour la ligne de commande native (guillemets doubles, antislashs qui les précèdent ou terminent le message) puis entre guillemets simples, apostrophes typographiques doublées ; `--` le précède s'il commence par un tiret. Elle est calculée avant la création, pour qu'un message refusé ne laisse aucun worktree.
- `Plan` n'écrit rien. Une nouvelle branche est créée par `worktree add --no-track -b` après un fetch de la base : sans amont, le premier push la publie sous son nom.
- `worktree-projects.json` est protégé par un verrou statique, partagé dans le processus par toutes les instances de `WorktreeProjectsRepository`, car `WorktreeFeed` y écrit le dépôt et `SettingsService` le dossier.
- Ports : mêmes fichiers et même expression que `Invoke-RandomizeWorktreePorts`, port libre testé par `TcpListener`, remplacement délimité (jamais dans `15173` ni `1.5173`), BOM conservé.
- Base répliquée (PostgreSQL dans Docker ou SQL Server, détectée comme `ConvertTo-DbInfo`) : mot de passe PostgreSQL passé en variable d'environnement, jamais en argument ; noms et chemins SQL Server en paramètres ; identifiants et littéraux échappés. Une base cible existante est réutilisée ; une erreur de base n'est qu'un avertissement. Garde-fou : une base identique à celle du dépôt principal, ou celle d'un dépôt principal sans base connue, n'est jamais supprimée.
- Suppression : confirmation exigée, dépôt principal refusé. Le dossier est d'abord déplacé, instantanément, dans la corbeille cachée `.tily-corbeille` de son dossier parent, en quelques essais le temps que les panes fermés rendent leurs processus. S'il est verrouillé, rien n'est touché et l'erreur cite les processus trouvés par le Restart Manager. Suivent `worktree prune`, la base et `branch -D`.
- La corbeille est purgée par `cmd.exe /d /c rd /s /q` : sur un poste protégé par un antivirus, une suppression faite par Tily lui-même plafonne à quelques dizaines de fichiers par seconde, contre des milliers pour `rd`. `rd` ne suit pas les jonctions ; `robocopy /MIR` les suit et efface leur cible, d'où son rejet. Un chemin contenant `%` et ce que `rd` laisse passent par `LockedFolder.DeleteAll`.

### Agents/

États des agents des panes (spec, §11) : fichiers `agents\<paneId>.json` écrits par un producteur externe (`AgentStateRepository`), un adaptateur par agent (`IAgentAdapter`), réunis par `AgentMonitor`.

- Un fichier d'état plus ancien que le shell du pane, illisible ou inconnu est ignoré : aucun état ancien ne passe pour vivant. Un pane dont le shell n'a aucun processus enfant perd son état.
- La seule présence d'un processus ne produit que « Inconnu ». Seul Claude Code a un producteur, ses hooks : son adaptateur reprend l'état rapporté, sinon rapporte « Inconnu » si un processus `claude` tourne ou si le registre des sessions trouve une session dans le pane.
- Aucun hook ne signale une interruption par Échap. `ClaudeSessionRegistry` lit le registre des sessions de Claude Code pour les PID du pane (PID réattribué écarté). Un registre passé à `idle` après le dernier état `working` ou `waiting` des hooks, et resté `idle` au-delà d'un court délai de grâce (le registre passe à `idle` juste avant le hook Stop), fait passer l'agent à « Terminé », message « Interrompu. », sans notification.
- `ClaudeHooksInstaller` fusionne ou retire les hooks de Tily dans `~\.claude\settings.json`, seulement sur clic dans Paramètres, en gardant le reste. Un groupe Tily se reconnaît au chemin de `tily-agent-state.ps1` ; `Status` exige chaque groupe avec son `matcher` et son `if` ; un fichier illisible n'est jamais réécrit. `RepointIfMissing` recale les hooks sur le script de cette copie quand le script déclaré a disparu (autre canal désinstallé).
- `PreviewRequestRepository` consomme les demandes d'aperçu du hook dans l'ordre d'écriture et ignore un `.tmp` ou tout chemin qui n'est pas une page `.html` / `.htm` existante.

### Mcp/

Serveur MCP (spec, §11, « Pilotage par Claude Code (MCP) »), partie partagée par l'hôte et `tily-mcp.exe` : pipe nommé (`McpPipeServer`, `McpPipeClient`), déclaration dans Claude Code, noms et bornes des outils.

- Un pipe par instance : `tily-mcp-` et un hachage du dossier de données, résolu comme l'hôte (`TILY_DATA_DIR`, sinon `%LOCALAPPDATA%\Tily`).
- Pipe `CurrentUserOnly` des deux côtés : réservé au compte courant. `FirstPipeInstance` : une seconde instance sur le même dossier échoue au lieu de détourner les appels.
- Une connexion par appel, une ligne JSON dans chaque sens, appels servis en parallèle.
- Arguments vérifiés avant envoi : commande d'une ligne, dossier résolu par rapport au dossier de l'agent, adresse normalisée, capture `.png` dans un dossier existant, élément visé d'une seule façon (`BrowserTargets`), touche connue (`BrowserKeys`), direction de défilement.
- `ClaudeMcpInstaller` déclare le serveur `tily` dans `~\.claude.json` en gardant le reste ; une déclaration Tily se reconnaît à son exécutable `tily-mcp.exe` ; un serveur `tily` étranger n'est jamais remplacé ni retiré.

### Browser/

Panes navigateur (spec, §6, « Panes navigateur »), partie sans interface : adresses, journaux console et réseau, scripts de page, interactions pilotées par Claude Code.

- `BrowserAddress` complète une saisie (`localhost:5173`, une IP ou un nom sans point en `http://`, sinon `https://` ; chemin Windows en `file:///`) et n'admet que http, https, file et `about:blank`.
- `BrowserLog` garde console et réseau dans des tampons circulaires ; un numéro de chargement permet de ne lire que le dernier ; `ErrorCount` compte à l'arrivée, donc au-delà des tampons.
- `DevToolsConsole` ignore `Log.entryAdded` de source `network`, déjà dans le réseau ; `DevToolsNetwork` ne compte pas une requête annulée comme une erreur.
- `BrowserPageScript.Keys`, injecté dans chaque page, intercepte avant elle les combinaisons de Tily (`ShortcutRules.InterceptedChords`), calculées comme côté web (`keyChords.ts`), et les envoie à l'hôte (`tily.key`), sauf pendant une touche pressée par Claude (`window.__tilyDriving`).
- `BrowserPageDriver` construit les appels au script d'interaction (`BrowserPageElements` : rôles, noms, états, valeurs ; `BrowserPageActions` : plan de la page, recherche d'un élément, point visé, champ, défilement), installé une fois par document dans `window.__tilyDriver` et exécuté par `Runtime.evaluate`. Les références (`e12`) sont des `WeakRef` gardées dans la page, jamais dans le DOM ; un refus attendu revient en `{ error }` en français, lu par `BrowserPageResults`. Une valeur affectée à une liste déroulante passe par le setter du prototype, que les frameworks à état contrôlé (React) voient changer.
- `BrowserKeys` traduit une combinaison (`Ctrl+Shift+K`, alias français compris) en événements `Input.dispatchKeyEvent` : modificateurs pressés dans un ordre fixe, texte produit seulement sans Ctrl, Alt ni Meta.

### Shortcuts/

Raccourcis clavier (spec, §8, « Touche Leader ») : forme canonique et affichage français (`ShortcutChord`), catalogue des commandes aux identifiants de l'enum `Command` du web (`ShortcutCatalog`), règles (`ShortcutRules`), `shortcuts.json`.

- `Check` (enregistrement, import) refuse, et `Resolve` (lecture du fichier) écarte, une combinaison invalide, réservée, déjà prise ou égale au Leader ; les deux complètent par les défauts restés libres.
- Le fichier ne garde que les écarts aux défauts ; une valeur vide désactive le raccourci.

### Updates/

Mises à jour par les releases GitHub (spec, §13).

- Canal fixé à la compilation (`TILY_BETA`) ; le stable lit `releases/latest`, la bêta la dernière pré-release.
- Une release n'est acceptée que si son installeur porte le nom du canal, vient de `https://github.com/MaximeRazafinjato/tily/releases/download/` et a une empreinte `sha256:` publiée par GitHub. Le téléchargement va dans un `.part` haché au fil de l'eau, supprimé si l'empreinte diffère, renommé sinon.
- Versions comparées à la SemVer (`2.3.0-beta.2` < `2.3.0-beta.10` < `2.3.0`).
- Copie installée reconnue à `unins000.exe` ; installation pour tous les utilisateurs si elle est sous `Program Files`.

### StatusLog/

`StatusLogRepository` (`status-log.json`, entrées plafonnées, fichier illisible mis en quarantaine) et `UserErrorMessage.Of`, par lequel passe toute remontée d'erreur générique : le message d'une exception de Tily, déjà en français, ou, pour une exception d'entrée / sortie du framework, une phrase française suivie du détail système.

## Tily.Host

### Démarrage et fenêtre (`App`, `MainWindow`, `app.manifest`, `Assets/`)

- Barre de titre et fond de la WebView2 suivent la couleur de Tily (`ApplyWindowColors`), calculée dès la construction du pont puis à chaque changement.
- Dossier de données : `TILY_DATA_DIR`, réécrite en chemin absolu pour que le hook et `tily-mcp.exe` retrouvent l'instance, sinon `%LOCALAPPDATA%\Tily`, ou `%LOCALAPPDATA%\Tily Beta` en bêta (la variable est alors posée). Profil WebView2 de l'interface dans `WebView2\`.
- `--remove-claude-hooks` (désinstallation) retire hooks et déclaration MCP, sauf si l'autre canal est installé : il les reprendra à son prochain lancement.
- `app.manifest` : DPI `PerMonitorV2`, `longPathAware`.
- Aucun `KeyboardAccelerator` : les raccourcis sont interceptés par l'interface. Focus donné à la WebView2 dès sa création et à chaque activation, pour taper dans le terminal sans clic. `AllowDrop` : sans lui, WinUI ne transmet pas les glisser venus d'autres applications.
- WebView2 de l'interface : raccourcis du navigateur, menus contextuels, zoom et saisie automatique désactivés ; lecture du presse-papiers accordée d'office.
- Navigation hors de l'origine de l'application et nouvelle fenêtre refusées : un lien déposé ou un `window.open` ne remplace jamais l'interface. `https://tily.example/` est mappé sur `wwwroot/`, ou `TILY_WEB_DEV_URL` vise le serveur Vite.
- Fermeture en deux temps : la croix envoie `app.closing` ; la fermeture réelle vient de `window.close` ou d'un délai de garde, que `window.closeCancel` désarme ; un second clic pendant l'attente est ignoré.
- `BrowserLayer`, un `Canvas` au-dessus de l'interface, reçoit les WebView2 des panes navigateur. WinUI 3 ne sait pas rendre une WebView2 transparente : rien ne peut s'afficher par-dessus elles, si bien que l'interface les masque et montre leur capture pendant un menu, la palette ou un dialogue.
- Icônes versionnées, régénérées par `node scripts/generate-icon.js`, jamais pendant le build ; en bêta, `IconName` prend `TilyBeta.*`, copiées sous le nom `Tily.*`.

### Pont (`HostBridge`, `BackgroundQueue`, `PaneOutputBuffer`)

- `HostBridge` désérialise chaque message en `BridgeCommandModel` et le route par type ou par préfixe vers un feed ; un type inconnu remonte en `error`.
- Le thread UI, par lequel passent chaque frappe et son écho, ne fait ni écriture disque ni lecture lente. `session.save` et `text.save` (décodé dans la file, car c'est le plus gros message) partent dans une file d'écriture ordonnée, vidée avant la fermeture ; chaque feed a ses propres files (`BackgroundQueue` : un travail à la fois, dans l'ordre). Une exception dans une file remonte en `error`.
- La sortie des terminaux est décodée par pane (`PaneOutputBuffer`, UTF-8 incrémental) et vidée en une passe sur le thread UI. Contre-pression : au-delà d'un volume non acquitté par `terminal.ack`, le thread de lecture du pane attend, ce qui ralentit le programme au lieu de saturer la WebView2.
- `terminal.drop` apporte les fichiers en objets joints (`CoreWebView2File.Path`). `terminal.dropPath` n'accepte qu'un chemin absolu existant, vérifié hors du thread UI à cause des partages réseau ; sinon `error` sans pane, pour ne pas marquer le terminal en échec.
- `settings.save` applique aussitôt : shells des prochains terminaux (les shells lancés ne bougent pas), éditeur, racine des projets, historique, vérification des mises à jour (minuteur réarmé seulement si le réglage change), raccourcis des panes navigateur. L'import ne fait que lire : l'appliquer passe par `settings.save`, qui remplace toute la configuration sans fusion.
- `app.hello` porte l'`InformationalVersion` de l'assembly `Tily`, sans suffixe de révision (`x.y.z-beta.n` en bêta).

### Agents et notifications (`AgentStateFeed`, `hooks/tily-agent-state.ps1`, `PreviewRequestFeed`, `AttentionNotifier`)

- `AgentStateFeed` purge tous les états au démarrage seulement ; `terminal.create` et `terminal.close` ne suppriment que le fichier du pane. Il évalue `AgentMonitor` hors du thread UI, sur un minuteur non réentrant avancé après un changement du dossier `agents`, et n'envoie `agent.states` que si le résultat change.
- `tily-agent-state.ps1`, copié à côté de `Tily.exe`, écrit l'état du pane `TILY_PANE_ID` (rien sans lui) dans `agents\` du dossier de données (`TILY_DATA_DIR`), tous deux hérités du shell : `SessionStart` inconnu ; `UserPromptSubmit` et `PostToolUse` en cours ; `PermissionRequest`, `PreToolUse` sur `AskUserQuestion` et `Notification` d'attente réelle en attente (`idle_prompt` est ignorée pour ne pas confondre attente et fin de tour, et une notification n'écrase pas une attente de `PermissionRequest`) ; `Stop` terminé ; `StopFailure` erreur ; `SessionEnd` suppression. Messages français fixes, sauf la question d'`AskUserQuestion`. BOM UTF-8 obligatoire : sans lui, Windows PowerShell 5.1 lit mal les accents.
- Aperçu : un second groupe `PreToolUse` (`Bash`, `"if": "Bash(start *)"`) ne lance PowerShell que si une sous-commande est `start`. Pour une page `.html` / `.htm` existante, le script dépose une demande dans `previews\` (`.tmp` puis renommage) et refuse la commande avec une raison en français : Tily a ouvert la page, relancer le reste sans ce `start` (le hook ne peut laisser passer une partie d'une commande composée). Tout autre cas passe sans réponse. `PreviewRequestFeed` relaie chaque demande en `preview.requested`.
- `AttentionNotifier` passe par `ToastNotifier` (`Windows.UI.Notifications`) après inscription de l'identifiant d'application sous `HKCU\Software\Classes\AppUserModelId`, car `AppNotificationManager` du Windows App SDK échoue en déploiement autonome. Fenêtre active : rien, sauf test et fin d'agent. Sinon clignotement, son et notification, une par pane ; un `.wav` est joué par `PlaySound`, la notification restant muette. Un clic ramène la fenêtre et envoie `agent.join`. Inscription impossible : clignotement et son seuls, signalés dans `settings.result`.

### Explorateur et aperçu (`FileExplorerFeed`, `ExplorerGitMarks`, `FilePreviewFeed`)

- `files.watch` remplace l'ensemble des dossiers surveillés (un `FileSystemWatcher` non récursif chacun). Le premier, racine de l'arbre, est confié à `ExplorerGitMarks`, qui a sa propre file pour ne jamais retarder les listings et un seul `git status` en attente ; ses chemins partent du dossier affiché (`rev-parse --show-prefix`), pour qu'une jonction ou un lecteur `subst` garde ses marques.
- `files.search` a sa file ; une nouvelle recherche annule la précédente. `files.openAt` préfère le chemin plus long à espaces dont le lien a été raccourci, s'il existe exactement.
- Pages HTML de l'aperçu : servies par `WebResourceRequested` sur `https://tily.files/*` avec `CoreWebView2WebResourceRequestSourceKinds.All` (sans lui, feuilles de style et scripts de la page ne se chargent pas), types limités, sinon 404. La page vit dans une iframe isolée (origine opaque, sans accès au pont) ; `FrameNavigationStarting` n'y laisse charger que le document affiché et traite un clic sur un lien comme `preview.follow`.

### Git et MR/PR (`GitFeed`, `GitOperationRunner`, `GitWatcher`, `ForgeFeed`)

- Trois circuits : état et historique ; diff et détail, pour qu'un clic n'attende pas un rafraîchissement ; opérations une par une dans `GitOperationRunner`, pour lire pendant un push.
- Un changement de la copie de travail ou de l'index ne relit que `status`. Un signal du watcher antérieur au début de la dernière lecture de même portée est ignoré : une opération de Tily ne déclenche pas deux rafraîchissements. Sans changement, `git.changed` fait recharger un diff ouvert.
- `GitOperationRunner` garde l'annulation et l'autorisation de push forcé par dépôt et branche (levée par un refus, retirée après un push réussi). « Commit et push » journalise le commit avant le push. Le fetch automatique, demandé quand le dépôt suivi change, reste silencieux en cas d'échec : ni `git.done` ni `git.failed`.
- `GitWatcher` ne retient, dans le dossier Git et le dossier commun, que `HEAD`, `index`, `refs`, `packed-refs`, les marqueurs d'opération et les fichiers des worktrees : un `wtr` tapé au terminal apparaît aussitôt, sans rafraîchir à chaque `index` d'un autre worktree ; `.lock` ignorés.
- `ForgeFeed` a trois files (listes, pastilles, formulaire), pour qu'une liste lente ne retarde pas les pastilles ; toute exception devient l'`error` de la réponse, pour que le web n'attende jamais.

### Worktrees (`WorktreeFeed`)

- L'hôte ne crée ni ne ferme jamais de workspace : il annonce `worktrees.created` dès que le dossier existe, puis réplique la base pendant que le web ouvre le workspace et lance `pnpm install`.
- Dossier d'un worktree : celui de la demande, sinon celui mémorisé pour le projet, sinon celui des Paramètres ; choisir celui des Paramètres oublie celui du projet.
- Création et suppression passent une à une ; la purge de la corbeille a sa propre file, après `worktrees.done`, sans retenir les opérations suivantes.
- `worktrees.done` ou `worktrees.failed` termine toujours une opération, exception imprévue comprise. Le numéro `request` est renvoyé dans chaque message, pour que le serveur MCP suive ses opérations.

### Serveur MCP (`McpFeed`)

- Le pipe n'est ouvert que si le serveur est déclaré ; au démarrage, la déclaration est recalée sur cette copie si l'exécutable déclaré a disparu.
- Chaque appel devient `mcp.request`, terminé par `mcp.response` ; avant `app.ready`, il échoue (« Tily démarre encore »). Le pane appelant vient de `TILY_PANE_ID`, hérité par Claude Code puis par `tily-mcp.exe`. L'attente se fait sur le pool de threads.
- Délais de réponse : 10 s par défaut ; délai demandé plus 5 s pour l'attente d'un motif ; 125 s pour `run`, `interrupt` et `close`, qui peuvent attendre l'accord de l'utilisateur ; 10 min pour créer ou supprimer un worktree ; 60 s pour les outils navigateur qui attendent une navigation, une capture ou une action dans la page.
- La réponse de `layout` reçoit la branche de chaque pane.

### Panes navigateur (`BrowserFeed`, `BrowserView`, `BrowserDevTools`, `BrowserNavigations`, `BrowserDriver`, `BrowserInput`)

- `browser.*` est routé avant tout autre traitement. Une `BrowserView` par pane, avec le profil WebView2 distinct `browser` : cookies et sessions séparés de l'interface et conservés. Saisie automatique et mots de passe y restent actifs.
- Les récepteurs d'événements DevTools sont gardés dans un champ : sinon le ramasse-miettes les libère et la collecte s'arrête sans bruit. `browser.state` regroupe les changements du nombre d'erreurs, pour qu'une page qui inonde sa console n'inonde pas le pont.
- La vue masquée est placée hors champ le temps d'une capture ou d'une action (`DriveAsync`, qui les exécute une à une par vue) ; `browser.snapshot` donne l'image instantanée que l'interface montre à la place de la vue masquée.
- `BrowserDriver` enchaîne les actions de Claude : clic, double clic et molette par `Input.dispatchMouseEvent`, saisie par `Input.insertText`, touches par `Input.dispatchKeyEvent` (`BrowserInput`). Des coordonnées visent la page émulée au viewport de la capture le temps de l'action. Une action suivie d'une navigation l'attend (`BrowserNavigations.FollowAsync`) ; la page n'a pas besoin du focus Windows, que l'utilisateur garde.
- Une fenêtre demandée avec taille ou position (popup de connexion MSAL) s'ouvre dans une fenêtre WebView2 qui partage la session et garde `window.opener` ; toute autre devient `browser.newPane`.
- `tily.key` rend le focus à l'interface puis devient `browser.key` ; quand les raccourcis changent, le script est réinscrit et rejoué.

### Couleurs (`AppearanceFeed`)

- Le thème ne dépend que des réglages : calculé au démarrage, recalculé à chaque enregistrement, `appearance.theme` seulement s'il change.
- `appearance.projects` (dossier du pane actif de chaque workspace) est résolu dans sa propre file, car trouver le projet lit le disque ; `appearance.projectsResolved` ne part que si le résultat change, et `app.hello` remet ce filtre à zéro.
- `appearance.projectColor` n'écrit que `appearance.json` puis renvoie les projets ; un enregistrement des réglages les renvoie aussi.

### Mises à jour et journal (`UpdateFeed`, `StatusLogFeed`, `PathPicker`)

- Rien n'est téléchargé sans `update.install`, refusé pour une copie non installée ; l'installeur va dans `updates\`, vidé au démarrage. `update.apply` exige que l'installeur vérifié existe encore ; il n'est lancé qu'à la fin de `HostBridge.Dispose`, terminaux arrêtés, attend la fin de Tily puis relance `Tily.exe` avec les droits de l'utilisateur d'origine.
- `StatusLogFeed` écrit par la file de la session ; un échec d'écriture n'est signalé qu'une fois jusqu'à la prochaine réussite, car ce message, lui-même journalisé, relancerait une boucle d'échecs.
- `PathPicker` : sélecteurs natifs ; une annulation n'envoie rien.

## Règles

- L'hôte est la source de vérité de la session persistée : il valide la session complète envoyée par le web avant de l'écrire. Chaque `session.save` ou `text.save` répond `session.saved` ou `session.saveFailed`, sans faire tomber la session en cours.
- Un fichier mis en quarantaine (session, texte, journal) est signalé par `recovery` dans `app.hello` et reste à côté pour récupération.
- Le texte restauré n'est qu'un affichage : les shells sont relancés neufs, aucune commande n'est rejouée.
- Fermer un pane, un onglet, un workspace ou l'application termine tout l'arbre de processus par son Job Object ; aucun service persistant ne reprend agents ou serveurs. L'hôte n'arrête rien avant `terminal.close` ou `window.close` : le web confirme d'abord, à partir de `terminal.activityResult` ou de l'activité portée par `app.closing`.
- Le shell reçoit `TILY_TERMINAL=1`, `TILY_PANE_ID` et `TERM_PROGRAM=TilyTerminal` ; toute variable `WEZTERM_*` est retirée.
- `wtr` / `rmwt` tapés au terminal : l'hôte ne rejoue aucun effet. Après `wtr`, seul l'OSC 7 du prompt (`terminal.cwd`) suit. À chaque `terminal.cwd`, l'hôte vérifie le dossier de toutes les sessions et envoie `terminal.pathMissing` pour celles dont le dossier a disparu ; de même à `terminal.create`, le shell démarrant alors dans le dossier utilisateur. Aucun pane ni workspace n'est fermé ou créé automatiquement.
- Seul l'échec d'une commande `terminal.*` porte le `pane` dans `error`, et le web affiche alors un état local au pane ; ailleurs, `error` ne cite pas de pane, pour ne jamais présenter un shell vivant comme arrêté.

## Contrat du pont

Les types TypeScript sont dans `web/src/bridge/` : `messages.ts` (application, session, réglages, terminaux, agents, projets, explorateur), `appearanceMessages.ts`, `gitMessages.ts`, `forgeMessages.ts`, `worktreeMessages.ts`, `previewMessages.ts`, `mcpMessages.ts`, `browserMessages.ts`, `updateMessages.ts`, `statusLogMessages.ts`. Les champs se lisent là et dans les modèles C#. Toute évolution se fait des deux côtés dans le même commit.

### Web → hôte

- Application : `app.ready` (interface prête : `app.hello` en retour, appels MCP acceptés), `window.title` (titre « workspace › onglet »), `window.close` (fermeture réelle, disposition et texte envoyés), `window.closeCancel` (fermeture annulée).
- Session : `session.save` (session complète), `text.save` (texte des panes modifiés et panes à garder).
- Réglages : `settings.get` (demande `settings.result`), `settings.save` (enregistre et applique), `settings.export` (sélecteur puis export), `settings.import` (sélecteur puis lecture sans écriture), `appearance.fontSize` (taille du texte choisie dans la palette), `appearance.projects` (dossier du pane actif de chaque workspace), `appearance.projectColor` (couleur d'un projet, vide pour la retirer), `dialog.pick` (sélecteur natif), `agents.installHooks`, `agents.removeHooks` (hooks Claude Code), `mcp.install`, `mcp.remove` (déclaration du serveur MCP).
- Attention : `attention.raise` (attente ou fin d'agent non acquittée), `attention.flash` (fin d'une commande longue), `attention.test` (aperçu d'une notification avec les réglages en cours d'édition).
- Terminaux : `terminal.create` (lance le shell, commande initiale facultative), `terminal.input` (frappe), `terminal.resize` (dimensions), `terminal.ack` (caractères affichés, contre-pression), `terminal.close` (arrête le pane et ses processus), `terminal.activity` (programmes encore actifs ; `request` distingue le serveur MCP de la confirmation de fermeture), `terminal.drop` (fichiers déposés, en objets joints), `terminal.dropPath` (chemin d'une ligne de l'arbre des fichiers).
- Projets et contexte : `projects.list` (projets du sélecteur), `projects.repositories` (dépôts d'un projet), `projects.rememberRepository` (dépôt par défaut d'un projet), `context.query` (contexte Git du dossier d'un pane), `context.open` (dossier dans l'éditeur ou l'Explorateur), `link.open` (lien d'un terminal hors de Tily).
- Explorateur : `files.watch` (dossiers affichés, le premier étant la racine), `files.refresh` (relit dossiers et marques Git), `files.open` (éditeur), `files.openAt` (lien `chemin:ligne:colonne` d'un terminal), `files.reveal` (Explorateur Windows), `files.search` (fichiers du projet pour la palette), `files.create`, `files.rename`, `files.delete` (corbeille).
- Aperçu : `preview.open` (ouvre un fichier), `preview.follow` (lien cliqué), `preview.close` (arrête la surveillance), `preview.browser` (page HTML dans le navigateur par défaut), `preview.save`.
- Git, lectures : `git.watch` (suit un dépôt, chemin vide pour arrêter), `git.refresh` (relit l'état), `git.init` (crée un dépôt et le suit), `git.history` (portée et nombre de commits), `git.diff` (diff d'un fichier), `git.details` (commit ou stash).
- Git, index et copie de travail : `git.stage`, `git.unstage`, `git.discard`, `git.stageLines`, `git.unstageLines`, `git.discardLines`, `git.ignore`, `git.resolve`.
- Git, historique : `git.commit` (amend et push facultatifs), `git.merge`, `git.rebase`, `git.cherryPick`, `git.revert`, `git.reset`, `git.continue`, `git.abort`, `git.undo`.
- Git, synchronisation : `git.push`, `git.pushBranch` (branche non courante, entière ou jusqu'à un commit), `git.pull`, `git.fetch`.
- Git, références et stash : `git.switch`, `git.branchCreate`, `git.branchRename`, `git.branchDelete`, `git.remoteBranchDelete`, `git.refsDelete` (suppression groupée), `git.tagCreate`, `git.tagDelete`, `git.tagPush`, `git.stash`, `git.stashApply`, `git.stashDrop`.
- MR/PR : `forge.list` (MR/PR du dépôt), `forge.branch` (pastille d'une branche), `forge.form` (formulaire de création ou de modification), `forge.compare` (couple source / cible), `forge.create` (création, push facultatif), `forge.update` (modification ou fermeture).
- Worktrees : `worktrees.sources` (dépôts proposés), `worktrees.plan` (plan sans écriture), `worktrees.list` (worktrees du dépôt d'un dossier), `worktrees.create`, `worktrees.remove`.
- MCP : `mcp.response` (réponse à un `mcp.request`).
- Mises à jour : `update.check` (vérification), `update.install` (téléchargement), `update.cancel` (annule le téléchargement), `update.apply` (installation et redémarrage).
- Journal de la barre de statut : `statusLog.append` (ajoute un message), `statusLog.clear` (vide le journal).
- Navigateur : `browser.attach` (crée la vue du pane), `browser.bounds` (rectangle et visibilité), `browser.snapshot` (image affichée à la place de la vue masquée), `browser.navigate`, `browser.back`, `browser.reload` (navigation), `browser.viewport` (bureau ou mobile), `browser.devtools` (outils de développement), `browser.focus` (focus dans la page), `browser.close` (libère la vue), `browser.console`, `browser.network` (journaux filtrés), `browser.screenshot` (capture PNG), `browser.elements` (plan de la page avec références), `browser.click`, `browser.type`, `browser.press`, `browser.scroll`, `browser.evaluate` (actions de Claude Code dans la page).

### Hôte → web

- Application : `app.hello` (état initial, avec `theme` : couleur affichée et préréglages, et `recovery` après une quarantaine), `app.closing` (demande de fermeture avec l'activité des panes), `session.saved`, `session.saveFailed` (résultat d'une écriture), `error` (erreur à afficher, `pane` pour un échec `terminal.*` seulement).
- Réglages : `settings.result` (réglages et état des intégrations pour l'écran Paramètres), `settings.exported`, `settings.imported` (à confirmer par `settings.save`), `appearance.changed` (taille enregistrée), `appearance.theme` (tokens et thème du terminal de la couleur de Tily), `appearance.projectsResolved` (projet et couleur de projet de chaque dossier), `dialog.picked` (chemin choisi).
- Terminaux : `terminal.output` (sortie), `terminal.cwd` (OSC 7), `terminal.exit` (fin du shell), `terminal.pathMissing` (dossier disparu et repli), `terminal.dropped` (chemins mis en forme pour le shell), `terminal.activityResult` (panes actifs, `request` renvoyé, 0 sans numéro).
- Agents : `agent.states` (agent de chaque pane qui en a un), `agent.join` (notification cliquée), `mcp.request` (outil appelé par Claude Code, nommé comme l'enum `McpTool` de `mcpMessages.ts`).
- Projets et contexte : `projects.listed`, `projects.repositoriesFound`, `projects.repositoryRemembered`, `context.result`, réponses aux demandes correspondantes.
- Explorateur : `files.listed` (contenu d'un dossier), `files.created`, `files.renamed`, `files.deleted` (confirmations), `files.gitMarks` (marques Git de l'arbre), `files.searched` (fichiers du projet).
- Aperçu : `preview.loaded` (ouverture ou rechargement), `preview.saved`, `preview.saveFailed` (résultat d'un enregistrement), `preview.requested` (page HTML ouverte par Claude Code).
- Git : `git.state` (état du dépôt suivi), `git.changed` (état inchangé, diff à recharger), `git.history`, `git.diff`, `git.details` (réponses aux lectures), `git.done`, `git.failed`, `git.pushRejected` (fin d'une opération), `git.autoFetchStarted`, `git.autoFetchEnded` (fetch automatique en cours).
- MR/PR : `forge.listed`, `forge.branchListed`, `forge.formLoaded`, `forge.compared`, `forge.created`, `forge.updated`, réponses aux messages `forge.*`.
- Worktrees : `worktrees.sourcesFound`, `worktrees.planned`, `worktrees.listed` (réponses aux lectures), `worktrees.progress` (étape en cours), `worktrees.created` (dossier prêt, le web ouvre le workspace), `worktrees.done`, `worktrees.failed` (fin d'une opération), `worktrees.purging`, `worktrees.purged` (effacement en arrière-plan).
- Mises à jour : `update.state` (état des mises à jour), `update.restart` (installeur prêt, le web ferme l'application).
- Journal de la barre de statut : `statusLog.added`, `statusLog.cleared` (journal modifié).
- Navigateur : `browser.state` (état d'un pane navigateur), `browser.newPane` (lien à ouvrir dans un nouveau pane), `browser.focused` (la page a pris le focus), `browser.key` (raccourci de Tily tapé dans la page), `browser.failed` (vue impossible à créer), `browser.reply` (réponse à une commande numérotée).

## Construction

- `dotnet build Tily.slnx` construit tout. La cible `BuildWeb` de `Tily.Host.csproj` lance `pnpm install --frozen-lockfile` puis `pnpm build` si `web/dist/index.html` manque ou en Release ; `web/dist` est copié dans `wwwroot/` à la construction et à la publication.
- Publication autonome : `dotnet publish src/Tily.Host/Tily.Host.csproj -c Release -r win-x64 -p:Platform=x64 --self-contained -o publish`. `EnableMsixTooling` est requis pour que le `.pri` soit publié. `tily-mcp.exe` est publié dans le même dossier, sans second runtime.
- Installeur : `scripts/build-installer.cmd` publie, télécharge le programme d'installation WebView2 Evergreen et compile `installer/Tily.iss` (Inno Setup 6). Installation par utilisateur sans droits administrateur, WebView2 installé seulement s'il manque. La désinstallation lance `Tily.exe --remove-claude-hooks` et propose de supprimer le dossier de données (non par défaut). L'installeur n'est pas signé : SmartScreen avertit au premier lancement. Mise à jour intégrée : `/WAITPID` fait attendre la fin de Tily, `/RELAUNCH=1` relance `Tily.exe` par l'Explorateur avec les droits de l'utilisateur d'origine.
- Release : tag `v<version>` et installeur `Tily-<version>-setup.exe` obligatoires (`gh release create … --generate-notes`) : la mise à jour intégrée cherche cet installeur dans la dernière release et affiche la section « Nouveautés » de ses notes.
- Bêta (branche `develop`) : `scripts/build-installer.cmd beta <version>` publie avec `-p:Channel=beta` et produit `TilyBeta-<version>-setup.exe`, publié en pré-release (`--prerelease --target develop`) que Tily stable et winget ignorent. Tily Beta s'installe à côté de Tily (AppId, dossier, données, notifications et icône propres) ; hooks et serveur MCP restent partagés, car le hook et `tily-mcp.exe` suivent `TILY_DATA_DIR`.
- Développement : `pnpm dev` dans `web/` et l'hôte lancé avec `TILY_WEB_DEV_URL=http://localhost:5173`. `TILY_DATA_DIR=<chemin absolu>` isole session, texte, réglages, états d'agents et profil WebView2, pour lancer une version de développement à côté d'un Tily installé sans écraser sa session.

## Conventions

- Messages d'erreur en français ; les termes Git restent en anglais et invariables (push, pull, fetch, stash, stage, merge, rebase, amend, checkout, cherry-pick, revert). Suffixe `Model` pour les classes de données, suffixe `Async` pour les méthodes asynchrones, aucun commentaire dans le code, fichiers de moins de 400 lignes.
- Les erreurs attendues du pont remontent en `error` au web ; une exception inattendue ne doit jamais faire tomber l'hôte.
