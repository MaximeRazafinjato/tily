# Architecture frontend (web/)

Application React 19 + TypeScript construite par Vite, stylée avec Tailwind 4, état géré par Zustand. Elle tourne dans la WebView2 principale de l'hôte et porte toute l'interface : arborescence des workspaces, onglets, splits, terminaux xterm.js, Leader et palette. Chaque pane navigateur a sa propre WebView2, que l'hôte pose sur le rectangle du pane.

## Structure

Une section par dossier de `web/src` : rôle, invariants et choix non évidents. Le détail des composants, libellés, raccourcis et menus se lit dans le code et dans la spec.

### `main.tsx` et `App.tsx`

`main.tsx` importe `index.css` et monte `App` en `StrictMode`, qui monte deux fois en développement : chaque boucle ou abonnement démarré par `App` rend sa fonction d'arrêt.

`App` est l'unique aiguillage des messages de l'hôte : un `bridge.on` par type, qui confie le message à la fonction `receive…` de son dossier. Il démarre les boucles et notifieurs (`startAttentionNotifier`, `startExternalDrops`, `startStatusLog`, `startDeferredPreviews`, `startBrowserLayer`, `startTextAutosave`), puis envoie `app.ready`.

- À `app.hello`, il pose `data-channel` sur `<html>`, configure les modules et injecte le texte de la session précédente ; il ne charge la session qu'une fois la police de symboles Nerd Font chargée.
- Une réponse numérotée va d'abord à son écouteur (`dispatchReply`) : `browser.reply` et `worktrees.*`, dont `worktrees.done` et `worktrees.failed` vont aussi à l'interface. `terminal.activityResult` va à `paneActivity` s'il porte un numéro attendu, sinon à `closeGuard`. `dialog.picked` est routé par champ : formulaire de worktree, dépôt d'un projet, sinon Paramètres (`hostStore.pickedPath`).
- À chaque nouvelle session, il détruit les terminaux et les vues navigateur des panes disparus, puis sauvegarde (voir « Flux »).

### `src/model/`

Modèle pur, sans React ni DOM : session, panes navigateur, bornes de la taille du texte, motif de la recherche dans les terminaux.

- La session est le miroir du modèle C# : l'hôte la valide (`SessionValidator`) avant de l'écrire et refuse une session invalide (`session.saveFailed`). Un champ nouveau se déclare des deux côtés.
- Les helpers d'arbre ne mutent rien et rendent le même nœud quand rien ne change, ce qui préserve le partage structurel de `sessionStore`.
- Un onglet ou un pane créé par un agent porte `owner`, le pane de cet agent ; `disownTab` le retire d'une copie.
- L'onglet porte l'ouverture et la vue du panneau de droite (`explorer`, `panel`) ; le workspace sa note, reprise par l'onglet fermé qui était son dernier ; la session les largeurs et la disposition du graphe Git. Ratios, largeurs et tailles sont bornés par le modèle ; `FAVORITES_MAX` reprend la limite de l'hôte.
- `searchPattern` rend `null` pour une expression régulière invalide.

### `src/bridge/`

`bridge.ts` envoie et reçoit par `window.chrome.webview` ; `sendWithFiles` joint des fichiers déposés. `messages.ts` et les fichiers par domaine (`browserMessages.ts`, `forgeMessages.ts`, `gitMessages.ts`, `mcpMessages.ts`, `previewMessages.ts`, `statusLogMessages.ts`, `updateMessages.ts`, `worktreeMessages.ts`) sont le miroir du contrat C# décrit dans `docs/BACKEND_ARCHITECTURE.md` : un message se change des deux côtés à la fois.

`requestListeners.ts` tire des numéros de requête à partir de 1 000 000 (`newAgentRequest`), pour ne jamais croiser les numéros propres à chaque store, et associe à chacun un écouteur de réponse. Il sert au serveur MCP et à l'interface : création et suppression de worktree par le formulaire, `browser.snapshot` et toute commande de `requestBrowser`. L'annulation d'une suppression de worktree est signalée à son écouteur (`CANCELLED_REPLY`).

### `src/store/`

Stores Zustand. Seule la session est persistée.

