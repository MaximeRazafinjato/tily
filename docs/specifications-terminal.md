# Tily — Spécifications

Description fonctionnelle de Tily, terminal Windows, telle que l’application la met en œuvre aujourd’hui. Le nom vient de *mitily*, « guetter » en malgache.

## 1. Objectif et périmètre

Créer un véritable terminal Windows, organisé en workspaces libres, avec une interface légère permettant de naviguer rapidement entre plusieurs activités. L’utilisateur garde la liberté d’exécuter ses commandes, scripts et outils interactifs habituels.

Le panneau de gauche présente les workspaces et leurs onglets. Les états d’agents fournissent des indications d’attention dans cette organisation.

Claude Code, lancé par l’utilisateur dans un pane, peut lire et organiser Tily par un serveur MCP (section 11, « Pilotage par Claude Code (MCP) »). Une action qu’il demande ainsi vaut action explicite de l’utilisateur : l’exclusion de la création ou de la fermeture automatique de workspaces ne s’applique pas à ce cas.

### Hors périmètre actuel

- Couche « Projet » obligatoire au-dessus des workspaces.
- Maintien des agents ou serveurs en arrière-plan après fermeture de l’application ; reprise des processus après réouverture.
- Conversation complète d’un agent (transcript rendu) et orchestration entre agents (file de tâches, dépendances entre tâches).
- Création ou fermeture automatique de workspaces liée au cycle de vie des worktrees : seules les actions explicites de l’utilisateur en ouvrent ou en ferment (voir la gestion des worktrees en section 10). Une action demandée par le serveur MCP de Tily par un agent que l’utilisateur a lancé vaut action explicite (section 11, « Pilotage par Claude Code (MCP) »).
- Modèles de workspace et mode focus dédié.
- Recherche globale dans le contenu des fichiers du projet.
- Catalogue de thèmes ou couleur au choix : Tily est vert, Tily Beta bleu (section 3).
- Choix de la police des terminaux, zoom de l’interface et adaptation aux très petites dimensions de fenêtre ; seule la taille du texte des terminaux se règle.

## 2. Modèle fonctionnel

Hiérarchie : **Workspace → Onglet → Pane de terminal**.

| Entité | Définition | Invariants |
| --- | --- | --- |
| Workspace | Groupe nommé d’onglets, sans dossier unique imposé. | Chaque onglet appartient à un workspace. Un workspace « Général » est créé au premier lancement ; ensuite, Tily peut n’en avoir aucun (état vide, section 4). |
| Onglet | Activité contenant un ou plusieurs panes, avec sa disposition de splits. | Chaque pane appartient à un onglet. L’onglet conserve un pane actif. |
| Pane | Instance de terminal avec shell, dossier courant, sortie et état de processus. | Le dossier réel est suivi pendant la session. |
| Split | Division d’une zone en deux sous-zones, éventuellement subdivisées. | Orientation et proportions sont conservées. |
| Activité d’agent | Information rattachée à un pane lorsqu’une intégration le permet. | Elle ne devient pas une couche de navigation obligatoire. |

Exemple : « Perso » peut contenir un terminal dans Documents, un autre dans un dépôt Git et un troisième dans un dossier de scripts. Aucun projet commun n’est requis.

Utiliser des identifiants stables indépendants des noms. Deux workspaces ou onglets peuvent porter le même nom sans collision. Renommer un élément ne modifie ni son dossier ni sa branche.

## 3. Direction visuelle et disposition

