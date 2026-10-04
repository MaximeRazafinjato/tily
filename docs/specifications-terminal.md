# Tily — Spécifications complètes

Version 2.0 · 18 septembre 2026 · Application Windows · Aucune priorité définie

Document de référence pour l’implémentation. Cette version remplace les spécifications initiales et consolide les décisions prises pendant le cadrage et le développement de l’application.

**Retenu (30 septembre 2026).** L’application s’appelle Tily, de *mitily*, « guetter » en malgache ; elle s’appelait Dock jusque-là.

## 1. Statut des exigences

- **Retenu** : besoin explicitement demandé ou direction visuelle sélectionnée par l’utilisateur.
- **Convention proposée** : détail nécessaire à l’implémentation, proposé ici lorsque la conversation ne le tranche pas. Il ne constitue pas une validation supplémentaire de l’utilisateur.
- **À décider** : information manquante ou choix technique qui doit être établi avant l’implémentation concernée.

## 2. Objectif et périmètre

**Retenu.** Créer un véritable terminal Windows, organisé en workspaces libres, avec une interface légère permettant de naviguer rapidement entre plusieurs activités. L’utilisateur garde la liberté d’exécuter ses commandes, scripts et outils interactifs habituels.

Le panneau de gauche présente les workspaces et leurs onglets. Les états d’agents fournissent des indications d’attention dans cette organisation.