- `sessionStore` : la session et toutes ses mutations, écrites sur un brouillon Immer. Seuls les objets modifiés changent d'identité et une mutation sans effet rend la même session : ni rendu ni sauvegarde. `change` applique une mutation donnée (serveur MCP) ; `browserPanes.ts` et `paneMoves.ts` portent des mutations du brouillon. Un onglet dupliqué n'appartient à aucun agent.
- Reçu de l'hôte : `hostStore` (shells, projets, contextes Git par pane, réglages, statut, Leader, « Non enregistré »), `shortcutStore`, `agentStore`, `statusLogStore`, `browserStore`, `updateStore`.
- Interface : `uiStore` (renommages et leur origine, palette, sélecteur de projets et Paramètres mutuellement exclusifs, glisser, pane agrandi, confirmation de fermeture), `paneStore`, `pasteStore`, `commandStore`, `terminalSearchStore` (texte et options partagés par la barre d'un pane et la recherche globale).
- Fonctions : `explorerStore`, `gitStore`, `forgeStore`, `mergeRequestFormStore`, `worktreeStore`, `previewStore`, `projectOpenStore`, `filePickerStore`, `commitPickerStore`, `mcpConsentStore`.

Invariants :

- Une requête numérotée garde son numéro dans son store ; une réponse dépassée est ignorée. `hostStore.setContext` et `forgeStore` ignorent un résultat inchangé, pour ne rien redessiner.
- `paneStore` : `markAlive`, appelé à chaque `terminal.cwd`, efface un échec ou une fin du shell mais garde un dossier disparu jusqu'au choix de l'utilisateur, car à la restauration le shell démarré dans le dossier personnel signale aussitôt ce dossier. Un dossier disparu ignoré reste ignoré pour ce pane.
- `agentStore` : états remplacés à chaque `agent.states` ; un acquittement masque la carte d'attention jusqu'au prochain changement d'état du pane.
- Toute fenêtre modale tenue par un store est comptée par `AppShell` (voir `components/`).

### `src/terminal/`

Terminaux et cycle de vie des panes (section 7 de la spec).

`terminalRegistry` garde une instance xterm.js par pane, hors React, pour survivre aux changements d'onglet et aux remontages.

- Le terminal naît au premier attachement de son `TerminalPane`, qui envoie `terminal.create` : un pane jamais affiché n'a ni instance ni processus. `restart` renvoie `terminal.create` sur la même instance. Un pane déplacé vers un autre onglet garde son terminal sous le même identifiant.
- L'effet d'attachement de `TerminalPane` dépend de l'identifiant du pane, pas de l'objet, pour qu'une mutation de session ne relance ni attachement ni `fit()`.
- `terminal.output` s'écrit directement dans l'instance, sans React ; des acquittements (`terminal.ack`) régulent le flux.
- Rendu WebGL, repli DOM (xterm.js 6 n'a pas de rendu canvas). Au plus 14 contextes WebGL, Chromium retirant le plus ancien au-delà de 16 : le terminal caché affiché le moins récemment rend le sien et le retrouve à son prochain affichage, jamais un terminal visible. Après une perte de contexte, le terminal passe en DOM et WebGL est retenté à son prochain affichage.
- `runAtStart` retient une commande envoyée une seule fois avec le premier `terminal.create` du pane : `claude` et l'installation d'un worktree créé, commande de démarrage d'un outil MCP.
- URL, hyperliens OSC 8 et chemins de fichiers (`fileLinks.ts`) ne s'ouvrent qu'au Ctrl + clic, le clic simple restant à la sélection. Tous les schémas passent à l'hôte, qui les valide et signale un refus.

Persistance du texte (`textPersistence.ts`) :

- L'historique au-dessus de la zone visible ne change pas : il est sérialisé une seule fois, en morceaux bornés par des repères xterm.js, pendant les temps morts (`requestIdleCallback`). Ce cache est vidé au redimensionnement et au changement de buffer ; le buffer alternatif est toujours sérialisé en entier.
- Le texte des onglets fermés reste en mémoire, hors du store ; après un échec d'écriture, `markTextSaveFailed` fait tout renvoyer.
- `prime` réinjecte le texte suivi d'un séparateur (onglet rouvert, session restaurée) avant de lancer un nouveau processus ; aucune commande n'est rejouée.

Suivi des commandes (`commandOutput.ts`, `commandNotices.ts`) :

- Le shell intégré annonce exécution, fin et invite par `OSC 6973`, son dossier par `OSC 7` ; un shell sans ces séquences reste non suivi.
- Un repère xterm.js est posé à l'Entrée qui lance une commande. ConPTY sous Windows 10 transmet les séquences OSC avant d'avoir dessiné la fin de la sortie : le repère de fin suit le curseur après l'invite jusqu'à la première frappe, et la plage n'est validée qu'à l'annonce `done`.
- Ces repères servent la copie de la sortie de la dernière commande, Alt + PgUp / PgDn (`scrollToCommand`) et le serveur MCP (`commandTracking`, `nextOutputRow`, `onCommandFinished`).
- Une commande longue finie hors de l'onglet affiché est signalée sur son onglet et son workspace (`commandStore`), à défaut d'état d'agent.

Fermetures et dépôts :

- Toute fermeture passe par `requestClose` (`closeGuard.ts`), qui demande `terminal.activity` à l'hôte et ne confirme que si un programme tourne ; `app.closing` et Alt + F4 aussi. Fermer garde le texte pour la réouverture (`tabLifecycle.ts`) ; les fermetures du serveur MCP le gardent aussi sans repasser par `closeGuard`.
- `externalDrop.ts` : des fichiers venus de Windows partent en objets joints de `terminal.drop`, une ligne de l'arbre des fichiers dans `terminal.dropPath` ; l'hôte protège le chemin selon le shell. Un glisser de l'arbre n'est accepté que si sa valeur commence par un jeton aléatoire tiré au chargement de la page (`treeDragValue`) : Chromium transporte aussi les types personnalisés venus d'autres applications, et `dragend` arrive dès le début d'un glisser dans la WebView2, il ne peut pas servir de repère. Un pane recouvert par un message refuse le dépôt, pour ne rien taper dans un terminal masqué ; tout autre dépôt de fichiers ou de liens est refusé, sinon Chromium l'ouvrirait dans une nouvelle fenêtre.

Autres modules :

- `terminalActions.ts` : `focusPane` vise le bouton par défaut du message qui recouvre le pane, sinon son terminal ; tout retour de focus vers un pane passe par lui. `joinPane` acquitte l'état de l'agent, sélectionne workspace, onglet et pane, et masque le graphe Git s'il recouvre les terminaux. Un collage de plusieurs lignes demande confirmation quand le programme n'a pas activé le collage délimité.
- `contextActions.ts` agit sur le dossier réel du pane et relit son contexte Git à chaque `terminal.cwd`, donc après chaque commande ; `gitSummary` n'invente jamais de valeur.
- `paneSearch.ts` charge `@xterm/addon-search` à la première recherche d'un terminal, hors `terminalRegistry` ; `globalSearch.ts` relève les lignes des terminaux créés à l'ouverture de la recherche globale.
- `paneZoom.ts` n'agrandit que le pane actif d'un onglet d'au moins deux panes : `SplitView` ne rend que lui, les autres terminaux restant dans `terminalRegistry`. Le zoom cesse dès que le pane actif ou l'onglet change.
- `paneLifecycle.ts` : relance, dossier de repli, changement de shell ou abandon du signalement ; aucun repli silencieux.

### `src/keyboard/`

Raccourcis (section 8 de la spec). L'enum `Command` partage ses identifiants avec `ShortcutCatalog` côté hôte. Les combinaisons en vigueur viennent de l'hôte (`app.hello`, `settings.result`) dans `shortcutStore` ; leurs valeurs par défaut sont dans `ShortcutCatalog` et la spec.

- Une seule fonction `runCommand`, déclenchée par le Leader puis une touche ou par un raccourci direct.
- Tout est intercepté dans xterm.js (`attachCustomKeyEventHandler`), jamais par l'hôte. Hors d'un terminal, `handleDocumentShortcut`, écouté par `AppShell`, applique les mêmes raccourcis directs, sauf dans un champ, un menu, un dialogue, sous une fenêtre modale ou quand un composant a déjà traité la touche.
- Pendant le Leader, `handleLeaderKeyCapture`, en phase de capture sur le document, traite la touche suivante avant tout composant. Échap annule ; une touche sans commande ou un second Leader rend la frappe au terminal (Ctrl + Espace atteint ainsi PSReadLine). Leader puis un chiffre de 1 à 8 sélectionne cet onglet du workspace actif, 9 le dernier (`selectTabNumber`), sans réglage.
- Les événements en cours de composition IME passent toujours au terminal.
- Dans un terminal : Ctrl + C copie s'il y a une sélection, sinon interrompt ; Ctrl + V colle toujours ; Maj + Entrée et Ctrl + Entrée envoient Échap + Entrée quand un agent est connu dans le pane ; Alt + PgUp / PgDn passent à la commande précédente ou suivante, sauf sur l'écran alternatif, où la touche va au programme.
- Un composant qui traite lui-même un raccourci de l'application (vue Git, graphe, arbre des fichiers) le reconnaît par `isCommandShortcut(event, Command…)`, jamais par une combinaison écrite en dur : les raccourcis personnalisés s'y appliquent aussi.
- Les flèches (directes ou après Leader) changent de pane d'après les rectangles DOM (`paneNavigation`).
- `leaderKeyOf` (`keyChords.ts`) fait le même calcul que le script injecté dans les pages des panes navigateur.
- `shortcutRules.ts` reprend les règles de l'hôte pour signaler aussitôt une combinaison réservée dans Paramètres ; l'hôte reste juge.
- `typeAhead.ts` : recherche par premières lettres, sans casse ni accents, partagée par l'arbre des fichiers et le panneau des workspaces.

### `src/palette/`

Palette de commandes (section 8 de la spec), sans React. `paletteItems.ts` construit la liste : en tête une entrée « Rejoindre » par pane en attente d'un agent, de l'attente la plus ancienne à la plus récente, puis commandes, onglets fermés restaurables et navigation vers chaque workspace, onglet et pane. `searchFilter.ts` filtre pour la palette et tous les sélecteurs fondés sur `SearchDialog`.

- Recherche par mots, sans casse ni accents, `/` et `\` confondus ; chaque mot doit correspondre ; tri par score, l'ordre de la liste départageant. Le libellé compte plus que l'indice (`searchText` : chemin complet, SHA) ; une faute de frappe ou des initiales trouvent encore le libellé.
- Les favoris (`session.favorites`) sont des identifiants stables de commandes : ni les entrées « Rejoindre » ni les onglets fermés, dont l'identifiant ne dure pas, ne portent d'étoile. `toggleFavoriteCommand` retire d'abord les favoris orphelins, puis refuse un favori au-delà de `FAVORITES_MAX`, car l'hôte refuserait la session.
- L'indice d'un pane porte sa branche Git, pour le retrouver par le nom de sa branche.

### `src/components/`

Un composant par fichier, à plat, préfixé par domaine : `Git*`, `MergeRequest*`, `Worktree*`, `Settings*` et `*SettingsSection`, `Workspace*` et `Header*`, `File*`, `Browser*`, `Pane*`, `Split*`, `Tab*`, `Agent*`, `Update*`. Les `.ts` du dossier portent classes partagées (`*Styles.ts`), hooks (`use*.ts`), gestes de glisser et gestionnaires stables. Briques communes : `ActionMenu` et `FloatingMenu`, `SearchDialog`, `Tooltip` et `InfoTip`, `Icon`, `Spinner`, `TruncatedName`, `InlineNameEditor`, `SidebarResizer` et `SplitResizer`.

- `AppShell` est la racine : il monte panneaux, fenêtres, menus, infobulle et barre de statut, écoute le clavier sur le document et compte les fenêtres modales (`confirmationOpen`). Il ne s'abonne qu'aux valeurs qu'il affiche (`useShallow`), lit les actions par `getState()` et définit hors du composant les gestionnaires transmis aux composants mémoïsés.
- Les composants mémoïsés (`PaneView`, `WorkspaceItem`, `FileTreeRow`, `GitGraphRow`…) reçoivent des objets de gestionnaires stables (`WorkspacePanelActions`, `HeaderWorkspaceActions`, `FileTreeHandlers`, `GitGraphRowHandlers`) qui lisent les stores au moment de l'appel.
- Fenêtre modale : `role="dialog"` ou `role="alertdialog"`, `keepTabInside` (`focusTrap.ts`) en `onKeyDown`, comptage dans `confirmationOpen`, qui bloque les raccourcis du document. Le piège de Tab compte comme étape une zone qui défile sans rien de focalisable, comme Chromium, pour que le focus ne parte jamais vers un terminal masqué qui garderait Tab. Ces rôles figent aussi les panes navigateur (voir `browser/`).
- Confirmation : le bouton de confirmation a le focus, Entrée confirme, Échap, « Annuler » ou un clic hors de la boîte annule. Une demande venue d'un agent (accord MCP, suppression de worktree) met le focus sur le refus et n'active la confirmation qu'après un court délai, pour qu'une frappe destinée ailleurs n'accorde rien.
- `SearchDialog` est la boîte commune de la palette et des sélecteurs (projets, dépôts, worktrees, fichiers, commits). La recherche dans tous les terminaux (`TerminalSearchDialog`) est à part et partage seulement `SearchOptionToggles` avec la barre de recherche d'un pane.
- Un menu se ferme avant d'exécuter son entrée et rend le focus à son origine. Après une fenêtre, un renommage ou le repli d'un panneau, le focus revient au pane actif par `focusPane`.
- Le focus qui entre dans un pane inactif le rend actif : la saisie et le pane actif ne divergent jamais. Tant qu'un message (`PaneOverlay`) recouvre un pane, le terminal sort de l'ordre de Tab ; le bouton par défaut du message prend le focus, « Ignorer » pour un dossier disparu car le shell y tourne encore. Juste après une prise de focus automatique venue du terminal, Entrée et Espace sont annulés (`ACTIVATION_GUARD_MS`), pour qu'une frappe partie vers le terminal n'active pas le bouton ; un pane inactif qui réapparaît ne vole jamais le focus.
- Un seul `Tooltip`, monté par `AppShell`, affiche le texte de `data-tip` en position fixe, jamais tronqué ; sans `data-tip`, un texte coupé par `truncate` montre son texte complet au survol. Jamais d'attribut `title`.
- Listes longues virtualisées par `useVirtualRows` (graphe et diff Git).
- Onglets et workspaces se glissent par événements pointeur (`pointerDrag.ts`, `tabDrag.ts`, `workspaceDrag.ts`, cible par `elementFromPoint` sur des attributs `data-drop-*` et `data-workspace-*`) ; les instances xterm.js suivent leurs panes sans être recréées. Seule une ligne de l'arbre glissée vers un pane utilise le glisser-déposer HTML5.

### `src/panel/`

`rightPanel.ts` : panneau de droite à trois vues (Fichiers, Git, Notes), sans onglets ; ouverture et vue appartiennent à l'onglet, largeur à la session.

- `togglePanelView(vue, focus)` ouvre le panneau sur la vue demandée, passe d'une autre vue à celle-ci, ou ferme le panneau si cette vue était déjà affichée, puis donne le focus à la vue ou le rend au terminal. `openPanelView` ouvre sans jamais fermer (Ctrl + clic sur la branche d'un pane, recherche d'un commit).
- Ouvrir la vue Git rouvre toujours le graphe, qui recouvre les terminaux de l'onglet et prend le focus.
- `revealInFileTree` et `showFileChanges` réessaient jusqu'au chargement de la ligne ou d'un état Git frais, annulés par un compteur de génération ; le premier ne prend le focus que s'il est libre ou déjà dans l'arbre. `showFileChanges` compare les chemins à partir de `displayRoot`, racine vue du dossier suivi, pour rester juste sous une jonction ou un lecteur `subst`.

### `src/explorer/`

Vue Fichiers et sélecteur de fichiers du projet (section 3 de la spec), sans React.

- `fileTree.ts` aplatit l'arbre visible en lignes et rend les dossiers à surveiller : la racine, dossier du pane actif, et chaque dossier déplié visible. `files.watch` ne part que si cette liste change ; `FileExplorer` envoie une liste vide au démontage.
- Après une création ou un renommage, le focus rejoint la ligne seulement si personne d'autre ne l'a pris.
- Un clic ou Entrée sur un fichier prévisualisable ouvre l'aperçu ; un double-clic ou Entrée ouvre dans l'éditeur un fichier sans aperçu. L'hôte décide quels fichiers ont un aperçu.
- `gitMarks.ts` indexe les marques Git par chemin en minuscules ; chaque dossier ancêtre d'une modification, jusqu'à la racine du dépôt, porte une marque.
- `projectFileActions.ts` : « Ouvrir un fichier du projet… » (`files.search`), fichiers modifiés puis derniers choisis en tête.

### `src/preview/`

Aperçu et édition des fichiers, dans un tiroir posé sur la zone des terminaux avec la vue Fichiers (section 3 de la spec).

- `receivePreview` n'accepte que le fichier affiché. Les liens ne naviguent jamais : une ancre défile localement, tout autre lien part à l'hôte (`preview.follow`).
- `preview.requested` (page HTML ouverte par Claude Code dans un pane) s'affiche si l'onglet de ce pane est affiché, sans prendre le focus ; sinon elle attend (`previewStore.deferred`, une par onglet) que l'onglet soit affiché. Aucun changement d'onglet automatique.
- `renderPreview.ts` assainit le Markdown rendu par DOMPurify et réécrit les images relatives vers l'adresse servie par l'hôte. Une page HTML tourne dans une iframe `sandbox="allow-scripts allow-popups"` : origine opaque, ses scripts n'ont aucun accès à Tily.
- `previewEdit.ts` : le brouillon part du texte lu, fins de ligne ramenées à LF, et de la `version` de l'hôte. `guardEdits` demande confirmation avant de fermer, d'ouvrir un autre fichier (`preview.requested` compris) ou de quitter l'édition avec des modifications. Un rechargement d'une autre version remplace un brouillon non modifié, sinon le garde et affiche le conflit.
- `LazyFilePreview` charge le tiroir, marked, highlight.js et DOMPurify dans leur propre fichier JavaScript au premier aperçu ; CodeMirror (`editorSetup.ts`) se charge avec `TextEditor` à la première édition.

### `src/git/`

Vue Git (section 10 de la spec), sans React. Toute opération s'exécute dans l'hôte ; le web choisit, confirme et affiche.

- `gitRequests.ts` : `git.watch` part seulement quand le dossier change. Chaque lecture porte un numéro et `gitStore` ignore les réponses dépassées ; un changement de dépôt remet l'état à zéro. `revealCommit` charge des pages jusqu'à trouver le commit, avec un plafond. `retryOnFailure` / `takeRetry` changent un échec codé (`notMerged`, `conflictMarkers`) en confirmation, puis en demande confirmée.
- `gitRefActions.ts` : merge, rebase, cherry-pick, revert (`revertCommit`), checkout, reset, branches, tags, stash, saisies en place. `gitMenus.ts`, `gitChangeMenu.ts`, `gitGraphActions.ts`, `gitRefSelection.ts` : menus et sélections multiples ; une suppression groupée passe par une seule confirmation.
- `gitDiffActions.ts` envoie `git.stageLines`, `git.unstageLines` ou `git.discardLines` avec l'empreinte du diff : l'hôte refuse si le fichier a changé, et la sélection est vidée quand l'empreinte change. `gitDiffText.ts` copie le patch brut reçu de l'hôte (« Copier le diff »), refusé avec sa raison pour un diff tronqué ou hors UTF-8.
- `gitDrag.ts` : glisser d'une branche par événements pointeur sur `data-git-drop-*` ; une cible n'est acceptée que si l'une des deux branches est la branche courante et qu'aucune opération n'est en cours ; le dépôt ouvre le menu Merge / Rebase.
- `gitReceivers.ts` : un état ou `git.changed` recharge le diff affiché, dont le volet suit un fichier passé d'un groupe à l'autre ; des conflits ramènent à la ligne WIP ; `git.done`, `git.failed` et `git.pushRejected` terminent l'opération en cours (`gitBusy.ts`).
- `gitFocus.ts` : `takeFocusFromCoveredTerminals`, appelé par `AppShell` à chaque affichage du graphe, donne le focus au graphe s'il était resté sur la page ou sur un terminal recouvert.
- `commitSearch.ts` : la recherche d'un commit (`CommitPicker`) ouvre la vue Git puis appelle `revealCommit`.
- `gitStore` garde aussi le brouillon du message de commit par dépôt (`drafts`) et le dépôt du commit en cours (`committing`).

### `src/forge/`

MR/PR GitHub et GitLab (section 10 de la spec). Toute la logique d'hébergeur reste dans l'hôte (`gh`, `glab`).

- `mergeRequestActions.ts` : seule la dernière réponse de liste compte. Les MR/PR d'une branche (`forge.branch`) sont demandées à chaque contexte Git d'un pane, donc après chaque commande ; l'hôte garde la réponse en cache.
- `mergeRequestFormActions.ts` : une comparaison ne remplace titre et description que s'ils n'ont pas été modifiés à la main, et jamais en modification. « Enregistrer » n'agit qu'après un changement ou avec un push demandé ; fermer une MR/PR demande un second clic. Après une création ou une modification, pastilles et liste sont relues de force ; un échec reste dans le formulaire, ou va dans la barre de statut s'il a été fermé.
- `mergeRequestMenu.ts` : le menu se ferme avant d'agir et le focus revient à l'élément d'origine, que le formulaire retient à son tour.

### `src/worktree/`

Worktrees natifs (section 10 de la spec). Création, suppression et effacement s'exécutent dans l'hôte ; le web tient le formulaire, la confirmation et les panes.

- L'hôte exécute les opérations une à une, dans l'ordre d'envoi. Chacune porte un numéro tiré de `requestListeners` et reste dans `worktreeStore.tasks` jusqu'à son bilan ; les opérations du serveur MCP entrent dans la même file.
- `worktrees.create` ne part que quand le plan à jour (`worktrees.plan`, redemandé à chaque modification) donne un dossier sans erreur.
- `openCreatedWorktree` confie à `runAtStart` `claude` dans le pane du workspace créé, puis l'installation dans le même pane ou, avec Claude, dans un pane en dessous ; le pane de Claude reste actif.
- Suppression : une seule case « Fermer ces onglets et panes » pour tous les panes concernés ; à la confirmation, `requestClose` porte sur ces panes, qui se ferment (onglet entier quand tous ses panes sont dans le worktree), puis `worktrees.remove` part. Un refus de l'hôte rouvre la confirmation avec « Réessayer ». L'annulation d'une suppression demandée par le serveur MCP, ici ou dans `closeGuard`, est signalée à `requestListeners`.
- `worktreePaths.ts` compare les dossiers sans casse et rattache les panes à leur worktree d'après `worktreeRoot` des contextes Git.

### `src/project/`

`projectOpenActions.ts` (section 9 de la spec) : un worktree s'ouvre tel quel ; un projet demande `projects.repositories` et s'ouvre aussitôt s'il n'a qu'un candidat, sinon le sélecteur passe au choix du dépôt (`projectOpenStore`).

### `src/browser/`

Panes navigateur (section 6 de la spec). Un `Pane` de type `PaneKind.Browser` garde `url` et `viewport` en plus du dossier et du shell du pane d'où il a été ouvert. Sa page vit dans une WebView2 posée par l'hôte ; le web ne rend que l'en-tête et un corps vide (`BrowserPaneView`, à la place de `PaneView`, corps `[data-browser-body]`).

- `browserLayer.ts` : une boucle `requestAnimationFrame` envoie `browser.attach` à la première apparition d'un corps, `browser.bounds` quand son rectangle change, `visible: false` quand il quitte le DOM. Un pane navigateur compte comme démarré dès qu'il a été affiché ; `disposeMissingBrowsers` ferme la vue des panes sortis de la session.
- La WebView2 de la page n'est pas transparente : rien de l'interface ne peut s'afficher par-dessus. Quand un `role` `menu`, `dialog` ou `alertdialog` est ouvert, qu'une infobulle (`role="tooltip"`) chevauche le pane ou qu'un élément recouvre l'un des 16 points échantillonnés, la page est figée : capture `browser.snapshot` affichée dans le corps, vue masquée une fois l'image chargée, puis réaffichée à la fin. Un élément flottant nouveau doit porter l'un de ces rôles ou couvrir un point échantillonné.
- `restoreBrowserFocus` rend le focus à la page du pane actif après un raccourci renvoyé par la page ou la fin du Leader, si rien d'autre ne l'a pris. `browser.key` passe par `handleForwardedKey` (`browserKeys.ts`).
- `requestBrowser` (`browserRequests.ts`) numérote une commande `browser.*` et attend son `browser.reply`, avec un délai.

### `src/agents/`

États des agents (section 11 de la spec). L'hôte lit les états écrits par les hooks Claude Code ; le web les reçoit dans `agent.states` et les présente.

- `longestWaitingFirst` (`agentSummary.ts`) classe les attentes de la plus ancienne à la plus récente : même ordre dans la palette, les cartes d'attention et le passage au pane en attente suivant.
- `attentionNotifier.ts` envoie `attention.raise` une seule fois par état-message, pour une attente nouvelle et non acquittée, et pour un passage à « Terminé », sauf un agent interrompu. L'hôte décide de la notification selon l'activation de la fenêtre et les réglages.
- Rejoindre un pane acquitte l'état de son agent. Aucune prise de focus ni changement de workspace automatique : la saisie n'est jamais interrompue.

### `src/mcp/`

Outils du serveur MCP calculés côté interface (section 11 de la spec), un module par groupe d'outils. `mcpRequests.ts` reçoit `mcp.request` et répond toujours par `mcp.response`, avec `result` ou une `error` en français ; un outil inconnu demande de mettre Tily à jour.

- La requête désigne le pane appelant. Ce qu'un agent crée lui appartient (`owner`) ; `layoutOf` marque `caller`, `active`, `started` et `mine`, avec l'état d'agent et, pour un pane navigateur, adresse, titre, largeur et erreurs.
- Un pane pas encore affiché n'a pas de terminal : les outils des terminaux le refusent, comme un pane navigateur. Un onglet créé avec une commande s'affiche pour que son terminal démarre.
- Une action hors des panes de l'agent demande l'accord (`requireConsent` : file `mcpConsentStore`, `McpConsentDialog`, clignotement de la barre des tâches, refus d'office après 2 minutes) ; l'état du pane est revérifié après l'accord.
- `run` écrit par `terminal.input(…, false)`, qui passe par `onData` comme une frappe sans prendre le focus ; jamais dans le pane appelant, ni sur un shell terminé, un programme plein écran ou une commande en cours. `close` ne vise jamais le pane appelant ni son onglet, et se passe d'accord seulement pour un élément entièrement à l'agent et au repos.
- `waitFor` ne relit que les lignes nouvelles grâce à un repère xterm.js et laisse ConPTY finir de dessiner avant de conclure.
- Une suppression de worktree est refusée pour le dépôt principal, pour le worktree du pane appelant et tant qu'une autre confirmation de suppression est affichée ; sinon la confirmation de l'interface s'ouvre préremplie avec l'agent demandeur.
- Outils navigateur : sans pane indiqué, le dernier navigateur ouvert ou désigné par l'agent, sinon son dernier navigateur, sinon le seul de son onglet ou de Tily ; un navigateur jamais affiché est refusé.

### `src/statusLog/`

`statusLogActions.ts` (section 3 de la spec) : `startStatusLog` observe `hostStore.status` et envoie `statusLog.append` pour chaque nouveau message, sans toucher aux appelants de `setStatus` ; l'hôte horodate et renvoie l'entrée. Le journal garde 500 entrées, comme l'hôte.

### `src/update/`

`updateActions.ts` (section 13 de la spec) : aucune logique de version ni de téléchargement côté web. `installUpdate` envoie `update.install` ; une fois l'installeur prêt, il demande la fermeture de toute l'application à `closeGuard`, puis envoie `update.apply` ; `update.restart` déclenche `closeApplication`.

### `src/index.css`

Import Tailwind, police de symboles Nerd Font embarquée, tokens `--color-tily-*`.

- `--font-mono` est réservée au contenu de code : terminaux, diff, aperçu et édition de fichiers, sorties de commandes, texte collé, détail MCP, lignes de la recherche dans les terminaux, code des notes de version. Tout le reste est en `--font-sans`, en 11, 12, 13 ou 15 px, la racine étant à 13 px.
- Les couleurs saturées d'état d'agent (`--color-tily-status-*`) sont réservées aux icônes et pastilles d'agents. Le diff, les huit voies du graphe Git, les MR/PR fusionnées et la syntaxe ont leurs tokens.
- Contour `:focus-visible` global en `tily-focus` ; barres de défilement fines, sans flèches et discrètes partout, terminaux compris.
- En bêta (`html[data-channel='beta']`), accents, fonds, bordures, textes et barres de défilement prennent le bleu de l'icône Tily Beta ; couleurs d'état, de diff, de voies Git et de syntaxe ne changent pas.

## Flux

1. `App` envoie `app.ready` ; l'hôte répond `app.hello` avec la session persistée (ou initiale), les shells disponibles, le texte des panes de la session précédente et les réglages de persistance. Le texte est injecté dans chaque pane avant le premier attachement ; un message `recovery` s'affiche en avertissement quand un fichier a été mis en quarantaine.
2. `sessionStore.load` charge la session ; `SplitView` rend l'arbre de l'onglet actif ; chaque `TerminalPane` demande `terminal.create` à son premier attachement.
3. Toute mutation du store produit une nouvelle session par partage structurel (Immer : objets non modifiés conservés, session produite figée, jamais de mutation en place) ; `App` la sauvegarde après 500 ms de calme via `session.save` et détruit les terminaux dont le pane n'existe plus (le texte est alors renvoyé pour purger `text.json`). Le texte des terminaux part indépendamment toutes les 30 s (seuls les panes modifiés ; l'historique déjà sérialisé est réutilisé, le reste l'est par tranches pendant les temps morts) et à la fermeture ; un échec d'écriture affiche « Non enregistré » dans le pied de page jusqu'à la prochaine écriture réussie.
4. `terminal.cwd` (émis à chaque prompt) met à jour `pane.path` et efface un échec ou une fin du shell signalés pour le pane ; quand ni le dossier ni le nom automatique de l'onglet ne changent, la session n'est pas modifiée : aucun rendu ni aucune sauvegarde ; le nom automatique de l'onglet, le contexte Git et les actions de dossier suivent ce chemin, ce qui couvre `wtr`. `terminal.pathMissing` (après `rmwt` ou au démarrage) marque le pane comme dossier disparu sans le fermer. `terminal.output` va directement à l'instance xterm.js sans passer par React.

## Règles

- Le modèle et le pont ne connaissent pas React. Les composants ne contiennent pas de logique métier : ils appellent les actions du store.
- Les handlers sont des fonctions nommées (`handleSelect`, `handleClose`), pas de lambdas inline avec logique dans le JSX.
- Enums TypeScript plutôt que types union pour les valeurs fermées (`SplitAxis`, `StatusLevel`, `Renderer`). `erasableSyntaxOnly` est désactivé pour cela.
- Couleurs via les tokens `tily-*` de `index.css`, jamais en dur dans les composants. Le thème xterm.js est centralisé dans `terminalRegistry`, fond, texte, curseur et sélection suivant le canal reçu dans `app.hello` (`setChannel`).
- Textes visibles en français. Les termes Git restent en anglais et invariables, employés comme des noms : Push, Pull, Fetch, Stash, Stage / Unstage (Staged / Unstaged), Merge, Rebase, Amend, Checkout, Cherry-pick (« Push vers origin/main », « Faites un pull »).
- Fichiers de moins de 400 lignes, un composant exporté par fichier.
- Interface sobre (section 3 de la spec) : une action secondaire est un bouton icône seul avec `aria-label` et infobulle « action (raccourci) », sans geste secondaire (double-clic, glisser, clic droit), sauf le Ctrl + clic sur la branche de l'en-tête d'un pane, qui ouvre la vue Git et que son infobulle rappelle ; les actions principales et les états importants gardent leur texte ; aucune aide clavier permanente dans un dialogue, le raccourci va dans l'infobulle de son bouton (« Entrée », « Échap ») ; une explication détaillée va dans un `InfoTip`.

## Commandes

```
cd web
pnpm install
pnpm dev        # serveur Vite sur http://localhost:5173, à combiner avec TILY_WEB_DEV_URL côté hôte
pnpm build      # tsc -b puis vite build vers web/dist
pnpm lint       # oxlint
```

L'interface web n'a pas de tests automatisés ; le modèle est validé côté hôte par `SessionValidator` et ses tests xUnit.