Tily vert en thème sombre : fonds gris anthracite, accent vert sauge désaturé, terminaux sombres, en-tête compact, panneau gauche en arborescence. Maximiser l’espace disponible pour les terminaux. Tily Beta, installable à côté de Tily, garde la même disposition en bleu (accent #6a96d4, fonds #14181e et #1b1f26, terminaux #101318) ; l’en-tête et le titre de sa fenêtre disent « Tily Beta ».

| Zone | Contenu |
| --- | --- |
| En-tête compact | Bouton de visibilité du panneau des workspaces, nom de l’application, puis, panneau replié, la bande des workspaces (section 4) ; à droite, le bouton de mise à jour quand une version est disponible et l’engrenage des Paramètres. Pendant une séquence Leader, l’aide de ses touches s’y affiche. |
| Barre d’onglets | Onglets du workspace actif, bouton « + » et, à droite, les icônes Fichiers, Git et Notes du panneau de droite. |
| Zone de travail | Panes et séparateurs, occupant la hauteur restante. |
| En-tête d’un pane | Dernier dossier du chemin courant (chemin complet en infobulle), branche Git et pastille de MR/PR, shell s’il n’est pas celui par défaut, badge d’agent et marque « créé par Claude », puis les actions du pane : copier le chemin, ouvrir dans l’éditeur et dans l’explorateur, splits, réduire et fermer (détail ci-dessous et section 10). |
| Panneau gauche | Workspaces, chevrons de dépliage, onglets enfants, accès aux projets et indications d’attention. |

Le titre de la fenêtre, visible dans la barre des tâches et Alt + Tab, reprend le workspace et l’onglet actifs : « workspace › onglet - Tily », ou « Tily » sans workspace.

### Règles de présentation

- Pas de bordure ou barre colorée pour signaler un onglet sélectionné, un workspace sélectionné ou un résultat de palette sélectionné. Utiliser un fond discret.
- Conserver les lignes fines de l’arborescence : elles représentent la hiérarchie, pas une sélection.
- Éviter titres de section redondants, slogan, texte d’aide permanent, chemin global répété, barre d’état sans utilité immédiate et gros blocs de présentation.
- Préférer les infobulles et noms accessibles pour les boutons compacts.
- Réserver les fenêtres modales aux interactions qui en bénéficient réellement, notamment la palette. Les actions courantes sont directes, inline ou contextuelles.

Une action secondaire est un bouton icône seul, avec son nom et son raccourci en infobulle (« Fichiers (Ctrl+Maj+E) ») ; les gestes secondaires (double-clic, glisser, clic droit, Maj + clic) ne figurent pas dans les infobulles, seulement dans cette spécification. Les actions principales (Commit, Créer, Enregistrer) et les états importants gardent leur texte. Les raccourcis s’affichent sans espaces (« Ctrl+Maj+T »). Les aides clavier sont dans l’infobulle des boutons, jamais dans l’en-tête des dialogues, et l’aide des sélecteurs est une icône ⓘ dans leur champ de recherche. En particulier : engrenage seul pour les Paramètres ; trois icônes Fichiers, Git et Notes dans la barre d’onglets, chacune ouvrant le panneau de droite sur sa vue, ou le fermant quand cette vue est déjà affichée ; dans l’en-tête, la bande des workspaces quand leur panneau est replié, et le nom du workspace seulement pendant un renommage lancé par la palette ou Ctrl+Maj+W ; badge d’agent, marque « créé par Claude » et bouton de création de MR/PR en icône seule ; pas de nom de dossier en tête de l’arbre des fichiers ; vue Notes sans titre ni ligne d’aide, l’aide étant dans une icône ⓘ ; branche non publiée signalée par une icône de nuage barré ; case « Amend » ; barre du graphe sans titre, avec le nom du dépôt, qui n’est pas répété dans l’en-tête du panneau Git ; colonne des branches sans section vide ; barre de statut sans heure.

Dans le panneau des workspaces, le nom du workspace actif ressort en clair et ceux des autres sont atténués ; les workspaces sont espacés pour séparer les groupes ; sur la ligne d’un workspace replié, le nombre d’onglets cède sa place à la croix au survol ; le nom de shell d’un onglet est atténué. Dans l’en-tête d’un pane, le dernier dossier est en vert sur le pane actif et atténué ailleurs, le nom de shell est atténué, et les actions (Copier le chemin, Ouvrir dans l’éditeur, Ouvrir dans l’explorateur, splits, Fermer ; pour un pane navigateur, largeur mobile, DevTools, splits, Fermer) ne s’affichent que sur le pane actif ou au survol ; « Copier la branche » ne fait pas partie des actions : un clic sur la branche la copie et Ctrl + clic ouvre la vue Git, exception à la règle des gestes hors infobulle, l’infobulle de la branche le rappelant. Dans la barre d’onglets, la croix ne s’affiche que sur l’onglet actif ou au survol. Le panneau de droite n’a pas d’onglets : il porte le titre de sa vue, choisie par les icônes de la barre d’onglets. Dans la colonne des branches du graphe Git, la branche courante puis `main`, `master`, `preprod`, `develop` et `evolutions` sont épinglées, nom complet, en tête des branches locales ; les lignes n’ont pas d’icône de type, la place étant réservée à la coche de la branche ou du worktree courant et à l’indicateur d’opération en cours ; les dossiers sont repliés à l’ouverture du graphe et atténués, leur nombre accolé au nom ; nom, nombre et information de droite partagent la même ligne de base ; avec un seul dépôt distant, ses branches s’affichent directement sous « Distantes » ; l’information à droite d’une ligne (branche d’un worktree, `stash@{n}`, SHA d’un tag) se tronque sans masquer le nom.

### Repères visuels

Ces valeurs sont des références de réalisation, pas des contraintes de taille absolues : en-tête d’environ 34 px, fond de l’application, des panneaux latéraux et de la barre de statut #17191b, en-tête, zone de travail, en-têtes de panes et dialogues #1e2123, fond de terminal #121416, accent #7a9f8b, fond de sélection à peine plus clair que le panneau, interface en Segoe UI et terminal en police monospace. Préserver la lisibilité avec la mise à l’échelle Windows.

Une seule police pour l’interface, Segoe UI, y compris pour les chemins, branches, SHA, références MR/PR, compteurs, barre de statut, journal, notes et champs de saisie. La police monospace du terminal est réservée au contenu dont l’alignement compte : terminaux, diff, aperçu et édition de fichiers, sorties de commandes, texte collé, détail d’une demande MCP, lignes trouvées dans les terminaux et code des notes de version. Échelle de tailles : 11 px pour le secondaire (compteurs, métadonnées, titres de section, messages de liste vide), 12 px pour le contenu des panneaux, des menus et des onglets, 13 px pour les listes principales, 15 px pour les titres de dialogue et l’identité de l’en-tête ; le rendu Markdown de l’aperçu garde sa propre échelle de document.

Taille du texte des terminaux : réglage « Taille du texte » de la section « Terminaux » des Paramètres, liste de 8 à 32 px, 14 par défaut, avec un aperçu. Elle s’applique à l’enregistrement à tous les terminaux ouverts, qui recalculent leurs colonnes et leurs lignes et les transmettent au shell ; elle est conservée dans `appearance.json` et fait partie des préférences exportées. La palette propose aussi « Agrandir le texte des terminaux », « Réduire le texte des terminaux » et « Taille du texte des terminaux par défaut », qui appliquent et enregistrent la nouvelle taille sans ouvrir les Paramètres.

### Explorateur de fichiers

Un explorateur de fichiers intégré s’affiche dans un panneau à droite de la zone de travail, du côté opposé à l’arborescence des workspaces. Il est fermé par défaut et s’ouvre ou se ferme par l’icône Fichiers de la barre d’onglets. Son état ouvert ou fermé est mémorisé par onglet. Il affiche le dossier courant du pane actif et le suit : un changement de dossier dans le shell ou un changement de pane met l’explorateur à jour. Un fichier s’ouvre dans l’éditeur configuré ; l’explorateur permet de créer, renommer et supprimer des fichiers et des dossiers.

Icône Fichiers de la barre d’onglets, commande « Afficher / masquer les fichiers » dans la palette, Leader puis E ou Ctrl + Maj + E : ouvre avec le focus dans l’arbre, ou ferme et rend le focus au terminal. Arbre dépliable dont la racine est le dossier du pane actif, dossiers d’abord puis fichiers, triés sans casse ; tout est affiché, `.git` et fichiers cachés compris ; au-delà de 2 000 éléments dans un dossier, le reste est seulement annoncé. Les dossiers affichés sont surveillés en direct, un bouton « Actualiser » relit le tout. Un clic déplie ou replie un dossier ; double-clic ou Entrée ouvre dans l’éditeur un fichier sans aperçu (les autres s’ouvrent dans l’aperçu, ci-dessous), Entrée déplie ou replie aussi un dossier. Boutons « Nouveau fichier » et « Nouveau dossier » en tête du panneau, menu contextuel (clic droit ou Maj + F10 : aperçu pour un fichier qui en a un, ouvrir dans l’éditeur, ouvrir un terminal ici, nouveau fichier, nouveau dossier, renommer, supprimer, copier le chemin), noms saisis en place ; F2 renomme, Suppr place l’élément dans la corbeille de Windows après confirmation. Navigation ↑ / ↓ / ← / → / Début / Fin, Échap rend le focus au terminal. Panneau redimensionnable par glisser ou flèches ; état ouvert par onglet et largeur mémorisés dans la session. La recherche dans le contenu des fichiers reste hors périmètre.

Aperçu des fichiers Markdown et texte : dans l’arbre, un simple clic ou Entrée sur un fichier Markdown (`.md`, `.markdown`) ou texte courant (`.txt`, `.log`, `.json`, `.yml`, `.toml`, `.ini`, `.xml`, `.csv`, `.env`…) ouvre un aperçu en lecture seule dans un tiroir latéral posé sur la zone des terminaux, comme le diff Git ; « Ouvrir dans l’éditeur » reste dans le menu contextuel et dans l’en-tête de l’aperçu, les autres fichiers s’ouvrent toujours dans l’éditeur, par double-clic ou Entrée. Le Markdown est rendu (tableaux, cases à cocher, images locales en chemin relatif, blocs de code colorés), un fichier texte s’affiche en police à chasse fixe, coloré quand son format est connu. L’aperçu se recharge quand le fichier change sur disque. Un lien relatif vers un autre fichier lisible l’ouvre dans l’aperçu, avec son ancre ; un lien web s’ouvre dans le navigateur, un autre fichier dans l’éditeur.

L’icône « Source » de l’en-tête d’un aperçu Markdown affiche son texte brut, coloré, au lieu du rendu, et un second clic revient au rendu ; le choix tient tant que le même fichier reste ouvert, même quand il est rechargé après une modification.

Aperçu limité aux 2 premiers Mo du fichier, avec un avertissement ; fichier binaire refusé avec un message ; Échap ferme l’aperçu et rend le focus à l’arbre.

Les images courantes (`.png`, `.jpg`, `.gif`, `.webp`, `.svg`, `.bmp`, `.ico`, `.avif`) s’ouvrent aussi dans l’aperçu par un simple clic ou Entrée, ajustées à la place disponible, avec leurs dimensions en pixels à côté du badge « Image » ; un clic sur l’image bascule entre la taille ajustée et la taille réelle, avec défilement ; elles sont servies par l’hôte comme les images d’un Markdown et rechargées quand le fichier change. « Ouvrir dans l’éditeur » reste disponible.

Aperçu HTML : une page `.html` ou `.htm` s’ouvre dans l’aperçu comme un Markdown (simple clic ou Entrée dans l’arbre) et y est rendue telle quelle, scripts compris, puis rechargée quand le fichier change, avec les icônes « Source » (code HTML coloré), « Ouvrir dans le navigateur » et « Agrandir ». Quand Claude Code ouvre une page HTML pour relecture (`start "" fichier.html`) depuis un pane de Tily, elle s’ouvre dans l’aperçu de l’onglet de ce pane au lieu du navigateur : aussitôt si cet onglet est celui qu’on regarde, sinon la barre de statut l’annonce et la page s’affiche à l’ouverture de l’onglet, sans changement d’onglet automatique.

La page tourne isolée (iframe d’origine opaque, sans accès à Tily) ; ses liens web s’ouvrent dans le navigateur, ses liens vers un autre fichier dans l’aperçu ou l’éditeur. « Agrandir » étend le tiroir à toute la zone des terminaux pour tout aperçu. Un `start` sur une page est intercepté, seul ou dans une commande composée (`cd dossier && … ; start "" page.html`, chemin relatif résolu après les `cd` qui le précèdent), par un hook `PreToolUse` posé avec les autres hooks (à réinstaller depuis les Paramètres après chaque mise à jour de Tily) ; Claude reçoit un refus qui lui indique que Tily a ouvert la page et, pour une commande composée, qu’il doit en relancer le reste sans ce `start`. Dans une commande composée, une page encore absente (produite par la commande elle-même) n’est pas ouverte : le refus demande de lancer le reste, puis le `start` seul. Un `start` seul vers un fichier absent s’exécute tel quel.

Édition des fichiers texte dans l’aperçu : un fichier Markdown, HTML ou texte (`.txt`, `.json`, `.yml`, `.ini`, `.xml`…) se modifie dans l’aperçu par l’icône « Éditer », dans un éditeur CodeMirror (coloration, numéros de ligne, annulation, recherche), sans linting ni autre outil. Ctrl + S ou « Enregistrer » écrit le fichier. Si le fichier change sur le disque pendant des modifications non enregistrées, un bandeau propose « Recharger » (reprendre la version du disque) ou « Écraser » (enregistrer par-dessus). Fermer l’aperçu, ouvrir un autre fichier ou quitter l’édition avec des modifications non enregistrées demande confirmation : « Enregistrer », « Abandonner les modifications » ou « Annuler ».

L’enregistrement garde l’encodage du fichier (UTF-8 avec ou sans BOM, UTF-16, Latin-1) et ses fins de ligne (CRLF si le fichier en contient, sinon LF) ; un caractère impossible à écrire en Latin-1 refuse l’enregistrement avec un message. Un fichier tronqué (plus de 2 Mo), binaire ou une image ne se modifie pas. Sans modification locale, un changement sur le disque recharge l’éditeur sans bandeau. Échap ferme d’abord le panneau de recherche de l’éditeur, puis l’aperçu. La fermeture de Tily ne demande pas de confirmation pour une édition en cours.

Dans l’arbre des fichiers, taper les premières lettres d’un nom sélectionne l’élément visible suivant qui commence ainsi, sans tenir compte de la casse ni des accents, comme dans l’Explorateur Windows ; répéter la même lettre passe d’un élément à l’autre, et la saisie repart de zéro après 0,7 seconde sans frappe.

Le menu contextuel d’un fichier ou d’un dossier propose aussi « Afficher dans l’Explorateur Windows », qui ouvre son dossier parent avec l’élément sélectionné ; celui d’un dossier propose en plus « Ouvrir dans l’éditeur ». « Copier le chemin » (Ctrl + C sur la ligne sélectionnée) et « Copier le chemin relatif » (Ctrl + Maj + C) copient son chemin complet ou son chemin depuis la racine de l’arbre, c’est-à-dire le dossier du pane actif (`docs\TESTING.md`), pratique pour citer un fichier à un agent. « Insérer le chemin dans le terminal » colle son chemin complet dans le terminal actif, comme un glisser de la ligne sur ce terminal ; si un message recouvre ce terminal, rien n’est inséré et la barre de statut le dit.

Le menu d’un fichier propose « Ouvrir un terminal dans son dossier », qui ouvre un nouvel onglet dans le dossier parent du fichier, comme « Ouvrir un terminal ici » pour un dossier.

Un bouton « Tout replier » de l’en-tête de l’arbre des fichiers replie tous les dossiers dépliés sous la racine affichée ; il est grisé quand aucun dossier n’est déplié.

Dans la vue Git, le menu d’un seul fichier modifié (non supprimé) propose « Afficher dans l’arbre des fichiers » : la vue Fichiers s’ouvre, les dossiers parents se déplient et le fichier est sélectionné avec le focus. Un fichier hors du dossier affiché par l’arbre (terminal ouvert dans un sous-dossier du dépôt) est signalé dans la barre de statut. À l’inverse, le menu d’un fichier marqué dans l’arbre des fichiers propose « Voir les modifications », qui ouvre la vue Git sur son diff (Unstaged s’il en a, sinon Staged).

La branche affichée dans l’en-tête d’un terminal est un bouton : un clic la copie et Ctrl + clic ouvre la vue Git sur le dépôt de ce terminal, en ouvrant le panneau de droite au besoin, ce que rappelle son infobulle ; une HEAD détachée, sans branche à copier, ouvre la vue Git au clic.

« Ouvrir un fichier du projet… » (palette) liste les fichiers du dépôt Git du pane actif, suivis et non suivis, sans les fichiers ignorés ni supprimés, sans les dépôts imbriqués ni les sous-modules, ou, hors dépôt, ceux de son dossier sans `.git`, `.vs`, `node_modules`, `bin` ni `obj`, parcourus pendant 3 secondes au plus ; au plus 20 000 fichiers, avec un avertissement quand la liste est incomplète. Les fichiers modifiés, indexés, non suivis ou en conflit viennent en tête, marqués « modifié » (taper « modifié » les retrouve), puis les dix derniers fichiers choisis dans le sélecteur pour ce dépôt, marqués « récent » (mémoire de la session de Tily, perdue à sa fermeture). On filtre en tapant le nom ou le dossier (même recherche que la palette, 200 résultats affichés), ou en collant un chemin relatif, avec `\` ou `/` ; Entrée ouvre le fichier dans l’éditeur, Alt + Entrée l’ouvre dans l’aperçu (vue Fichiers ouverte au besoin ; un type sans aperçu, comme un fichier de code, y affiche un message qui renvoie vers « Ouvrir dans l’éditeur »), Maj + Entrée l’affiche dans l’arbre des fichiers s’il est sous le dossier du terminal (sinon la barre de statut le dit et le focus revient au terminal), Ctrl + Entrée insère son chemin complet à l’invite du terminal actif (protégé selon le shell, comme un dépôt de fichier), Échap rend le focus au terminal.

F5 actualise l’arbre des fichiers quand le focus y est, et la vue Git quand le focus est dans la vue Git (une touche maintenue ne relance pas l’actualisation en boucle). Dans le message de commit, Ctrl + Entrée lance « Commit » et Ctrl + Maj + Entrée « Commit et push », avec les mêmes garde-fous que les boutons.

Dans un dépôt Git, l’arbre des fichiers montre l’état de chaque fichier comme la vue Git : nom coloré et lettre à droite (M modifié, A ajouté, D supprimé, R renommé, U non suivi, ! en conflit ; libellé en infobulle), l’état du répertoire de travail l’emportant sauf pour un fichier ajouté ou renommé puis modifié, qui garde A ou R. Un dossier qui contient des modifications porte un point de la couleur de sa modification la plus marquante (conflit, puis fichier non suivi ou supprimé, puis ajout ou renommage, puis modification). L’état suit le dépôt en direct, y compris après une commande tapée au terminal. Hors dépôt, rien ne s’affiche.

Au renommage d’un fichier, seul son nom avant la dernière extension est sélectionné, comme dans l’Explorateur Windows : taper un nouveau nom garde l’extension. Un dossier ou un nom qui commence par un point est sélectionné en entier.

### Journal de la barre de statut

Chaque message affiché dans la barre de statut est gardé dans un journal, enregistré sur disque et retrouvé après un redémarrage. Le journal s’ouvre dans un tiroir déplié au-dessus de la barre de statut, par un clic sur la barre, par la palette et par la touche Leader ou un raccourci direct.

Leader puis L, Ctrl + Maj + L, la palette (« Afficher / masquer le journal des messages ») ou un clic sur la barre de statut ouvrent le tiroir avec le focus dans la liste, ou le ferment ; Échap le ferme et rend le focus au terminal. Chaque ligne donne l’heure (précédée du jour s’il ne s’agit pas d’aujourd’hui, date complète en infobulle), le niveau (Info, Avertissement, Erreur) et le texte complet, jamais tronqué. Messages du plus ancien au plus récent, la liste suit le dernier tant qu’on n’a pas remonté. « Copier » place tout le journal dans le presse-papiers, « Effacer » le vide sans confirmation. L’hôte horodate chaque message et garde les 500 derniers, 2 000 caractères au plus chacun, dans `status-log.json` du dossier de données ; un fichier illisible est mis de côté et signalé au démarrage. Le libellé d’une opération Git en cours n’est pas journalisé : seul son résultat l’est.

La barre de statut n’affiche pas l’heure du message, qui est dans le journal. Un message d’information s’efface de la barre après 8 secondes et reste dans le journal ; un avertissement ou une erreur reste affiché jusqu’au message suivant.

Le tiroir du journal porte une bascule « Avertissements et erreurs » qui n’affiche que ces messages (« 7 sur 213 messages » dans l’en-tête) ; Copier et Effacer portent toujours sur tout le journal. Au lancement, le message « Session restaurée » indique le nombre de workspaces et d’onglets restaurés.

## 4. Workspaces et panneau en arborescence

| ID | Exigence |
| --- | --- |
| WS-01 | Créer plusieurs workspaces et naviguer entre eux sans association obligatoire à un projet. |
| WS-02 | Aucun terminal autonome hors workspace ; un workspace « Général » au premier lancement. |
| WS-03 | Renommer un workspace sur place, sans popup : double-clic ou F2 sur sa ligne du panneau ou dans la bande de l’en-tête, ou « Renommer le workspace » dans la palette. |
| WS-04 | Afficher les workspaces à gauche et leurs onglets sous forme d’arborescence. |
| WS-05 | Chaque chevron déplie ou replie les onglets de son workspace, indépendamment des autres. |
| WS-06 | Cliquer sur un onglet de l’arborescence active son workspace et cet onglet. |
| WS-07 | Mémoriser les états déplié/replié, la largeur et la visibilité du panneau. |
| WS-08 | Permettre de masquer entièrement le panneau et de le réafficher via le bouton toujours accessible dans l’en-tête ou la palette. |
| WS-09 | Redimensionner le panneau en faisant glisser son séparateur ; conserver sa largeur après masquage. |

Quand le panneau est masqué, l’en-tête montre à sa place la bande des workspaces : un bouton par workspace, avec ses états d’agents et l’indication de fin de commande ; un clic l’active, un double-clic ou F2 le renomme, et ceux qui débordent passent dans le menu « Autres workspaces ».

### Notes du workspace

Chaque workspace porte une note en texte brut, partagée par tous ses onglets, affichée et modifiée dans la vue Notes du panneau de droite, ouverte par l’icône Notes de la barre d’onglets. La note est enregistrée avec la session, sans bouton d’enregistrement. Dans le panneau des workspaces, une petite icône suit le nom d’un workspace dont la note n’est pas vide ; son infobulle montre la première ligne de la note.

Leader puis O, Ctrl + Maj + O, la palette (« Afficher / masquer les notes du workspace ») ou l’icône Notes de la barre d’onglets ouvrent la vue avec le focus dans la note, ou la ferment ; Échap rend le focus au terminal. Un clic sur l’icône de note, ou « Notes du workspace » dans le menu contextuel du workspace, active ce workspace et ouvre la vue. Police de l’interface, au plus 100 000 caractères. Fermer le dernier onglet d’un workspace garde sa note avec l’onglet fermé : le rouvrir recrée le workspace avec sa note.

Dans la note, Ctrl + Entrée colle la ligne du curseur, ou la sélection si elle existe (sans ses sauts de ligne finaux), dans le terminal actif du workspace sans l’exécuter, puis donne le focus à ce terminal : Entrée reste à taper. Ctrl + Maj + Entrée colle la ligne du curseur, ou la sélection si elle tient sur une seule ligne (même partielle), et l’exécute aussitôt, pour lancer une commande gardée en note ; une sélection de plusieurs lignes n’est alors pas envoyée et la barre de statut renvoie vers Ctrl + Entrée. Une ligne vide, ou un terminal qui affiche un message à la place de son shell (processus terminé), n’envoie rien et l’explique dans la barre de statut ; une sélection de plusieurs lignes passe par la confirmation du collage multi-ligne (section 7).

### Création et renommage

Le « + » du panneau crée directement un workspace et ouvre aussitôt l’édition de son nom. Un double-clic ou F2 sur la ligne d’un workspace, dans le panneau ou dans la bande de l’en-tête, démarre le renommage. Entrée ou perte de focus enregistre ; Échap annule. Un nom vide ne remplace pas le nom existant.

La commande « Renommer le workspace » de la palette, comme Ctrl + Maj + W pour un nouveau workspace, ouvre l’éditeur du nom dans l’en-tête, ou dans la bande quand le panneau est masqué. Le panneau reflète immédiatement le nouveau nom.

Les workspaces se réordonnent par « Monter » et « Descendre » dans leur menu contextuel ou dans la palette (workspace actif), par Alt + ↑ / ↓ sur un workspace sélectionné au clavier dans le panneau, et par glisser-déposer de sa ligne, devant un autre workspace ou en fin de liste. Les onglets se déplacent de même d’un rang dans leur workspace (menu contextuel de l’onglet dans le panneau, Alt + ↑ / ↓ sur l’onglet sélectionné au clavier dans le panneau, Alt + ← / → sur un onglet de la barre qui a le focus), en plus du glisser-déposer et de Ctrl + Maj + PageUp / PageDown. L’ordre est conservé dans la session.

« Fermer le workspace », dans son menu contextuel ou dans la palette pour le workspace actif (nommé dans l’entrée), ferme tous ses onglets avec une seule confirmation si des programmes tournent ; ses derniers onglets restent restaurables un par un.

Au clavier, dans le panneau des workspaces, ↑ / ↓ / Début / Fin passent d’une ligne visible à l’autre, workspaces et onglets confondus ; → déplie un workspace replié, ← le replie ou, depuis un onglet, remonte à son workspace. Tab parcourt toujours chaque bouton. Taper les premières lettres d’un nom donne le focus à la ligne visible suivante qui commence ainsi, comme dans l’arbre des fichiers. Échap rend le focus au terminal.

Un workspace replié affiche en gris, à droite de son nom, son nombre d’onglets ; le chevron le dit aussi aux lecteurs d’écran (« Afficher les 3 onglets de gd »).

Un workspace créé depuis le sélecteur de projets porte automatiquement le nom du dossier choisi. Un workspace créé sans projet s’appelle « Workspace N » (N étant le nouveau nombre de workspaces) et son nom s’édite aussitôt ; un nom saisi n’est jamais écrasé. Son premier onglet, Windows PowerShell, s’ouvre dans le dossier utilisateur. Un clic sur un workspace rejoint son dernier onglet et son dernier pane actifs. Replier une branche ne change pas la sélection.

Fermer le dernier onglet ou le dernier pane d’un workspace ferme ce workspace et arrête ses processus. S’il ne reste aucun workspace, afficher un état vide avec un message accueillant et une action pour en créer un. « Fermer le workspace » ne demande une confirmation que si des programmes y tournent ; la confirmation arrête alors tous ses processus et supprime le workspace.

## 5. Onglets

| ID | Exigence |
| --- | --- |
| TAB-01 | Ouvrir plusieurs onglets dans un workspace. |
| TAB-02 | Clic gauche sur « + » : créer immédiatement un onglet PowerShell, sans formulaire. |
| TAB-03 | Clic droit sur le même « + » : menu contextuel des shells disponibles (Windows PowerShell 5.1, PowerShell 7, Invite de commandes, Git Bash) et « Navigateur », placé près du bouton. |
| TAB-04 | Le nouvel onglet reprend le dossier courant du pane actif au moment de l’action. |
| TAB-05 | Double-clic sur le nom d’un onglet : renommage inline. La palette offre aussi cette action. |
| TAB-06 | Entrée ou clic ailleurs valide le nom ; Échap annule ; le nom manuel prime sur les noms automatiques. |
| TAB-06a | Le nom automatique d’un onglet est le nom du dossier courant au moment de sa création ; il reste synchronisé tant qu’aucun nom manuel n’a été saisi. |
| TAB-07 | Réordonner les onglets et les déplacer entre workspaces, notamment par glisser-déposer. |
| TAB-08 | Fermer un onglet et pouvoir rouvrir un onglet fermé accidentellement. |
| TAB-09 | La barre d’onglets et l’arborescence reflètent la même sélection, le même ordre et les mêmes noms. |

« Reprendre le nom du dossier », dans le menu d’un onglet (barre d’onglets ou panneau des workspaces) et dans la palette pour l’onglet actif, annule un nom saisi manuellement : l’onglet reprend le nom du dossier de son terminal actif et le suit de nouveau. L’entrée est grisée, ou absente de la palette, pour un onglet qui porte déjà son nom automatique.

Un double-clic dans l’espace vide de la barre d’onglets (hors onglets et boutons) ouvre un nouvel onglet, comme le bouton « + », à la manière des navigateurs et de Windows Terminal.

### Menu des shells

Le menu accepte ↑ / ↓, Entrée et Échap. Un clic à l’extérieur le ferme. Maj + F10 ou la touche de menu contextuel sur le « + » offre un accès clavier. L’action reste accessible via la palette. Le menu ne remplace pas le clic gauche direct.

### Déplacement

Le déplacement conserve le shell, le dossier, l’historique, les processus actifs et la disposition de l’onglet. Il ne recrée pas les terminaux. Le glisser-déposer est possible depuis la barre supérieure ou les onglets de l’arborescence. Déposer sur un workspace transfère l’onglet ; déposer sur un onglet permet de choisir sa position.

Un onglet déposé sur un autre s’insère avant lui ; déposé sur un workspace, il s’ajoute en fin de liste et devient actif. Au clavier, la palette (« Déplacer l’onglet vers · … ») et Ctrl + Maj + PageUp / PageDown font les mêmes déplacements.

### Cas de fermeture

La fermeture du dernier onglet supprime le workspace après arrêt de ses processus. Aucun onglet vide de remplacement n’est créé. Si aucun workspace ne subsiste, afficher l’état vide et son action de création.

Rouvrir restaure noms, shells, chemins, splits et texte avec de nouveaux processus et un séparateur de restauration. Ne pas réexécuter les anciennes commandes. Conserver les cinq derniers onglets fermés, y compris après redémarrage.

Un clic droit sur un onglet de la barre ouvre son menu : Renommer, Dupliquer l’onglet (même disposition, mêmes dossiers et shells, terminaux neufs, aucune commande rejouée), Déplacer à gauche ou à droite, Déplacer vers « workspace » pour chaque autre workspace (comme dans la palette ; si le workspace d’origine se vide et avait une note, elle est ajoutée à la fin de la note du workspace cible, sous son nom), Copier le chemin (dossier de son pane actif), Fermer l’onglet, Fermer les autres onglets et Fermer les onglets à droite (aussi dans la palette ; même confirmation et même texte conservé que pour les autres onglets). Le menu d’une ligne d’onglet du panneau des workspaces propose les mêmes déplacements vers un autre workspace, la même copie du chemin et les mêmes fermetures, « Fermer les onglets en dessous » y remplaçant « à droite ». Ce dernier ne demande qu’une seule confirmation si des programmes tournent ; les cinq derniers onglets fermés restent restaurables.

Au clavier, dans la barre d’onglets, ← / → passent le focus à l’onglet voisin sans l’afficher, Entrée l’affiche, F2 le renomme et Alt + ← / → le déplacent d’un rang, comme ↑ / ↓, F2 et Alt + ↑ / ↓ dans le panneau des workspaces.

La palette propose une entrée « Rouvrir l’onglet fermé · nom » par onglet encore restaurable, de la plus récente à la plus ancienne, avec le workspace d’origine en indice : on peut rouvrir n’importe lequel des cinq, pas seulement le dernier. L’onglet reprend sa position d’origine dans son workspace, recréé s’il n’existe plus (position exacte quand on rouvre dans l’ordre inverse des fermetures, la plus proche sinon) ; Ctrl + Maj + Z et l’état vide rouvrent toujours le dernier fermé.

## 6. Panes et splits

| ID | Exigence |
| --- | --- |
| PANE-01 | Diviser un pane côte à côte ou haut/bas, rapidement depuis les commandes ou les boutons compacts. |
| PANE-02 | Le nouveau pane reprend le dossier du pane actif. |
| PANE-03 | Redimensionner les sous-zones avec leurs séparateurs. |
| PANE-04 | Naviguer entre panes au clavier et activer un pane en cliquant dedans. |
| PANE-05 | Conserver la disposition et ses proportions entre sessions. |

Les splits peuvent être imbriqués. L’action de fermeture d’un pane retire cette feuille de la disposition et agrandit la zone restante.

Leader puis M, Ctrl + Maj + M, la palette, le menu contextuel du terminal ou un double-clic sur l’en-tête d’un pane l’agrandit temporairement à toute la zone de l’onglet, sans modifier la disposition enregistrée ; les autres terminaux continuent de tourner. Le même geste, le bouton « Réduire » de son en-tête, un split, le passage à un autre pane (Alt + flèche compris, qui réduit puis passe au pane voisin) ou à un autre onglet le réduisent. Un onglet d’un seul pane n’a rien à agrandir.

Un double-clic sur un séparateur rétablit sa taille par défaut : parts égales pour un split, largeur initiale pour le panneau des workspaces, le panneau de droite et les colonnes du graphe Git.

Leader puis = ou « Égaliser les panes de l’onglet » dans la palette (proposée quand l’onglet a plusieurs panes) donne la même place à chaque pane de l’onglet actif : chaque split est réparti selon le nombre de panes alignés de part et d’autre dans sa direction, si bien que trois splits côte à côte successifs donnent trois tiers au lieu de 50 %, 25 % et 25 %. Les bornes de taille d’un séparateur restent appliquées ; aucun raccourci direct.

Leader puis !, « Déplacer le pane actif dans un nouvel onglet » dans la palette ou « Déplacer dans un nouvel onglet » du menu contextuel du terminal sortent un pane de son onglet, comme le `break-pane` de tmux : il devient seul dans un nouvel onglet placé juste après, qui devient actif, avec le même terminal, son processus, son texte et son état d’agent. L’onglet d’origine se referme sur les panes restants. Un pane déjà seul dans son onglet ne bouge pas et la barre de statut l’indique.

À l’inverse, comme le `join-pane` de tmux, « Déplacer le pane actif vers l’onglet · <nom> » dans la palette (une entrée par autre onglet du workspace, puis « · workspace / onglet » pour les onglets des autres workspaces) place le pane, avec son terminal, à droite du pane actif de l’onglet choisi, qui devient actif avec son workspace. Un onglet d’origine vidé ainsi disparaît sans entrer dans les onglets fermés, puisque aucun terminal n’a été arrêté ; le dernier pane d’un workspace ne peut pas le quitter, pour ne jamais faire disparaître un workspace et sa note sans confirmation, et la barre de statut l’explique.

Le split hérite aussi du shell du pane actif, commence à parts égales et active le nouveau pane. Le pane qui reçoit le focus, y compris par un bouton de son en-tête ou du message qui le recouvre, devient le pane actif : la saisie et les commandes visent toujours le même pane. La fermeture du dernier pane utilise les règles de fermeture d’un onglet. Préserver les saisies, processus et sélections lorsque le panneau latéral est masqué, lorsqu’un groupe est déplié ou lorsqu’une zone est redimensionnée.

Leader puis Maj + flèche, ou « Échanger le pane actif avec son voisin de gauche / droite / du haut / du bas » dans la palette, échange la place du pane actif avec le pane voisin dans cette direction, choisi comme pour la navigation, à la manière du `swap-pane` de tmux : les deux terminaux gardent leur processus et leur texte, les proportions des splits ne changent pas, et le pane actif reste actif à sa nouvelle place. Un pane agrandi est d’abord réduit ; sans voisin dans cette direction, rien ne change.

La navigation au clavier est spatiale : chaque direction choisit le pane dont la position visuelle est la plus proche dans cette direction. En l’absence de cible dans la direction demandée, conserver le pane actif.

### Panes navigateur

Un pane peut être un navigateur, pour voir l’application en cours de développement à côté de ses terminaux ; Claude Code en lit lui-même la console, le réseau, le contenu et des captures, et y clique, saisit et fait défiler (section 11, « Pilotage par Claude Code (MCP) »). On l’ouvre depuis la palette, le menu « + » ou Leader, en split ou en onglet. Son en-tête porte un champ d’adresse, Précédent, Recharger, la largeur mobile ou desktop, l’ouverture des DevTools et un compteur d’erreurs. Le pane est restauré avec la session (adresse et largeur). Les cookies et les sessions des pages, connexion Azure AD comprise, sont gardés dans un profil séparé de celui de l’interface de Tily et conservés d’un lancement à l’autre. Aucune connexion automatique avec le compte Windows : on se connecte une fois à la main, ce qui laisse choisir un compte de test et reste prévisible.

Leader puis U ouvre un navigateur côte à côte du pane actif ; la palette propose « Navigateur côte à côte », « Navigateur en dessous » et « Navigateur dans un nouvel onglet » ; le clic droit sur « + » ajoute « Navigateur » à la liste des shells. Un navigateur ouvert depuis l’interface affiche une page vide et met le focus dans son champ d’adresse. Une adresse sans schéma s’ouvre en http pour `localhost`, une adresse IP ou un nom sans point, en https sinon ; seuls http, https et file sont acceptés. Entrée navigue, Échap rend le focus à la page. Le pane garde le dossier et le shell du pane d’où il a été ouvert : un split depuis un navigateur ouvre un terminal dans ce dossier. Le nom automatique de l’onglet est le titre de la page, sinon son hôte. La largeur mobile affiche la page dans une colonne de 390 px centrée, avec l’émulation mobile (balise viewport, media queries) ; « Outils de développement » ouvre les DevTools dans une fenêtre à part.

Les raccourcis de Tily tapés dans la page (Ctrl + Espace et la touche Leader suivante, Ctrl + P, Ctrl + Tab, Ctrl + Maj + lettre des raccourcis directs, Alt + flèche, Alt + F4) vont à Tily et jamais à la page, sauf quand Claude Code les presse lui-même (section 11) ; toute autre touche va à la page. Un clic dans la page rend le pane actif ; un pane navigateur activé au clavier reçoit le focus clavier. Un lien `_blank` ou un `window.open` sans dimensions s’ouvre dans un nouveau pane navigateur côte à côte, dans le même profil ; une fenêtre demandée avec des dimensions (popup de connexion type MSAL) s’ouvre dans une petite fenêtre qui partage la session.

Rien de l’interface ne pouvant se dessiner par-dessus la page (section 14), la page est figée dès qu’un menu, la palette ou un dialogue de Tily est ouvert, ou qu’un élément de l’interface (infobulle, tiroir, notification) recouvre le pane : elle est masquée et remplacée par sa capture, puis réaffichée à la fermeture. Cliquer sur la page figée ferme le menu ouvert comme un clic ailleurs. Un pane navigateur jamais affiché depuis le lancement de Tily n’a pas démarré ; un onglet en arrière-plan garde sa page vivante, qui continue d’être suivie.

Pour chaque page démarrée, Tily garde en continu, y compris quand son onglet n’est pas affiché, les 1 000 derniers messages de console (journaux, avertissements, erreurs, exceptions et rejets de promesse non gérés, messages de sécurité ou d’obsolescence du navigateur) et les 500 dernières requêtes réseau terminées (méthode, adresse, type, statut, durée, échec ; corps des réponses en erreur, 2 000 caractères au plus) ; chaque navigation ouvre un nouveau chargement. Le compteur de l’en-tête additionne les erreurs de console et les requêtes en erreur (statut 400 ou plus, échec réseau, requête bloquée ; une requête annulée n’en est pas une) du chargement courant, même au-delà de ce que gardent les tampons ; il disparaît à zéro, se met à jour au plus quatre fois par seconde et un clic ouvre les DevTools.

## 7. Terminal réel et shells

Tily héberge de vrais terminaux interactifs. Windows PowerShell 5.1 est le shell par défaut, pour charger le profil existant ; PowerShell 7, l’Invite de commandes et Git Bash sont proposés quand ils sont trouvés à leur chemin, réglable dans les Paramètres.

- Charger le profil PowerShell habituel avec ses alias, fonctions, modules et prompt.
- Préserver l’utilisation de wtr et rmwt depuis le profil.
- Permettre sélection de texte, copier/coller, défilement et exécution libre des programmes.
- Prendre en charge les interactions des outils utilisés : couleurs, curseur, touches de contrôle, programmes plein écran et redimensionnement.
- Suivre le dossier courant réel après les commandes de navigation, y compris après une fonction du profil qui change le dossier.
- Ne pas remplacer le shell par un interpréteur limité à quelques commandes reconnues par l’interface.

Un clic droit dans un terminal, ou la touche Menu, ouvre un menu contextuel : Copier (si du texte est sélectionné), Copier la sortie de la dernière commande, Coller, Tout sélectionner, Effacer l’historique de défilement, Split côte à côte, Split haut / bas, Agrandir le pane (ou Réduire le pane s’il est agrandi), Déplacer dans un nouvel onglet et Fermer le pane.

« Effacer l’historique de défilement » (menu contextuel du terminal, ou la palette pour le pane actif) supprime les lignes remontées au-dessus de l’écran, y compris le texte restauré au démarrage, et garde l’écran visible tel quel, pour ne pas désaligner le terminal de ConPTY ; le texte enregistré du pane suit à l’enregistrement suivant. Pendant un programme plein écran, la barre de statut demande de le quitter d’abord.

Alt + PgUp et Alt + PgDn (ou « Remonter à la commande précédente » et « Descendre à la commande suivante » dans la palette) font défiler le terminal actif jusqu’à la ligne de commande précédente ou suivante, avec une ligne de contexte au-dessus, comme les repères de commande de VS Code et Windows Terminal ; au-delà de la dernière, le terminal revient en bas, et sans commande plus haut la barre de statut le dit. Les 500 dernières commandes terminées de chaque terminal PowerShell sont repérées ; chaque repère est recalé sur le texte de la commande, que ConPTY peut décaler en redessinant l’écran.

« Copier la sortie de la dernière commande » (menu contextuel du terminal, ou la palette pour le pane actif) copie le texte affiché entre la ligne de la commande et l’invite suivante, sans l’une ni l’autre, pour le coller par exemple dans un agent. Il s’appuie sur le wrapper de prompt de Windows PowerShell et PowerShell 7 (section 14), qui signale chaque invite, le moment où PSReadLine rend la ligne à exécuter (les lignes de continuation `>>` d’une commande sur plusieurs lignes ne font donc pas partie de la sortie), chaque commande terminée et la hauteur de l’invite ; une Entrée sur une ligne vide garde la sortie précédente. La commande lancée par Tily à la création d’un worktree est couverte de la même façon. Si aucune commande n’est terminée, si la sortie n’est plus dans l’historique du terminal ou si elle est vide, la barre de statut le dit. Quand le programme du terminal suit la souris, le clic droit lui revient ; Maj + clic droit ouvre alors le menu.

Déposer des fichiers ou des dossiers depuis l’Explorateur Windows sur un terminal y colle leurs chemins, comme dans Windows Terminal, protégés selon le shell (guillemets simples pour PowerShell et Git Bash, doubles pour CMD) et suivis d’une espace ; le pane devient actif. Glisser une ligne de l’arbre des fichiers de Tily sur un terminal y colle de même le chemin complet du fichier ou du dossier. Ailleurs dans Tily, le dépôt de fichiers ou de liens est refusé et n’ouvre jamais de fenêtre.

Coller un texte de plusieurs lignes (Ctrl + V, Ctrl + Maj + V, Maj + Inser, menu « Coller », ou Ctrl + Entrée depuis les notes) dans un terminal dont le programme n’a pas activé le collage délimité (bracketed paste, cas de Windows PowerShell 5.1, de CMD et de Git Bash sous ConPTY) demande d’abord confirmation : le dialogue « Coller N lignes ? » rappelle que chaque ligne s’exécute dès qu’elle arrive et montre les 8 premières lignes ; Entrée colle, Échap annule sans rien envoyer. Un seul saut de ligne final ne compte pas comme une ligne de plus. Un programme qui a activé le collage délimité (Claude Code, éditeurs plein écran) reçoit le texte sans confirmation.

Préserver l’historique et le processus lors des changements de workspace. Si un shell est introuvable ou échoue au démarrage, afficher un état local au pane avec actions de relance ou de choix du shell. Ne pas basculer silencieusement vers un autre shell. Tant qu’un tel message recouvre un pane, il reçoit le focus à la place du terminal chaque fois que le pane devient actif : Entrée déclenche son action par défaut, « Relancer » pour un shell arrêté, « Ignorer » pour un dossier disparu car le shell y tourne encore, et Tab parcourt les autres actions. Quand le message prend le focus alors qu’on tapait dans ce terminal, Entrée et Espace sont ignorés pendant 0,6 seconde : une frappe déjà en cours ne déclenche pas une action que l’on n’a pas eu le temps de lire. Rejoindre volontairement un pane qui affiche déjà un message n’est pas concerné. Le message d’un dossier disparu reste affiché jusqu’à ce choix, y compris à la restauration, où le shell démarre dans le dossier personnel.

Le profil contenant `wtr` et `rmwt` est `%USERPROFILE%\Documents\WindowsPowerShell\Microsoft.PowerShell_profile.ps1`. Le dossier courant est obtenu par une intégration shell propre à Tily (variable d’environnement dédiée et séquence OSC émise par le prompt), décrite en section 14 ; aucune variable WezTerm n’est simulée.

Un lien affiché dans un terminal s’ouvre par Ctrl + clic ; le clic simple reste réservé à la sélection de texte et au placement du curseur, sans jamais ouvrir de lien.

Un chemin de fichier affiché dans un terminal est aussi un lien : absolu (`C:\dépôt\a.cs`, `C:/app/index.js`) ou relatif avec un séparateur (`src/app.ts`, `..\web\App.tsx`), éventuellement suivi d’une ligne et d’une colonne (`:12`, `:12:5`, `(42,17)`) ; un simple nom de fichier n’est lié que s’il porte une ligne. Ctrl + clic l’ouvre dans l’éditeur configuré, à la ligne et à la colonne indiquées pour les éditeurs de la famille VS Code (`code`, `code-insiders`, `codium`, `cursor`, `windsurf`, par `-g`), au début du fichier pour les autres. Un chemin relatif part du dossier du pane, et un chemin `a/…` ou `b/…` de `git diff` absent tel quel est cherché sans ce préfixe ; un fichier absent est signalé dans la barre de statut. Un chemin absolu dont des dossiers contiennent des espaces (`D:\Projets\Projet T\src\a.cs(12,5)`, `C:\Program Files (x86)\…`) est lié en entier ; si ce chemin n’existe pas (phrase prise pour un chemin), la partie qui suit chaque espace est essayée à son tour, depuis le dossier du pane. Quand un des dossiers contient une extension suivie d’une espace (« a.ts and src », mais aussi « Node.js Apps »), le lien s’arrête au premier chemin plausible et les chemins suivants de la ligne restent liés à part ; le Ctrl + clic sur ce premier lien ouvre toutefois le chemin long s’il existe tel quel. Un nom de fichier ou un chemin relatif qui contient des espaces, les parties d’URL, les domaines (`www.exemple.com/…`, `hote.com:8080`) et la suite d’un chemin replié sur la ligne précédente ne sont pas liés ; les lettres accentuées font partie du chemin. L’éditeur reçoit chaque argument entre guillemets, pour qu’un `&` ou un `^` d’un nom de dossier ne soit jamais interprété par cmd.exe.

Reconnaître les URL présentes dans le texte ainsi que les hyperliens explicites émis par les programmes (séquence OSC 8). Ouvrir le lien dans le navigateur par défaut de Windows, jamais dans la fenêtre de Tily. N’ouvrir que les liens `http` et `https`, et les liens `file:///` vers un fichier local existant de type page HTML, PDF, image ou texte (`.html`, `.htm`, `.pdf`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.txt`, `.md`), ouverts dans leur application par défaut ; un autre schéma, un fichier réseau ou un autre type de fichier (exécutable, script…) n’est jamais ouvert et la barre de statut l’explique. Souligner le lien au survol pour montrer qu’il est actif.

Dans un pane où Tily détecte Claude Code, Maj + Entrée et Ctrl + Entrée insèrent un retour à la ligne dans le prompt au lieu de l’envoyer (Tily transmet Échap + Entrée, que Claude Code interprète ainsi). Dans les autres panes, ces combinaisons restent transmises telles quelles au shell.

### Recherche dans les terminaux

Ctrl + Maj + F (ou « Rechercher dans le terminal du pane actif… » dans la palette) ouvre une barre de recherche dans le pane actif ; « Rechercher dans tous les terminaux… » (palette) cherche dans tous les terminaux ouverts. Trois options : respect de la casse, mot entier, expression régulière.

La barre se place en haut à droite du pane et reprend le texte sélectionné dans le terminal s’il tient sur une ligne et fait 200 caractères au plus. Toutes les occurrences sont surlignées, l’occurrence courante plus vivement, avec un compteur « 3/12 » (au-delà de 1 000 occurrences : « 1000+ ») ; la saisie cherche en partant du bas. Entrée remonte à l’occurrence précédente, Maj + Entrée descend à la suivante ; Alt + C, Alt + W et Alt + R basculent la casse, le mot entier et l’expression régulière ; une expression invalide est signalée dans la barre ; Échap ferme la barre, efface le surlignage et rend le focus au terminal. Une seule barre est ouverte à la fois ; Ctrl + Maj + F dans un autre pane l’y déplace. Ctrl + Maj + F sur un pane navigateur ouvre la recherche dans tous les terminaux.

La recherche dans tous les terminaux (aussi Alt + Entrée ou « Tous » depuis la barre, qui en reprend le texte et les options) liste les lignes trouvées, celles du pane actif d’abord, puis celles des autres panes dans l’ordre des workspaces et des onglets, les plus récentes en premier, avec l’occurrence surlignée et l’emplacement (workspace / onglet · dossier) ; au plus 300 lignes affichées, le total étant indiqué. Le texte est relevé à l’ouverture : seuls les terminaux déjà affichés depuis le lancement de Tily sont parcourus. Entrée ou un clic affiche le pane de la ligne et y ouvre la barre sur cette occurrence.

## 8. Palette et clavier

### Palette de commandes

Ctrl + P ouvre la palette de commandes et de navigation. Elle recherche les commandes et les éléments de navigation. ↑ / ↓ déplace la sélection ; Entrée exécute le résultat sélectionné ; Échap ferme la palette.

- Sélection visible uniquement par un fond discret, sans barre latérale colorée.
- Le résultat sélectionné reste visible lorsque la liste défile.
- Modifier la requête remet la sélection au premier résultat disponible.
- Une recherche sans résultat affiche un message neutre et Entrée ne déclenche aucune action.
- La sélection à la souris et au clavier conduit à la même action.
- La palette rejoint les workspaces, onglets et panes ; elle déclenche les éditeurs inline plutôt que des formulaires modaux supplémentaires.

À la fermeture, le focus revient au terminal du pane actif, ou au graphe Git s’il est affiché ; lorsqu’une commande ouvre un terminal ou un éditeur inline, son nouveau champ reçoit le focus.

Tant qu’une fenêtre est ouverte (palette, sélecteur de projets, paramètres, confirmation), Tab et Maj + Tab parcourent ses seuls éléments, en boucle : le focus ne rejoint jamais un terminal masqué derrière elle.

L’étoile d’une commande (clic ou Ctrl + Entrée) la marque comme favorite et la place en tête de la palette. Seules les commandes en portent une : ni les entrées de navigation, ni « Rejoindre », ni « Rouvrir l’onglet fermé ». Au plus 50 favoris ; au-delà, la palette demande d’en retirer un.

Quand plusieurs onglets d’un même workspace portent le même nom (par défaut celui de leur dossier), leurs entrées de navigation et celles de leurs panes précisent leur position dans la barre d’onglets : « repo (onglet 3) ». De même, deux workspaces homonymes sont distingués par leur position dans le panneau (« gd (workspace 3) ») dans la palette et dans les entrées « Déplacer vers » des menus d’onglet.

### Touche Leader

La touche Leader est **Ctrl + Espace** par défaut, avec un délai d’expiration de **5 secondes**. Le mapping et le délai sont personnalisables.

La plupart des commandes ont aussi un raccourci direct, sans passer par le Leader. Par défaut, les raccourcis directs utilisent Ctrl + Maj + lettre (jamais Ctrl + lettre seul, réservé au shell) et Alt + flèche pour la navigation (Ctrl + Maj + flèche est utilisé par PSReadLine). Ctrl + Maj + C et Ctrl + Maj + V restent copier et coller ; le split côte à côte direct utilise donc D. Les raccourcis par défaut sont listés dans l’application (Paramètres, section « Raccourcis clavier », et aide du Leader), et tous se personnalisent.

Les séquences Leader sont consommées par l’application uniquement lorsqu’elles correspondent à une commande active. Une commande non reconnue ou expirée rend la saisie au pane actif ; les raccourcis personnalisés peuvent désactiver ou remplacer les valeurs par défaut.

Les raccourcis se modifient dans Paramètres, section « Raccourcis clavier » : la touche Leader (combinaison libre, sauf Alt + F4, Ctrl + Maj + C et Ctrl + Maj + V), son délai (1 à 60 s), et pour chaque commande clavier ou commande fixe de la palette (hors entrées propres à une cible : rejoindre un onglet, déplacer vers un workspace, onglets fermés, navigation) au plus un raccourci direct et au plus une touche après le Leader, chacun désactivable. Un raccourci direct passe par Ctrl ou Alt, sauf touche de fonction ou Maj + touche non imprimable ; Ctrl + lettre seule reste au shell (sauf Ctrl + P), Ctrl + Maj + C / V, Maj + Entrée, Ctrl + Entrée et Alt + F4 sont réservés. Après le Leader : une touche seule, avec Maj au besoin ; 1 à 9 et Échap restent réservés. La saisie se fait au clavier (cliquer puis appuyer sur la combinaison) ; un raccourci déjà pris passe à la nouvelle commande, l’ancienne le perd et un message le signale. Les infobulles, la palette, les menus et l’aide du Leader affichent les raccourcis en vigueur. Une commande de contexte lancée sans son contexte (aucun worktree, aucun autre onglet…) consomme la touche et l’explique dans la barre de statut. L’hôte valide les raccourcis et les enregistre dans `shortcuts.json` (écarts aux valeurs par défaut seulement), repris par l’export et l’import des préférences.

Leader puis un chiffre de 1 à 9 (touches de la rangée du haut, sans Maj en AZERTY) affiche l’onglet correspondant du workspace actif, 9 affichant le dernier, comme les navigateurs et le préfixe de tmux ; un onglet absent est signalé dans la barre de statut.

Leader puis N ouvre la création d’un worktree (section 10) ; aucun raccourci direct.

Leader puis U ouvre un navigateur côte à côte du pane actif (section 6, « Panes navigateur ») ; aucun raccourci direct.

Leader puis O, ou Ctrl + Maj + O, ouvre ou ferme la vue Notes du panneau de droite (section 4, « Notes du workspace »).

Leader puis L, ou Ctrl + Maj + L, ouvre ou ferme le journal de la barre de statut (section 3, « Journal de la barre de statut »).

Ctrl + Tab et Ctrl + Maj + Tab passent à l’onglet suivant ou précédent du workspace actif, en boucle, comme dans Windows Terminal. Ces combinaisons n’envoient au shell que Tab ou Maj + Tab, qui restent disponibles sans Ctrl.

Leader puis B, ou Ctrl + Maj + B, masque ou affiche le panneau des workspaces (WS-08), en rendant le focus au terminal s’il était dans le panneau ; quand il l’affiche, le focus va à l’onglet actif dans le panneau. « Aller au panneau des workspaces », dans la palette, y amène le focus sans le masquer.

Les raccourcis directs fonctionnent aussi quand le focus est hors d’un terminal (panneau des workspaces, graphe Git, explorateur), sauf dans un champ de saisie, un menu ou une boîte de dialogue ; il en va de même pour le Leader, dont la touche suivante n’est jamais interceptée par l’élément qui a le focus. Exception : sur un onglet de la barre ou une ligne du panneau des workspaces qui a le focus, Alt + flèche déplace cet élément au lieu de changer de pane.

## 9. Sélecteur de projets

Chercher rapidement un dossier du dossier des projets (`C:\Files\Projects` par défaut, réglage « Dossier des projets » des Paramètres), puis ouvrir un workspace avec un premier terminal dans ce dossier.

Ce sélecteur recherche des dossiers, pas du texte dans les fichiers. L’interface doit rester compacte et intégrée. La navigation clavier suit le principe ↑ / ↓ / Entrée / Échap.

Le sélecteur liste les dossiers de premier niveau du dossier des projets, hors `worktrees` et dossiers cachés. Il ne recherche que des dossiers et ne détecte pas les workspaces déjà ouverts : chaque sélection peut créer un nouveau workspace. Le nom initial est celui du dossier sélectionné.

Les dossiers de premier niveau de `worktrees` sont listés à part, après les projets, avec la mention « worktree » ; en choisir un ouvre un workspace comme pour un projet. Quand un autre dossier des worktrees est réglé (section 10), c’est lui qui est listé, et il est retiré de la liste des projets s’il se trouve dans le dossier des projets ; il en va de même des dossiers des worktrees mémorisés par projet (section 10).

Maj + Entrée, ou Maj + clic, sur un projet ou un worktree du sélecteur l’ouvre dans un nouvel onglet du workspace actif au lieu d’un nouveau workspace (sans workspace ouvert, il en ouvre un comme Entrée) ; l’icône ⓘ de son champ de recherche rappelle les deux gestes. Le sélecteur « Ouvrir un worktree » (palette) accepte le même geste ; un worktree déjà ouvert dans un terminal est rejoint dans les deux cas.

## 10. Actions contextuelles et worktrees

Les actions utilisent le **dossier du pane actif**, jamais un hypothétique dossier unique du workspace.

| Action | Comportement |
| --- | --- |
| Copier le chemin | Copier le chemin courant réel dans le presse-papiers. |
| Ouvrir dans l’éditeur | Ouvrir le dossier dans l’éditeur configuré. |
| Ouvrir dans l’explorateur | Ouvrir le dossier dans l’explorateur Windows. |
| Copier la branche | Résoudre et copier la branche Git du contexte courant lorsque disponible. |
| Terminal supplémentaire | Ouvrir un terminal dans le même dossier, notamment dans le même worktree. |

Montrer le chemin ciblé dans le menu ou la zone d’actions. Afficher explicitement « Aucun dépôt Git », « Aucune branche » ou « HEAD détachée » selon le contexte. Désactiver ou masquer les actions Git hors dépôt ; ne jamais afficher une branche fictive.

L’en-tête de chaque pane affiche la branche Git de son dossier, ou « HEAD détachée », à côté du chemin ; rien hors d’un dépôt. Elle est relue après chaque commande, pour suivre un `git switch` ou un `wtr`. Un clic sur la branche la copie, Ctrl + clic ouvre la vue Git. Dans un pane de moins de 520 px de large, elle est masquée et « Copier la branche » reste dans la palette. Seul le dernier dossier du chemin est affiché, le chemin complet restant en infobulle. Dans un pane de moins de 280 px, les boutons Copier le chemin, Ouvrir dans l’éditeur et Ouvrir dans l’explorateur sont masqués (ils restent dans la palette) pour que Split et Fermer restent visibles, et le nom du shell, affiché seulement s’il n’est pas Windows PowerShell, se tronque au besoin. Le badge d’un agent est une icône seule, son état en infobulle. Dans la palette, l’entrée de chaque pane rappelle aussi sa branche, qu’on peut donc taper pour le retrouver.

### Gestion des worktrees

Tily liste, ouvre, crée et supprime les worktrees Git en natif, avec le comportement de `wtr` et `rmwt` : les étapes Git, les ports de développement aléatoires, `pnpm install` et la base de données répliquée (PostgreSQL sous Docker, SQL Server). `wtr` et `rmwt` restent utilisables au terminal, avec les mêmes chemins ; l’interface suit aussi leurs effets (contrat ci-dessous).

| Sujet | Comportement |
| --- | --- |
| Points d’entrée | Vue Git, palette, Leader, panneau des workspaces, et une icône d’arbre à côté de « Ouvrir un projet » qui fait choisir le projet source. Sur chaque ligne d’onglet du panneau, un bouton d’arbre affiché au survol, comme la croix, crée un worktree du projet de l’onglet ; hors dépôt Git, il est grisé avec une infobulle. |
| Branche | Nouvelle branche depuis une base, ou branche existante, locale ou distante. |
| Dépôt source | Un projet n’est pas toujours un dépôt Git (« App Starter Kit » contient le dépôt `app-starter-kit`) : le formulaire cherche les dépôts du projet sur 3 niveaux et choisit le premier trouvé, ou le dépôt par défaut du projet ; une liste des dépôts trouvés et l’icône « Parcourir les dépôts » permettent d’en changer ; la case « Par défaut pour ce projet » en fait le nouveau défaut à la création. Depuis la vue Git, un onglet ou un pane, le dépôt de départ reste celui du dossier. « Ouvrir un projet » partage ce dépôt par défaut : un projet avec un seul dépôt s’ouvre directement dedans (sans dépôt : dans son dossier) ; avec plusieurs, une seconde liste propose les dépôts, le défaut en tête, et « Parcourir… » ; Ctrl + Entrée ouvre le dépôt et en fait le défaut du projet. |
| Réglages | Dossier des worktrees (par défaut `worktrees` du dossier des projets) et base par défaut (`develop`), modifiables dans Paramètres. Si le dépôt n’a pas cette branche, localement ni parmi les branches distantes déjà récupérées, et qu’elle ne désigne pas non plus un tag ou un commit, le formulaire propose `main` puis `master` à la place ; la base réglée reste choisissable dans la liste, et le fetch de la création la récupère si elle vient d’être poussée. |
| Ouverture | Nouveau workspace, ouvert dès que le dossier existe ; `pnpm install` tourne visiblement dans son terminal, ou dans un pane sous celui de Claude Code (ci-dessous) ; la base est répliquée en parallèle ; progression et avertissements dans la barre de statut. |
| Suppression | La confirmation présente, libellés en colonne, le dossier, la branche avec « Garder », les onglets et panes concernés avec « Fermer ces onglets et panes » (cochée) et la base avec « Supprimer la réplique ». |
| Cycle de vie | Jamais d’ouverture ni de fermeture automatique : seulement proposer. |

Le dossier des worktrees peut être choisi pour chaque projet. Le formulaire de création propose le dossier mémorisé pour le projet, sinon celui des Paramètres ; il affiche le dossier final et reste modifiable par le crayon (saisie ou sélecteur de dossier), le nom `<projet>-<branche>` restant calculé. La case « Mémoriser pour <projet> » n’apparaît que si le dossier saisi diffère du dossier proposé, et elle est alors cochée ; cochée, la création réussie retient ce dossier pour le projet (choisir le dossier des Paramètres oublie la surcharge). Le dossier est mémorisé pour le projet, comme son dépôt par défaut, et vaut pour tous ses dépôts. Les dossiers mémorisés sont listés dans Paramètres, sous le dossier des worktrees, avec « Retirer », appliqué à l’enregistrement ; les worktrees qu’ils contiennent apparaissent dans les sélecteurs comme ceux du dossier des Paramètres.

Le formulaire de création propose, à côté de « pnpm install », la case « Claude Code », cochée par défaut comme les autres options : cochée, `claude` démarre dans le premier pane du nouveau workspace, et `pnpm install`, s’il est lancé, tourne dans un pane en dessous. Le pane de Claude reste le pane actif, et la création demandée par le serveur MCP ne lance pas Claude.

Le formulaire affiche le dossier cible calculé par l’hôte (`<dossier des worktrees>\<projet>-<dernier segment de la branche>`) et refuse un dossier existant, un nom de branche invalide, une branche déjà utilisée par un autre worktree. Une nouvelle branche part de `origin/<base>` après un fetch, sans branche suivie (un push la publiera sous son propre nom) ; une branche distante crée une branche locale qui la suit. Les ports reprennent les fichiers et l’expression de `wtr` ; un port sans remplaçant libre est signalé. Un échec Git arrête la création ; les ports, `pnpm install` et la base ne produisent que des avertissements. « Ouvrir » un worktree rejoint un pane qui s’y trouve déjà, sinon ouvre un workspace. La suppression refuse le dépôt principal, vérifie d’abord qu’aucun programme ne verrouille le dossier (le worktree reste alors intact, avec « Réessayer » et, quand Windows les connaît, les processus en cause), puis déplace aussitôt le dossier dans une corbeille cachée `.tily-corbeille` de son dossier parent, fait un prune, supprime la base répliquée (jamais une base identique à celle du dépôt principal) et la branche, sauf si elle est gardée ou si HEAD est détachée ; la corbeille est ensuite vidée en arrière-plan, avec sa progression dans la barre de statut.

`wtr` et `rmwt` sont des fonctions du profil PowerShell de l’utilisateur ; la gestion native de Tily reprend leur comportement et fait foi en cas d’écart. `wtr <Branch> [Base] [-NoDb]` (base `develop` par défaut) crée une nouvelle branche depuis `origin/<Base>` après un fetch, dans le worktree `<dossier des worktrees>\<projet>-<dernier segment de la branche>`, y place le shell, remplace les ports de développement, lance `pnpm install` (un échec n’est qu’un avertissement) et, sauf `-NoDb`, réplique la base de données et adapte la configuration locale. `rmwt [Slug] [-KeepBranch]` vise un worktree par son slug, ou le worktree courant (jamais le dépôt principal), ramène le shell au dépôt principal s’il était dedans, supprime le worktree et son dossier, la base répliquée quand elle se distingue de celle du dépôt principal, et la branche, sauf `-KeepBranch` ou HEAD détachée. Ces fonctions ne ferment pas les programmes qui verrouillent le dossier.

**Contrat de synchronisation.** Après `wtr`, le pane qui exécute la commande devient la source de vérité pour le dossier courant et le contexte Git ; l’interface relit ces valeurs et met à jour le workspace ou l’onglet déjà associé sans créer de doublon automatiquement. Après `rmwt`, elle relit le dossier et Git, marque comme indisponibles les panes dont le chemin n’existe plus et propose de les fermer ou de choisir un dossier de repli. L’interface ne rejoue pas les effets d’un `wtr`/`rmwt` tapé au terminal, ne relance jamais ces commandes à la restauration d’une session, ne déduit pas une réussite complète du seul texte final (certaines étapes ne produisent que des avertissements) et ne supprime pas un workspace sans action explicite de l’utilisateur.

### Gestion visuelle de Git

Une vue Git permet de piloter le dépôt du pane actif sans taper de commande. Elle s’affiche dans le panneau de droite, comme les vues Fichiers et Notes : même état par onglet et même largeur, les terminaux restant visibles. Elle présente la liste des branches locales et distantes avec leur avance et leur retard, et le graphe de l’historique avec les étiquettes de branches et de tags ; un clic sur un commit montre ses fichiers et son diff. Stage et unstage se font par fichier, par chunk ou par ligne (ci-dessous), avec un diff coloré en lecture seule dans Tily, un message de commit, la case « Amend » et « Commit et push ». Fonctions incluses : commit, push, pull, fetch, merge, création, checkout, renommage et suppression de branches, stash, tags, rebase non interactif, cherry-pick et reset vers un commit. Un bouton « Annuler » défait la dernière opération faite depuis Tily tant qu’aucun push ne l’a publiée. En cas de conflit, la vue liste les fichiers concernés, les ouvre dans l’éditeur configuré, permet de les marquer résolus puis de terminer ou d’annuler l’opération. Le push forcé n’est proposé qu’après un push refusé, toujours avec `--force-with-lease` et après confirmation.

La dernière vue du panneau de droite (Fichiers, Git ou Notes) est mémorisée par onglet avec son ouverture ; une icône par vue dans la barre d’onglets ouvre le panneau sur cette vue, ou le ferme quand elle est déjà affichée, et le panneau porte le titre de sa vue. Commande « Afficher / masquer Git » dans la palette, Leader puis G ou Ctrl + Maj + G : ouvre la vue Git, y bascule depuis une autre vue, ou ferme et rend le focus au terminal. La vue suit le dépôt ou le worktree du dossier du pane actif et affiche « Aucun dépôt Git » hors dépôt ; elle se met à jour en direct, y compris après une commande tapée au terminal ou lancée par un agent. Ouvrir la vue Git affiche, à la place des terminaux de l’onglet et sous la barre d’onglets, un graphe qui regroupe l’historique et les branches, avec le focus. Colonnes « Branche / Tag », « Graphe », « Message », « Auteur » et « Date » : leur largeur se règle à la souris ou au clavier, « Auteur » et « Date » se masquent par un clic droit sur l’en-tête, et ces réglages sont mémorisés dans la session. Les étiquettes des branches et des tags sont reliées à leur commit ; une branche locale et sa branche distante sont réunies dans une seule étiquette quand elles pointent sur le même commit, la branche courante porte une coche. Les nœuds portent les initiales de l’auteur (aucune photo, aucun accès réseau), les merges une simple pastille. Une ligne « // WIP » en tête, reliée en pointillés au commit HEAD, annonce les fichiers ajoutés, modifiés, supprimés ou en conflit et l’opération en cours ; chaque stash apparaît en nœud pointillé rattaché à son commit de départ. Le graphe montre toutes les branches par défaut, une bascule « Courante » le limite à la branche courante et à son amont, et les commits se chargent par pages de 200 au défilement. À gauche du graphe, une colonne repliable et redimensionnable liste les branches locales avec leur avance et leur retard, rangées en dossiers par préfixe `/` (la branche courante et les branches principales épinglées en tête, section 3), les branches distantes par dépôt distant, les tags, les stash et les worktrees (une section vide n’est pas affichée ; à l’ouverture du graphe, toutes les sections sont repliées sauf les branches locales, et leurs titres ressortent en clair et en gras) : un clic amène au commit dans le graphe, un double-clic fait le checkout de la branche. Sur la branche courante ou sur la branche distante qu’elle suit, un double-clic, dans cette colonne ou sur l’étiquette du graphe, fait un pull. La section Worktrees liste le dépôt principal et ses worktrees avec leur branche : « Ouvrir » rejoint un pane qui s’y trouve déjà, sinon ouvre un workspace, et son « + » crée un worktree. Ctrl + clic, Maj + clic, Maj + flèches et Ctrl + A y sélectionnent plusieurs branches, branches distantes, tags ou stash, même de sections différentes : le clic droit propose alors de les supprimer après une seule confirmation, qui signale les branches sans merge et les branches distantes, ou de copier leurs noms, et Suppr supprime la sélection ; « Annuler » restaure ensuite les branches, tags et stash locaux. Glisser une branche sur la branche courante, ou la branche courante sur une autre branche, propose un merge ou un rebase. Menus contextuels, notamment : commit (checkout, créer une branche ou un tag, cherry-pick, revert, merge, rebase, reset soft, mixed ou hard, push, copier le SHA ou le message), branche (checkout, merge, rebase, aller au commit, renommer, supprimer, push, créer un worktree ou une MR/PR depuis la branche, copier le nom ; supprimer la branche distante depuis une branche distante ou une étiquette du graphe), tag (push, aller au commit, créer une branche, supprimer), stash (appliquer, appliquer et supprimer, voir les modifications, supprimer), worktree (ouvrir, afficher dans l’Explorateur Windows, copier le chemin, supprimer), ligne WIP (stage de tout, stash, créer une branche) et fichiers modifiés du panneau Git, sélectionnables à plusieurs par Ctrl + clic, Maj + clic ou Ctrl + A (ouvrir dans l’éditeur, stage, unstage, marquer résolu, stash des seuls fichiers choisis, abandonner, ajouter au `.gitignore`, copier les chemins ; Espace et Suppr agissent sur toute la sélection). Échap ou la croix ferme le graphe et rend les terminaux sans fermer le panneau ; le bouton « Graphe » du panneau l’affiche ou le masque. Le panneau Git montre le détail de la ligne choisie, sans onglets internes : pour la ligne WIP, les conflits, les fichiers Unstaged puis, en dessous, les fichiers Staged, avec leurs actions, le message de commit, la case « Amend » (amend du dernier commit), « Commit » et « Commit et push » ; pour un commit, son message, son auteur, sa date et ses fichiers ; pour un stash, les mêmes informations et ses actions. En tête du panneau : branche (un clic la copie) ou HEAD détachée, avance et retard sur la branche distante suivie, bouton « Graphe », puis Fetch, Pull, Push (qui publie une branche sans amont), Annuler et Actualiser. Le diff d’un fichier s’affiche dans un volet large par-dessus le graphe ou les terminaux : il suit le fichier choisi, se recharge quand le fichier change et se ferme par Échap ou la croix. Les branches distantes se suppriment depuis la vue après confirmation ; le reset hard, la suppression d’une branche sans merge, l’abandon de modifications, la suppression d’un stash, l’abandon d’une opération en cours et le push forcé demandent aussi une confirmation. « Annuler » couvre commit, amend, merge, pull, rebase, cherry-pick, reset (les modifications locales effacées par un reset hard sont restaurées), checkout, création, suppression et renommage de branche, tags, stash, suppression d’un stash et abandon de modifications ; il est refusé, raison en infobulle, si le dépôt a changé depuis ou si un push a publié les commits, ne couvre ni ce qui a été publié ni l’application d’un stash, et n’est pas conservé à la fermeture de Tily. Un conflit ramène le panneau sur la ligne WIP avec une bannière « Terminer » / « Abandonner » ; « Marquer résolu » demande confirmation si le fichier contient encore des marqueurs de conflit. Après un push refusé, une bannière propose « Pull » ou « Forcer le push… » avec `--force-with-lease`, refusé si la branche distante a changé depuis le dernier fetch. L’hôte exécute le `git` installé avec des arguments séparés, sans composer de ligne de commande, et respecte la configuration, les hooks et le gestionnaire d’identifiants de l’utilisateur ; la sortie d’une commande refusée, hooks compris, s’affiche dans la vue. Le rebase interactif et l’éditeur de conflits intégré sont hors périmètre ; les MR/PR et le stage d’une partie de fichier sont décrits ci-dessous.

Les libellés et les messages de la vue Git gardent les termes Git anglais, invariables : Push, Pull, Fetch, Stash, Stage et Unstage (fichiers Staged et Unstaged), Merge, Rebase, Amend, Checkout et Cherry-pick. Les phrases restent en français et emploient ces termes comme des noms, par exemple « Push vers origin/main terminé. », « 3 commits à push » ou « Faites un pull pour les intégrer ».

Ouvrir la vue Git lance un fetch de toutes les branches distantes (`git fetch --all`), y compris au démarrage de Tily si elle était ouverte, puis chaque fois que le pane actif passe à un autre dépôt, au plus une fois toutes les 5 minutes par dépôt (un fetch manuel compte). Ce fetch est discret : la barre de progression s’affiche, mais ni message de réussite ni erreur (hors ligne, authentification) ; un dépôt sans dépôt distant est ignoré. Il se désactive dans les Paramètres (« Fetch automatique à l’ouverture de la vue Git », activé par défaut).

L’en-tête du volet de diff porte un bouton « Copier le diff », qui place dans le presse-papiers le diff du fichier tel que Git le produit (en-tête `diff --git` avec renommage, création ou suppression, `--- a/…`, `+++ b/…`, chunks `@@`, fins de ligne CR conservées), applicable par `git apply` ou à coller dans un agent, pour un fichier Unstaged, Staged, d’un commit ou d’un stash ; il est grisé pour un fichier binaire, pour un diff tronqué à l’affichage, dont la copie donnerait un patch incomplet, et pour un fichier qui n’est pas en UTF-8, dont les caractères accentués seraient perdus.

Dans un diff Unstaged ou Staged, Ctrl + clic sur le texte d’une ligne ouvre le fichier dans l’éditeur à cette ligne (numérotation de la nouvelle version ; sans effet sur une ligne supprimée ; dans un diff Staged d’un fichier qui a aussi des modifications Unstaged, le fichier s’ouvre sans ligne, la numérotation de l’index ne correspondant plus) ; Ctrl + clic dans la gouttière reste réservé à la sélection de lignes.

Le menu d’un commit propose aussi « Revert sur « branche courante » », qui crée un commit défaisant ses modifications (`git revert --no-edit`, par rapport au premier parent pour un merge), y compris pour le commit HEAD ; un conflit suit le parcours des autres opérations (bannière « Terminer » / « Abandonner »), et « Annuler » retire le commit de revert tant qu’il n’est pas publié.

Le clic droit sur un commit du graphe permet son push sans faire de checkout : « Push de « branche » » pour chaque branche locale dont il est la pointe, courante ou non. Le menu d’une branche, sur son étiquette ou dans la colonne des branches, propose de même « Push de la branche ».

Sur un commit non publié de la branche courante autre que HEAD, « Push de « branche » jusqu’à ce commit » publie ce commit et ses parents sans les commits suivants (`git push <distant> <commit>:<branche>`) ; seuls les commits qu’un tel push publierait en avance rapide le proposent, et une branche publiée ainsi suit aussitôt sa branche distante. Ces entrées sont grisées sans dépôt distant ou quand la branche n’a aucun commit à pousser. Un push de la branche courante entière suit le parcours du bouton Push ; un refus d’un autre push (autre branche ou push partiel) s’affiche dans le bandeau d’échec avec la sortie de Git, sans proposer de push forcé, qui reste réservé au push de la branche courante entière.

Le diff d’un fichier Unstaged ou Staged, fichier non suivi compris, permet de choisir des chunks entiers ou des lignes précises. Chaque chunk porte ses actions, comme les lignes choisies : Stage et Abandonner dans un diff Unstaged, Unstage dans un diff Staged. L’abandon demande une confirmation et « Annuler » le défait, comme l’abandon d’un fichier. Le stage d’une partie d’un fichier non suivi l’ajoute à l’index avec les seules lignes choisies, le reste restant Unstaged. Au clavier, ↑ / ↓ déplacent le choix de ligne modifiée en ligne modifiée, Espace fait le stage ou l’unstage du choix et Suppr l’abandonne.

La sélection se fait dans la gouttière des numéros de ligne, pour laisser le texte du diff sélectionnable et copiable : clic, Maj + clic pour une plage, Ctrl + clic pour ajouter ou retirer une ligne, glisser pour une plage ; un clic sur l’en-tête d’un chunk le choisit en entier. Maj + ↑ / ↓ étend le choix, Ctrl + ↑ / ↓ choisit le chunk précédent ou suivant, Ctrl + A toutes les lignes modifiées, Échap efface le choix puis, au second appui, ferme le volet. Tout à gauche, un petit bouton encadré « + » vert (Stage) ou « − » rouge (Unstage), distinct des signes + et − du diff, apparaît au survol d’une ligne modifiée et sur la ligne courante : il agit sur cette ligne, ou sur toutes les lignes choisies si elle en fait partie ; le même bouton, toujours visible, est en tête de chaque chunk, suivi de son bouton Abandonner ; une barre flottante en bas du diff annonce le nombre de lignes choisies avec leurs actions. Aucune sélection sur un fichier renommé, binaire, trop volumineux ou dans le diff d’un commit. L’hôte relit le diff et refuse la sélection s’il a changé depuis son affichage, reconstruit un patch partiel puis l’applique par `git apply` (`--cached` pour Stage, `--cached --reverse` pour Unstage, `--reverse` pour l’abandon) ; une sélection que Git ne sait pas appliquer seule (par exemple autour d’une fin de fichier sans retour à la ligne) est refusée avec un message qui invite à y ajouter les lignes voisines ou le chunk entier.

Quand le dossier du pane actif n’appartient à aucun dépôt, la vue Git le dit et propose « Initialiser un dépôt Git ici » (`git init` dans ce dossier) ; la vue affiche aussitôt le nouveau dépôt et la barre de statut confirme « Dépôt Git initialisé dans … (branche …) ».

« Rechercher un commit dans le graphe… » (palette, quand la vue Git est affichée et son historique chargé, ou bouton loupe de la barre du graphe) cherche dans les commits déjà chargés par le graphe (200 au départ, davantage en défilant) par message, SHA, auteur, adresse ou nom de branche ou de tag ; Entrée ouvre la vue Git sur le graphe, sélectionne le commit, le centre et affiche son détail.

Quand la place manque dans le graphe, Date puis Auteur sont masqués à l’affichage pour laisser au moins 200 px au message, sans changer le réglage mémorisé ; ils réapparaissent dès que la place revient. De même, s’il reste moins de 400 px au graphe, la colonne des branches, tags et stash est repliée à l’affichage ; son bouton dans la barre du graphe l’affiche quand même, et elle revient d’elle-même quand la place revient.

La vue Git porte une section repliable « Pull requests » (GitHub) ou « Merge requests » (GitLab) qui liste les MR/PR ouvertes du projet. L’hébergeur est reconnu à l’adresse du dépôt distant `origin` : GitHub, gitlab.com ou une instance GitLab auto-hébergée ; aucun autre hébergeur. Tily réutilise les CLI déjà configurées, `gh` pour GitHub et `glab` pour GitLab, sans aucun jeton saisi dans Tily ; une CLI absente, non authentifiée, un hébergeur injoignable ou non pris en charge donnent un message clair en français. Filtres rapides : labels, assignés et recherche texte. Un clic ouvre la MR/PR dans le navigateur par défaut, Maj + clic dans un pane navigateur de Tily. La ou les MR/PR ouvertes de la branche courante s’affichent, à la manière de Claude Code pour GitHub, en pastille dans l’en-tête du terminal à côté de la branche et dans l’en-tête de la section.

La section est repliée par défaut et garde son ouverture tant que Tily tourne ; dès l’affichage de la vue Git, elle charge les 100 MR/PR ouvertes les plus récemment mises à jour, avec leur nombre dans son en-tête, la branche courante en tête et surlignée, et se relit à chaque changement de dépôt et par son bouton d’actualisation. Labels et assignés se choisissent à plusieurs dans un menu (une MR/PR qui porte au moins l’un d’eux est gardée) ; « Moi » est en tête des assignés quand la CLI donne le compte connecté. La recherche porte sur le titre, le numéro, l’auteur et les branches. Chaque ligne donne le titre, puis le numéro, les branches source et cible et la date de mise à jour, puis le brouillon ou la revue (approuvée, modifications demandées, revue requise), les labels et les initiales des assignés, le détail complet en infobulle ; l’icône GitHub ou GitLab de l’en-tête de la section ouvre la liste de l’hébergeur. La pastille porte la couleur de l’état et de la revue, `+n` quand la branche a plusieurs MR/PR ouvertes, et se masque avec la branche dans un pane étroit. L’hôte garde la réponse d’une branche 60 s (5 min pour un échec), si bien que la pastille suit une MR/PR créée au terminal au plus tard une minute après.

Tily crée une MR/PR sur GitHub et GitLab, par les mêmes CLI, dans une boîte de dialogue : branche source, branche cible, titre, description, reviewers (plusieurs, lus sur l’hébergeur), assigné (un seul, lu sur l’hébergeur, le compte connecté par défaut), labels (plusieurs, lus sur l’hébergeur), case « Créer en brouillon » décochée à l’ouverture, boutons Annuler et Créer. Elle s’ouvre depuis la section MR/PR de la vue Git, la palette, le menu d’une branche du graphe et l’en-tête du terminal. La cible proposée est la base réglée pour les worktrees (`develop`) si elle existe sur `origin`, sinon la branche par défaut de l’hébergeur. Une branche non publiée ou en avance sur `origin` est signalée, avec une case « Pousser la branche avant de créer » cochée. Le titre reprend le message du commit s’il est seul, sinon le nom de la branche ; la description reprend le modèle de MR/PR du dépôt s’il existe, sinon la liste des commits. Après la création, la barre de statut l’annonce, et la liste comme la pastille de la branche se mettent à jour.

Le bouton de l’en-tête du terminal (icône « Créer une PR » ou « Créer une MR ») n’apparaît que si la branche n’a aucune MR/PR ouverte et n’est ni la base des worktrees ni la branche par défaut de `origin`. Le formulaire indique le nombre de commits d’avance sur la cible et signale une MR/PR déjà ouverte depuis la source ; changer de branche recalcule ces indications, ainsi que le titre et la description tant qu’ils n’ont pas été modifiés à la main. Reviewers, assigné et labels se choisissent dans une liste avec recherche. Ctrl + Entrée crée, Échap ferme. Si l’hébergeur refuse l’assigné, les labels ou les reviewers après avoir créé la MR/PR, elle est gardée et la barre de statut le signale en avertissement.

Tily modifie une MR/PR ouverte, sur GitHub et GitLab, par les mêmes CLI et dans la même boîte de dialogue que la création, préremplie avec son état actuel : branche cible, titre, description, reviewers, assigné, labels et case « Brouillon » (passage en brouillon ou prête pour la revue) ; la branche source ne se modifie pas. Un bouton « Fermer la PR » (ou « la MR ») ferme la MR/PR ; les MR/PR fusionnées ou fermées ne se modifient pas. La modification s’ouvre par un crayon et par le clic droit sur une ligne de la liste MR/PR, sur la pastille de la branche (en-tête du terminal et section MR/PR), et depuis la palette (« Modifier la PR #n… » pour la branche du pane actif) ; le clic simple garde son comportement. Seuls les champs changés sont envoyés : une MR/PR qui a plusieurs assignés les garde tant que l’assigné n’est pas changé, et changer l’assigné les remplace tous. Après l’enregistrement, la barre de statut l’annonce, et la liste comme la pastille de la branche se mettent à jour.

« Enregistrer » reste désactivé tant que rien n’a changé (Ctrl + Entrée enregistre, Échap ferme) ; la fermeture demande un second clic sur « Confirmer la fermeture » et enregistre aussi les champs modifiés. Les autres assignés sont rappelés sous l’assigné. Les équipes demandées en revue sur GitHub ne sont ni affichées ni retirées. Sur GitLab, le brouillon passe par le préfixe « Draft: » du titre. Une branche source en avance sur `origin` propose « Pousser la branche avant d’enregistrer », décochée. Un refus de l’hébergeur sur les labels, l’assigné, les reviewers ou le brouillon après l’enregistrement du reste devient un avertissement de la barre de statut.

## 11. Attention, agents et notifications

Les workspaces restent les éléments principaux. L’activité de **Claude Code** (`claude`) s’y rattache pour aider à trouver où une intervention est nécessaire.

| État | Signification |
| --- | --- |
| En cours | Une intégration indique une activité en cours. |
| En attente | Une réponse utilisateur ou une autorisation est nécessaire. |
| Terminé | L’activité suivie est terminée. |
| En erreur | L’activité a rencontré une erreur identifiée. |
| Inconnu | L’état ne peut pas être déterminé de manière fiable. |

- Résumer les besoins d’attention au niveau du workspace et les rendre repérables sur l’onglet concerné.
- Cliquer sur une activité ou une indication d’attention rejoint le workspace, l’onglet et le pane correspondants.
- Fournir des notifications discrètes et ciblées, notamment lors d’une demande d’intervention.
- Ne pas interrompre la saisie ni changer automatiquement de workspace à l’arrivée d’un état.
- Ne pas considérer un processus existant comme une preuve de travail effectif ou d’attente utilisateur.
- À la restauration d’une session, ne pas restaurer comme vivants les états des anciens processus.

Fin d’une commande longue dans Windows PowerShell ou PowerShell 7 : le wrapper de prompt de Tily (section 14) annonce à chaque nouvelle entrée de l’historique sa durée et son succès (`$?`) par une séquence OSC privée (6973), jamais affichée. Si la commande a duré au moins 10 secondes et que son onglet n’est pas celui affiché, l’onglet porte, dans la barre d’onglets et le panneau des workspaces, une coche (réussite) ou une croix rouge (échec) avec la durée en infobulle, sauf si un état d’agent occupe déjà cette place ; la même indication (échec d’abord) figure sur la ligne d’un workspace replié du panneau et sur son nom dans l’en-tête quand le panneau est masqué ; la barre de statut l’annonce en citant la première ligne de la commande, tronquée à 48 caractères (« « pnpm test » en échec après 1 min 05 s dans l’onglet « web ». »). Afficher l’onglet efface l’indication. Si Tily n’est pas la fenêtre active, la fin d’une telle commande, même dans l’onglet affiché, fait aussi clignoter Tily dans la barre des tâches quand la case « Clignotement dans la barre des tâches » (Paramètres, section « Notifications ») est cochée. Aucune notification Windows, aucun son, aucun changement de focus. CMD et Git Bash n’ont pas ce wrapper et ne sont pas concernés.

Agréger le nombre d’attentes par workspace, éviter les notifications répétées pour le même événement et offrir l’accès au pane sans prise de focus forcée. Si plusieurs panes attendent, permettre de choisir la destination.

Dans la palette, chaque entrée « Rejoindre » indique depuis combien de temps l’agent attend (« depuis 3 min »), mesuré depuis que Tily a reçu cet état, et les entrées vont de l’attente la plus ancienne à la plus récente. Les cartes d’attention affichent cette durée sous sa forme courte (ci-dessous), mise à jour toutes les 30 secondes, et suivent le même ordre.

Les notifications d’attention, dans Tily comme dans Windows, et de fin, dans Windows seulement, ne disent que l’essentiel sur deux lignes : « workspace › onglet », puis la raison courte : « Autorisation : <outil> », le texte de la question posée, ou « Terminé ». Ni commande, ni dernier message de l’agent, ni dossier, ni branche ; le détail reste dans l’infobulle de l’onglet et dans la palette. La carte d’attention de Tily porte en plus la durée d’attente en forme courte (« < 1 min », « 12 min ») ; un clic sur la carte rejoint le pane, sa croix l’ignore, et une raison trop longue est coupée, en entier dans son infobulle.

Leader puis A, Ctrl + Maj + A ou « Rejoindre l’agent en attente suivant » dans la palette rejoint le pane en attente qui suit le pane actif dans l’ordre de la palette, de l’attente la plus ancienne à la plus récente (ordre du panneau à égalité), tous workspaces confondus et en boucle ; répété, il passe d’une attente à l’autre. Sans agent en attente, la barre de statut l’indique.

Claude Code est suivi par ses hooks, que Tily installe depuis les Paramètres (section « Agents et MCP »). Tant que l’état d’un agent ne peut pas être établi, afficher « État inconnu » plutôt que d’inférer une activité depuis le seul processus.

### Pilotage par Claude Code (MCP)

L’utilisateur n’a plus à servir de presse-papier entre ses terminaux et Claude Code : un agent lancé dans un pane lit la sortie de n’importe quel pane, retrouve les commandes en échec, attend qu’un serveur soit prêt et organise lui-même workspaces, onglets, panes et worktrees.

- Transport : un exécutable stdio `tily-mcp.exe`, livré à côté de `Tily.exe` et bâti sur le SDK officiel `ModelContextProtocol` pour C#, est déclaré une seule fois comme serveur MCP `tily` au niveau utilisateur de Claude Code (`~/.claude.json`, édité directement). Il retrouve son instance de Tily par `TILY_DATA_DIR`, hérité du pane, et lui parle par un named pipe propre à cette instance ; rien n’écoute sur le réseau. Lancé hors de Tily (sans `TILY_PANE_ID`), il ne déclare ni outil ni instruction, pour ne rien ajouter au contexte de Claude ; un appel qui lui parviendrait quand même reçoit une erreur claire en français.
- Activation : le réglage « Serveur MCP » de la section « Agents et MCP » des Paramètres active ou désactive le serveur au choix de l’utilisateur et affiche « Activé » ou « Désactivé ». Activer déclare le serveur ; désactiver le retire de la configuration de Claude Code et ferme le canal de l’instance. Les autres réglages et serveurs de ce fichier sont conservés. L’exécutable partage le runtime .NET de Tily : l’installeur n’embarque pas de second runtime.
- Pouvoirs : la lecture et les actions sûres sont libres. Une confirmation dans Tily (Autoriser / Refuser, avec l’agent, l’action et la cible) est demandée pour fermer un pane occupé ou qui n’appartient pas à l’agent, écrire dans un pane qui n’appartient pas à l’agent et supprimer un worktree ; un refus revient à Claude sous forme d’erreur en français. Les onglets et panes créés par un agent lui appartiennent et portent une marque discrète : une étoile, avec l’agent créateur en infobulle.
- Source de la sortie : le texte rendu par xterm.js côté interface, avec les repères de commande existants ; l’hôte ne duplique pas la sortie des terminaux. Un pane jamais affiché depuis le lancement de Tily n’a pas démarré : sa lecture répond par une erreur. Un onglet ou un split créé par l’agent avec une commande de démarrage devient l’onglet affiché, ce qui démarre son terminal.
- Succès d’une commande : connu pour Windows PowerShell 5.1 et PowerShell 7 (séquence OSC 6973) ; « inconnu » pour les autres shells.
- Hors périmètre : les logs de jobs GitLab, qui passent par le serveur MCP GitLab existant.

| Outil | Rôle | Garde-fou |
| --- | --- | --- |
| `tily_layout` | Arborescence workspaces → onglets → panes : identifiants, noms, dossier, branche, shell, état d’agent, pane démarré ou non ; le pane appelant et les éléments affichés sont marqués. | libre |
| `tily_read_pane` | Texte rendu d’un pane : N dernières lignes, ou sortie de la dernière commande. | libre |
| `tily_commands` | Commandes terminées : commande, durée, succès, dossier, extrait de sortie ; filtre « échecs seulement ». | libre |
| `tily_wait_for` | Attend un motif (`Now listening on`, `ready in`) ou la fin d’une commande, avec un délai maximal. | libre |
| `tily_open_workspace`, `tily_new_tab`, `tily_split`, `tily_focus`, `tily_rename` | Organisation ; un onglet ou un split créé peut lancer une commande au démarrage. | libre |
| `tily_run`, `tily_interrupt` | Écrire une commande ou envoyer Ctrl + C dans un pane. | libre dans un pane de l’agent, confirmation sinon |
| `tily_close` | Fermer un pane ou un onglet. | libre si le pane est à l’agent et inactif, confirmation sinon |
| `tily_worktrees`, `tily_create_worktree` | Lister et créer (ports, `pnpm install`, base répliquée). | libre |
| `tily_remove_worktree` | Suppression avec le même dialogue que l’interface. | confirmation |
| `tily_browser_open`, `tily_browser_navigate`, `tily_browser_reload`, `tily_browser_resize` | Ouvrir un pane navigateur (côte à côte, en dessous ou en onglet) et y charger une adresse ; naviguer et recharger en attendant la fin du chargement ; largeur mobile ou desktop (section 6, « Panes navigateur »). | libre, y compris sur un navigateur ouvert par l’utilisateur |
| `tily_browser_console`, `tily_browser_network` | Console d’un pane navigateur (niveau minimal, depuis le dernier chargement) et requêtes réseau terminées (échecs seulement). | libre |
| `tily_browser_screenshot` | Capture PNG de la page en viewport desktop ou mobile, pleine page sur demande. | libre |
| `tily_browser_snapshot` | Contenu de la page sans capture : titres, textes, champs, boutons et liens avec rôle, nom, état, valeur et référence des éléments interactifs. | libre |
| `tily_browser_click`, `tily_browser_type`, `tily_browser_press`, `tily_browser_scroll` | Cliquer (double clic sur demande), saisir dans un champ ou choisir une option, presser une touche ou une combinaison, faire défiler, comme la souris et le clavier. | libre, y compris sur un navigateur ouvert par l’utilisateur |
| `tily_browser_evaluate` | Évaluer une expression JavaScript dans la page et rendre son résultat. | libre, y compris sur un navigateur ouvert par l’utilisateur |

Le nom du pipe dérive d’une empreinte SHA-256 du dossier de données (`tily-mcp-<24 caractères hexadécimaux>`) ; le pipe est réservé au compte Windows courant et refuse une seconde instance de Tily sur le même dossier de données. Chaque appel ouvre une connexion, envoie une ligne JSON et lit une ligne JSON. L’hôte relaie la demande à l’interface (`mcp.request`), qui répond (`mcp.response`) ; une demande sans réponse expire après 10 secondes (pour `tily_wait_for`, après le délai d’attente demandé plus 5 secondes) sans jamais bloquer le fil de l’interface. L’hôte ajoute à `tily_layout` la branche de chaque dossier. Une déclaration qui pointe vers une autre copie de Tily compte comme « activé » et peut être remplacée par « Activer pour cette copie » ; un serveur `tily` qui n’est pas celui de Tily n’est jamais écrasé. La désinstallation retire la déclaration.

Lecture : `tily_read_pane` rend par défaut les 100 dernières lignes d’un pane (2 000 au plus), lignes repliées recollées, au plus 40 000 caractères (les derniers, la réponse est alors marquée tronquée) ; un programme plein écran rend son écran. Chaque pane garde ses 100 dernières commandes terminées depuis son ouverture, avec le dossier où elles ont été lancées. `tily_commands` rend les 20 plus récentes par défaut (100 au plus), de tous les panes démarrés ou d’un seul, chacune avec ses 20 dernières lignes de sortie, ainsi que les commandes en cours et les panes dont le shell ne signale pas ses commandes. `tily_wait_for` attend 60 secondes par défaut, 300 au plus ; le texte (sans tenir compte de la casse, expression régulière sur demande) est cherché dans la sortie de la commande en cours depuis son lancement, sinon dans ce qui s’affiche après l’invite (PowerShell) ou dans l’écran visible (autres shells), puis dans tout ce qui s’affiche ensuite. L’attente s’arrête aussi quand la commande suivie se termine, quand le shell se termine ou quand le pane est fermé, et rend alors la fin de l’écran ; sans texte, elle attend la fin de la commande en cours (PowerShell uniquement).

Organisation : la propriété est enregistrée dans la session (le pane de l’agent créateur, sur l’onglet et sur chaque pane créés) et survit au redémarrage ; un onglet dupliqué par l’utilisateur ne lui appartient pas. La marque est une petite étoile sur l’onglet (barre d’onglets et panneau des workspaces) et dans l’en-tête du pane, avec en infobulle le workspace et l’onglet de l’agent. Un nouvel onglet s’ajoute à la fin du workspace de l’agent par défaut, dans le dossier de l’agent ; un split s’ouvre dans le dossier et le shell du pane partagé, sans prendre le focus clavier. Sans commande ni demande d’affichage, un élément créé ne change pas ce que regarde l’utilisateur. Les chemins relatifs partent du dossier courant de l’agent et un dossier absent est refusé. `tily_run` écrit une seule ligne, comme une frappe, et refuse un pane dont le shell s’est terminé, qui affiche un programme plein écran ou dont une commande tourne déjà ; il attend au plus 3 secondes que la commande démarre ou se termine. `tily_interrupt` attend au plus 3 secondes l’arrêt de la commande.

Confirmations : le dialogue « Claude Code demande votre accord » cite l’agent (son workspace et son onglet), l’action, la cible (pane ou onglet, ouvert par l’utilisateur ou créé par Claude) et, s’il y a lieu, la commande à lancer ou ce qui tourne (commande suivie, programmes actifs vus par l’hôte). Le focus est sur « Refuser » ; Entrée et Échap refusent ; « Autoriser » n’agit qu’après 0,6 seconde, pour qu’une frappe en cours ne vaille jamais accord. Sans réponse en 2 minutes, la demande est refusée ; plusieurs demandes s’affichent l’une après l’autre ; la barre des tâches clignote (réglage `taskbarFlash`) et la barre de statut annonce la demande. Un pane est occupé quand une commande suivie y tourne ou que l’hôte y voit des programmes actifs. Claude ne peut ni écrire dans son propre pane, ni l’interrompre, ni le fermer avec son onglet. Une fermeture autorisée ne repasse pas par la confirmation de fermeture de l’interface ; un onglet fermé se rouvre par Ctrl + Maj + Z.

Naviguer, recharger, changer la largeur d’un pane navigateur et y agir (clic, saisie, touches, défilement, JavaScript) sont libres, comme la lecture, même s’il a été ouvert par l’utilisateur ; le fermer suit les règles de `tily_close`.

Navigateur : sans `pane`, un outil navigateur vise le dernier pane navigateur que l’agent a ouvert ou désigné, sinon son dernier pane navigateur dans la disposition, sinon le seul pane navigateur de son onglet ou de Tily ; s’il en reste plusieurs, il demande de préciser `pane`. `tily_layout` marque les panes navigateur (`kind: "browser"`, adresse, titre, largeur, nombre d’erreurs). `tily_browser_open` crée un pane qui appartient à l’agent, à côté de son pane par défaut, affiche son onglet pour que l’utilisateur voie la page sans lui prendre le focus clavier, puis charge l’adresse. Navigation et rechargement attendent la fin du chargement (30 s au plus) et rendent le statut HTTP, le titre et le nombre d’erreurs du chargement. La console rend les 50 derniers messages par défaut (500 au plus), du niveau « log » et au-delà par défaut ; le réseau les 50 dernières requêtes (500 au plus). La capture rend à Claude une image PNG (1440 × 900, ou 390 × 844 à l’échelle 2 en mobile ; largeur du pane par défaut ; pleine page jusqu’à 16 000 px de haut), même pour un pane dont l’onglet n’est pas affiché, et peut aussi l’enregistrer dans un fichier `.png` d’un dossier existant (chemin relatif au dossier de l’agent). Un pane navigateur jamais affiché depuis le lancement de Tily répond par une erreur ; les outils des terminaux (lecture, commandes, attente, écriture, interruption) refusent un pane navigateur en renvoyant vers les outils navigateur.

Interactions : `tily_browser_snapshot` rend la page sous forme de plan indenté (800 lignes au plus, limité à un sélecteur CSS sur demande), où chaque élément interactif porte une référence (`[ref=e12]`) valable jusqu’au prochain chargement de la page, avec l’élément qui a le focus, la taille de la page affichée et sa position de défilement. Les outils d’action visent un élément d’une seule façon : sa référence, un sélecteur CSS (premier élément affiché), son texte visible ou son nom accessible (`label`), ou des coordonnées en pixels de la page telle que la rend la capture, émulée le temps de l’action. Le clic et la saisie passent par de vrais événements souris et clavier du navigateur : l’élément est amené à l’écran, un élément masqué ou recouvert est refusé en nommant ce qui le recouvre, et le focus clavier de l’utilisateur ne change pas. La saisie écrit à la fin du champ ou remplace son contenu (`clear`), presse Entrée sur demande (`submit`) et choisit l’option correspondante d’une liste déroulante ; elle rend la valeur du champ, masquée pour un mot de passe. Une touche pressée par Claude va à la page, même si c’est un raccourci de Tily ; elle se répète 100 fois au plus. Le défilement agit comme la molette sur la zone sous l’élément visé ou au centre de la page (80 % de la zone par défaut), ou amène un élément au centre de l’écran, et rend la position atteinte. Clic, saisie et touches attendent la fin d’une navigation qu’ils déclenchent (30 s au plus) et rendent l’adresse, le titre, le nombre d’erreurs et l’élément qui a le focus. `tily_browser_evaluate` accepte `await` au premier niveau, attend une promesse 30 s au plus et rend le résultat sérialisé en JSON (20 000 caractères au plus) ou le message et la pile d’une exception. Un pane dont l’onglet n’est pas affiché est rendu hors champ le temps de l’action, comme pour une capture.

Worktrees : `tily_worktrees` liste les worktrees du dépôt d’un dossier (par défaut, celui de l’agent) avec les panes ouverts dans chacun. `tily_create_worktree` suit les étapes du formulaire de création (dépôt du dossier, plan, création, ports, installation, base répliquée) et ouvre le worktree dans un workspace de l’agent, affiché seulement si une installation y démarre ou sur demande ; il rend la main à la fin de la réplication, 10 minutes au plus. `tily_remove_worktree` ouvre le dialogue de suppression de l’interface, prérempli par l’agent (branche gardée ou non, base supprimée ou non) : il cite l’agent demandeur, met le focus sur « Annuler » et n’active « Supprimer » qu’après 0,6 seconde ; sans réponse en 2 minutes, la demande est refusée. Le dépôt principal et le worktree où tourne l’agent ne se suppriment jamais par ce biais.

## 12. Sauvegarde, fermeture et restauration

### Données à retrouver

- Workspaces et onglets, noms et ordre.
- Note de chaque workspace.
- Journal des messages de la barre de statut.
- Dispositions de splits, orientations, proportions et panes actifs.
- Dossiers courants et shells utilisés.
- Adresse et largeur de chaque pane navigateur ; la session de ses pages reste dans son profil (section 6, « Panes navigateur »).
- Texte des anciennes sessions avec distinction visuelle à la réouverture.
- Workspace et onglet actifs, largeur du panneau, panneau visible/replié et groupes dépliés/repliés.

Sauvegarder automatiquement la disposition pendant l’utilisation, sans attendre une fermeture normale. À la réouverture, restaurer l’environnement visuel et créer des shells neufs. Ne pas réexécuter les anciennes commandes et ne pas conserver volontairement les agents ou serveurs en arrière-plan après fermeture.

Le texte restauré est accompagné d’un séparateur explicite, par exemple « Session restaurée — nouvelle session ». Un ancien affichage de serveur ou d’agent ne doit pas être présenté comme une activité encore en cours.

### Robustesse

- Écritures atomiques et format versionné pour éviter une sauvegarde partiellement écrite.
- Sauvegardes différées et regroupées pour les redimensionnements, avec enregistrement final en fin d’interaction.
- Sauvegarde périodique du texte indépendante de la sauvegarde de disposition.
- En cas d’échec d’écriture, garder la session utilisable et signaler que les changements ne sont pas enregistrés.
- Si les données sont corrompues, conserver le fichier fautif pour récupération et ouvrir une session de secours plutôt que l’écraser silencieusement. Chaque enregistrement garde le précédent dans `session.previous.json` ; si `session.json` est illisible (par exemple vidé par une coupure de courant), cet avant-dernier enregistrement est restauré s’il est valide, sinon la session initiale ; les fichiers sont écrits sur le disque avant d’être renommés.
- Si un dossier a disparu, conserver le pane et demander ou proposer un dossier de repli avec indication locale.

La valeur par défaut est de 10 000 lignes conservées par pane et de 256 Mio pour l’historique global ; ces deux limites sont configurables. Sauvegarder le texte toutes les 30 secondes, fréquence configurable. Conserver cinq onglets fermés restaurables et leur historique après redémarrage. À la fermeture d’un pane, d’un onglet, d’un workspace ou de l’application, utiliser l’arrêt forcé ; demander une confirmation si un serveur, un agent ou un programme est encore actif, puis arrêter tous les processus concernés.

## 13. Configuration exportable

La configuration doit être sauvegardable, exportable et versionnable au format **JSON**. L’import doit permettre de retrouver les préférences sauvegardées.

Séparer trois ensembles :

| Ensemble | Contenu |
| --- | --- |
| Préférences versionnables | Shells, chemins exécutables, paramètres, raccourcis, police, éditeur, dossier Projets et préférences visuelles. |
| État de session local | Workspaces, onglets, chemins courants, sélection et disposition. |
| Historique local | Texte terminal et éventuelles données nécessaires à la réouverture d’un onglet. |

L’export de préférences ne doit pas embarquer implicitement la sortie des terminaux. Un export volontaire de disposition peut être proposé séparément ; il contient alors des chemins locaux. L’import valide l’ensemble avant mutation et **remplace** la configuration courante ; il ne fusionne pas silencieusement les valeurs.

Les préférences exportables, l’état de session et l’historique restent séparés, chacun avec une version de schéma. Ils sont dans `%LOCALAPPDATA%\Tily` (`%LOCALAPPDATA%\Tily Beta` pour Tily Beta), ou dans le dossier que désigne la variable d’environnement `TILY_DATA_DIR`. Une confirmation est requise avant un import qui remplace une configuration existante.

L’en-tête de l’écran Paramètres affiche la version de Tily (« Tily x.y.z »), pour la comparer aux versions publiées ou la citer dans un signalement.

L’écran Paramètres reste court : une colonne de sections à gauche (Shells et éditeur, Terminaux, Raccourcis clavier, Projets et Git, Notifications, Agents et MCP, Mises à jour) n’affiche qu’une section à la fois, aux libellés alignés en colonne ; les modifications de toutes les sections sont enregistrées ensemble. Chaque réglage n’affiche que son libellé, et le détail (valeur par défaut, bornes, effet, fichiers touchés) est dans l’infobulle d’une icône ⓘ placée à côté du libellé ou du titre de la section, affichée au survol, au focus clavier ou au clic. Les états (installé, activé), les avertissements et les erreurs restent affichés en clair ; la disponibilité d’un shell est une pastille à côté de son nom, un shell introuvable restant signalé en clair. Un champ numérique hors bornes affiche ses bornes, et Enregistrer ramène à sa section. Les chemins des fichiers de réglages ne sont pas listés : « Ouvrir le dossier des réglages » ouvre leur dossier.

Le pied de l’écran Paramètres propose trois boutons icônes, Importer, Exporter et « Ouvrir le dossier des réglages » : l’Explorateur Windows s’ouvre sur le dossier des fichiers de réglages (et de la session), pour les sauvegarder ou les modifier à la main.

L’écran Paramètres signale un éditeur introuvable : chemin absolu absent, ou nom de commande (`code`, `cursor`…) qui n’est ni dans le PATH, avec les extensions de PATHEXT, ni parmi les applications enregistrées de Windows (App Paths) ; c’est un avertissement, l’enregistrement reste possible.

Un clic hors de l’écran Paramètres le ferme seulement s’il n’a aucune modification en cours ; sinon l’écran reste ouvert et son pied indique « Modifications non enregistrées : Enregistrer, ou Annuler pour les abandonner. ». Échap et Annuler ferment toujours sans enregistrer. Il en va de même pour le formulaire « Créer un worktree » : une fois un nom de nouvelle branche saisi, seuls Échap et Annuler le ferment.

Le dossier des worktrees et la base par défaut font partie des préférences exportées, sous une clé `worktrees` facultative : un fichier de version 1 qui ne la contient pas reste importable, avec les valeurs par défaut.

### Mises à jour de l’application

Tily signale qu’une nouvelle version est publiée et ne l’installe que sur un clic « Installer et redémarrer » : il télécharge l’installeur, ferme Tily, installe la mise à jour puis relance Tily. La nouvelle version s’annonce par un bouton « Mise à jour x.y.z » dans l’en-tête, à côté de Paramètres, qui ouvre ses nouveautés, et par une section « Mises à jour » dans Paramètres (état, « Rechercher maintenant »). La vérification a lieu au démarrage puis toutes les 6 heures, désactivable dans Paramètres ; la recherche manuelle reste toujours possible.

La source est la dernière release publique du dépôt GitHub (hors brouillons et préversions), dont l’installeur `Tily-x.y.z-setup.exe` est vérifié par l’empreinte SHA-256 que publie GitHub avant tout lancement : une release sans empreinte n’est pas installable. Tily Beta, installable à côté de Tily, suit de la même façon la dernière pré-release du dépôt, dont l’installeur s’appelle `TilyBeta-x.y.z-beta.n-setup.exe`. Les nouveautés affichées sont la section « Nouveautés » des notes de la release, ou toutes les notes sans elle. La fermeture suit celle de l’application (section 12) : confirmation si des programmes tournent, avec « Arrêter et installer » ; la session est sauvegardée puis restaurée avec des shells neufs. L’installeur tourne en mode silencieux avec sa fenêtre de progression, dans le mode de l’installation existante (par utilisateur, ou pour tous les utilisateurs avec l’autorisation de Windows), attend la fin de Tily et le relance. Une copie de Tily qui n’a pas été installée par son installeur (version de développement) signale la nouvelle version mais renvoie vers GitHub. Le réglage fait partie des préférences exportées, sous une clé `updates` facultative.

À l’import, une valeur de persistance hors bornes (sauvegarde du texte, lignes par pane, historique global) est ramenée dans sa plage, et chaque correction est signalée dans l’écran Paramètres, sous l’avis d’import, avant tout enregistrement.

## 14. Architecture fonctionnelle et choix techniques

Cette section décrit une séparation des responsabilités puis la pile technique.

- **Interface** : navigation, édition inline, palette, arborescence et affichage des états.
- **Modèle de session** : identifiants stables, ownership des onglets/panes, arbre de splits et sélection.
- **Moteur de terminal** : rendu, entrées clavier, sélection et historique.
- **Gestionnaire de processus** : lancement des shells, communication avec les terminaux, redimensionnement et fermeture des processus associés.
- **Intégration shell** : obtention fiable du dossier courant et chargement de la configuration habituelle.
- **Services locaux** : dossiers de projets, presse-papiers, éditeur, explorateur et contexte Git.
- **Adaptateurs d’agents** : conversion des événements disponibles vers les états normalisés du produit.
- **Persistance** : préférences, état de session, historique, migrations et récupération.

Les déplacements et changements de présentation agissent sur le modèle et la visibilité, pas sur le cycle de vie des processus. Les identifiants servent à retrouver les éléments ; les noms servent à les présenter.

### Pile technique

- **Hôte Windows :** application C# sur .NET 10 LTS avec une seule fenêtre WinUI 3 non empaquetée (Windows App SDK 2.5.1, publication autonome depuis la ligne de commande). L’hôte ne porte aucune interface métier : il gère la fenêtre, le gestionnaire de processus, les services locaux, les adaptateurs d’agents et la persistance.
- **Interface :** une WebView2 héberge toute l’interface (arborescence, onglets, splits, palette, Leader) et un terminal xterm.js par pane (les panes navigateur ont chacun la leur, voir plus bas), avec le renderer WebGL et un repli sur le rendu DOM. Les raccourcis sont interceptés dans xterm.js, jamais par des accélérateurs XAML, afin qu’un seul moteur traite le clavier et le focus.
- **Pseudo-terminal :** ConPTY, isolé derrière le gestionnaire de processus en C# avec P/Invoke. Chaque pane est rattaché à un Job Object Windows pour garantir l’arrêt de l’arbre de processus. Tily utilise la ConPTY de Windows.
- **Dossier courant :** ConPTY ne le fournit pas. Tily l’obtient par intégration shell propre (variable d’environnement dédiée et wrapper de prompt non intrusif émettant une séquence OSC), compatible avec Windows PowerShell 5.1 et oh-my-posh, sans imiter WezTerm. Il enveloppe aussi `PSConsoleHostReadLine`, s’il est défini, pour annoncer le début de l’exécution (`OSC 6973;exec`), comme l’intégration shell de VS Code, et annonce la hauteur en lignes de l’invite produite (`OSC 6973;prompt;<lignes>`, séquences d’échappement exclues). Il rend au prompt d’origine le statut `$?` de la dernière commande, qu’il lit avant d’émettre la séquence : un prompt qui affiche l’échec de la commande précédente (oh-my-posh, starship) le montre comme hors de Tily.
- **Pont hôte / interface :** messages JSON par `PostWebMessage`, sortie des terminaux comprise.
- **Distribution :** build Windows autonome publiée dans une release GitHub, avec un installeur Inno Setup pour l’application dépaquetée ; l’installeur remplace la version précédente, détecte ou installe le runtime WebView2 Evergreen et embarque le runtime Windows App SDK (build autonome). Les mises à jour s’installent depuis l’application (section 13).

Chaque pane navigateur (section 6, « Panes navigateur ») est une seconde WebView2 que l’hôte place au-dessus de l’emplacement du pane, dans le même environnement que l’interface mais avec un profil WebView2 distinct, dont les cookies et les sessions sont séparés de ceux de l’interface et conservés d’un lancement à l’autre. Elle donne le protocole DevTools complet, les captures natives et une vraie navigation (connexion Azure AD, popups), là où l’iframe de l’aperçu HTML est refusée par Azure AD et par beaucoup de sites et n’a qu’un protocole DevTools limité. L’interface et le clavier restent dans la WebView2 de l’interface : une page renvoie à Tily les raccourcis de Tily qu’on y tape.

WinUI 3 ne sait pas rendre une WebView2 transparente (documentation Microsoft) : rien de l’interface ne peut se dessiner par-dessus la page. Tant qu’un menu, la palette, un dialogue ou une infobulle de Tily recouvre un pane navigateur, la page est donc masquée et remplacée par sa capture (environ 75 ms), puis réaffichée à la fermeture.

### Structure conceptuelle des données

| Objet | Champs conceptuels |
| --- | --- |
| Session | Version, liste ordonnée des workspaces, workspace actif, état du panneau. |
| Workspace | Identifiant, nom, onglets ordonnés, onglet actif, état déplié. |
| Onglet | Identifiant, nom affiché, nom manuel ou automatique, arbre de splits, pane actif. |
| Nœud split | Orientation, proportion, deux enfants ; ou référence à un pane pour une feuille. |
| Pane | Identifiant, profil de shell, dossier courant, référence à l’historique, état de session ; pour un navigateur, adresse et largeur. |
| Activité | Identifiant, pane concerné, état, source, date de changement ; données de session vivante. |

Mesures de référence : ConPTY livre 7 à 12 Mo/s en flux soutenu ; `PostWebMessage` transmet 20 Mo sur deux panes simultanés sans perte, avec un rendu xterm.js cumulé de 18 Mc/s, et reste le canal utilisé. Le dossier courant est reçu environ 100 ms après le prompt. Versions minimales : Windows 10 1809 (build 17763) pour ConPTY, Windows App SDK et WebView2 Evergreen. Critères de performance à respecter par l’application : aucune perte ni doublon de frappe, débit de rendu au moins égal au débit ConPTY, dossier courant reçu en moins d’une seconde, aucun processus survivant après fermeture d’un pane.

## 15. Qualité et accessibilité

Ces exigences préservent les interactions décrites dans les sections précédentes.

- Ne pas perdre une saisie lorsqu’on replie le panneau, déplie un workspace, renomme un autre élément ou redimensionne une zone.
- Maintenir une distinction entre sélection de texte dans un terminal, raccourcis de l’application et saisie dans les champs inline.
- Supporter la composition de texte ; Entrée pendant une composition ne doit pas valider prématurément un renommage.
- Exposer noms accessibles, états dépliés, sélection et relation entre menus et boutons.
- Conserver un focus visible et un ordre clavier cohérent ; éviter les pièges de focus.
- Limiter les rendus et écritures pendant les flux de sortie importants, dans les critères de performance de la section 14.
- Afficher les noms, chemins et sorties comme des données ; ne pas les interpréter comme du code HTML.
- Valider les données importées avant de modifier la session courante.
- Traiter les chemins comme des arguments structurés lors des appels aux outils locaux, y compris avec espaces et caractères spéciaux.

Un nom, un chemin ou un message coupé par manque de place (points de suspension) montre son texte complet en infobulle au survol, y compris dans la barre de statut.
