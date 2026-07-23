# CLAUDEMAP — Sycora

> Carte vivante du projet. Mise à jour à chaque évolution.
> **Version : 0.12** · Dernière mise à jour : session « mise à jour Analyse (détail par tiers) »
> Règle : ce fichier doit toujours refléter l'état réel du code livré.

---

## 1. Objectif du projet

Application web hors-ligne (PWA) pour cabinet à Dakar, réunissant **trois modules** :

1. **Montage des états financiers** — à partir de la fiche d'entité + balances N/N-1,
   génère bilan, compte de résultat, TFT et notes annexes ; exporte au **format DGID**
   (dépôt officiel), en masque Excel, ou en PDF.
2. **Audit** — outil existant (« Auris ») de contrôle des balances et de génération du
   pré-rapport Word, intégré tel quel.
3. **Analyse des comptes** — revue comptable détaillée compte par compte : ratios,
   comparatif N/N-1, anomalies automatiques, fiches de contrôle SYSCOHADA.

Référentiels visés : **SYSCOHADA** et **SYCEBNL** (Associations/Fondations, Projets de développement).

---

## 2. Fichiers livrés (dossier `Sycora/`)

| Fichier | Rôle |
|---|---|
| `index.html` | App unifiée : écran d'accueil (2 cartes) + onglets + module Audit intégré + iframe Montage. **Point d'entrée.** |
| `montage.html` | Module de montage (chargé dans une iframe par index.html). |
| `analyse.html` | Module d'analyse des comptes (iframe). **Version AuditDiag complète fournie par le client** (135 Ko). |
| `modele_dgid.xlsx` | Modèle officiel DGID (SYSCOHADA) intégré ; rempli automatiquement à l'export. |
| `modele_sycebnl.xlsx` | Masque de liasse SYCEBNL intégré (formules SUMIF → notes auto dans Excel). |
| `manifest.json` | Manifeste PWA (nom Sycora, thème #10243E). |
| `sw.js` | Service worker : HTML network-first, assets cache-first, cache `sycora-v1`. |
| `icon-192.png` / `icon-512.png` | Icônes (logo : barres + coche, navy/teal). |
| `LISEZMOI.txt` | Mode d'emploi client. |
| `claudemap.md` | Ce fichier. |

**Dépendances CDN** (mises en cache par le SW, cache `sycora-v2`) : `xlsx 0.18.5`, `jszip 3.10.1`,
`Chart.js 4.4.1`, `html-docx-js 0.3.1`, `FileSaver 2.0.5` (ces trois dernières pour le module Analyse).
`index.html` embarque en plus **JSZip inline** (hérité d'Auris).

---

## 3. Architecture de l'app unifiée (index.html)

- Barre supérieure `#sycora-bar` : logo (clic → accueil) + onglets `#tb-montage` / `#tb-audit`.
- `setSycoraMode(mode)` bascule via une classe body : `m-home` | `m-montage` | `m-audit` | `m-analyse`
  (CSS masque/affiche les blocs). Mode mémorisé dans `localStorage['sycora-mode']`.
- Écran d'accueil `#sycora-home` : trois grandes cartes (Montage / Audit / Analyse des comptes).
- **Montage et Analyse isolés en iframes** (`#montage-frame`, `#analyse-frame`) : zéro conflit JS/CSS
  entre les deux modules (chacun a son JSZip, ses globals). L'iframe se charge à la
  première ouverture du montage (lazy).
- Dans montage.html, le lien « Accueil » détecte l'iframe (`window.self!==window.top`)
  et appelle `parent.setSycoraMode('audit')` (libellé « ← Audit »).

---

## 4. Module MONTAGE (montage.html)

### 4.1 Parcours (stepper 4 étapes)
1. **Système** : SYSCOHADA / SYCEBNL-Assoc / SYCEBNL-Projets (`M.sys`).
2. **Fiche R1** : ~40 champs (`FICHE_FIELDS`), persistés dans `localStorage['montage-fiche']`.
   - Import Excel : `parseFicheExcel()` (clé/libellé/valeur) + `downloadFicheTemplate()`.
3. **Import balances** : `parseBalance()` — détection **globale** des colonnes (fonctionne
   avec OU sans ligne d'en-tête ; comptes ≥3 chiffres ; colonnes de valeurs par fréquence,
   dernière paire = soldes finaux D/C). Validé sur balance Sage réelle sans en-tête. Stocke `M.balN`, `M.balN1` = `{data, idx}`.
   - `data` = entrées `{cpte, lib, sid, sic, md, mc, sfd, sfc}` (soldes nets par sens).
   - `idx` = `mkIndex(data)` → fournit `SD(prefix)` / `SC(prefix)` (somme par préfixe de compte).
4. **États + exports** : sous-onglets Actif / Passif / Compte de résultat / Flux / Notes.

### 4.2 Moteurs de calcul
- `evalSysco(idx, idxPrev)` — mapping SYSCOHADA aligné sur les réf. DGID
  (ACTIF AD–BZ, PASSIF CA–DZ, CR TA→XI). Totaux résolus en multi-passes (`resolveTotals`).
  Expose brut/amort N et N-1, résultat, flag `sysco:true`.
- `evalSycebnl(idx, idxPrev)` — mapping **transpilé** des formules du masque SYCEBNL
  (SYCEBNL_ACTIF/PASSIF/CR), évaluation multi-passes (totaux qui précèdent leurs détails).
- ✅ Testés (node) : SYSCOHADA équilibré (écart 0, résultat exact) ; SYCEBNL asso écart 0.

### 4.3 TFT (SYSCOHADA)
- `computeTFT()` — méthode indirecte : CAFG = résultat + dot.(68/69/85) − reprises(79/86)
  + VNC cessions(81) − produits cessions(82) ; variations de BFR ; écart de contrôle affiché.
- ⚠️ Lignes FF–FN (investissement/financement) **estimées** à partir des variations de bilan.
- Aperçu `renderTFTPreview()` (nécessite balance N-1 pour être significatif).

### 4.4 Notes annexes
- `NOTES_DEF` — **822 formules SUMIF du masque SYCEBNL transpilées** (extraction auto),
  37 notes. Évaluateur `noteCellVal()` / `noteTermVal()` (somme par préfixe sur la balance).
- Aperçu écran `renderNotes()` (sous-onglet « Notes annexes »), colonnes N / N-1.
- `DGID_NOTES` — cartographie **notes DGID → comptes OHADA** (22 notes, 120 lignes),
  injectée dans le formulaire DGID par `injectNotesDGID()` (cols N/N-1 selon la note).
  `noteCodeVal(codes, useN, field)` : field `D`=SF débit, `C`=SF crédit, `NET`=D−C.
  ✅ Totaux vérifiés = lignes du bilan/CR (stocks, clients, dispo, frs, achats, CA…).

### 4.5 Exports
| Export | Fonction | Principe |
|---|---|---|
| **DGID (Excel)** | `exportDGID()` → `injectDGID()` | `fetch('modele_dgid.xlsx')` → injecte page de garde, fiche R1, bilan paysage, CR, TFT **et notes** dans les cellules exactes. `fullCalcOnLoad=1`. Aucun dépôt manuel. |
| **Liasse (masque)** | `exportLiasse()` | `fetch('modele_sycebnl.xlsx')` (ou masque déposé) → injecte les balances ; **Excel recalcule tout, notes comprises** (SUMIF). |
| **PDF** | `exportPDF()` | `#print-zone` + `window.print()` : bilan actif/passif, CR, TFT. |

Mécanique d'injection Excel : JSZip + DOMParser ; `getSheetPath()` (résolution nom→feuille),
`setCell()` (crée ligne/cellule manquante, style préservé), `cellEl()` (inlineStr / numérique),
`xlDate()` (série Excel). NS = `NSX`.

### 4.6 Cartographies clés (cellules DGID)
- Page de garde : B17 centre dépôt, M27 exercice clos, L35 dénom, H41 sigle, J46 adresse, N51 NINEA.
- Fiche R1 : AH1/AH10 durée, Y13/AH13 exercice, Q20 précédent clos, F24/I24/W24, G36/Q36/Y36/AA36/AE36, D40/D44/D48/D52/D56, D69/D72/D75, banques T71-73/AD71-73.
- BILAN PAYSAGE : actif D/E/F(+G N-1) lignes 9-37 ; passif K/L lignes 9-37 (réf `DGID_ACTIF_ROWS` / `DGID_PASSIF_ROWS`).
- COMPTE DE RESULTAT : E/F lignes 8-49 (`DGID_CR_ROWS`).
- FLUX : E lignes 8-37 (`DGID_TFT_ROWS`).
- Crosswalk entité SYCEBNL → formulaire DGID (SYSCOHADA) : `A_ROW_MAP`/`P_ROW_MAP`/`C_ROW_MAP`.

---

## 5. Module AUDIT (intégré dans index.html)

- Application « Auris » d'origine, inchangée : onglets accueil / import / contrôle / EF /
  ratios / mapping / rapport ; gestion de missions ; export pré-rapport Word.
- **Bug corrigé (N-1)** : les colonnes d'années étaient codées en dur (2025/2024).
  Ajout de `findYearCols()` (détection générique : année la plus récente = N, précédente = N-1),
  utilisé dans `extractReportRows()` et `detectColsXML()`. Le rapport précédent se charge
  désormais quel que soit l'exercice.

---

## 5bis. Module ANALYSE DES COMPTES (analyse.html)

**Version en production : fichier fourni par le client (AuditDiag complet, ~144 Ko, 2094 lignes),
intégré tel quel — aucune modification.** Il remplace le portage initial réalisé côté Sycora.

- Titre : « Sycora — Analyse des comptes (AuditDiag) ».
- Déjà câblé pour la coquille Sycora : le lien « Accueil » appelle `parent.setSycoraMode('home')`
  lorsqu'il est chargé en iframe.
- Dépendances propres : **Chart.js 4.4.1** (graphiques), **html-docx-js 0.3.1** + **FileSaver 2.0.5**
  (export Word), en plus de `xlsx`. Ajoutées à `STATIC_ASSETS` du service worker
  (cache `sycora-v5`) pour le fonctionnement hors-ligne.
- Logique métier de référence : `REFERENCE_MOTEUR_AUDITDIAG.md` (parsing grand livre par delta
  de solde progressif, classification SYSCOHADA générique, ratios, base de connaissances,
  anomalies, comparatif N/N-1).

> Note : toute évolution future de ce module doit repartir du fichier client, qui fait foi.

---

## 6. Couverture des NOTES (mesurée sur le modèle DGID)

Total ≈ **651 lignes de données** sur 46 feuilles de notes.

| Catégorie | Lignes | % | Automatisable ? | État |
|---|---|---|---|---|
| A. Soldes de comptes | 364 | 56 % | Oui (balance) | partiellement mappé |
| B. Tableaux de mouvements | 128 | 20 % | Oui (SI + mouvements, déjà captés) | **non mappé** |
| C. Hors balance / qualitatif | 159 | 24 % | Non (saisie externe) | non applicable |
| **Mappé (validé sur liasse réelle)** | **231** | **35 %** | — | livré |
| **Plafond réaliste (A+B)** | **492** | **76 %** | — | objectif |

Notes injectées en DGID (23) : 4,6,7,8,9,10,11,14,15A,16A,17,18,19,20,21,22,23,24,25,26,27A,29,30.

**Validation** : cartographie confrontée à une liasse DGID réelle déposée (Copie_de_DGID_7_2023)
+ sa balance (BAL_APRES_IS). 53 lignes non nulles testées → **0 divergence**. Bilan 8 515 209 461
(écart 0), résultat 30 440 697, notes (titres, emprunts, fournisseurs, CA…) : tout concorde.

---

## 7. Limites connues

- Notes : 18 % injectées en DGID (voir §6). Les ventilations fines (zone géographique,
  échéances) exigent un plan de comptes détaillé et/ou une saisie ; le qualitatif (C) est hors balance.
- TFT : lignes FF–FN estimées (écart de contrôle affiché).
- Entité SYCEBNL déposée sur formulaire DGID (SYSCOHADA) : rubriques les plus proches reportées.
- Masque SYSCOHADA d'origine **chiffré** (illisible) → pas de transpilation SYSCOHADA des notes.
- Balance protégée par mot de passe : Excel refuse l'ouverture programmatique.

---

## 8. Ce qui débloquerait la suite (par ordre d'impact)

1. **Masque Excel SYSCOHADA NON protégé** → transpiler ses formules de notes comme pour
   SYCEBNL (822 formules) ; couverture A+B vérifiable sans deviner.
2. **Balance réelle anonymisée (N et N-1)** → valider le parseur + connaître le niveau de
   détail des comptes (3 vs 4-5 chiffres) qui conditionne les ventilations.
3. **Liasse DGID déjà déposée/acceptée (anonymisée)** → étalon de comparaison cellule à cellule.
4. **Formulaire « compléments annexes »** (à construire) → saisir une fois les données de
   catégorie C (échéances, effectifs, sûretés, engagements, répartition du résultat).

---

## 9. Journal des évolutions

- **0.1** — Module Montage autonome (fiche, balances, bilan/CR, export masque + PDF).
- **0.2** — Moteurs SYSCOHADA/SYCEBNL corrigés et testés (écart 0). Export DGID par dépôt du modèle.
- **0.3** — App unifiée « Liassio » (accueil 2 options) ; puis fusion Montage+Audit (iframe).
- **0.4** — Renommage **Sycora** + logo + icônes générées ; interface à onglets.
- **0.5** — Écran d'accueil (2 cartes) ; correction bug rapport N-1 (audit) ;
  Montage revu : DGID auto-chargé (plus de dépôt), import fiche Excel, aperçu TFT.
- **0.6** — Notes annexes : transpilation des 822 formules SYCEBNL (aperçu écran) +
  injection de 22 notes dans le formulaire DGID (totaux vérifiés). Analyse de couverture (§6).

- **0.7** — Fichiers réels reçus (balance + liasse DGID déposée). Parseur de balance
  réécrit (détection **globale** des colonnes : fonctionne sans en-tête, comptes 6 chiffres,
  colonnes MVT/SF). Cartographie DGID des notes **reconstruite et validée** contre la liasse
  réelle (231 lignes, 0 divergence). Colonnes des notes corrigées (N=B, N-1=C).

- **0.8** — **3e module « Analyse des comptes »** (`analyse.html`) : portage du moteur
  AuditDiag (parsing grand livre par delta de solde progressif, classification SYSCOHADA,
  ratios, base de connaissances ~55 comptes, anomalies, fiches). Accueil à **3 cartes** et
  3e onglet. Réintégration des notes calculées 3A/31/34 dans l'export DGID.
  Validé sur la balance réelle : agrégats identiques à la liasse déposée.

- **0.9** — Module Analyse remplacé par la **version AuditDiag complète fournie par le client**
  (intégrée verbatim). Service worker mis à jour (`sycora-v2`) avec Chart.js, html-docx-js et
  FileSaver pour l'usage hors-ligne. Intégration vérifiée (onglet, carte, iframe, lien retour).

- **0.10** — Module Analyse mis à jour (version client la plus récente) : export Excel corrigé —
  noms d'onglets rendus **uniques** et nommés par code de compte (`<code> - N-N1` / `<code> - Detail`),
  ce qui évitait l'échec de génération en cas de noms d'onglets identiques. Cache SW → `sycora-v3`.

- **0.11** — Module Analyse mis à jour (version client) : rendu de l'**export Word** corrigé —
  pastilles de risque en cercle Unicode coloré par style inline (au lieu d'émojis, dont le rendu
  dépendait d'une police absente de Word), codes de comptes mis en évidence en couleurs
  hexadécimales (les variables CSS ne survivent pas à la conversion HTML → Word), et cellules
  de tableau acceptant du HTML pré-construit (`raw()` / `cellHtml()`). Cache SW → `sycora-v4`.

- **0.12** — Module Analyse mis à jour (version client) : **détail par tiers** à partir du grand
  livre auxiliaire — fiche par client / fournisseur avec comparatif N/N-1, liste des écritures,
  et anomalies (doublons, montants ronds ≥ 1 M multiples de 100 000, **ancienneté** du solde
  au-delà de 90 j / 180 j, solde sans écriture retrouvée). Deux modes de rapport
  (`reportMode` : « complet » avec le détail par tiers, « synthèse » sans). Cache SW → `sycora-v5`.

### Prochaines étapes proposées
- Catégorie B (mouvements : immobilisations 3A/3C/3D, provisions, capital) via SI + md/mc.
- Formulaire de compléments annexes (catégorie C).
- Transpilation SYSCOHADA si masque non protégé fourni.
- Analyse : passerelle Montage → Analyse (réutiliser la balance déjà importée).