**Retenu (30 septembre 2026, issue #118).** Le panneau de gauche bascule entre cette arborescence et une vue Agents, qui suit les agents de tous les workspaces, permet de leur répondre, d’en lancer un sur une tâche et de reprendre une session terminée (section 12, « Vue Agents »). La règle précédente, qui excluait toute interface dédiée aux agents et toute distribution de tâches, est levée.

**Retenu (4 octobre 2026, issue #141).** Claude Code, lancé par l’utilisateur dans un pane, peut lire et organiser Tily par un serveur MCP (section 12, « Pilotage par Claude Code (MCP) »). Une action qu’il demande ainsi vaut action explicite de l’utilisateur : l’exclusion de la création ou de la fermeture automatique de workspaces ne s’applique pas à ce cas.

### Hors périmètre actuel

- Couche « Projet » obligatoire au-dessus des workspaces.
- Maintien des agents ou serveurs en arrière-plan après fermeture de l’application ; reprise des processus après réouverture.
- Conversation complète d’un agent (transcript rendu) et orchestration entre agents (file de tâches, dépendances entre tâches) : la vue Agents s’en tient au résumé de chaque agent et au lancement d’un agent à la fois.
- Création ou fermeture automatique de workspaces liée au cycle de vie des worktrees : seules les actions explicites de l’utilisateur en ouvrent ou en ferment (voir la gestion des worktrees en section 11). Une action demandée par le serveur MCP de Tily par un agent que l’utilisateur a lancé vaut action explicite (section 12, « Pilotage par Claude Code (MCP) »).
- Modèles de workspace et mode focus dédié.
- Recherche globale dans le contenu des fichiers du projet.
- Recherche dans la sortie des terminaux : ce besoin a été retiré du périmètre.
- Catalogue permanent de thèmes : la direction retenue est Tily vert avec panneau en arborescence.

## 3. Modèle fonctionnel

Hiérarchie : **Workspace → Onglet → Pane de terminal**.

| Entité | Définition | Invariants |
| --- | --- | --- |
| Workspace | Groupe nommé d’onglets, sans dossier unique imposé. | Chaque onglet appartient à un workspace. Un workspace par défaut est disponible. |
| Onglet | Activité contenant un ou plusieurs panes, avec sa disposition de splits. | Chaque pane appartient à un onglet. L’onglet conserve un pane actif. |
| Pane | Instance de terminal avec shell, dossier courant, sortie et état de processus. | Le dossier réel est suivi pendant la session. |
| Split | Division d’une zone en deux sous-zones, éventuellement subdivisées. | Orientation et proportions sont conservées. |
| Activité d’agent | Information rattachée à un pane lorsqu’une intégration le permet. | Elle ne devient pas une couche de navigation obligatoire. |

Exemple : « Perso » peut contenir un terminal dans Documents, un autre dans un dépôt Git et un troisième dans un dossier de scripts. Aucun projet commun n’est requis.

**Convention proposée.** Utiliser des identifiants stables indépendants des noms. Deux workspaces ou onglets peuvent porter le même nom sans collision. Renommer un élément ne modifie ni son dossier ni sa branche.

## 4. Direction visuelle et disposition

**Retenu.** Tily vert en thème sombre (décision du 21 septembre 2026, remplaçant l’interface claire initiale) : fonds gris anthracite, accent vert sauge désaturé, terminaux sombres, en-tête compact, panneau gauche en arborescence. Maximiser l’espace disponible pour les terminaux.

| Zone | Contenu attendu |
| --- | --- |
| En-tête compact | Identité de l’application, nom du workspace éditable inline, accès à la palette, bouton de visibilité du panneau. |
| Barre d’onglets | Onglets du workspace actif, bouton « + », actions compactes de split et actions du dossier. |
| Zone de travail | Panes et séparateurs, occupant la hauteur restante. |
| En-tête d’un pane | Shell, dossier courant et action de fermeture ; chemin tronqué si nécessaire et consultable intégralement. |
| Panneau gauche | Workspaces, chevrons de dépliage, onglets enfants, accès aux projets et indications d’attention ; ou, au choix, la vue Agents (section 12). |

**Convention proposée.** Le titre de la fenêtre, visible dans la barre des tâches et Alt + Tab, reprend le workspace et l’onglet actifs : « workspace › onglet - Tily », ou « Tily » sans workspace.

### Règles de présentation

- Pas de bordure ou barre colorée pour signaler un onglet sélectionné, un workspace sélectionné ou un résultat de palette sélectionné. Utiliser un fond discret.
- Pas de contour permanent autour du champ de recherche de la palette. Le focus clavier reste perceptible, notamment par le fond.
- Conserver les lignes fines de l’arborescence : elles représentent la hiérarchie, pas une sélection.
- Éviter titres de section redondants, slogan, texte d’aide permanent, chemin global répété, barre d’état sans utilité immédiate et gros blocs de présentation.
- Préférer les infobulles et noms accessibles pour les boutons compacts.
- Réserver les fenêtres modales aux interactions qui en bénéficient réellement, notamment la palette. Les actions courantes sont directes, inline ou contextuelles.

### Repères visuels

Ces valeurs sont des références de réalisation, pas des contraintes de taille absolues : en-tête d’environ 42 px, fond de l’application #17191b, panneaux #1e2123, fond de terminal #121416, accent #7a9f8b, fond de sélection à peine plus clair que le panneau, interface en Segoe UI et terminal en police monospace. Préserver la lisibilité avec la mise à l’échelle Windows.

**À décider.** Personnalisation de la police terminal, zoom et comportement aux très petites dimensions. La cible principale reste une fenêtre d’application de bureau.

**Convention proposée.** Taille du texte des terminaux : réglage « Taille du texte (px) » de la section « Terminaux » des Paramètres, de 8 à 32 px, 14 par défaut, avec un aperçu. Elle s’applique à l’enregistrement à tous les terminaux ouverts, qui recalculent leurs colonnes et leurs lignes et les transmettent au shell ; elle est conservée dans `appearance.json` et fait partie des préférences exportées. La palette propose aussi « Agrandir le texte des terminaux », « Réduire le texte des terminaux » et « Taille du texte des terminaux par défaut », qui appliquent et enregistrent la nouvelle taille sans ouvrir les Paramètres.

### Explorateur de fichiers

**Retenu.** Un explorateur de fichiers intégré s’affiche dans un panneau à droite de la zone de travail, du côté opposé à l’arborescence des workspaces. Il est fermé par défaut et s’ouvre ou se ferme par un bouton. Son état ouvert ou fermé est mémorisé par onglet. Il affiche le dossier courant du pane actif et le suit : un changement de dossier dans le shell ou un changement de pane met l’explorateur à jour. Un fichier s’ouvre dans l’éditeur configuré ; l’explorateur permet de créer, renommer et supprimer des fichiers et des dossiers.

**Retenu (25 septembre 2026).** Bouton à droite de la barre d’onglets, commande « Afficher / masquer les fichiers » dans la palette, Leader puis E ou Ctrl + Maj + E : ouvre avec le focus dans l’arbre, ou ferme et rend le focus au terminal. Arbre dépliable dont la racine est le dossier du pane actif, dossiers d’abord puis fichiers, triés sans casse ; tout est affiché, `.git` et fichiers cachés compris ; au-delà de 2 000 éléments dans un dossier, le reste est seulement annoncé. Les dossiers affichés sont surveillés en direct, un bouton « Actualiser » relit le tout. Un clic déplie ou replie un dossier ; double-clic ou Entrée ouvre un fichier dans l’éditeur, Entrée déplie ou replie aussi un dossier. Boutons « Nouveau fichier » et « Nouveau dossier » en tête du panneau, menu contextuel (clic droit ou Maj + F10 : ouvrir dans l’éditeur, ouvrir un terminal ici, nouveau fichier, nouveau dossier, renommer, supprimer, copier le chemin), noms saisis en place ; F2 renomme, Suppr place l’élément dans la corbeille de Windows après confirmation. Navigation ↑ / ↓ / ← / → / Début / Fin, Échap rend le focus au terminal. Panneau redimensionnable par glisser ou flèches ; état ouvert par onglet et largeur mémorisés dans la session. La recherche dans le contenu des fichiers reste hors périmètre.

**Retenu (29 septembre 2026, issue #80).** Aperçu des fichiers Markdown et texte : dans l’arbre, un simple clic ou Entrée sur un fichier Markdown (`.md`, `.markdown`) ou texte courant (`.txt`, `.log`, `.json`, `.yml`, `.toml`, `.ini`, `.xml`, `.csv`, `.env`…) ouvre un aperçu en lecture seule dans un tiroir latéral posé sur la zone des terminaux, comme le diff Git ; « Ouvrir dans l’éditeur » reste dans le menu contextuel et dans l’en-tête de l’aperçu, les autres fichiers s’ouvrent toujours dans l’éditeur, par double-clic ou Entrée. Le Markdown est rendu (tableaux, cases à cocher, images locales en chemin relatif, blocs de code colorés), un fichier texte s’affiche en police à chasse fixe, coloré quand son format est connu. L’aperçu se recharge quand le fichier change sur disque. Un lien relatif vers un autre fichier lisible l’ouvre dans l’aperçu, avec son ancre ; un lien web s’ouvre dans le navigateur, un autre fichier dans l’éditeur.

**Convention proposée.** Le bouton « Source » de l’en-tête d’un aperçu Markdown affiche son texte brut, coloré, au lieu du rendu, et un second clic revient au rendu ; le choix tient tant que le même fichier reste ouvert, même quand il est rechargé après une modification.

**Convention proposée.** Aperçu limité aux 2 premiers Mo du fichier, avec un avertissement ; fichier binaire refusé avec un message ; Échap ferme l’aperçu et rend le focus à l’arbre.

**Convention proposée.** Les images courantes (`.png`, `.jpg`, `.gif`, `.webp`, `.svg`, `.bmp`, `.ico`, `.avif`) s’ouvrent aussi dans l’aperçu par un simple clic ou Entrée, ajustées à la place disponible, avec leurs dimensions en pixels à côté du badge « Image » ; un clic sur l’image bascule entre la taille ajustée et la taille réelle, avec défilement ; elles sont servies par l’hôte comme les images d’un Markdown et rechargées quand le fichier change. « Ouvrir dans l’éditeur » reste disponible.

**Retenu (2 octobre 2026, issue #129).** Aperçu HTML : une page `.html` ou `.htm` s’ouvre dans l’aperçu comme un Markdown (simple clic ou Entrée dans l’arbre) et y est rendue telle quelle, scripts compris, puis rechargée quand le fichier change, avec « Source » (code HTML coloré), « Ouvrir dans le navigateur » et « Agrandir ». Quand Claude Code ouvre une page HTML pour relecture (`start "" fichier.html`) depuis un pane de Tily, elle s’ouvre dans l’aperçu de l’onglet de ce pane au lieu du navigateur : aussitôt si cet onglet est celui qu’on regarde, sinon la barre de statut l’annonce et la page s’affiche à l’ouverture de l’onglet, sans changement d’onglet automatique.

**Convention proposée.** La page tourne isolée (iframe d’origine opaque, sans accès à Tily) ; ses liens web s’ouvrent dans le navigateur, ses liens vers un autre fichier dans l’aperçu ou l’éditeur. « Agrandir » étend le tiroir à toute la zone des terminaux pour tout aperçu. Un `start` sur une page est intercepté, seul ou dans une commande composée (`cd dossier && … ; start "" page.html`, chemin relatif résolu après les `cd` qui le précèdent), par un hook `PreToolUse` posé avec les autres hooks (à réinstaller depuis les Paramètres après la mise à jour) ; Claude reçoit un refus qui lui indique que Tily a ouvert la page et, pour une commande composée, qu’il doit en relancer le reste sans ce `start` (issue #140). Dans une commande composée, une page encore absente (produite par la commande elle-même) n’est pas ouverte : le refus demande de lancer le reste, puis le `start` seul. Un `start` seul vers un fichier absent s’exécute tel quel.

**Retenu (2 octobre 2026, issue #128).** Édition des fichiers texte dans l’aperçu : un fichier Markdown, HTML ou texte (`.txt`, `.json`, `.yml`, `.ini`, `.xml`…) se modifie dans l’aperçu par le bouton « Éditer », dans un éditeur CodeMirror (coloration, numéros de ligne, annulation, recherche), sans linting ni autre outil. Ctrl + S ou « Enregistrer » écrit le fichier. Si le fichier change sur le disque pendant des modifications non enregistrées, un bandeau propose « Recharger » (reprendre la version du disque) ou « Écraser » (enregistrer par-dessus). Fermer l’aperçu, ouvrir un autre fichier ou quitter l’édition avec des modifications non enregistrées demande confirmation : « Enregistrer », « Abandonner les modifications » ou « Annuler ».

**Convention proposée.** L’enregistrement garde l’encodage du fichier (UTF-8 avec ou sans BOM, UTF-16, Latin-1) et ses fins de ligne (CRLF si le fichier en contient, sinon LF) ; un caractère impossible à écrire en Latin-1 refuse l’enregistrement avec un message. Un fichier tronqué (plus de 2 Mo), binaire ou une image ne se modifie pas. Sans modification locale, un changement sur le disque recharge l’éditeur sans bandeau. Échap ferme d’abord le panneau de recherche de l’éditeur, puis l’aperçu. La fermeture de Tily ne demande pas de confirmation pour une édition en cours.

**Convention proposée.** Dans l’arbre des fichiers, taper les premières lettres d’un nom sélectionne l’élément visible suivant qui commence ainsi, sans tenir compte de la casse ni des accents, comme dans l’Explorateur Windows ; répéter la même lettre passe d’un élément à l’autre, et la saisie repart de zéro après 0,7 seconde sans frappe.

**Convention proposée.** Le menu contextuel d’un fichier ou d’un dossier propose aussi « Afficher dans l’Explorateur Windows », qui ouvre son dossier parent avec l’élément sélectionné ; celui d’un dossier propose en plus « Ouvrir dans l’éditeur ». « Copier le chemin » (Ctrl + C sur la ligne sélectionnée) et « Copier le chemin relatif » (Ctrl + Maj + C) copient son chemin complet ou son chemin depuis la racine de l’arbre, c’est-à-dire le dossier du pane actif (`docs\TESTING.md`), pratique pour citer un fichier à un agent. « Insérer le chemin dans le terminal » colle son chemin complet dans le terminal actif, comme un glisser de la ligne sur ce terminal ; si un message recouvre ce terminal, rien n’est inséré et la barre de statut le dit.

**Convention proposée.** Le menu d’un fichier propose « Ouvrir un terminal dans son dossier », qui ouvre un nouvel onglet dans le dossier parent du fichier, comme « Ouvrir un terminal ici » pour un dossier.

**Convention proposée.** Un bouton « Tout replier » de l’en-tête de l’arbre des fichiers replie tous les dossiers dépliés sous la racine affichée ; il est grisé quand aucun dossier n’est déplié.

**Convention proposée.** Dans la vue Git, le menu d’un seul fichier modifié (non supprimé) propose « Afficher dans l’arbre des fichiers » : la vue Fichiers s’ouvre, les dossiers parents se déplient et le fichier est sélectionné avec le focus. Un fichier hors du dossier affiché par l’arbre (terminal ouvert dans un sous-dossier du dépôt) est signalé dans la barre de statut. À l’inverse, le menu d’un fichier marqué dans l’arbre des fichiers propose « Voir les modifications », qui ouvre la vue Git sur son diff (Unstaged s’il en a, sinon Staged).

**Convention proposée.** La branche affichée dans l’en-tête d’un terminal est un bouton : un clic ouvre la vue Git sur le dépôt de ce terminal, en ouvrant le panneau de droite au besoin.

**Convention proposée.** « Ouvrir un fichier du projet… » (palette) liste les fichiers du dépôt Git du pane actif, suivis et non suivis, sans les fichiers ignorés ni supprimés, sans les dépôts imbriqués ni les sous-modules, ou, hors dépôt, ceux de son dossier sans `.git`, `.vs`, `node_modules`, `bin` ni `obj`, parcourus pendant 3 secondes au plus ; au plus 20 000 fichiers, avec un avertissement quand la liste est incomplète. Les fichiers modifiés, indexés, non suivis ou en conflit viennent en tête, marqués « modifié » (taper « modifié » les retrouve), puis les dix derniers fichiers choisis dans le sélecteur pour ce dépôt, marqués « récent » (mémoire de la session de Tily, perdue à sa fermeture). On filtre en tapant le nom ou le dossier (même recherche que la palette, 200 résultats affichés), ou en collant un chemin relatif, avec `\` ou `/` ; Entrée ouvre le fichier dans l’éditeur, Alt + Entrée l’ouvre dans l’aperçu (vue Fichiers ouverte au besoin ; un type sans aperçu, comme un fichier de code, y affiche un message qui renvoie vers « Ouvrir dans l’éditeur »), Maj + Entrée l’affiche dans l’arbre des fichiers s’il est sous le dossier du terminal (sinon la barre de statut le dit et le focus revient au terminal), Ctrl + Entrée insère son chemin complet à l’invite du terminal actif (protégé selon le shell, comme un dépôt de fichier), Échap rend le focus au terminal.

**Convention proposée.** F5 actualise l’arbre des fichiers quand le focus y est, et la vue Git quand le focus est dans la vue Git (une touche maintenue ne relance pas l’actualisation en boucle). Dans le message de commit, Ctrl + Entrée lance « Commit » et Ctrl + Maj + Entrée « Commit et push », avec les mêmes garde-fous que les boutons.

**Convention proposée.** Dans un dépôt Git, l’arbre des fichiers montre l’état de chaque fichier comme la vue Git : nom coloré et lettre à droite (M modifié, A ajouté, D supprimé, R renommé, U non suivi, ! en conflit ; libellé en infobulle), l’état du répertoire de travail l’emportant sauf pour un fichier ajouté ou renommé puis modifié, qui garde A ou R. Un dossier qui contient des modifications porte un point de la couleur de sa modification la plus marquante (conflit, puis fichier non suivi ou supprimé, puis ajout ou renommage, puis modification). L’état suit le dépôt en direct, y compris après une commande tapée au terminal. Hors dépôt, rien ne s’affiche.

**Convention proposée.** Au renommage d’un fichier, seul son nom avant la dernière extension est sélectionné, comme dans l’Explorateur Windows : taper un nouveau nom garde l’extension. Un dossier ou un nom qui commence par un point est sélectionné en entier.

### Journal de la barre de statut

**Retenu (29 septembre 2026, issue #87).** Chaque message affiché dans la barre de statut est gardé dans un journal, enregistré sur disque et retrouvé après un redémarrage. Le journal s’ouvre dans un tiroir déplié au-dessus de la barre de statut, par un clic sur la barre, par la palette et par la touche Leader ou un raccourci direct.

**Convention proposée.** Leader puis L, Ctrl + Maj + L, la palette (« Afficher / masquer le journal des messages ») ou un clic sur la barre de statut ouvrent le tiroir avec le focus dans la liste, ou le ferment ; Échap le ferme et rend le focus au terminal. Chaque ligne donne l’heure (précédée du jour s’il ne s’agit pas d’aujourd’hui, date complète en infobulle), le niveau (Info, Avertissement, Erreur) et le texte complet, jamais tronqué. Messages du plus ancien au plus récent, la liste suit le dernier tant qu’on n’a pas remonté. « Copier » place tout le journal dans le presse-papiers, « Effacer » le vide sans confirmation. L’hôte horodate chaque message et garde les 500 derniers, 2 000 caractères au plus chacun, dans `status-log.json` du dossier de données ; un fichier illisible est mis de côté et signalé au démarrage. Le libellé d’une opération Git en cours n’est pas journalisé : seul son résultat l’est.

**Convention proposée.** L’heure du message affiché (heures, minutes, secondes, précédées du jour s’il ne date pas d’aujourd’hui) figure en gris à droite de la barre de statut, la date complète en infobulle, pour qu’un message ancien ne passe pas pour un message récent ; elle est masquée pendant une opération Git ou worktree en cours.

**Convention proposée.** Le tiroir du journal porte une bascule « Avertissements et erreurs » qui n’affiche que ces messages (« 7 sur 213 messages » dans l’en-tête) ; Copier et Effacer portent toujours sur tout le journal. Au lancement, le message « Session restaurée » indique le nombre de workspaces et d’onglets restaurés.

## 5. Workspaces et panneau en arborescence

| ID | Exigence retenue |
| --- | --- |
| WS-01 | Créer plusieurs workspaces et naviguer entre eux sans association obligatoire à un projet. |
| WS-02 | Disposer d’un workspace par défaut ; aucun terminal autonome hors workspace. |
| WS-03 | Renommer le workspace directement dans le titre de l’en-tête, sans popup. |
| WS-04 | Afficher les workspaces à gauche et leurs onglets sous forme d’arborescence. |
| WS-05 | Chaque chevron déplie ou replie les onglets de son workspace, indépendamment des autres. |
| WS-06 | Cliquer sur un onglet de l’arborescence active son workspace et cet onglet. |
| WS-07 | Mémoriser les états déplié/replié, la largeur et la visibilité du panneau. |
| WS-08 | Permettre de masquer entièrement le panneau et de le réafficher via le bouton toujours accessible dans l’en-tête ou la palette. |
| WS-09 | Redimensionner le panneau en faisant glisser son séparateur ; conserver sa largeur après masquage. |

### Notes du workspace

**Retenu (29 septembre 2026, issue #85).** Chaque workspace porte une note en texte brut, partagée par tous ses onglets, affichée et modifiée dans une troisième vue « Notes » du panneau de droite, à côté de « Fichiers » et « Git ». La note est enregistrée avec la session, sans bouton d’enregistrement. Dans le panneau des workspaces, une petite icône suit le nom d’un workspace dont la note n’est pas vide ; son infobulle montre la première ligne de la note.

**Convention proposée.** Leader puis O, Ctrl + Maj + O, la palette (« Afficher / masquer les notes du workspace ») ou l’onglet « Notes » du panneau ouvrent la vue avec le focus dans la note, ou la ferment ; Échap rend le focus au terminal. Un clic sur l’icône de note, ou « Notes du workspace » dans le menu contextuel du workspace, active ce workspace et ouvre la vue. Police mono, au plus 100 000 caractères. Fermer le dernier onglet d’un workspace garde sa note avec l’onglet fermé : le rouvrir recrée le workspace avec sa note (recette R35).

**Convention proposée.** Dans la note, Ctrl + Entrée colle la ligne du curseur, ou la sélection si elle existe (sans ses sauts de ligne finaux), dans le terminal actif du workspace sans l’exécuter, puis donne le focus à ce terminal : Entrée reste à taper. Ctrl + Maj + Entrée colle la ligne du curseur, ou la sélection si elle tient sur une seule ligne (même partielle), et l’exécute aussitôt, pour lancer une commande gardée en note ; une sélection de plusieurs lignes n’est alors pas envoyée et la barre de statut renvoie vers Ctrl + Entrée. Une ligne vide, ou un terminal qui affiche un message à la place de son shell (processus terminé), n’envoie rien et l’explique dans la barre de statut ; une sélection de plusieurs lignes passe par la confirmation du collage multi-ligne (section 8).

### Création et renommage

Le « + » du panneau crée directement un workspace et permet de modifier son nom inline. Le clic sur le titre du workspace actif démarre le renommage. Entrée ou perte de focus enregistre ; Échap annule. Un nom vide ne remplace pas le nom existant.

La commande « Renommer le workspace » dans la palette active le même éditeur inline. Le panneau reflète immédiatement le nouveau nom.

**Convention proposée.** Les workspaces se réordonnent par « Monter » et « Descendre » dans leur menu contextuel ou dans la palette (workspace actif), par Alt + ↑ / ↓ sur un workspace sélectionné au clavier dans le panneau, et par glisser-déposer de sa ligne, devant un autre workspace ou en fin de liste. Les onglets se déplacent de même d’un rang dans leur workspace (menu contextuel de l’onglet dans le panneau, Alt + ↑ / ↓ sur l’onglet sélectionné au clavier dans le panneau, Alt + ← / → sur un onglet de la barre qui a le focus), en plus du glisser-déposer et de Ctrl + Maj + PageUp / PageDown. L’ordre est conservé dans la session.

**Convention proposée.** « Fermer le workspace », dans son menu contextuel ou dans la palette pour le workspace actif (nommé dans l’entrée), ferme tous ses onglets avec une seule confirmation si des programmes tournent ; ses derniers onglets restent restaurables un par un.

**Convention proposée.** Au clavier, dans le panneau des workspaces, ↑ / ↓ / Début / Fin passent d’une ligne visible à l’autre, workspaces et onglets confondus ; → déplie un workspace replié, ← le replie ou, depuis un onglet, remonte à son workspace. Tab parcourt toujours chaque bouton. Taper les premières lettres d’un nom donne le focus à la ligne visible suivante qui commence ainsi, comme dans l’arbre des fichiers. Échap rend le focus au terminal.

**Convention proposée.** Un workspace replié affiche en gris, à droite de son nom, son nombre d’onglets ; le chevron le dit aussi aux lecteurs d’écran (« Afficher les 3 onglets de gd »).

**Décision prise.** Un workspace créé depuis le sélecteur de projets porte automatiquement le nom du dossier choisi. Un workspace créé sans projet reçoit un nom automatique descriptif ; un nom saisi manuellement reste prioritaire et n’est jamais écrasé. Le premier onglet PowerShell reprend le dossier du pane actif ou, au premier lancement, le dossier utilisateur. Un clic sur un workspace rejoint son dernier onglet et son dernier pane actifs. Replier une branche ne change pas la sélection.

**Décision prise.** Fermer le dernier onglet ou le dernier pane d’un workspace ferme ce workspace et arrête ses processus. S’il ne reste aucun workspace, afficher un état vide avec un message accueillant et une action pour en créer un. La suppression explicite d’un workspace demande une confirmation lorsqu’il contient des onglets ou des processus actifs ; la confirmation arrête alors tous ses processus et supprime le workspace.

## 6. Onglets

| ID | Exigence retenue |
| --- | --- |
| TAB-01 | Ouvrir plusieurs onglets dans un workspace. |
| TAB-02 | Clic gauche sur « + » : créer immédiatement un onglet PowerShell, sans formulaire. |
| TAB-03 | Clic droit sur le même « + » : menu contextuel PowerShell / CMD / Git Bash, placé près du bouton. Supprimer le bouton séparé de choix du shell. |
| TAB-04 | Le nouvel onglet reprend le dossier courant du pane actif au moment de l’action. |
| TAB-05 | Double-clic sur le nom d’un onglet : renommage inline. La palette offre aussi cette action. |
| TAB-06 | Entrée ou clic ailleurs valide le nom ; Échap annule ; le nom manuel prime sur les noms automatiques. |
| TAB-06a | Le nom automatique d’un onglet est le nom du dossier courant au moment de sa création ; il reste synchronisé tant qu’aucun nom manuel n’a été saisi. |
| TAB-07 | Réordonner les onglets et les déplacer entre workspaces, notamment par glisser-déposer. |
| TAB-08 | Fermer un onglet et pouvoir rouvrir un onglet fermé accidentellement. |
| TAB-09 | La barre d’onglets et l’arborescence reflètent la même sélection, le même ordre et les mêmes noms. |

**Convention proposée.** « Reprendre le nom du dossier », dans le menu d’un onglet (barre d’onglets ou panneau des workspaces) et dans la palette pour l’onglet actif, annule un nom saisi manuellement : l’onglet reprend le nom du dossier de son terminal actif et le suit de nouveau. L’entrée est grisée, ou absente de la palette, pour un onglet qui porte déjà son nom automatique.

**Convention proposée.** Un double-clic dans l’espace vide de la barre d’onglets (hors onglets et boutons) ouvre un nouvel onglet, comme le bouton « + », à la manière des navigateurs et de Windows Terminal.

### Menu des shells

Le menu accepte ↑ / ↓, Entrée et Échap. Un clic à l’extérieur le ferme. Maj + F10 ou la touche de menu contextuel sur le « + » offre un accès clavier. L’action reste accessible via la palette. Le menu ne remplace pas le clic gauche direct.

### Déplacement

Le déplacement conserve le shell, le dossier, l’historique, les processus actifs et la disposition de l’onglet. Il ne recrée pas les terminaux. Le glisser-déposer est possible depuis la barre supérieure ou les onglets de l’arborescence. Déposer sur un workspace transfère l’onglet ; déposer sur un onglet permet de choisir sa position.

**Convention proposée.** Insérer avant l’onglet cible ; déposer sur le workspace ajoute en fin de liste et active l’onglet déplacé. Proposer un équivalent clavier dans les commandes pour les déplacements essentiels.

### Cas de fermeture

**Décision prise.** La fermeture du dernier onglet supprime le workspace après arrêt de ses processus. Aucun onglet vide de remplacement n’est créé. Si aucun workspace ne subsiste, afficher l’état vide et son action de création.

**Décision prise.** Rouvrir restaure noms, shells, chemins, splits et texte avec de nouveaux processus et un séparateur de restauration. Ne pas réexécuter les anciennes commandes. Conserver les cinq derniers onglets fermés, y compris après redémarrage.

**Convention proposée.** Un clic droit sur un onglet de la barre ouvre son menu : Renommer, Dupliquer l’onglet (même disposition, mêmes dossiers et shells, terminaux neufs, aucune commande rejouée), Déplacer à gauche ou à droite, Déplacer vers « workspace » pour chaque autre workspace (comme dans la palette ; si le workspace d’origine se vide et avait une note, elle est ajoutée à la fin de la note du workspace cible, sous son nom), Copier le chemin (dossier de son pane actif), Fermer l’onglet, Fermer les autres onglets et Fermer les onglets à droite (aussi dans la palette ; même confirmation et même texte conservé que pour les autres onglets). Le menu d’une ligne d’onglet du panneau des workspaces propose les mêmes déplacements vers un autre workspace, la même copie du chemin et les mêmes fermetures, « Fermer les onglets en dessous » y remplaçant « à droite ». Ce dernier ne demande qu’une seule confirmation si des programmes tournent ; les cinq derniers onglets fermés restent restaurables.

**Convention proposée.** Au clavier, dans la barre d’onglets, ← / → passent le focus à l’onglet voisin sans l’afficher, Entrée l’affiche, F2 le renomme et Alt + ← / → le déplacent d’un rang, comme ↑ / ↓, F2 et Alt + ↑ / ↓ dans le panneau des workspaces.

**Convention proposée.** La palette propose une entrée « Rouvrir l’onglet fermé · nom » par onglet encore restaurable, de la plus récente à la plus ancienne, avec le workspace d’origine en indice : on peut rouvrir n’importe lequel des cinq, pas seulement le dernier. L’onglet reprend sa position d’origine dans son workspace, recréé s’il n’existe plus (position exacte quand on rouvre dans l’ordre inverse des fermetures, la plus proche sinon) ; Ctrl + Maj + Z et l’état vide rouvrent toujours le dernier fermé.

## 7. Panes et splits

| ID | Exigence retenue |
| --- | --- |
| PANE-01 | Diviser un pane côte à côte ou haut/bas, rapidement depuis les commandes ou les boutons compacts. |
| PANE-02 | Le nouveau pane reprend le dossier du pane actif. |
| PANE-03 | Redimensionner les sous-zones avec leurs séparateurs. |
| PANE-04 | Naviguer entre panes au clavier et activer un pane en cliquant dedans. |
| PANE-05 | Conserver la disposition et ses proportions entre sessions. |

Les splits peuvent être imbriqués. L’action de fermeture d’un pane retire cette feuille de la disposition et agrandit la zone restante.

**Convention proposée.** Leader puis M, Ctrl + Maj + M, la palette, le menu contextuel du terminal ou un double-clic sur l’en-tête d’un pane l’agrandit temporairement à toute la zone de l’onglet, sans modifier la disposition enregistrée ; les autres terminaux continuent de tourner. Le même geste, le bouton « Réduire » de son en-tête, un split, le passage à un autre pane (Alt + flèche compris, qui réduit puis passe au pane voisin) ou à un autre onglet le réduisent. Un onglet d’un seul pane n’a rien à agrandir.

**Convention proposée.** Un double-clic sur un séparateur rétablit sa taille par défaut : parts égales pour un split, largeur initiale pour le panneau des workspaces, le panneau de droite et les colonnes du graphe Git.

**Convention proposée.** Leader puis = ou « Égaliser les panes de l’onglet » dans la palette (proposée quand l’onglet a plusieurs panes) donne la même place à chaque pane de l’onglet actif : chaque split est réparti selon le nombre de panes alignés de part et d’autre dans sa direction, si bien que trois splits côte à côte successifs donnent trois tiers au lieu de 50 %, 25 % et 25 %. Les bornes de taille d’un séparateur restent appliquées ; aucun raccourci direct.

**Convention proposée.** Leader puis !, « Déplacer le pane actif dans un nouvel onglet » dans la palette ou « Déplacer dans un nouvel onglet » du menu contextuel du terminal sortent un pane de son onglet, comme le `break-pane` de tmux : il devient seul dans un nouvel onglet placé juste après, qui devient actif, avec le même terminal, son processus, son texte et son état d’agent. L’onglet d’origine se referme sur les panes restants. Un pane déjà seul dans son onglet ne bouge pas et la barre de statut l’indique.

**Convention proposée.** À l’inverse, comme le `join-pane` de tmux, « Déplacer le pane actif vers l’onglet · <nom> » dans la palette (une entrée par autre onglet du workspace, puis « · workspace / onglet » pour les onglets des autres workspaces) place le pane, avec son terminal, à droite du pane actif de l’onglet choisi, qui devient actif avec son workspace. Un onglet d’origine vidé ainsi disparaît sans entrer dans les onglets fermés, puisque aucun terminal n’a été arrêté ; le dernier pane d’un workspace ne peut pas le quitter, pour ne jamais faire disparaître un workspace et sa note sans confirmation, et la barre de statut l’explique.

**Conventions proposées.** Le split hérite aussi du shell du pane actif, commence à parts égales et active le nouveau pane. Le pane qui reçoit le focus, y compris par un bouton de son en-tête ou du message qui le recouvre, devient le pane actif : la saisie et les commandes visent toujours le même pane. La fermeture du dernier pane utilise les règles de fermeture d’un onglet. Préserver les saisies, processus et sélections lorsque le panneau latéral est masqué, lorsqu’un groupe est déplié ou lorsqu’une zone est redimensionnée.

**Convention proposée.** Leader puis Maj + flèche, ou « Échanger le pane actif avec son voisin de gauche / droite / du haut / du bas » dans la palette, échange la place du pane actif avec le pane voisin dans cette direction, choisi comme pour la navigation, à la manière du `swap-pane` de tmux : les deux terminaux gardent leur processus et leur texte, les proportions des splits ne changent pas, et le pane actif reste actif à sa nouvelle place. Un pane agrandi est d’abord réduit ; sans voisin dans cette direction, rien ne change.

**Décision prise.** La navigation au clavier est spatiale : chaque direction choisit le pane dont la position visuelle est la plus proche dans cette direction. En l’absence de cible dans la direction demandée, conserver le pane actif.

### Panes navigateur

**Retenu (4 octobre 2026, issue #142).** Un pane peut être un navigateur, pour voir l’application en cours de développement à côté de ses terminaux ; Claude Code en lit lui-même la console, le réseau et des captures (section 12, « Pilotage par Claude Code (MCP) »). On l’ouvre depuis la palette, le menu « + » ou Leader, en split ou en onglet. Son en-tête porte un champ d’adresse, Précédent, Recharger, la largeur mobile ou desktop, l’ouverture des DevTools et un compteur d’erreurs. Le pane est restauré avec la session (adresse et largeur). Les cookies et les sessions des pages, connexion Azure AD comprise, sont gardés dans un profil séparé de celui de l’interface de Tily et conservés d’un lancement à l’autre. **Décidé (4 octobre 2026) :** aucune connexion automatique avec le compte Windows : on se connecte une fois à la main, ce qui laisse choisir un compte de test et reste prévisible.

**Convention proposée.** Leader puis U ouvre un navigateur côte à côte du pane actif ; la palette propose « Navigateur côte à côte », « Navigateur en dessous » et « Navigateur dans un nouvel onglet » ; le clic droit sur « + » ajoute « Navigateur » à la liste des shells. Un navigateur ouvert depuis l’interface affiche une page vide et met le focus dans son champ d’adresse. Une adresse sans schéma s’ouvre en http pour `localhost`, une adresse IP ou un nom sans point, en https sinon ; seuls http, https et file sont acceptés. Entrée navigue, Échap rend le focus à la page. Le pane garde le dossier et le shell du pane d’où il a été ouvert : un split depuis un navigateur ouvre un terminal dans ce dossier. Le nom automatique de l’onglet est le titre de la page, sinon son hôte. La largeur mobile affiche la page dans une colonne de 390 px centrée, avec l’émulation mobile (balise viewport, media queries) ; « Outils de développement » ouvre les DevTools dans une fenêtre à part.

**Convention proposée.** Les raccourcis de Tily tapés dans la page (Ctrl + Espace et la touche Leader suivante, Ctrl + P, Ctrl + Tab, Ctrl + Maj + lettre des raccourcis directs, Alt + flèche, Alt + F4) vont à Tily et jamais à la page ; toute autre touche va à la page. Un clic dans la page rend le pane actif ; un pane navigateur activé au clavier reçoit le focus clavier. Un lien `_blank` ou un `window.open` sans dimensions s’ouvre dans un nouveau pane navigateur côte à côte, dans le même profil ; une fenêtre demandée avec des dimensions (popup de connexion type MSAL) s’ouvre dans une petite fenêtre qui partage la session.

**Convention proposée.** Rien de l’interface ne pouvant se dessiner par-dessus la page (section 15), la page est figée dès qu’un menu, la palette ou un dialogue de Tily est ouvert, ou qu’un élément de l’interface (infobulle, tiroir, notification) recouvre le pane : elle est masquée et remplacée par sa capture, puis réaffichée à la fermeture. Cliquer sur la page figée ferme le menu ouvert comme un clic ailleurs. Un pane navigateur jamais affiché depuis le lancement de Tily n’a pas démarré ; un onglet en arrière-plan garde sa page vivante, qui continue d’être suivie.

**Convention proposée.** Pour chaque page démarrée, Tily garde en continu, y compris quand son onglet n’est pas affiché, les 1 000 derniers messages de console (journaux, avertissements, erreurs, exceptions et rejets de promesse non gérés, messages de sécurité ou d’obsolescence du navigateur) et les 500 dernières requêtes réseau terminées (méthode, adresse, type, statut, durée, échec ; corps des réponses en erreur, 2 000 caractères au plus) ; chaque navigation ouvre un nouveau chargement. Le compteur de l’en-tête additionne les erreurs de console et les requêtes en erreur (statut 400 ou plus, échec réseau, requête bloquée ; une requête annulée n’en est pas une) du chargement courant, même au-delà de ce que gardent les tampons ; il disparaît à zéro, se met à jour au plus quatre fois par seconde et un clic ouvre les DevTools.

## 8. Terminal réel et shells

**Retenu.** L’application finale héberge de vrais terminaux interactifs. Windows PowerShell 5.1 est le shell par défaut afin de charger le profil existant ; CMD, Git Bash et PowerShell 7 sont disponibles en alternative configurée.

- Charger le profil PowerShell habituel avec ses alias, fonctions, modules et prompt.
- Préserver l’utilisation de wtr et rmwt depuis le profil.
- Permettre sélection de texte, copier/coller, défilement et exécution libre des programmes.
- Prendre en charge les interactions des outils utilisés : couleurs, curseur, touches de contrôle, programmes plein écran et redimensionnement.
- Suivre le dossier courant réel après les commandes de navigation, y compris après une fonction du profil qui change le dossier.
- Ne pas remplacer le shell par un interpréteur limité à quelques commandes reconnues par l’interface.

**Convention proposée.** Un clic droit dans un terminal, ou la touche Menu, ouvre un menu contextuel : Copier (si du texte est sélectionné), Copier la sortie de la dernière commande, Coller, Tout sélectionner, Effacer l’historique de défilement, Split côte à côte, Split haut / bas, Agrandir le pane (ou Réduire le pane s’il est agrandi), Déplacer dans un nouvel onglet et Fermer le pane.

**Convention proposée.** « Effacer l’historique de défilement » (menu contextuel du terminal, ou la palette pour le pane actif) supprime les lignes remontées au-dessus de l’écran, y compris le texte restauré au démarrage, et garde l’écran visible tel quel, pour ne pas désaligner le terminal de ConPTY ; le texte enregistré du pane suit à l’enregistrement suivant. Pendant un programme plein écran, la barre de statut demande de le quitter d’abord.

**Convention proposée.** Alt + PgUp et Alt + PgDn (ou « Remonter à la commande précédente » et « Descendre à la commande suivante » dans la palette) font défiler le terminal actif jusqu’à la ligne de commande précédente ou suivante, avec une ligne de contexte au-dessus, comme les repères de commande de VS Code et Windows Terminal ; au-delà de la dernière, le terminal revient en bas, et sans commande plus haut la barre de statut le dit. Les 500 dernières commandes terminées de chaque terminal PowerShell sont repérées ; chaque repère est recalé sur le texte de la commande, que ConPTY peut décaler en redessinant l’écran.

**Convention proposée.** « Copier la sortie de la dernière commande » (menu contextuel du terminal, ou la palette pour le pane actif) copie le texte affiché entre la ligne de la commande et l’invite suivante, sans l’une ni l’autre, pour le coller par exemple dans un agent. Il s’appuie sur le wrapper de prompt de Windows PowerShell et PowerShell 7 (section 15), qui signale chaque invite, le moment où PSReadLine rend la ligne à exécuter (les lignes de continuation `>>` d’une commande sur plusieurs lignes ne font donc pas partie de la sortie), chaque commande terminée et la hauteur de l’invite ; une Entrée sur une ligne vide garde la sortie précédente. La commande lancée par Tily à la création d’un worktree est couverte de la même façon. Si aucune commande n’est terminée, si la sortie n’est plus dans l’historique du terminal ou si elle est vide, la barre de statut le dit. Quand le programme du terminal suit la souris, le clic droit lui revient ; Maj + clic droit ouvre alors le menu.

**Convention proposée.** Déposer des fichiers ou des dossiers depuis l’Explorateur Windows sur un terminal y colle leurs chemins, comme dans Windows Terminal, protégés selon le shell (guillemets simples pour PowerShell et Git Bash, doubles pour CMD) et suivis d’une espace ; le pane devient actif. Glisser une ligne de l’arbre des fichiers de Tily sur un terminal y colle de même le chemin complet du fichier ou du dossier. Ailleurs dans Tily, le dépôt de fichiers ou de liens est refusé et n’ouvre jamais de fenêtre.

**Convention proposée.** Coller un texte de plusieurs lignes (Ctrl + V, Ctrl + Maj + V, Maj + Inser, menu « Coller », ou Ctrl + Entrée depuis les notes) dans un terminal dont le programme n’a pas activé le collage délimité (bracketed paste, cas de Windows PowerShell 5.1, de CMD et de Git Bash sous ConPTY) demande d’abord confirmation : le dialogue « Coller N lignes ? » rappelle que chaque ligne s’exécute dès qu’elle arrive et montre les 8 premières lignes ; Entrée colle, Échap annule sans rien envoyer. Un seul saut de ligne final ne compte pas comme une ligne de plus. Un programme qui a activé le collage délimité (Claude Code, Codex, éditeurs plein écran) reçoit le texte sans confirmation.

**Conventions proposées.** Préserver l’historique et le processus lors des changements de workspace. Si un shell est introuvable ou échoue au démarrage, afficher un état local au pane avec actions de relance ou de choix du shell. Ne pas basculer silencieusement vers un autre shell. Tant qu’un tel message recouvre un pane, il reçoit le focus à la place du terminal chaque fois que le pane devient actif : Entrée déclenche son action par défaut, « Relancer » pour un shell arrêté, « Ignorer » pour un dossier disparu car le shell y tourne encore, et Tab parcourt les autres actions. Quand le message prend le focus alors qu’on tapait dans ce terminal, Entrée et Espace sont ignorés pendant 0,6 seconde : une frappe déjà en cours ne déclenche pas une action que l’on n’a pas eu le temps de lire. Rejoindre volontairement un pane qui affiche déjà un message n’est pas concerné. Le message d’un dossier disparu reste affiché jusqu’à ce choix, y compris à la restauration, où le shell démarre dans le dossier personnel.

**Décision prise.** Le profil contenant `wtr` et `rmwt` est `%USERPROFILE%\\Documents\\WindowsPowerShell\\Microsoft.PowerShell_profile.ps1`. WezTerm utilise actuellement `powershell.exe -NoLogo`. PowerShell 7 est installé mais son profil utilisateur correspondant n’a pas été trouvé dans `Documents\\PowerShell`; il reste une alternative à configurer explicitement. Les chemins de CMD et Git Bash doivent rester configurables. Le dossier courant est obtenu par une intégration shell propre à Tily (variable d’environnement dédiée et séquence OSC émise par le prompt), décrite en section 15 ; aucune variable WezTerm n’est simulée.

**Retenu.** Un lien affiché dans un terminal s’ouvre par Ctrl + clic ; le clic simple reste réservé à la sélection de texte et au placement du curseur, sans jamais ouvrir de lien.

**Convention proposée.** Un chemin de fichier affiché dans un terminal est aussi un lien : absolu (`C:\dépôt\a.cs`, `C:/app/index.js`) ou relatif avec un séparateur (`src/app.ts`, `..\web\App.tsx`), éventuellement suivi d’une ligne et d’une colonne (`:12`, `:12:5`, `(42,17)`) ; un simple nom de fichier n’est lié que s’il porte une ligne. Ctrl + clic l’ouvre dans l’éditeur configuré, à la ligne et à la colonne indiquées pour les éditeurs de la famille VS Code (`code`, `code-insiders`, `codium`, `cursor`, `windsurf`, par `-g`), au début du fichier pour les autres. Un chemin relatif part du dossier du pane, et un chemin `a/…` ou `b/…` de `git diff` absent tel quel est cherché sans ce préfixe ; un fichier absent est signalé dans la barre de statut. Un chemin absolu dont des dossiers contiennent des espaces (`D:\Projets\Projet T\src\a.cs(12,5)`, `C:\Program Files (x86)\…`) est lié en entier ; si ce chemin n’existe pas (phrase prise pour un chemin), la partie qui suit chaque espace est essayée à son tour, depuis le dossier du pane. Quand un des dossiers contient une extension suivie d’une espace (« a.ts and src », mais aussi « Node.js Apps »), le lien s’arrête au premier chemin plausible et les chemins suivants de la ligne restent liés à part ; le Ctrl + clic sur ce premier lien ouvre toutefois le chemin long s’il existe tel quel. Un nom de fichier ou un chemin relatif qui contient des espaces, les parties d’URL, les domaines (`www.exemple.com/…`, `hote.com:8080`) et la suite d’un chemin replié sur la ligne précédente ne sont pas liés ; les lettres accentuées font partie du chemin. L’éditeur reçoit chaque argument entre guillemets, pour qu’un `&` ou un `^` d’un nom de dossier ne soit jamais interprété par cmd.exe.

**Conventions proposées.** Reconnaître les URL présentes dans le texte ainsi que les hyperliens explicites émis par les programmes (séquence OSC 8). Ouvrir le lien dans le navigateur par défaut de Windows, jamais dans la fenêtre de Tily. N’ouvrir que les liens `http` et `https`, et les liens `file:///` vers un fichier local existant de type page HTML, PDF, image ou texte (`.html`, `.htm`, `.pdf`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.svg`, `.webp`, `.txt`, `.md`), ouverts dans leur application par défaut ; un autre schéma, un fichier réseau ou un autre type de fichier (exécutable, script…) n’est jamais ouvert et la barre de statut l’explique. Souligner le lien au survol pour montrer qu’il est actif.

**Retenu (29 septembre 2026).** Dans un pane où Tily détecte Claude Code ou Codex CLI, Maj + Entrée et Ctrl + Entrée insèrent un retour à la ligne dans le prompt au lieu de l’envoyer (Tily transmet Échap + Entrée, que les deux agents interprètent ainsi). Dans les autres panes, ces combinaisons restent transmises telles quelles au shell.

## 9. Palette et clavier

### Palette de commandes

**Retenu.** Ctrl + P ouvre la palette « Commandes & navigation ». Elle recherche les commandes et les éléments de navigation. ↑ / ↓ déplace la sélection ; Entrée exécute le résultat sélectionné ; Échap ferme la palette.

- Sélection visible uniquement par un fond discret, sans barre latérale colorée.
- Le résultat sélectionné reste visible lorsque la liste défile.
- Modifier la requête remet la sélection au premier résultat disponible.
- Une recherche sans résultat affiche un message neutre et Entrée ne déclenche aucune action.
- La sélection à la souris et au clavier conduit à la même action.
- La palette rejoint les workspaces, onglets et panes ; elle déclenche les éditeurs inline plutôt que des formulaires modaux supplémentaires.

**Convention proposée.** Conserver Ctrl + Maj + P comme alias. Prévoir retour du focus à l’élément d’origine à la fermeture ; lorsqu’une commande ouvre un terminal ou un éditeur inline, son nouveau champ reçoit le focus.

**Convention proposée.** Tant qu’une fenêtre est ouverte (palette, sélecteur de projets, paramètres, confirmation), Tab et Maj + Tab parcourent ses seuls éléments, en boucle : le focus ne rejoint jamais un terminal masqué derrière elle.

**Convention proposée.** L’étoile d’une commande (clic ou Ctrl + Entrée) la marque comme favorite et la place en tête de la palette. Seules les commandes en portent une : ni les entrées de navigation, ni « Rejoindre », ni « Rouvrir l’onglet fermé ». Au plus 50 favoris ; au-delà, la palette demande d’en retirer un.

**Convention proposée.** Quand plusieurs onglets d’un même workspace portent le même nom (par défaut celui de leur dossier), leurs entrées de navigation et celles de leurs panes précisent leur position dans la barre d’onglets : « repo (onglet 3) ». De même, deux workspaces homonymes sont distingués par leur position dans le panneau (« gd (workspace 3) ») dans la palette et dans les entrées « Déplacer vers » des menus d’onglet.

### Touche Leader

Le principe d’une touche Leader est retenu. Le raccourci par défaut est **Ctrl + Espace** et son délai d’expiration est de **5 secondes**. Le mapping et le délai sont personnalisables.

**Retenu (21 septembre 2026).** Chaque commande Leader dispose aussi d’un raccourci direct, sans passer par le Leader. Les raccourcis directs utilisent Ctrl + Maj + lettre (jamais Ctrl + lettre seul, réservé au shell) et Alt + flèche pour la navigation (Ctrl + Maj + flèche est utilisé par PSReadLine). Ctrl + Maj + C et Ctrl + Maj + V restent copier et coller ; le split côte à côte direct utilise donc D.

| Séquence Leader | Raccourci direct | Action |
| --- | --- | --- |
| Ctrl + Espace, puis P | Ctrl + P ou Ctrl + Maj + P | Palette |
| Ctrl + Espace, puis T | Ctrl + Maj + T | Nouvel onglet PowerShell |
| Ctrl + Espace, puis V | Ctrl + Maj + D | Split côte à côte |
| Ctrl + Espace, puis H | Ctrl + Maj + H | Split haut/bas |
| Ctrl + Espace, puis F | À définir avec le sélecteur | Sélecteur de projets |
| Ctrl + Espace, puis W | Ctrl + Maj + W | Nouveau workspace |
| Ctrl + Espace, puis X | Ctrl + Maj + X | Fermer le pane actif |
| Ctrl + Espace, puis E | Ctrl + Maj + E | Explorateur de fichiers |
| Ctrl + Espace, puis G | Ctrl + Maj + G | Vue Git |
| Ctrl + Espace, puis flèche | Alt + flèche | Navigation entre panes |

Les séquences Leader sont consommées par l’application uniquement lorsqu’elles correspondent à une commande active. Une commande non reconnue ou expirée rend la saisie au pane actif ; les raccourcis personnalisés peuvent désactiver ou remplacer les valeurs par défaut.

**Convention proposée.** Leader puis un chiffre de 1 à 9 (touches de la rangée du haut, sans Maj en AZERTY) affiche l’onglet correspondant du workspace actif, 9 affichant le dernier, comme les navigateurs et le préfixe de tmux ; un onglet absent est signalé dans la barre de statut.

**Convention proposée.** Leader puis N ouvre la création d’un worktree (section 11), comme le Leader + n de WezTerm ; aucun raccourci direct.

**Convention proposée.** Leader puis U ouvre un navigateur côte à côte du pane actif (section 7, « Panes navigateur ») ; aucun raccourci direct.

**Convention proposée.** Leader puis O, ou Ctrl + Maj + O, ouvre ou ferme la vue Notes du panneau de droite (section 5, « Notes du workspace »).

**Convention proposée.** Leader puis L, ou Ctrl + Maj + L, ouvre ou ferme le journal de la barre de statut (section 4, « Journal de la barre de statut »).

**Convention proposée.** Leader puis I, ou Ctrl + Maj + I, affiche la vue Agents du panneau de gauche, ou revient à la vue Workspaces (section 12, « Vue Agents »).

**Convention proposée.** Ctrl + Tab et Ctrl + Maj + Tab passent à l’onglet suivant ou précédent du workspace actif, en boucle, comme dans Windows Terminal. Ces combinaisons n’envoient au shell que Tab ou Maj + Tab, qui restent disponibles sans Ctrl.

**Convention proposée.** Leader puis B, ou Ctrl + Maj + B, masque ou affiche le panneau des workspaces (WS-08), en rendant le focus au terminal s’il était dans le panneau ; quand il l’affiche, le focus va à l’onglet actif dans le panneau. « Aller au panneau des workspaces », dans la palette, y amène le focus sans le masquer.

**Convention proposée.** Les raccourcis directs fonctionnent aussi quand le focus est hors d’un terminal (panneau des workspaces, graphe Git, explorateur), sauf dans un champ de saisie, un menu ou une boîte de dialogue ; il en va de même pour le Leader, dont la touche suivante n’est jamais interceptée par l’élément qui a le focus. Exception à confirmer : sur un onglet de la barre ou une ligne du panneau des workspaces qui a le focus, Alt + flèche déplace cet élément au lieu de changer de pane.

## 10. Sélecteur de projets

**Retenu.** Chercher rapidement un dossier dans `C:\\Files\\Projects`, puis ouvrir un workspace avec un premier terminal dans ce dossier. Le raccourci WezTerm Leader + F existant sert de référence fonctionnelle.

Ce sélecteur recherche des dossiers, pas du texte dans les fichiers. L’interface doit rester compacte et intégrée. La navigation clavier suit le principe ↑ / ↓ / Entrée / Échap.

**Décision prise.** Le chemin est `C:\\Files\\Projects`. Reprendre la profondeur de premier niveau de WezTerm, exclure `worktrees` de la liste des projets puis l’exposer séparément si nécessaire. Le sélecteur ne recherche que des dossiers et ne détecte pas les workspaces déjà ouverts : chaque sélection peut créer un nouveau workspace. Le nom initial est celui du dossier sélectionné.

**Convention proposée.** Les dossiers de premier niveau de `worktrees` sont listés à part, après les projets, avec la mention « worktree », comme le préfixe `[wt]` du sélecteur WezTerm ; en choisir un ouvre un workspace comme pour un projet. Quand un autre dossier des worktrees est réglé (section 11), c’est lui qui est listé, et il est retiré de la liste des projets s’il se trouve dans le dossier des projets ; il en va de même des dossiers des worktrees mémorisés par projet (section 11).

**Convention proposée.** Maj + Entrée, ou Maj + clic, sur un projet ou un worktree du sélecteur l’ouvre dans un nouvel onglet du workspace actif au lieu d’un nouveau workspace (sans workspace ouvert, il en ouvre un comme Entrée) ; une ligne en bas du sélecteur rappelle les deux gestes. Le sélecteur « Ouvrir un worktree » (palette) accepte le même geste ; un worktree déjà ouvert dans un terminal est rejoint dans les deux cas.

## 11. Actions contextuelles et worktrees

Les actions utilisent le **dossier du pane actif**, jamais un hypothétique dossier unique du workspace.

| Action retenue | Comportement attendu |
| --- | --- |
| Copier le chemin | Copier le chemin courant réel dans le presse-papiers. |
| Ouvrir dans l’éditeur | Ouvrir le dossier dans l’éditeur configuré. |
| Ouvrir dans l’explorateur | Ouvrir le dossier dans l’explorateur Windows. |
| Copier la branche | Résoudre et copier la branche Git du contexte courant lorsque disponible. |
| Terminal supplémentaire | Ouvrir un terminal dans le même dossier, notamment dans le même worktree. |

**Décision prise.** Montrer le chemin ciblé dans le menu ou la zone d’actions. Afficher explicitement « Aucun dépôt Git », « Aucune branche » ou « HEAD détachée » selon le contexte. Désactiver ou masquer les actions Git hors dépôt ; ne jamais afficher une branche fictive.

**Convention proposée.** L’en-tête de chaque pane affiche la branche Git de son dossier, ou « HEAD détachée », à côté du chemin ; rien hors d’un dépôt. Elle est relue après chaque commande, pour suivre un `git switch` ou un `wtr`. Dans un pane de moins de 520 px de large, elle est masquée et reste lisible dans l’infobulle de « Copier la branche ». Quand le chemin est trop long, c’est le dossier parent qui est tronqué et le dernier dossier reste entier (`C:\Users\m…\repo`), et le chemin complet reste en infobulle. Dans un pane de moins de 280 px, les boutons Copier le chemin, Ouvrir dans l’éditeur, Ouvrir dans l’explorateur et Copier la branche sont masqués (ils restent dans la palette) pour que Split et Fermer restent visibles ; sous 420 px, le badge d’un agent n’en garde que l’icône (son état reste en infobulle), et le nom du shell se tronque au besoin. Dans la palette, l’entrée de chaque pane rappelle aussi sa branche, qu’on peut donc taper pour le retrouver.

### Gestion des worktrees

**Retenu (29 septembre 2026).** Tily liste, ouvre, crée et supprime les worktrees Git en natif, avec le comportement de `wtr` et `rmwt` : les étapes Git, les ports de développement aléatoires, `pnpm install` et la base de données répliquée (PostgreSQL sous Docker, SQL Server). La règle précédente, qui interdisait de réimplémenter ces fonctions, est levée. `wtr` et `rmwt` restent utilisables au terminal, avec les mêmes chemins ; l’interface suit aussi leurs effets (contrat ci-dessous). Décisions de l’utilisateur :

| Sujet | Décision |
| --- | --- |
| Points d’entrée | Vue Git, palette, Leader, panneau des workspaces, et une icône d’arbre à côté de « Ouvrir un projet » qui fait choisir le projet source. Sur chaque ligne d’onglet du panneau, un bouton d’arbre affiché au survol, comme la croix, crée un worktree du projet de l’onglet ; hors dépôt Git, il est grisé avec une infobulle. |
| Branche | Nouvelle branche depuis une base, ou branche existante, locale ou distante. |
| Dépôt source (2 octobre 2026) | Un projet n’est pas toujours un dépôt Git (« App Starter Kit » contient le dépôt `app-starter-kit`) : le formulaire cherche les dépôts du projet sur 3 niveaux et choisit le premier trouvé, ou le dépôt par défaut du projet ; une liste des dépôts trouvés et « Parcourir… » permettent d’en changer ; la case « Utiliser ce dépôt par défaut pour ce projet » en fait le nouveau défaut à la création. Depuis la vue Git, un onglet ou un pane, le dépôt de départ reste celui du dossier. « Ouvrir un projet » partage ce dépôt par défaut : un projet avec un seul dépôt s’ouvre directement dedans (sans dépôt : dans son dossier) ; avec plusieurs, une seconde liste propose les dépôts, le défaut en tête, et « Parcourir… » ; Ctrl + Entrée ouvre le dépôt et en fait le défaut du projet. |
| Réglages | Dossier des worktrees (par défaut `worktrees` du dossier des projets) et base par défaut (`develop`), modifiables dans Paramètres. Convention proposée : si le dépôt n’a pas cette branche, localement ni parmi les branches distantes déjà récupérées, et qu’elle ne désigne pas non plus un tag ou un commit, le formulaire propose `main` puis `master` à la place ; la base réglée reste choisissable dans la liste, et le fetch de la création la récupère si elle vient d’être poussée. |
| Ouverture | Nouveau workspace, ouvert dès que le dossier existe ; `pnpm install` tourne visiblement dans son terminal ; la base est répliquée en parallèle ; progression et avertissements dans la barre de statut. |
| Suppression | La confirmation liste les onglets et panes concernés, avec « Fermer ces onglets » (cochée), « Garder la branche » et « Supprimer la base répliquée ». |
| Cycle de vie | Jamais d’ouverture ni de fermeture automatique : seulement proposer. |

**Retenu (2 octobre 2026, issue #130).** Le dossier des worktrees peut être choisi pour chaque projet. Le formulaire de création propose le dossier mémorisé pour le projet, sinon celui des Paramètres ; il reste modifiable (saisie ou sélecteur de dossier), le nom `<projet>-<branche>` restant calculé. La case « Mémoriser pour les prochains worktrees de <projet> » n’apparaît que si le dossier saisi diffère du dossier proposé, et elle est alors cochée ; cochée, la création réussie retient ce dossier pour le projet (choisir le dossier des Paramètres oublie la surcharge). Le dossier est mémorisé pour le projet, comme son dépôt par défaut, et vaut pour tous ses dépôts. Les dossiers mémorisés sont listés dans Paramètres, sous le dossier des worktrees, avec « Retirer », appliqué à l’enregistrement ; les worktrees qu’ils contiennent apparaissent dans les sélecteurs comme ceux du dossier des Paramètres.

**Convention proposée.** Le formulaire affiche le dossier cible calculé par l’hôte (`<dossier des worktrees>\<projet>-<dernier segment de la branche>`) et refuse un dossier existant, un nom de branche invalide, une branche déjà utilisée par un autre worktree. Une nouvelle branche part de `origin/<base>` après un fetch, sans branche suivie (un push la publiera sous son propre nom) ; une branche distante crée une branche locale qui la suit. Les ports reprennent les fichiers et l’expression de `wtr` ; un port sans remplaçant libre est signalé. Un échec Git arrête la création ; les ports, `pnpm install` et la base ne produisent que des avertissements. « Ouvrir » un worktree rejoint un pane qui s’y trouve déjà, sinon ouvre un workspace. La suppression refuse le dépôt principal, vérifie d’abord qu’aucun programme ne verrouille le dossier (le worktree reste alors intact, avec « Réessayer » et, quand Windows les connaît, les processus en cause), puis supprime le dossier, fait un prune, supprime la base répliquée (jamais une base identique à celle du dépôt principal) et la branche, sauf si elle est gardée ou si HEAD est détachée.

**Contrat de synchronisation.** Après `wtr`, le pane qui exécute la commande devient la source de vérité pour le dossier courant et le contexte Git ; l’interface relit ces valeurs et met à jour le workspace ou l’onglet déjà associé sans créer de doublon automatiquement. Après `rmwt`, elle relit le dossier et Git, marque comme indisponibles les panes dont le chemin n’existe plus et propose de les fermer ou de choisir un dossier de repli. L’interface ne rejoue pas les effets d’un `wtr`/`rmwt` tapé au terminal et ne supprime pas un workspace sans action explicite de l’utilisateur.

### Gestion visuelle de Git

**Retenu.** Une vue Git permet de piloter le dépôt du pane actif sans taper de commande. Elle s’affiche dans le panneau de droite, qui bascule entre Fichiers et Git : même bouton d’ouverture, même état par onglet et même largeur que l’explorateur, les terminaux restant visibles. Elle présente la liste des branches locales et distantes avec leur avance et leur retard, et le graphe de l’historique avec les étiquettes de branches et de tags ; un clic sur un commit montre ses fichiers et son diff. Stage et unstage se font fichier par fichier, avec un diff coloré en lecture seule dans Tily, un message de commit, « Amend du dernier commit » et « Commit et push ». Fonctions incluses : commit, push, pull, fetch, merge, création, checkout, renommage et suppression de branches, stash, tags, rebase non interactif, cherry-pick et reset vers un commit. Un bouton « Annuler » défait la dernière opération faite depuis Tily tant qu’aucun push ne l’a publiée. En cas de conflit, la vue liste les fichiers concernés, les ouvre dans l’éditeur configuré, permet de les marquer résolus puis de terminer ou d’annuler l’opération. Le push forcé n’est proposé qu’après un push refusé, toujours avec `--force-with-lease` et après confirmation.

**Retenu (25 septembre 2026).** Le panneau de droite porte deux onglets, « Fichiers » et « Git » ; le bouton de la barre d’onglets l’ouvre ou le ferme sur sa dernière vue, mémorisée par onglet avec son ouverture. Commande « Afficher / masquer Git » dans la palette, Leader puis G ou Ctrl + Maj + G : ouvre la vue Git, y bascule depuis les fichiers, ou ferme et rend le focus au terminal. La vue suit le dépôt ou le worktree du dossier du pane actif et affiche « Aucun dépôt Git » hors dépôt ; elle se met à jour en direct, y compris après une commande tapée au terminal ou lancée par un agent. Ouvrir la vue Git affiche, à la place des terminaux de l’onglet et sous la barre d’onglets, un graphe qui regroupe l’historique et les branches, avec le focus. Colonnes « Branche / Tag », « Graphe », « Message », « Auteur » et « Date » : leur largeur se règle à la souris ou au clavier, « Auteur » et « Date » se masquent par un clic droit sur l’en-tête, et ces réglages sont mémorisés dans la session. Les étiquettes des branches et des tags sont reliées à leur commit ; une branche locale et sa branche distante sont réunies dans une seule étiquette quand elles pointent sur le même commit, la branche courante porte une coche. Les nœuds portent les initiales de l’auteur (aucune photo, aucun accès réseau), les merges une simple pastille. Une ligne « // WIP » en tête, reliée en pointillés au commit HEAD, annonce les fichiers ajoutés, modifiés, supprimés ou en conflit et l’opération en cours ; chaque stash apparaît en nœud pointillé rattaché à son commit de départ. Le graphe montre toutes les branches par défaut, une bascule « Courante » le limite à la branche courante et à son amont, et les commits se chargent par pages de 200 au défilement. À gauche du graphe, une colonne repliable et redimensionnable liste les branches locales avec leur avance et leur retard, les branches distantes par dépôt distant, les tags et les stash : un clic amène au commit dans le graphe, un double-clic fait le checkout de la branche. Ctrl + clic, Maj + clic, Maj + flèches et Ctrl + A y sélectionnent plusieurs branches, branches distantes, tags ou stash, même de sections différentes : le clic droit propose alors de les supprimer après une seule confirmation, qui signale les branches sans merge et les branches distantes, ou de copier leurs noms, et Suppr supprime la sélection ; « Annuler » restaure ensuite les branches, tags et stash locaux. Glisser une branche sur la branche courante, ou la branche courante sur une autre branche, propose un merge ou un rebase. Menus contextuels : commit (checkout, créer une branche ou un tag, cherry-pick, merge, rebase, reset soft, mixed ou hard), branche (checkout, merge, rebase, aller au commit, renommer, supprimer, supprimer la branche distante), tag (push, supprimer), stash (appliquer, appliquer et supprimer, supprimer), ligne WIP (stage de tout, stash, créer une branche) et fichiers modifiés du panneau Git, sélectionnables à plusieurs par Ctrl + clic, Maj + clic ou Ctrl + A (ouvrir dans l’éditeur, stage, unstage, marquer résolu, stash des seuls fichiers choisis, abandonner, ajouter au `.gitignore`, copier les chemins ; Espace et Suppr agissent sur toute la sélection). Échap ou la croix ferme le graphe et rend les terminaux sans fermer le panneau ; le bouton « Graphe » du panneau le rouvre. Le panneau Git montre le détail de la ligne choisie, sans onglets internes : pour la ligne WIP, les conflits, les fichiers Unstaged puis, en dessous, les fichiers Staged, avec leurs actions, le message de commit, « Amend du dernier commit », « Commit » et « Commit et push » ; pour un commit, son message, son auteur, sa date et ses fichiers ; pour un stash, les mêmes informations et ses actions. En tête du panneau : dépôt, branche (un clic la copie) ou HEAD détachée, avance et retard sur la branche distante suivie, bouton « Graphe », puis Fetch, Pull, Push (qui publie une branche sans amont), Annuler et Actualiser. Le diff d’un fichier s’affiche dans un volet large par-dessus le graphe ou les terminaux : il suit le fichier choisi, se recharge quand le fichier change et se ferme par Échap ou la croix. Les branches distantes se suppriment depuis la vue après confirmation ; le reset hard, la suppression d’une branche sans merge, l’abandon de modifications, la suppression d’un stash, l’abandon d’une opération en cours et le push forcé demandent aussi une confirmation. « Annuler » couvre commit, amend, merge, pull, rebase, cherry-pick, reset (les modifications locales effacées par un reset hard sont restaurées), checkout, création, suppression et renommage de branche, tags, stash, suppression d’un stash et abandon de modifications ; il est refusé, raison en infobulle, si le dépôt a changé depuis ou si un push a publié les commits, ne couvre ni ce qui a été publié ni l’application d’un stash, et n’est pas conservé à la fermeture de Tily. Un conflit ramène le panneau sur la ligne WIP avec une bannière « Terminer » / « Abandonner » ; « Marquer résolu » demande confirmation si le fichier contient encore des marqueurs de conflit. Après un push refusé, une bannière propose « Pull » ou « Forcer le push… » avec `--force-with-lease`, refusé si la branche distante a changé depuis le dernier fetch. L’hôte exécute le `git` installé avec des arguments séparés, sans composer de ligne de commande, et respecte la configuration, les hooks et le gestionnaire d’identifiants de l’utilisateur ; la sortie d’une commande refusée, hooks compris, s’affiche dans la vue. La gestion des worktrees reste celle de `wtr`/`rmwt` ; les pull requests, le rebase interactif et l’éditeur de conflits intégré sont hors périmètre ; le stage d’une partie de fichier, d’abord exclu, est retenu depuis l’issue #88 (ci-dessous).

**Retenu (25 septembre 2026).** Les libellés et les messages de la vue Git gardent les termes Git anglais, invariables : Push, Pull, Fetch, Stash, Stage et Unstage (fichiers Staged et Unstaged), Merge, Rebase, Amend, Checkout et Cherry-pick. Les phrases restent en français et emploient ces termes comme des noms, par exemple « Push vers origin/main terminé. », « 3 commits à push » ou « Faites un pull pour les intégrer ».

**Retenu (29 septembre 2026, issue #100).** Ouvrir la vue Git lance un fetch de toutes les branches distantes (`git fetch --all`), y compris au démarrage de Tily si elle était ouverte, puis chaque fois que le pane actif passe à un autre dépôt, au plus une fois toutes les 5 minutes par dépôt (un fetch manuel compte). Ce fetch est discret : la barre de progression s’affiche, mais ni message de réussite ni erreur (hors ligne, authentification) ; un dépôt sans dépôt distant est ignoré. Il se désactive dans les Paramètres (« Fetch automatique à l’ouverture de la vue Git », activé par défaut).

**Convention proposée.** L’en-tête du volet de diff porte un bouton « Copier le diff », qui place dans le presse-papiers le diff du fichier tel que Git le produit (en-tête `diff --git` avec renommage, création ou suppression, `--- a/…`, `+++ b/…`, chunks `@@`, fins de ligne CR conservées), applicable par `git apply` ou à coller dans un agent, pour un fichier Unstaged, Staged, d’un commit ou d’un stash ; il est grisé pour un fichier binaire, pour un diff tronqué à l’affichage, dont la copie donnerait un patch incomplet, et pour un fichier qui n’est pas en UTF-8, dont les caractères accentués seraient perdus.

**Convention proposée.** Dans un diff Unstaged ou Staged, Ctrl + clic sur le texte d’une ligne ouvre le fichier dans l’éditeur à cette ligne (numérotation de la nouvelle version ; sans effet sur une ligne supprimée ; dans un diff Staged d’un fichier qui a aussi des modifications Unstaged, le fichier s’ouvre sans ligne, la numérotation de l’index ne correspondant plus) ; Ctrl + clic dans la gouttière reste réservé à la sélection de lignes.

**Convention proposée.** Le menu d’un commit propose aussi « Revert sur « branche courante » », qui crée un commit défaisant ses modifications (`git revert --no-edit`, par rapport au premier parent pour un merge), y compris pour le commit HEAD ; un conflit suit le parcours des autres opérations (bannière « Terminer » / « Abandonner »), et « Annuler » retire le commit de revert tant qu’il n’est pas publié.

**Retenu (29 septembre 2026, issue #88).** Le diff d’un fichier Unstaged ou Staged, fichier non suivi compris, permet de choisir des chunks entiers ou des lignes précises. Chaque chunk porte ses actions, comme les lignes choisies : Stage et Abandonner dans un diff Unstaged, Unstage dans un diff Staged. L’abandon demande une confirmation et « Annuler » le défait, comme l’abandon d’un fichier. Le stage d’une partie d’un fichier non suivi l’ajoute à l’index avec les seules lignes choisies, le reste restant Unstaged. Au clavier, ↑ / ↓ déplacent le choix de ligne modifiée en ligne modifiée, Espace fait le stage ou l’unstage du choix et Suppr l’abandonne.

**Convention proposée.** La sélection se fait dans la gouttière des numéros de ligne, pour laisser le texte du diff sélectionnable et copiable : clic, Maj + clic pour une plage, Ctrl + clic pour ajouter ou retirer une ligne, glisser pour une plage ; un clic sur l’en-tête d’un chunk le choisit en entier. Maj + ↑ / ↓ étend le choix, Ctrl + ↑ / ↓ choisit le chunk précédent ou suivant, Ctrl + A toutes les lignes modifiées, Échap efface le choix puis, au second appui, ferme le volet. Tout à gauche, un petit bouton encadré « + » vert (Stage) ou « − » rouge (Unstage), distinct des signes + et − du diff, apparaît au survol d’une ligne modifiée et sur la ligne courante : il agit sur cette ligne, ou sur toutes les lignes choisies si elle en fait partie ; le même bouton, toujours visible, est en tête de chaque chunk, suivi de son bouton Abandonner ; une barre flottante en bas du diff annonce le nombre de lignes choisies avec leurs actions. Aucune sélection sur un fichier renommé, binaire, trop volumineux ou dans le diff d’un commit. L’hôte relit le diff et refuse la sélection s’il a changé depuis son affichage, reconstruit un patch partiel puis l’applique avec  ; une sélection que Git ne sait pas appliquer seule (par exemple autour d’une fin de fichier sans retour à la ligne) est refusée avec un message qui invite à y ajouter les lignes voisines ou le chunk entier.

**Convention proposée.** Quand le dossier du pane actif n’appartient à aucun dépôt, la vue Git le dit et propose « Initialiser un dépôt Git ici » (`git init` dans ce dossier) ; la vue affiche aussitôt le nouveau dépôt et la barre de statut confirme « Dépôt Git initialisé dans … (branche …) ».

**Convention proposée.** « Rechercher un commit dans le graphe… » (palette, quand la vue Git est affichée et son historique chargé, ou bouton loupe de la barre du graphe) cherche dans les commits déjà chargés par le graphe (200 au départ, davantage en défilant) par message, SHA, auteur, adresse ou nom de branche ou de tag ; Entrée ouvre la vue Git sur le graphe, sélectionne le commit, le centre et affiche son détail.

**Convention proposée.** Quand la place manque dans le graphe, Date puis Auteur sont masqués à l’affichage pour laisser au moins 200 px au message, sans changer le réglage mémorisé ; ils réapparaissent dès que la place revient. De même, s’il reste moins de 400 px au graphe, la colonne des branches, tags et stash est repliée à l’affichage ; son bouton dans la barre du graphe l’affiche quand même, et elle revient d’elle-même quand la place revient.

## 12. Attention, agents et notifications

**Retenu.** Les workspaces restent les éléments principaux. Les activités de **Claude Code** (`claude`) et du **Codex CLI** (`codex`) s’y rattachent pour aider à trouver où une intervention est nécessaire.

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

**Convention proposée.** Fin d’une commande longue dans Windows PowerShell ou PowerShell 7 : le wrapper de prompt de Tily (section 15) annonce à chaque nouvelle entrée de l’historique sa durée et son succès (`$?`) par une séquence OSC privée (6973), jamais affichée. Si la commande a duré au moins 10 secondes et que son onglet n’est pas celui affiché, l’onglet porte, dans la barre d’onglets et le panneau des workspaces, une coche (réussite) ou une croix rouge (échec) avec la durée en infobulle, sauf si un état d’agent occupe déjà cette place ; la même indication (échec d’abord) figure sur la ligne d’un workspace replié du panneau et sur son nom dans l’en-tête quand le panneau est masqué ; la barre de statut l’annonce en citant la première ligne de la commande, tronquée à 48 caractères (« « pnpm test » en échec après 1 min 05 s dans l’onglet « web ». »). Afficher l’onglet efface l’indication. Si Tily n’est pas la fenêtre active, la fin d’une telle commande, même dans l’onglet affiché, fait aussi clignoter Tily dans la barre des tâches quand le réglage « Faire clignoter Tily dans la barre des tâches » des notifications est coché. Aucune notification Windows, aucun son, aucun changement de focus. CMD et Git Bash n’ont pas ce wrapper et ne sont pas concernés.

**Conventions proposées.** Agréger le nombre d’attentes par workspace, éviter les notifications répétées pour le même événement et offrir l’accès au pane sans prise de focus forcée. Si plusieurs panes attendent, permettre de choisir la destination.

**Convention proposée.** Dans la palette, chaque entrée « Rejoindre » indique depuis combien de temps l’agent attend (« depuis 3 min »), mesuré depuis que Tily a reçu cet état, et les entrées vont de l’attente la plus ancienne à la plus récente. Les cartes d’attention affichent la même durée, mise à jour toutes les 30 secondes, et suivent le même ordre.

**Convention proposée.** Leader puis A, Ctrl + Maj + A ou « Rejoindre l’agent en attente suivant » dans la palette rejoint le pane en attente qui suit le pane actif dans l’ordre de la palette, de l’attente la plus ancienne à la plus récente (ordre du panneau à égalité), tous workspaces confondus et en boucle ; répété, il passe d’une attente à l’autre. Sans agent en attente, la barre de statut l’indique.

**Retenu (4 octobre 2026, issue #146).** Avec plusieurs fenêtres de Tily (section 13, « Plusieurs fenêtres »), la palette, les cartes d’attention et Leader puis A ne concernent que les agents de leur fenêtre ; une fenêtre qui n’est pas active signale les siens par ses notifications Windows et le clignotement de la barre des tâches. L’état d’un agent et une demande d’aperçu n’arrivent qu’à la fenêtre qui possède le pane.

**Décision de périmètre.** L’architecture permet des adaptateurs Claude Code et Codex CLI. Claude Code est suivi par ses hooks, que Tily installe depuis les Paramètres ; Codex CLI n’est reconnu que par son processus, et sa détection fiable est reportée à une évolution dédiée. Tant qu’un adaptateur ne peut pas établir un état, afficher « État inconnu » plutôt que d’inférer une activité depuis le seul processus.

### Vue Agents

**Retenu (30 septembre 2026, issue #118).** Le panneau de gauche porte deux vues : « Workspaces », l’arborescence des sections 4 et 5, et « Agents », un tableau de bord des agents de tous les workspaces, trié par urgence, où l’agent du pane actif est mis en avant. Pour chaque agent, la vue donne un résumé : le dernier message en entier, la question ou la permission en attente et l’action en cours, sans fil d’événements ni conversation complète. Elle permet aussi de répondre à un agent, d’en lancer un sur une tâche et de reprendre une session terminée. Seul Claude Code fournit ces informations ; Codex CLI garde « État inconnu » jusqu’à une évolution dédiée. Décisions de l’utilisateur :

| Sujet | Décision |
| --- | --- |
| Répondre | Une permission propose « Autoriser », « Refuser… », avec une raison facultative transmise à Claude, qui continue son tour, et, quand Claude Code propose une règle, « Toujours », la règle étant affichée sur le bouton. Une question à choix unique se répond par ses options ; un message de suivi s’envoie depuis la carte de l’agent. |
| Lancer | Depuis le dossier du pane actif, un projet, un nouveau worktree ou un worktree existant, avec une tâche et un mode de départ (Défaut, Plan, Modifications acceptées) mémorisé ; le modèle reste celui des réglages de Claude Code. Dans un nouveau worktree, Claude démarre dans le même terminal, après `pnpm install`. |
| Orchestration | Un agent par lancement, sans file de tâches ni dépendances entre tâches. |
| Historique | Les 50 dernières sessions Claude vues dans les terminaux de Tily, tous projets confondus, avec « Reprendre ». |
| Redémarrage | Chaque pane restauré qui avait une session Claude la propose en « Reprendre », sans jamais la relancer seul. |
| Cartes d’attention | Masquées tant que la vue Agents est affichée, puisqu’elle les remplace. |

**Convention proposée.** Deux onglets, « Workspaces » et « Agents », remplacent le titre du panneau de gauche ; « Agents » porte le nombre d’agents en attente, et les boutons de l’en-tête changent avec la vue (projets, worktree et nouveau workspace ; « Nouvel agent »). La vue choisie est mémorisée dans la session avec la largeur et la visibilité du panneau, largeur partagée par les deux vues. Leader puis I, Ctrl + Maj + I ou « Afficher les agents » dans la palette affiche le panneau sur la vue Agents avec le focus, ou revient à la vue Workspaces quand la vue Agents est déjà affichée ; Leader puis B masque ou affiche toujours le panneau sur sa vue courante. Les gestes qui visent l’arborescence (« Aller au panneau des workspaces », glisser un onglet vers le panneau) affichent d’abord la vue Workspaces.

**Convention proposée.** Les agents sont groupés par état : En attente (l’attente la plus ancienne d’abord, comme dans la palette), En erreur, En cours, Terminé, puis État inconnu ; un groupe vide n’apparaît pas. Chaque carte donne l’icône d’état, `workspace › onglet` (dossier et branche en infobulle), la durée dans l’état, le titre de la session (celui de `/rename`, sinon celui que génère Claude Code, sinon le premier prompt) et une ligne de résumé. Un clic déplie la carte ; Entrée ou « Rejoindre » rejoint le pane sans quitter la vue. Une carte dépliée ajoute l’action en cours (outil et cible), le dernier message en entier rendu en Markdown, les fichiers modifiés par l’agent avec leurs lignes ajoutées et supprimées (un clic rejoint le pane et ouvre le diff dans la vue Git), le contexte consommé (jetons de la dernière réponse, en pourcentage quand la fenêtre du modèle est connue) et la pull request liée. La carte de l’agent du pane actif est dépliée d’office ; ↑ / ↓ passent d’une carte à l’autre, Échap rend le focus au terminal. Sans agent, la vue invite à en lancer un.

**Convention proposée.** L’hôte lit le transcript de chaque session suivie, dont les hooks lui donnent le chemin, par la fin, puis suit ses ajouts sans le relire en entier ; ce format est interne à Claude Code, et une information absente est simplement omise. L’état donné par les hooks est recoupé avec le registre des sessions de Claude Code (`~/.claude/sessions`) : un Échap ne déclenche aucun hook, et seul ce registre voit alors l’agent redevenir inactif.

**Convention proposée.** Pour répondre, le hook PermissionRequest attend la réponse de la vue : le dialogue reste utilisable dans le terminal, et la première réponse l’emporte. Une question passe par le même hook, avec ses réponses dans `updatedInput`, s’il se déclenche pour elle ; sinon Tily tape les touches du dialogue. Le message de suivi est collé dans le champ de Claude, puis envoyé ; pendant que l’agent travaille, Claude Code le met en file. Avant tout envoi, l’hôte vérifie que l’agent attend toujours la même chose ; sinon, rien n’est envoyé et la barre de statut l’explique. Si une saisie est déjà commencée dans le champ de Claude, le message s’y ajoute.

**Convention proposée.** « Nouvel agent », dans l’en-tête de la vue, ou « Lancer un agent… », dans la palette, ouvre un formulaire de la même famille que « Créer un worktree », qui propose de son côté « Lancer Claude Code avec une tâche ». Tily ouvre un nouvel onglet, un nouveau workspace ou un split (dernier choix mémorisé), y lance `claude --session-id <uuid>` pour connaître la session d’avance, puis colle la tâche dès que Claude Code active le collage délimité : la tâche garde ses sauts de ligne et échappe aux guillemets de Windows PowerShell 5.1.

**Convention proposée.** L’historique, `agent-history.json` dans le dossier de données, garde pour chaque session son identifiant, son dossier, `workspace › onglet`, son titre, son début et sa fin, son dernier message, ses fichiers modifiés et son état final. Sa section, repliable, suit les agents vivants ; « Reprendre » ouvre un nouvel onglet dans le dossier de la session et y lance `claude --resume <id>`. Le bouton est grisé, avec la raison en infobulle, si le dossier n’existe plus, si Claude Code a effacé le transcript (30 jours par défaut) ou si la session tourne déjà. Après un redémarrage, un groupe « À reprendre » réunit les panes restaurés qui avaient une session Claude, avec « Reprendre ici », et l’en-tête de ces panes porte aussi « Reprendre Claude » jusqu’à la première commande tapée ; les anciennes sessions ne sont jamais présentées comme vivantes.

### Pilotage par Claude Code (MCP)

**Retenu (4 octobre 2026, issue #141).** L’utilisateur n’a plus à servir de presse-papier entre ses terminaux et Claude Code : un agent lancé dans un pane lit la sortie de n’importe quel pane, retrouve les commandes en échec, attend qu’un serveur soit prêt et organise lui-même workspaces, onglets, panes et worktrees.

- Transport : un exécutable stdio `tily-mcp.exe`, livré à côté de `Tily.exe` et bâti sur le SDK officiel `ModelContextProtocol` pour C#, est déclaré une seule fois comme serveur MCP `tily` au niveau utilisateur de Claude Code (`~/.claude.json`, édité directement). Il retrouve la fenêtre de Tily du pane par le nom de pipe qu’elle transmet à ses shells, et lui parle par ce named pipe propre à la fenêtre ; rien n’écoute sur le réseau. Un `claude` lancé dans un pane pilote toujours la fenêtre de ce pane, jamais une autre (section 13, « Plusieurs fenêtres »). Lancé hors de Tily (sans `TILY_PANE_ID`), il ne déclare ni outil ni instruction, pour ne rien ajouter au contexte de Claude (décision du 4 octobre 2026) ; un appel qui lui parviendrait quand même reçoit une erreur claire en français.
- Activation : Paramètres, section « Serveur MCP », active ou désactive le serveur au choix de l’utilisateur et affiche « activé » ou « désactivé ». Activer déclare le serveur ; désactiver le retire de la configuration de Claude Code et ferme le canal de l’instance. Les autres réglages et serveurs de ce fichier sont conservés. L’exécutable partage le runtime .NET de Tily : l’installeur n’embarque pas de second runtime.
- Pouvoirs : la lecture et les actions sûres sont libres. Une confirmation dans Tily (Autoriser / Refuser, avec l’agent, l’action et la cible) est demandée pour fermer un pane occupé ou qui n’appartient pas à l’agent, écrire dans un pane qui n’appartient pas à l’agent et supprimer un worktree ; un refus revient à Claude sous forme d’erreur en français. Les onglets et panes créés par un agent lui appartiennent et portent une marque discrète « créé par Claude ».
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
| `tily_browser_open`, `tily_browser_navigate`, `tily_browser_reload`, `tily_browser_resize` | Ouvrir un pane navigateur (côte à côte, en dessous ou en onglet) et y charger une adresse ; naviguer et recharger en attendant la fin du chargement ; largeur mobile ou desktop (issue #142, section 7, « Panes navigateur »). | libre, y compris sur un navigateur ouvert par l’utilisateur |
| `tily_browser_console`, `tily_browser_network` | Console d’un pane navigateur (niveau minimal, depuis le dernier chargement) et requêtes réseau terminées (échecs seulement). | libre |
| `tily_browser_screenshot` | Capture PNG de la page en viewport desktop ou mobile, pleine page sur demande. | libre |

**Convention proposée.** Le nom du pipe d’une fenêtre joint une empreinte SHA-256 du dossier de données et l’identifiant de sa session (`tily-mcp-<24 caractères hexadécimaux>-<32 caractères hexadécimaux>`) ; la fenêtre le transmet à ses shells par la variable `TILY_MCP_PIPE`, et le pipe est réservé au compte Windows courant. Sans cette variable (un `tily-mcp.exe` d’une version antérieure, déclaré par une autre copie de Tily), l’exécutable se rabat sur l’ancien nom, `tily-mcp-<24 caractères hexadécimaux>`, que la première fenêtre ouverte écoute aussi ; toute fenêtre refuse en français l’appel d’un pane qui n’est pas le sien et invite à activer le serveur pour cette copie. Chaque appel ouvre une connexion, envoie une ligne JSON et lit une ligne JSON. L’hôte relaie la demande à l’interface (`mcp.request`), qui répond (`mcp.response`) ; une demande sans réponse expire après 10 secondes (pour `tily_wait_for`, après le délai d’attente demandé plus 5 secondes) sans jamais bloquer le fil de l’interface. L’hôte ajoute à `tily_layout` la branche de chaque dossier. Une déclaration qui pointe vers une autre copie de Tily compte comme « activé » et peut être remplacée par « Activer pour cette copie » ; un serveur `tily` qui n’est pas celui de Tily n’est jamais écrasé. La désinstallation retire la déclaration.

**Convention proposée.** Lecture : `tily_read_pane` rend par défaut les 100 dernières lignes d’un pane (2 000 au plus), lignes repliées recollées, au plus 40 000 caractères (les derniers, la réponse est alors marquée tronquée) ; un programme plein écran rend son écran. Chaque pane garde ses 100 dernières commandes terminées depuis son ouverture, avec le dossier où elles ont été lancées. `tily_commands` rend les 20 plus récentes par défaut (100 au plus), de tous les panes démarrés ou d’un seul, chacune avec ses 20 dernières lignes de sortie, ainsi que les commandes en cours et les panes dont le shell ne signale pas ses commandes. `tily_wait_for` attend 60 secondes par défaut, 300 au plus ; le texte (sans tenir compte de la casse, expression régulière sur demande) est cherché dans la sortie de la commande en cours depuis son lancement, sinon dans ce qui s’affiche après l’invite (PowerShell) ou dans l’écran visible (autres shells), puis dans tout ce qui s’affiche ensuite. L’attente s’arrête aussi quand la commande suivie se termine, quand le shell se termine ou quand le pane est fermé, et rend alors la fin de l’écran ; sans texte, elle attend la fin de la commande en cours (PowerShell uniquement).

**Convention proposée.** Organisation : la propriété est enregistrée dans la session (le pane de l’agent créateur, sur l’onglet et sur chaque pane créés) et survit au redémarrage ; un onglet dupliqué par l’utilisateur ne lui appartient pas. La marque est une petite étoile sur l’onglet (barre d’onglets et panneau des workspaces) et le libellé « créé par Claude » dans l’en-tête du pane, avec en infobulle le workspace et l’onglet de l’agent. Un nouvel onglet s’ajoute à la fin du workspace de l’agent par défaut, dans le dossier de l’agent ; un split s’ouvre dans le dossier et le shell du pane partagé, sans prendre le focus clavier. Sans commande ni demande d’affichage, un élément créé ne change pas ce que regarde l’utilisateur. Les chemins relatifs partent du dossier courant de l’agent et un dossier absent est refusé. `tily_run` écrit une seule ligne, comme une frappe, et refuse un pane dont le shell s’est terminé, qui affiche un programme plein écran ou dont une commande tourne déjà ; il attend au plus 3 secondes que la commande démarre ou se termine. `tily_interrupt` attend au plus 3 secondes l’arrêt de la commande.

**Convention proposée.** Confirmations : le dialogue « Claude Code demande votre accord » cite l’agent (son workspace et son onglet), l’action, la cible (pane ou onglet, ouvert par l’utilisateur ou créé par Claude) et, s’il y a lieu, la commande à lancer ou ce qui tourne (commande suivie, programmes actifs vus par l’hôte). Le focus est sur « Refuser » ; Entrée et Échap refusent ; « Autoriser » n’agit qu’après 0,6 seconde, pour qu’une frappe en cours ne vaille jamais accord. Sans réponse en 2 minutes, la demande est refusée ; plusieurs demandes s’affichent l’une après l’autre ; la barre des tâches clignote (réglage `taskbarFlash`) et la barre de statut annonce la demande. Un pane est occupé quand une commande suivie y tourne ou que l’hôte y voit des programmes actifs. Claude ne peut ni écrire dans son propre pane, ni l’interrompre, ni le fermer avec son onglet. Une fermeture autorisée ne repasse pas par la confirmation de fermeture de l’interface ; un onglet fermé se rouvre par Ctrl + Maj + Z.

**Décidé (4 octobre 2026, issue #142).** Naviguer, recharger et changer la largeur d’un pane navigateur sont libres, comme la lecture, même s’il a été ouvert par l’utilisateur (ou par devup, issue #143) ; le fermer suit les règles de `tily_close`.

**Convention proposée.** Navigateur : sans `pane`, un outil navigateur vise le dernier pane navigateur que l’agent a ouvert ou désigné, sinon son dernier pane navigateur dans la disposition, sinon le seul pane navigateur de son onglet ou de Tily ; s’il en reste plusieurs, il demande de préciser `pane`. `tily_layout` marque les panes navigateur (`kind: "browser"`, adresse, titre, largeur, nombre d’erreurs). `tily_browser_open` crée un pane qui appartient à l’agent, à côté de son pane par défaut, affiche son onglet pour que l’utilisateur voie la page sans lui prendre le focus clavier, puis charge l’adresse. Navigation et rechargement attendent la fin du chargement (30 s au plus) et rendent le statut HTTP, le titre et le nombre d’erreurs du chargement. La console rend les 50 derniers messages par défaut (500 au plus), du niveau « log » et au-delà par défaut ; le réseau les 50 dernières requêtes (500 au plus). La capture rend à Claude une image PNG (1440 × 900, ou 390 × 844 à l’échelle 2 en mobile ; largeur du pane par défaut ; pleine page jusqu’à 16 000 px de haut), même pour un pane dont l’onglet n’est pas affiché, et peut aussi l’enregistrer dans un fichier `.png` d’un dossier existant (chemin relatif au dossier de l’agent). Un pane navigateur jamais affiché depuis le lancement de Tily répond par une erreur ; les outils des terminaux (lecture, commandes, attente, écriture, interruption) refusent un pane navigateur en renvoyant vers les outils navigateur.

**Convention proposée.** Worktrees : `tily_worktrees` liste les worktrees du dépôt d’un dossier (par défaut, celui de l’agent) avec les panes ouverts dans chacun. `tily_create_worktree` suit les étapes du formulaire de création (dépôt du dossier, plan, création, ports, installation, base répliquée) et ouvre le worktree dans un workspace de l’agent, affiché seulement si une installation y démarre ou sur demande ; il rend la main à la fin de la réplication, 10 minutes au plus. `tily_remove_worktree` ouvre le dialogue de suppression de l’interface, prérempli par l’agent (branche gardée ou non, base supprimée ou non) : il cite l’agent demandeur, met le focus sur « Annuler » et n’active « Supprimer » qu’après 0,6 seconde ; sans réponse en 2 minutes, la demande est refusée. Le dépôt principal et le worktree où tourne l’agent ne se suppriment jamais par ce biais.

## 13. Sauvegarde, fermeture et restauration

### Données à retrouver

- Workspaces et onglets, noms et ordre.
- Note de chaque workspace.
- Journal des messages de la barre de statut.
- Dispositions de splits, orientations, proportions et panes actifs.
- Dossiers courants et shells utilisés.
- Adresse et largeur de chaque pane navigateur ; la session de ses pages reste dans son profil (section 7, « Panes navigateur »).
- Texte des anciennes sessions avec distinction visuelle à la réouverture.
- Workspace et onglet actifs, largeur et vue du panneau (Workspaces ou Agents), panneau visible/replié et groupes dépliés/repliés.
- Historique des sessions d’agents (section 12, « Vue Agents »).

**Retenu.** Sauvegarder automatiquement la disposition pendant l’utilisation, sans attendre une fermeture normale. À la réouverture, restaurer l’environnement visuel et créer des shells neufs. Ne pas réexécuter les anciennes commandes et ne pas conserver volontairement les agents ou serveurs en arrière-plan après fermeture.

Le texte restauré est accompagné d’un séparateur explicite, par exemple « Session restaurée — nouvelle session ». Un ancien affichage de serveur ou d’agent ne doit pas être présenté comme une activité encore en cours.

### Robustesse proposée

- Écritures atomiques et format versionné pour éviter une sauvegarde partiellement écrite.
- Sauvegardes différées et regroupées pour les redimensionnements, avec enregistrement final en fin d’interaction.
- Sauvegarde périodique du texte indépendante de la sauvegarde de disposition.
- En cas d’échec d’écriture, garder la session utilisable et signaler que les changements ne sont pas enregistrés.
- Si les données sont corrompues, conserver le fichier fautif pour récupération et ouvrir une session de secours plutôt que l’écraser silencieusement. **Convention proposée :** chaque enregistrement garde le précédent dans `session.previous.json` ; si `session.json` est illisible (par exemple vidé par une coupure de courant), cet avant-dernier enregistrement est restauré s’il est valide, sinon la session initiale ; les fichiers sont écrits sur le disque avant d’être renommés.
- Si un dossier a disparu, conserver le pane et demander ou proposer un dossier de repli avec indication locale.

**Décisions prises.** La valeur par défaut est de 10 000 lignes conservées par pane et de 256 Mio pour l’historique global ; ces deux limites sont configurables. Sauvegarder le texte toutes les 30 secondes, fréquence configurable. Conserver cinq onglets fermés restaurables et leur historique après redémarrage. À la fermeture d’un pane, d’un onglet, d’un workspace ou de l’application, utiliser l’arrêt forcé ; demander une confirmation si un serveur, un agent ou un programme est encore actif, puis arrêter tous les processus concernés.

### Plusieurs fenêtres

**Retenu (4 octobre 2026, issue #146).** Plusieurs fenêtres de Tily peuvent être ouvertes en même temps, par exemple une par écran ou une par client, chacune avec ses workspaces, sans se gêner ni perdre leur travail. Décisions :

| Sujet | Décision |
| --- | --- |
| Modèle | Un processus par fenêtre, une session par fenêtre, préférences partagées. Un workspace ne passe pas d’une fenêtre à l’autre. |
| Restauration | Démarrer Tily alors qu’aucune fenêtre n’est ouverte rouvre chaque session enregistrée qui a au moins un workspace, chacune dans sa fenêtre et sur son écran ; lancer Tily quand il tourne déjà ouvre une fenêtre neuve. Une session sans workspace est oubliée. |
| Agents | La palette, les cartes d’attention et Leader puis A ne concernent que les agents de leur fenêtre ; les autres fenêtres se signalent par leurs notifications (section 12). |
| Préférences | Un réglage enregistré dans une fenêtre s’applique aussitôt aux autres ; seules les sections modifiées sont écrites, pour qu’une écriture concurrente ne perde rien. |

**Convention proposée.** Chaque session vit dans `%LOCALAPPDATA%\Tily\sessions\<identifiant>\` : disposition et avant-dernier enregistrement, texte des panes, journal de la barre de statut. Une fenêtre la réserve par un verrou de fichier, libéré même si elle s’arrête brutalement. La session d’une version antérieure, restée à la racine du dossier de données, devient la première session, sans perte. Une nouvelle fenêtre reprend de la dernière session enregistrée les favoris de la palette, la largeur des panneaux et la disposition du graphe Git. Les états d’agents et les demandes d’aperçu restent dans le dossier commun, chacun au nom de son pane : une fenêtre ne lit et ne supprime que ceux de ses panes, et ces dossiers, comme celui des téléchargements de mise à jour, ne sont purgés qu’au démarrage à froid, quand aucune autre fenêtre n’est ouverte.

**Convention proposée.** « Nouvelle fenêtre », dans la palette, ouvre une fenêtre neuve (session initiale) ; un nouveau lancement de Tily pendant qu’il tourne fait de même. Au démarrage à froid, la session enregistrée le plus récemment s’ouvre dans la première fenêtre et chacune des autres dans son propre processus. Chaque session retient la position de sa fenêtre et son état maximisé (`window.json`) : la fenêtre revient au même endroit, sur le même écran s’il est toujours branché, sinon là où Windows la ramène à l’écran.

**Convention proposée.** Préférences : chaque fenêtre surveille les fichiers de réglages et applique, au plus 300 ms après, ceux qu’une autre fenêtre enregistre (taille du texte comprise), en l’annonçant dans la barre de statut (« Réglages modifiés dans une autre fenêtre de Tily : appliqués ici. »). Un écran Paramètres ouvert sans modification se met à jour ; modifié, il garde la saisie, et « Enregistrer » n’écrit que les sections changées depuis son ouverture.

## 14. Configuration exportable

**Retenu.** La configuration doit être sauvegardable, exportable et versionnable au format **JSON**. L’import doit permettre de retrouver les préférences sauvegardées.

**Convention proposée.** Séparer trois ensembles :

| Ensemble | Contenu |
| --- | --- |
| Préférences versionnables | Shells, chemins exécutables, paramètres, raccourcis, police, éditeur, dossier Projets et préférences visuelles. |
| État de session local | Workspaces, onglets, chemins courants, sélection et disposition. |
| Historique local | Texte terminal et éventuelles données nécessaires à la réouverture d’un onglet. |

L’export de préférences ne doit pas embarquer implicitement la sortie des terminaux. Un export volontaire de disposition peut être proposé séparément ; il contient alors des chemins locaux. L’import valide l’ensemble avant mutation et **remplace** la configuration courante ; il ne fusionne pas silencieusement les valeurs.

**Convention de fichiers.** Les préférences exportables, l’état de session et l’historique restent séparés, chacun avec une version de schéma. L’emplacement exact peut être choisi par l’implémentation dans les répertoires de données Windows appropriés ; il doit être documenté et stable. Une confirmation est requise avant un import qui remplace une configuration existante.

**Convention proposée.** L’en-tête de l’écran Paramètres affiche la version de Tily (« Tily 1.0.0 »), pour la comparer aux versions publiées ou la citer dans un signalement.

**Convention proposée.** L’écran Paramètres reste court : chaque réglage n’affiche que son libellé, et le détail (valeur par défaut, bornes, effet, fichiers touchés) est dans l’infobulle d’une icône ⓘ placée à côté du libellé ou du titre de la section, affichée au survol, au focus clavier ou au clic. Les états (disponible, installé, activé), les avertissements et les erreurs restent affichés en clair ; un champ numérique hors bornes affiche ses bornes. Les chemins des fichiers de réglages ne sont pas listés : « Afficher les fichiers » ouvre leur dossier.

**Convention proposée.** Le pied de l’écran Paramètres propose, à côté d’Importer et Exporter, « Afficher les fichiers » : l’Explorateur Windows s’ouvre sur le dossier des fichiers de réglages (et de la session), pour les sauvegarder ou les modifier à la main.

**Convention proposée.** L’écran Paramètres signale un éditeur introuvable : chemin absolu absent, ou nom de commande (`code`, `cursor`…) qui n’est ni dans le PATH, avec les extensions de PATHEXT, ni parmi les applications enregistrées de Windows (App Paths) ; c’est un avertissement, l’enregistrement reste possible.

**Convention proposée.** Un clic hors de l’écran Paramètres le ferme seulement s’il n’a aucune modification en cours ; sinon l’écran reste ouvert et son pied indique « Modifications non enregistrées : Enregistrer, ou Annuler pour les abandonner. ». Échap et Annuler ferment toujours sans enregistrer. Il en va de même pour le formulaire « Créer un worktree » : une fois un nom de nouvelle branche saisi, seuls Échap et Annuler le ferment.

**Retenu (29 septembre 2026).** Le dossier des worktrees et la base par défaut font partie des préférences exportées, sous une clé `worktrees` facultative : un fichier de version 1 qui ne la contient pas reste importable, avec les valeurs par défaut.

### Mises à jour de l’application

**Retenu (29 septembre 2026).** Tily signale qu’une nouvelle version est publiée et ne l’installe que sur un clic « Installer et redémarrer » : il télécharge l’installeur, ferme Tily, installe la mise à jour puis relance Tily. La nouvelle version s’annonce par un bouton « Mise à jour x.y.z » dans l’en-tête, à côté de Paramètres, qui ouvre ses nouveautés, et par une section « Mises à jour » dans Paramètres (état, « Rechercher maintenant »). La vérification a lieu au démarrage puis toutes les 6 heures, désactivable dans Paramètres ; la recherche manuelle reste toujours possible.

**Convention proposée.** La source est la dernière release publique du dépôt GitHub (hors brouillons et préversions), dont l’installeur `Tily-x.y.z-setup.exe` est vérifié par l’empreinte SHA-256 que publie GitHub avant tout lancement : une release sans empreinte n’est pas installable. Les nouveautés affichées sont la section « Nouveautés » des notes de la release, ou toutes les notes sans elle. La fermeture suit celle de l’application (section 13) : confirmation si des programmes tournent, avec « Arrêter et installer » ; la session est sauvegardée puis restaurée avec des shells neufs. Avec plusieurs fenêtres, celle qui installe demande ensuite leur accord aux autres : chacune affiche la même confirmation si des programmes y tournent (« Installer Tily x.y.z et redémarrer ? Une autre fenêtre de Tily le demande. »), sinon accepte d’elle-même ; un seul refus, ou une fenêtre sans réponse en 2 minutes, annule la mise à jour pour toutes, ce que la barre de statut annonce. Sinon toutes se ferment en sauvegardant leur session. L’installeur tourne en mode silencieux avec sa fenêtre de progression, dans le mode de l’installation existante (par utilisateur, ou pour tous les utilisateurs avec l’autorisation de Windows), attend la fin de toutes les fenêtres de Tily et le relance, ce qui rouvre toutes les sessions. Une copie de Tily qui n’a pas été installée par son installeur (version de développement) signale la nouvelle version mais renvoie vers GitHub. Le réglage fait partie des préférences exportées, sous une clé `updates` facultative.

**Convention proposée.** À l’import, une valeur de persistance hors bornes (sauvegarde du texte, lignes par pane, historique global) est ramenée dans sa plage, et chaque correction est signalée dans l’écran Paramètres, sous l’avis d’import, avant tout enregistrement.

## 15. Architecture fonctionnelle et choix techniques

Cette section décrit une séparation des responsabilités puis la pile technique retenue.

- **Interface** : navigation, édition inline, palette, arborescence et affichage des états.
- **Modèle de session** : identifiants stables, ownership des onglets/panes, arbre de splits et sélection.
- **Moteur de terminal** : rendu, entrées clavier, sélection et historique.
- **Gestionnaire de processus** : lancement des shells, communication avec les terminaux, redimensionnement et fermeture des processus associés.
- **Intégration shell** : obtention fiable du dossier courant et chargement de la configuration habituelle.
- **Services locaux** : dossiers de projets, presse-papiers, éditeur, explorateur et contexte Git.
- **Adaptateurs d’agents** : conversion des événements disponibles vers les états normalisés du produit.
- **Persistance** : préférences, état de session, historique, migrations et récupération.

Les déplacements et changements de présentation agissent sur le modèle et la visibilité, pas sur le cycle de vie des processus. Les identifiants servent à retrouver les éléments ; les noms servent à les présenter.

### Pile technique retenue (validée par le spike T01)

- **Hôte Windows :** application C# sur .NET 10 LTS avec une seule fenêtre WinUI 3 (Windows App SDK) par processus ; plusieurs fenêtres sont plusieurs processus, une session chacun (section 13, « Plusieurs fenêtres »). L’hôte ne porte aucune interface métier : il gère la fenêtre, le gestionnaire de processus, les services locaux, les adaptateurs d’agents et la persistance. WinUI 3 non empaqueté est confirmé par le spike T01 (Windows App SDK 2.5.1, publication autonome depuis la ligne de commande) ; le repli WPF n’est plus nécessaire.
- **Interface :** dans chaque fenêtre, une WebView2 unique héberge toute l’interface (arborescence, onglets, splits, palette, Leader) et un terminal xterm.js par pane (seule exception : les panes navigateur, voir plus bas), avec le renderer WebGL et un repli canvas. Les raccourcis sont interceptés dans xterm.js, jamais par des accélérateurs XAML, afin qu’un seul moteur traite le clavier et le focus.
- **Pseudo-terminal :** ConPTY, isolé derrière le gestionnaire de processus en C# avec P/Invoke. Chaque pane est rattaché à un Job Object Windows pour garantir l’arrêt de l’arbre de processus. Le spike T01 a comparé la ConPTY intégrée à Windows et une `conpty.dll` embarquée issue d’OpenConsole.
- **Dossier courant :** ConPTY ne le fournit pas. Tily l’obtient par intégration shell propre (variable d’environnement dédiée et wrapper de prompt non intrusif émettant une séquence OSC), compatible avec Windows PowerShell 5.1 et oh-my-posh, sans imiter WezTerm. Il enveloppe aussi `PSConsoleHostReadLine`, s’il est défini, pour annoncer le début de l’exécution (`OSC 6973;exec`), comme l’intégration shell de VS Code, et annonce la hauteur en lignes de l’invite produite (`OSC 6973;prompt;<lignes>`, séquences d’échappement exclues). Il rend au prompt d’origine le statut `$?` de la dernière commande, qu’il lit avant d’émettre la séquence : un prompt qui affiche l’échec de la commande précédente (oh-my-posh, starship) le montre comme hors de Tily.
- **Pont hôte / interface :** messages JSON pour les commandes et un canal dédié pour les octets PTY. Mesurer d’abord `PostWebMessage` ; basculer sur un WebSocket local ou un flux binaire si le débit soutenu décroche.
- **Distribution :** build Windows autonome distribuée manuellement dans une release GitHub. Recommandation initiale : installeur Inno Setup pour l’application dépaquetée, sans mise à jour automatique ; l’installeur remplace la version précédente, détecte ou installe le runtime WebView2 Evergreen et embarque le runtime Windows App SDK (build autonome). Une distribution MSIX signée pourra être ajoutée si les contraintes de signature et de sideloading deviennent acceptables.

**Retenu.** Cette pile a été validée le 21 septembre 2026 par le spike T01 : PowerShell 5.1 réel avec le profil et oh-my-posh, ConPTY Windows et OpenConsole comparées, redimensionnement et applications plein écran, Unicode, IME, sélection et clavier français, dossier courant par `TILY_PANE_ID` et séquence OSC 7, Job Object sans processus survivant, pont hôte / interface mesuré et installeur autonome testé. Les résultats détaillés restent consultables dans l’historique Git : [compte rendu du spike T01](https://github.com/MaximeRazafinjato/tily/blob/b1c648454c311b51a731118aea84b98d10bea1ac/spike/README.md). Les alternatives écartées sont l’interface hybride XAML + WebView2 par pane (clavier et focus partagés entre deux moteurs), le contrôle de Windows Terminal (aucun paquet officiel WinUI 3), Electron (empreinte) et Tauri 2 (introduit Rust dans une équipe .NET).

**Retenu (4 octobre 2026, issue #142).** La règle « une seule WebView2 » est levée pour les panes navigateur (section 7, « Panes navigateur ») : chacun est une seconde WebView2 que l’hôte place au-dessus de l’emplacement du pane, dans le même environnement que l’interface mais avec un profil WebView2 distinct, dont les cookies et les sessions sont séparés de ceux de l’interface et conservés d’un lancement à l’autre. Elle donne le protocole DevTools complet, les captures natives et une vraie navigation (connexion Azure AD, popups), là où l’iframe de l’aperçu HTML est refusée par Azure AD et par beaucoup de sites et n’a qu’un protocole DevTools limité. L’interface et le clavier restent dans la WebView2 de l’interface : une page renvoie à Tily les raccourcis de Tily qu’on y tape.

**Fait (4 octobre 2026) : spike T02.** Validés sur une instance isolée : suivi de la position et de la taille du pane, clics, molette et saisie dans la page, renvoi des raccourcis de Tily (Ctrl + P tapé dans la page ouvre la palette, sans atteindre la page), collecte de la console (journaux, avertissements, erreurs, exceptions et rejets de promesse non gérés) et du réseau (méthode, URL, statut, durée, corps des réponses en erreur) par le protocole DevTools, captures desktop et mobile, pleine page et d’un pane masqué, lien `_blank` intercepté, popup de connexion qui garde `window.opener`, profil retrouvé après redémarrage et séparé de l’interface. WinUI 3 ne sait pas rendre une WebView2 transparente (documentation Microsoft) : rien de l’interface ne peut se dessiner par-dessus la page. **Convention proposée :** tant qu’un menu, la palette, un dialogue ou une infobulle de Tily recouvre un pane navigateur, la page est masquée et remplacée par sa capture (environ 75 ms), puis réaffichée à la fermeture. **À vérifier :** une connexion Azure AD réelle.

### Structure conceptuelle des données

| Objet | Champs conceptuels |
| --- | --- |
| Session | Version, liste ordonnée des workspaces, workspace actif, état du panneau. |
| Workspace | Identifiant, nom, onglets ordonnés, onglet actif, état déplié. |
| Onglet | Identifiant, nom affiché, nom manuel ou automatique, arbre de splits, pane actif. |
| Nœud split | Orientation, proportion, deux enfants ; ou référence à un pane pour une feuille. |
| Pane | Identifiant, profil de shell, dossier courant, référence à l’historique, état de session ; pour un navigateur, adresse et largeur. |
| Activité | Identifiant, pane concerné, état, source, date de changement ; données de session vivante. |

Mesures de référence du spike : ConPTY livre 7 à 12 Mo/s en flux soutenu ; `PostWebMessage` transmet 20 Mo sur deux panes simultanés sans perte, avec un rendu xterm.js cumulé de 18 Mc/s, et reste le canal retenu. Le dossier courant est reçu environ 100 ms après le prompt. Versions minimales : Windows 10 1809 (build 17763) pour ConPTY, Windows App SDK et WebView2 Evergreen ; seule la configuration Windows 11 build 26200 a été testée. Critères de performance à respecter par l’application : aucune perte ni doublon de frappe, débit de rendu au moins égal au débit ConPTY, dossier courant reçu en moins d’une seconde, aucun processus survivant après fermeture d’un pane.

## 16. Qualité et accessibilité

Ces exigences sont des recommandations d’implémentation pour préserver les interactions retenues.

- Ne pas perdre une saisie lorsqu’on replie le panneau, déplie un workspace, renomme un autre élément ou redimensionne une zone.
- Maintenir une distinction entre sélection de texte dans un terminal, raccourcis de l’application et saisie dans les champs inline.
- Supporter la composition de texte ; Entrée pendant une composition ne doit pas valider prématurément un renommage.
- Exposer noms accessibles, états dépliés, sélection et relation entre menus et boutons.
- Conserver un focus visible et un ordre clavier cohérent ; éviter les pièges de focus.
- Limiter les rendus et écritures pendant les flux de sortie importants. Définir des budgets de performance avec une charge représentative avant validation technique.
- Afficher les noms, chemins et sorties comme des données ; ne pas les interpréter comme du code HTML.
- Valider les données importées avant de modifier la session courante.
- Traiter les chemins comme des arguments structurés lors des appels aux outils locaux, y compris avec espaces et caractères spéciaux.

**Convention proposée.** Un nom, un chemin ou un message coupé par manque de place (points de suspension) montre son texte complet en infobulle au survol, y compris dans la barre de statut.

## 17. Matrice de recette

Ces scénarios définissent les vérifications à effectuer sur l’application finale.

| ID | Scénario | Résultat attendu |
| --- | --- | --- |
| R01 | Créer Perso avec trois dossiers différents. | Aucun dossier ou projet commun imposé. |
| R02 | Créer puis renommer un workspace inline ; tester Entrée, clic extérieur, Échap et nom vide. | Nom synchronisé, annulation correcte, aucun formulaire modal. |
| R02a | Créer un workspace depuis un dossier puis ouvrir un onglet et changer de dossier. | Workspace nommé d’après le dossier choisi ; onglet nommé d’après son dossier initial ; les noms manuels restent prioritaires. |
| R03 | Clic gauche sur « + ». | PowerShell s’ouvre immédiatement dans le dossier actif. |
| R04 | Clic droit ou Maj + F10 sur « + », puis choix CMD/Git Bash au clavier. | Menu contextuel accessible et shell choisi réellement lancé. |
| R05 | Double-cliquer sur un onglet, saisir un nom, puis changer son contexte. | Nom manuel conservé dans la barre et le panneau. |
| R06 | Réordonner/transférer un onglet avec un processus et plusieurs panes. | Ordre mis à jour sans relancer les processus ni perdre la disposition. |
| R07 | Déplier/replier plusieurs workspaces et cliquer sur un onglet enfant. | Groupes indépendants et navigation vers le bon onglet. |
| R08 | Replier le panneau avec une commande terminal non soumise, puis le rouvrir. | Pleine largeur disponible ; saisie et largeur précédente conservées. |
| R09 | Créer des splits imbriqués, les redimensionner et changer de pane au clavier. | Dossiers hérités, navigation spatiale et disposition cohérente. |
| R10 | Ctrl + P, filtrage, flèches, Entrée, recherche sans résultat et Échap. | Navigation correcte, sélection visible sans bordure, aucun déclenchement accidentel. |
| R12 | Charger le vrai profil PowerShell et exécuter ses alias/fonctions. | Comportement conforme à la session PowerShell habituelle. |
| R13 | Changer de dossier avec cd puis une fonction ; ouvrir onglet et split. | Dossier courant réel hérité. |
| R14 | Ouvrir un outil interactif plein écran, redimensionner et utiliser les touches de contrôle. | Rendu et interactions corrects avec le moteur terminal. |
| R15 | Exécuter wtr et rmwt. | Fonctions disponibles et interface cohérente selon le contrat défini après inspection. |
| R16 | Sélectionner un dossier réel dans Projets. | Workspace ouvert avec terminal dans le bon dossier. |
| R17 | Actions contextuelles depuis deux panes dans des dossiers différents. | Éditeur, explorateur, chemin et branche ciblent le pane actif. |
| R18 | Déclencher une attente avec une intégration d’agent réelle. | Workspace/onglet signalés et accès au bon pane sans focus forcé. |
| R19 | Fermer puis rouvrir l’application. | Disposition et texte restaurés, séparation explicite, shells neufs, aucune ancienne commande rejouée. |
| R20 | Fermer l’application avec serveur et agent actifs. | Confirmation ciblée puis arrêt forcé de tous les processus concernés, sans maintien volontaire. |
| R21 | Interrompre l’application après modification de disposition. | Dernière sauvegarde automatique exploitable, fichier non partiellement écrit. |
| R22 | Restaurer avec dossier disparu ou shell indisponible. | État local compréhensible et solution de repli sans perte silencieuse. |
| R23 | Fermer puis rouvrir un onglet. | Données prévues restaurées avec processus neufs. |
| R24 | Export/import et import invalide. | Préférences récupérables ; aucune mutation si validation échoue. |
| R25 | Tester noms longs, espaces, accents, IME, mise à l’échelle Windows. | Interface lisible, saisie fiable, chemins correctement traités. |
| R26 | Inspecter onglets, workspaces et palette. | Pas de bordures de sélection colorées ; fond et focus restent lisibles. |
| R27 | Ouvrir deux panes PowerShell 5.1 réels, utiliser les raccourcis, changer de dossier, produire un flux soutenu, fermer un pane, puis installer Tily sur une machine vierge. | Aucune perte ni doublon de frappe, dossier courant exact, aucun processus survivant, débit au moins égal à celui de ConPTY, installation fonctionnelle. |
| R28 | Dans un terminal, Ctrl + clic sur une URL puis sur un hyperlien OSC 8, clic simple sur un lien, puis Ctrl + clic sur un lien `file:///` vers une page HTML locale, vers un `.exe` et sur un lien d’un autre schéma. | Les liens `http` et `https` et la page HTML locale s’ouvrent dans leur application par défaut avec Ctrl + clic uniquement ; le clic simple sélectionne sans rien ouvrir ; le `.exe` et l’autre schéma ne sont jamais ouverts et un message l’explique. |
| R29 | Ouvrir l’explorateur par son bouton dans un onglet, changer d’onglet puis revenir, faire `cd` dans le shell, changer de pane, double-cliquer un fichier, créer, renommer puis supprimer un fichier. | Fermé par défaut, l’état est propre à chaque onglet ; l’explorateur suit le dossier du pane actif ; le fichier s’ouvre dans l’éditeur ; les opérations sur les fichiers sont visibles immédiatement et la suppression passe par une confirmation. |
| R30 | Dans un dépôt de test, ouvrir la vue Git puis enchaîner : stage d’un fichier et lecture de son diff, commit, création et merge d’une branche, conflit provoqué, annulation de la dernière opération, stash, tag et cherry-pick, push vers un dépôt distant, réécriture de l’historique et nouveau push. | Branches et graphe reflètent chaque opération, y compris celles faites au terminal ; le conflit liste ses fichiers et se termine ou s’annule ; « Annuler » restaure l’état précédent ; le push refusé ne propose le forçage qu’avec `--force-with-lease` et confirmation. |
| R31 | Dans un dépôt de test avec un worktree créé par `wtr`, ouvrir la vue Git, puis ouvrir ce worktree depuis sa section. | La section « Worktrees » liste le dépôt principal et le worktree avec leur branche ; « Ouvrir » rejoint un pane déjà dans le worktree, sinon ouvre un workspace. |
| R32 | Créer un worktree par Leader puis N (nouvelle branche), par l’icône d’arbre (branche existante) et depuis le menu d’une branche distante, dans un projet qui a des ports, un `package.json` et une base de test. | Workspace ouvert dès la création, `pnpm install` lancé dans son terminal, ports remplacés, base répliquée et chaîne de connexion réécrite ; bilan et avertissements dans la barre de statut. |
| R33 | Supprimer ce worktree avec un pane ouvert dedans, d’abord sans fermer le pane, puis en le fermant. | Premier essai refusé, worktree intact et « Réessayer » ; second essai : pane fermé, dossier, base répliquée et branche supprimés, sauf la branche si « Garder la branche » est cochée. |
| R34 | Dans un pane, lancer Claude Code puis Codex CLI et saisir un prompt sur plusieurs lignes avec Maj + Entrée et Ctrl + Entrée, puis faire Maj + Entrée dans PowerShell. | Chaque combinaison ajoute une ligne au prompt de l’agent sans l’envoyer ; dans PowerShell, Maj + Entrée exécute la commande comme Entrée. |
| R35 | Écrire une note sur plusieurs lignes dans la vue Notes d’un workspace (Ctrl + Maj + O), passer à un autre workspace, fermer puis rouvrir Tily ; fermer ensuite tous les onglets de ce workspace et rouvrir le dernier par Ctrl + Maj + Z. | Chaque workspace garde sa propre note ; l’icône de note et sa première ligne en infobulle apparaissent dans le panneau des workspaces ; la note est retrouvée après redémarrage et après la réouverture de l’onglet ; Échap rend le focus au terminal. |
| R36 | Dans un dépôt de test dont le dépôt distant a reçu un commit d’un autre clone, ouvrir la vue Git, la fermer et la rouvrir aussitôt, passer à un pane d’un autre dépôt, puis décocher le fetch automatique dans les Paramètres et recommencer après 5 minutes, enfin couper le réseau. | Le commit distant apparaît dans le graphe sans clic sur Fetch ; la réouverture immédiate ne relance pas de fetch ; l’autre dépôt a le sien ; réglage décoché : aucun fetch ; hors ligne : aucun message d’erreur. |
| R37 | Sur un Tily installé dans une version antérieure à la dernière release, attendre la vérification ou lancer « Rechercher maintenant », ouvrir le bouton « Mise à jour » puis « Installer et redémarrer » avec un programme actif dans un terminal ; recommencer en annulant le téléchargement ; enfin, avec trois fenêtres ouvertes dont une où tourne un programme, installer depuis une autre, refuser une première fois dans la fenêtre occupée, puis accepter. | Nouveautés affichées, progression visible, confirmation « Arrêter et installer » ; Tily se ferme, s’installe et redémarre dans la nouvelle version avec sa session ; l’annulation laisse Tily inchangé et ne garde aucun fichier partiel ; avec plusieurs fenêtres, seule la fenêtre occupée demande confirmation, le refus annule la mise à jour pour toutes (annoncé dans la barre de statut), l’accord les ferme toutes et les rouvre chacune avec sa session et sa position (section 13, « Plusieurs fenêtres »). |
| R38 | Provoquer plusieurs messages (fermer un onglet, copier un chemin, une erreur Git), ouvrir le journal par un clic sur la barre de statut, par Ctrl + Maj + L, par Leader puis L et par la palette ; fermer puis rouvrir Tily ; « Copier », puis « Effacer ». | Chaque message apparaît avec son heure et son niveau, dans l’ordre ; Échap ferme le tiroir et rend le focus au terminal ; le journal est retrouvé après redémarrage ; la copie contient toutes les lignes ; après « Effacer », le journal reste vide au redémarrage suivant. |
| R39 | Dans un dépôt de test, modifier un fichier à deux endroits et créer un fichier non suivi ; dans le diff Unstaged, faire le stage d’un chunk par son bouton, puis d’une seule ligne ajoutée au clavier (↓, Espace), abandonner une plage choisie par glisser puis « Annuler » ; dans le diff Staged, faire l’unstage d’une ligne ; enfin faire le stage de deux lignes du fichier non suivi. |  ne contient que les lignes choisies et la copie de travail garde tout le reste ; l’abandon demande confirmation et « Annuler » rétablit le fichier ; le fichier non suivi apparaît en Staged avec les deux lignes, son diff Unstaged montre les autres. |
| R40 | Dans un onglet à trois panes : égaliser les panes (Leader puis `=`), échanger le pane actif avec un voisin, le sortir dans un nouvel onglet (Leader puis `!`) puis le ramener dans l’onglet d’origine ; effacer l’historique de défilement d’un pane après une longue sortie ; réduire la fenêtre jusqu’à des panes de moins de 280 px. | Parts égales, processus et texte conservés à chaque déplacement ; seul l’écran visible reste après l’effacement et la sortie suivante s’affiche au bon endroit ; Split et Fermer restent visibles dans l’en-tête des panes étroits (conventions proposées, sections 7, 8 et 11). |
| R41 | Dans PowerShell 5.1, lancer trois commandes dont une de plus de 10 secondes dans un onglet en arrière-plan ; copier la sortie de la dernière commande, remonter de commande en commande (Alt + PgUp / PgDn), puis Ctrl + clic sur un chemin `fichier.ts:12:5` affiché par une commande. | L’onglet et le workspace signalent la fin de la commande longue ; la sortie copiée est exacte, sans invite ; le fichier s’ouvre dans l’éditeur à la ligne 12 (conventions proposées, section 8). |
| R42 | Dans un dépôt de test avec des fichiers modifiés, non suivis et ignorés, un sous-module et un dépôt imbriqué, ouvrir « Ouvrir un fichier du projet… », puis tester Entrée, Alt + Entrée, Maj + Entrée (panneau fermé) et Ctrl + Entrée ; recommencer hors dépôt dans un gros dossier. | Fichiers modifiés puis récents en tête, ni fichiers ignorés, ni supprimés, ni sous-module, ni dépôt imbriqué ; éditeur, aperçu, arbre (panneau ouvert, focus sur le fichier) et chemin inséré ; hors dépôt, réponse en 3 secondes au plus et avertissement si la liste est incomplète (convention proposée, section 4). |
| R43 | Dans un dépôt de test : Revert d’un commit, copie du diff d’un fichier puis `git apply` dans un clone, Ctrl + clic sur une ligne de diff, brouillon de commit gardé en changeant de dépôt, « Commit et push » (Ctrl + Maj + Entrée) avec un push refusé, « Rechercher un commit dans le graphe… » ; dans un dossier neuf, « Initialiser un dépôt Git ici ». | Chaque action aboutit ou explique son échec en français ; le commit reste fait quand seul le push échoue ; le commit recherché est sélectionné et centré ; le nouveau dépôt s’affiche aussitôt (conventions proposées, section 11). |
| R44 | Enregistrer deux états successifs de la session (ouvrir un onglet entre les deux), fermer Tily, vider `session.json` à la main, relancer ; puis rendre `session.previous.json` en lecture seule et modifier la session. | L’avant-dernier état est restauré avec un avertissement et le fichier fautif mis de côté ; la session continue de s’enregistrer malgré la copie impossible (convention proposée, section 13). |
| R45 | Lancer Claude Code dans trois onglets de deux workspaces ; provoquer une permission dans l’un et une question dans un autre ; afficher la vue Agents (Ctrl + Maj + I), rejoindre chaque agent, revenir à la vue Workspaces, puis interrompre un agent par Échap. | Agents groupés par état, l’attente la plus ancienne en tête, avec titre, dernier message entier, action en cours, fichiers modifiés et contexte ; « Rejoindre » active le bon pane sans quitter la vue ; les cartes d’attention restent masquées tant que la vue est affichée ; l’agent interrompu n’est plus affiché « En cours » (section 12, « Vue Agents »). |
| R46 | Depuis la vue Agents : autoriser une commande, en refuser une autre avec une raison, choisir « Toujours » sur une troisième, répondre à une question à choix unique, envoyer un message pendant que l’agent travaille ; puis répondre dans le terminal à une permission affichée dans la vue. | Claude Code prend en compte chaque réponse, reçoit la raison du refus sans arrêter son tour et enregistre la règle « Toujours » ; le message part en file ; la réponse donnée dans le terminal retire la demande de la vue, sans envoi tardif. |
| R47 | Lancer un agent sur une tâche de plusieurs lignes qui contient des guillemets, dans le dossier du pane actif, puis dans un nouveau worktree en mode Plan. | La tâche arrive intacte dans Claude Code ; dans le worktree, Claude démarre dans le même terminal après `pnpm install`, en mode Plan ; la carte de l’agent apparaît dès son démarrage. |
| R48 | Terminer deux sessions Claude, fermer puis rouvrir Tily ; reprendre une session depuis « À reprendre », une autre depuis l’historique, puis supprimer le worktree d’une troisième session. | L’historique liste les sessions avec leur titre ; les panes restaurés proposent « Reprendre » sans relancer Claude d’eux-mêmes ; chaque reprise rouvre la bonne conversation ; la session du worktree supprimé ne peut plus être reprise et l’infobulle l’explique. |
| R49 | Hooks réinstallés, demander à Claude Code dans un pane de produire une page HTML de relecture et de l’ouvrir avec `start`, en restant sur cet onglet puis en passant sur un autre ; ensuite cliquer un `.html` dans l’arbre, basculer « Source » et « Agrandir », suivre une ancre, un lien web et un lien vers un autre fichier, modifier le fichier, puis « Ouvrir dans le navigateur ». | Le navigateur ne s’ouvre pas : la page s’affiche dans l’aperçu de l’onglet de Claude, aussitôt ou au retour sur cet onglet avec une annonce dans la barre de statut ; Claude est informé que Tily l’a ouverte ; scripts de la page actifs, ancre suivie dans la page, lien web dans le navigateur, autre fichier dans l’aperçu ; rechargement après modification ; la page s’ouvre dans le navigateur par défaut sur demande (section 4). |
| R50 | Ouvrir un `.json` en CRLF dans l’aperçu, « Éditer », modifier, Ctrl + S ; modifier de nouveau puis changer le fichier hors de Tily, Ctrl + S, « Écraser », puis recommencer avec « Recharger » ; avec une modification en cours, Échap puis cliquer un autre fichier de l’arbre et tester « Annuler », « Enregistrer » et « Abandonner les modifications ». | Fichier écrit avec son encodage et ses fins de ligne CRLF, « Modifié » disparaît ; bandeau « Le fichier a été modifié sur le disque. » sans perte des modifications, Ctrl + S refusé avec un message en français, « Écraser » écrit les modifications, « Recharger » reprend la version du disque ; la confirmation apparaît à chaque fois, « Annuler » garde l’édition, « Enregistrer » écrit puis poursuit, « Abandonner » poursuit sans écrire (section 4). |
| R51 | Dans Paramètres, section « Serveur MCP », cliquer « Activer » ; lancer `claude` dans un pane d’un workspace qui en compte trois, vérifier `/mcp` puis demander la disposition de Tily ; cliquer « Désactiver » et redemander. | `~/.claude.json` déclare le serveur `tily` sans perdre ses autres clés ni serveurs ; Claude reçoit tous les workspaces, onglets et panes avec dossier, branche, shell et état d’agent, son propre pane marqué ; après désactivation, la déclaration a disparu et l’appel répond « Tily ne répond pas… » en français (section 12, « Pilotage par Claude Code (MCP) »). |
| R52 | Serveur activé, ouvrir une seconde fenêtre de Tily (« Nouvelle fenêtre » ou nouveau lancement, sans `TILY_DATA_DIR`) ; demander la disposition depuis un `claude` de chaque fenêtre, puis depuis un `claude` lancé hors de Tily. | Chaque agent reçoit la disposition de sa propre fenêtre, son pane marqué ; hors de Tily, Claude ne voit aucun outil Tily (`/mcp` : serveur `tily` connecté, sans outil). |
| R53 | Depuis Claude dans un pane : lire les 50 dernières lignes d’un autre pane, lister les commandes en échec d’un pane PowerShell puis d’un pane Git Bash, attendre `ready in` après `pnpm dev`, puis lire un pane jamais affiché depuis le lancement. | Texte exact, sans séquences d’échappement ; échecs PowerShell signalés, succès « inconnu » pour Git Bash ; l’attente rend la main dès le motif affiché, dès que la commande se termine sans l’afficher, ou à l’expiration du délai ; le pane jamais affiché répond par une erreur en français. |
| R54 | Depuis Claude : ouvrir un workspace, un onglet avec `pnpm dev`, un split, focaliser et renommer ; écrire une commande puis envoyer Ctrl + C dans un pane créé par Claude. | Chaque élément créé porte la marque « créé par Claude » ; l’onglet lancé devient l’onglet affiché et sa commande démarre ; aucune confirmation n’est demandée pour ces actions. |
| R55 | Depuis Claude : écrire dans un pane créé par l’utilisateur, fermer un pane occupé, supprimer un worktree ; refuser la première demande, autoriser les suivantes. | Un dialogue Autoriser / Refuser cite l’agent, l’action et la cible ; le refus revient à Claude en erreur française ; aucun appel ne fige l’interface. |
| R56 | Depuis Claude : lister les worktrees d’un dépôt, en créer un sans base répliquée, le relister, puis demander la suppression du dépôt principal, celle du worktree où tourne Claude et celle du worktree créé. | La liste donne chaque worktree avec ses panes ; le worktree créé s’ouvre dans un workspace marqué « créé par Claude » ; les deux premières suppressions sont refusées en français sans dialogue ; la troisième ouvre le dialogue de suppression de l’interface, qui cite Claude, avec le focus sur « Annuler » (section 12, « Pilotage par Claude Code (MCP) »). |
| R57 | Tily ouvert, choisir « Nouvelle fenêtre » dans la palette puis relancer Tily depuis le menu Démarrer ; ouvrir des workspaces différents dans chaque fenêtre, y lancer Claude Code et lui faire ouvrir une page HTML par `start` ; placer une fenêtre sur un autre écran, une autre en taille réduite ; fermer toutes les fenêtres une à une puis relancer Tily ; enfin fermer tous les workspaces d’une fenêtre, la fermer et relancer. | Chaque ouverture donne une fenêtre neuve, sans rouvrir la session d’une autre ; l’état de l’agent et l’aperçu arrivent dans la fenêtre de son pane ; au relancement, chaque fenêtre revient avec ses workspaces, son texte, sa position et son écran ; la fenêtre vidée de ses workspaces ne revient pas (section 13, « Plusieurs fenêtres »). |
| R58 | Deux fenêtres ouvertes : changer la taille du texte depuis la palette de la première ; ouvrir Paramètres dans la seconde, y modifier l’éditeur sans enregistrer, changer le son des notifications dans la première, puis enregistrer la seconde. | La seconde fenêtre applique aussitôt la taille du texte et l’annonce ; son formulaire garde la saisie ; après l’enregistrement, l’éditeur de la seconde et le son de la première sont tous deux conservés, dans les deux fenêtres (section 13, « Plusieurs fenêtres »). |
| R59 | Ouvrir un navigateur par Leader puis U, saisir `localhost:5173` ; ouvrir la palette, un menu contextuel et un dialogue, survoler un bouton de l’en-tête du pane ; passer en largeur mobile, replier le panneau des workspaces, agrandir le pane, changer d’onglet ; taper Ctrl + P, puis Leader puis U, dans la page ; suivre un lien `_blank` ; fermer puis rouvrir Tily ; fermer le pane. | La page suit le pane dans chaque disposition ; palette, menu, dialogue et infobulle passent au-dessus de la page figée ; la page ne reçoit ni Ctrl + P ni le Leader, qui agissent dans Tily ; le lien s’ouvre dans un nouveau pane navigateur ; adresse et largeur sont restaurées ; la fermeture ne laisse aucune page ouverte (section 7, « Panes navigateur »). |
| R60 | Dans un pane navigateur, se connecter à une application Azure AD (popup de connexion et redirection), fermer puis rouvrir Tily ; ouvrir la même application dans le navigateur par défaut. | Connexion réussie dans le pane, sans connexion automatique avec le compte Windows ; session retrouvée après redémarrage ; l’interface de Tily et le navigateur par défaut n’en partagent rien (section 7, « Panes navigateur »). |
| R61 | Ouvrir une page qui écrit dans la console (journal, avertissement, erreur), lève une exception, rejette une promesse et appelle une API qui répond 404 puis 500 ; observer le compteur, recharger, écrire 3 000 erreurs d’un coup, puis passer sur un autre onglet pendant que la page continue d’appeler l’API. | Le compteur affiche les erreurs du chargement courant (console et réseau, sans les avertissements), revient à zéro au rechargement puis remonte, compte les 3 000 erreurs sans figer l’interface ; la collecte continue en arrière-plan ; un clic sur le compteur ouvre les DevTools (section 7, « Panes navigateur »). |
| R62 | Depuis Claude dans un pane, avec deux navigateurs dans son onglet : demander la console sans préciser le pane ; ouvrir `localhost:5173` en onglet, passer en mobile, faire une capture enregistrée dans `avant.png`, lister les requêtes en échec, recharger, lire la console depuis le dernier chargement ; afficher un autre onglet et refaire une capture pleine page ; naviguer dans un navigateur ouvert par l’utilisateur ; lire ce navigateur avec `tily_read_pane` ; fermer le navigateur créé. | La première demande est refusée en français (plusieurs navigateurs) ; l’onglet du navigateur s’affiche sans prendre le focus clavier, la page est chargée et le résultat donne statut et titre ; les outils sans pane visent ce navigateur ; la capture mobile est rendue à Claude et enregistrée ; échecs et console exacts ; la capture pleine page marche onglet masqué ; la navigation dans le pane de l’utilisateur ne demande aucun accord ; `tily_read_pane` renvoie vers les outils navigateur ; la fermeture du navigateur de l’agent se fait sans confirmation (section 12, « Pilotage par Claude Code (MCP) »). |

## 18. Décisions restantes avant développement

1. Inspecter le profil PowerShell, wtr/rmwt et la configuration WezTerm Leader + F. **Fait :** voir `docs/inspection-environnement.md`.
2. Identifier les shells installés, l’éditeur, le dossier Projets et les agents utilisés. **Fait :** Windows PowerShell 5.1 par défaut, PowerShell 7/CMD/Git Bash disponibles, VS Code, `C:\\Files\\Projects`, Claude Code et Codex CLI.
3. **Fait :** pile hôte C# + WebView2 unique (xterm.js) + ConPTY validée par le spike T01 avec l’installeur manuel ; voir le [compte rendu du spike T01](https://github.com/MaximeRazafinjato/tily/blob/b1c648454c311b51a731118aea84b98d10bea1ac/spike/README.md). **Décidé :** l’interface entière est web dans une seule WebView2 ; l’hôte natif ne porte pas d’interface métier.
4. **Fait :** fermer le dernier onglet/pane supprime le workspace ; confirmer avant suppression d’un workspace actif ; état vide si nécessaire.
5. **Fait :** arrêt forcé avec confirmation si serveur, agent ou programme actif ; limites 10 000 lignes/256 Mio, sauvegarde texte toutes les 30 s, cinq onglets fermés.
6. **Fait :** Leader Ctrl + Espace, délai de 5 s, mapping personnalisable ; navigation spatiale.
7. **Fait :** JSON, préférences/session/historique séparés, import par remplacement.
8. **Fait :** noms automatiques dossier, branche absente/HEAD détachée et actions Git indisponibles hors dépôt ; contrat wtr/rmwt documenté.
9. **Fait pour Claude Code**, suivi par ses hooks ; **reporté pour Codex CLI** : définir ses événements fiables dans une évolution dédiée.
10. **Fait :** critères mesurables de performance et versions minimales de Windows consignés en section 15 à l’issue du spike.
11. **À décider :** sur un onglet de la barre ou une ligne du panneau des workspaces qui a le focus, Alt + flèche déplace cet élément au lieu de changer de pane comme le prévoit le tableau retenu de la section 9 (conventions proposées des sections 5, 6 et 9). Garder cette exception ou la retirer.
12. **À décider :** la « Décision prise » de la section 5 demande une confirmation pour supprimer un workspace « lorsqu’il contient des onglets ou des processus actifs ». Aujourd’hui, « Fermer le workspace » (menu du panneau, palette) ne confirme que si des programmes tournent : un workspace de plus de cinq onglets inactifs se ferme sans confirmation et ses onglets au-delà des cinq derniers ne sont plus restaurables. Préciser si la confirmation doit porter sur tout workspace qui contient des onglets.
13. **Fait (29 septembre 2026) :** gestion native des worktrees (section 11, recettes R31 à R33) ; `wtr` et `rmwt` restent utilisables au terminal avec les mêmes chemins.
14. **Fait (29 septembre 2026) :** mises à jour dans l’application (section 14, recette R37) : signalement, installation au clic, vérification au démarrage puis toutes les 6 heures.
15. **À décider :** Alt + PgUp et Alt + PgDn (navigation de commande en commande, section 8) sortent de la règle retenue des raccourcis directs (Ctrl + Maj + lettre, Alt + flèche). Garder cette exception, choisir un autre raccourci ou ne garder que la palette. De même, les nouvelles séquences Leader =, ! et Maj + flèche (section 7) et Leader puis chiffre (section 9) n’ont pas de raccourci direct, pas plus que « Ouvrir un fichier du projet… » (section 4), accessible seulement depuis la palette.
16. **Décidé (30 septembre 2026, issue #118) :** vue Agents du panneau de gauche (section 12, « Vue Agents », recettes R45 à R48). **À vérifier** avant d’implémenter les réponses : que le dialogue de permission reste utilisable dans le terminal pendant que le hook PermissionRequest attend. **Vérifié :** un Échap laisse aujourd’hui l’agent affiché « En cours » ou « En attente », faute de hook (issue #121).
17. **Décidé (4 octobre 2026, issue #146) :** plusieurs fenêtres en même temps, un processus et une session par fenêtre (section 13, « Plusieurs fenêtres »).
18. **Décidé (4 octobre 2026, issue #142) :** panes navigateur dans une seconde WebView2 (section 15, spike T02 fait). **À vérifier :** une connexion Azure AD réelle dans un pane navigateur, et sa conservation après redémarrage.

Ces décisions ne bloquent pas la compréhension du produit ; elles évitent de traiter un comportement accidentel comme une exigence validée.
