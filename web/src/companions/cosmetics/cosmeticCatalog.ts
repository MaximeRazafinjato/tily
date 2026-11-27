import type { CompanionOutfit } from '../../bridge/appearanceMessages'

export enum CosmeticSlot {
  Hat = 'hat',
  Face = 'face',
  Skin = 'skin',
  Trail = 'trail',
  Animation = 'animation',
}

export enum CosmeticTier {
  Common = 'common',
  Rare = 'rare',
  Legendary = 'legendary',
}

export const TIER_LABELS: Record<CosmeticTier, string> = {
  [CosmeticTier.Common]: 'Commun',
  [CosmeticTier.Rare]: 'Rare',
  [CosmeticTier.Legendary]: 'Légendaire',
}

export enum CompanionHat {
  Cap = 'cap',
  Beanie = 'beanie',
  Cowboy = 'cowboy',
  Chef = 'chef',
  TopHat = 'topHat',
  Viking = 'viking',
  Propeller = 'propeller',
  Crown = 'crown',
}

export enum CompanionFace {
  Mustache = 'mustache',
  ClownNose = 'clownNose',
  Monocle = 'monocle',
  EyePatch = 'eyePatch',
  HeroMask = 'heroMask',
  PixelShades = 'pixelShades',
}

export enum CompanionSkin {
  RpgDrop = 'rpgDrop',
  Pixel = 'pixel',
  Slime = 'slime',
  Ghost = 'ghost',
  Rainbow = 'rainbow',
  ArcadeGhost = 'arcadeGhost',
  Voxel = 'voxel',
  Synthwave = 'synthwave',
  Galaxy = 'galaxy',
  Neon = 'neon',
  Realistic = 'realistic',
  Mecha = 'mecha',
  Hologram = 'hologram',
}

export enum CompanionTrail {
  Stars = 'stars',
  Bubbles = 'bubbles',
  Hearts = 'hearts',
  Slime = 'slime',
  Rainbow = 'rainbow',
  Pixels = 'pixels',
}

export enum CompanionAnimation {
  Spring = 'spring',
  StopMotion = 'stopMotion',
  Spin = 'spin',
  Levitation = 'levitation',
  Ninja = 'ninja',
  Teleport = 'teleport',
  Disco = 'disco',
}

export interface CosmeticEntry {
  id: string
  name: string
  description: string
  tier: CosmeticTier
}

export interface WardrobeCategory {
  slot: CosmeticSlot
  name: string
  description: string
  items: CosmeticEntry[]
}

const { Common, Rare, Legendary } = CosmeticTier

export const WARDROBE: WardrobeCategory[] = [
  {
    slot: CosmeticSlot.Hat,
    name: 'Chapeaux',
    description: 'Posés sur le haut du compagnon, ils suivent son rebond.',
    items: [
      { id: CompanionHat.Cap, name: 'Casquette', description: 'Visière sur le côté, bouton sur le dessus.', tier: Common },
      { id: CompanionHat.Beanie, name: 'Bonnet à pompon', description: 'Revers côtelé, pompon qui ballotte.', tier: Common },
      { id: CompanionHat.Cowboy, name: 'Chapeau de cowboy', description: 'Bords relevés, calotte creusée.', tier: Common },
      { id: CompanionHat.Chef, name: 'Toque de chef', description: 'Gonflée comme un soufflé.', tier: Common },
      { id: CompanionHat.TopHat, name: 'Haut-de-forme', description: 'Ruban rouge, très distingué.', tier: Rare },
      { id: CompanionHat.Viking, name: 'Casque viking', description: 'Deux cornes et des rivets.', tier: Rare },
      { id: CompanionHat.Propeller, name: 'Casquette à hélice', description: 'L’hélice tourne sans arrêt.', tier: Rare },
      { id: CompanionHat.Crown, name: 'Couronne', description: 'Trois pointes et un rubis.', tier: Legendary },
    ],
  },
  {
    slot: CosmeticSlot.Face,
    name: 'Visage',
    description: 'Accrochés aux yeux, au nez ou à la bouche.',
    items: [
      { id: CompanionFace.Mustache, name: 'Moustache', description: 'En guidon, les pointes frétillent.', tier: Common },
      { id: CompanionFace.ClownNose, name: 'Nez de clown', description: 'Rouge, rond et brillant.', tier: Common },
      { id: CompanionFace.Monocle, name: 'Monocle', description: 'Cerclé d’or avec sa chaînette.', tier: Rare },
      { id: CompanionFace.EyePatch, name: 'Cache-œil', description: 'De pirate, sur l’œil droit.', tier: Rare },
      { id: CompanionFace.HeroMask, name: 'Masque de héros', description: 'Bandeau dont les nœuds flottent.', tier: Rare },
      { id: CompanionFace.PixelShades, name: 'Lunettes pixel', description: 'Tombent du ciel de temps en temps.', tier: Legendary },
    ],
  },
  {
    slot: CosmeticSlot.Skin,
    name: 'Apparence',
    description: 'Remplace la matière du compagnon, en gardant sa teinte quand c’est possible.',
    items: [
      { id: CompanionSkin.RpgDrop, name: 'Goutte de RPG', description: 'Le premier monstre de toute aventure : pointe molle et grand sourire.', tier: Common },
      { id: CompanionSkin.Pixel, name: 'Pixel', description: 'Basse résolution, animé à 10 images par seconde.', tier: Rare },
      { id: CompanionSkin.Slime, name: 'Slime', description: 'Translucide, bulles qui remontent, flaque au sol.', tier: Rare },
      { id: CompanionSkin.Ghost, name: 'Fantôme', description: 'Flotte, bas en vagues, à moitié transparent.', tier: Rare },
      { id: CompanionSkin.Rainbow, name: 'Arc-en-ciel', description: 'Rayures pastel qui défilent.', tier: Rare },
      { id: CompanionSkin.ArcadeGhost, name: 'Fantôme d’arcade', description: 'Jupe en dents de scie et grands yeux qui suivent le regard.', tier: Rare },
      { id: CompanionSkin.Voxel, name: 'Bloc voxel', description: 'Un cube de terre et d’herbe, à miner sans modération.', tier: Rare },
      { id: CompanionSkin.Synthwave, name: 'Synthwave', description: 'Soleil couchant à rayures et grille néon qui défile.', tier: Rare },
      { id: CompanionSkin.Galaxy, name: 'Galaxie', description: 'Nébuleuses et étoiles qui scintillent.', tier: Legendary },
      { id: CompanionSkin.Neon, name: 'Néon', description: 'Contour lumineux sur un corps sombre.', tier: Legendary },
      { id: CompanionSkin.Realistic, name: 'Réaliste', description: 'Peau à pores, reflets humides, vrais yeux et vraies lèvres. Il vous fixe.', tier: Legendary },
      { id: CompanionSkin.Mecha, name: 'Mecha', description: 'Plaques rivetées, visière qui balaie, antenne qui clignote.', tier: Legendary },
      { id: CompanionSkin.Hologram, name: 'Hologramme', description: 'Projeté depuis un socle : lignes de balayage et grésillements.', tier: Legendary },
    ],
  },
  {
    slot: CosmeticSlot.Trail,
    name: 'Traînée',
    description: 'Laissée derrière lui quand il se déplace, elle s’estompe jusqu’à disparaître.',
    items: [
      { id: CompanionTrail.Stars, name: 'Étoiles', description: 'Petites étoiles qui tournoient et retombent.', tier: Common },
      { id: CompanionTrail.Bubbles, name: 'Bulles', description: 'Bulles de savon qui montent et éclatent.', tier: Common },
      { id: CompanionTrail.Hearts, name: 'Cœurs', description: 'Cœurs roses qui s’envolent en zigzag.', tier: Common },
      { id: CompanionTrail.Slime, name: 'Bave', description: 'Trace brillante à la couleur de l’agent.', tier: Common },
      { id: CompanionTrail.Rainbow, name: 'Arc-en-ciel', description: 'Ruban qui ondule à chaque saut.', tier: Rare },
      { id: CompanionTrail.Pixels, name: 'Pixels', description: 'Carrés 8 bits qui s’éparpillent.', tier: Rare },
    ],
  },
  {
    slot: CosmeticSlot.Animation,
    name: 'Animations',
    description: 'Changent sa façon de bouger.',
    items: [
      { id: CompanionAnimation.Spring, name: 'Ressort', description: 'Monté sur ressort, il rebondit sans cesse.', tier: Common },
      { id: CompanionAnimation.StopMotion, name: 'Stop-motion', description: 'Saccadé comme un film en pâte à modeler.', tier: Rare },
      { id: CompanionAnimation.Spin, name: 'Toupie', description: 'Double vrille en plein saut.', tier: Rare },
      { id: CompanionAnimation.Levitation, name: 'Lévitation', description: 'Flotte au-dessus du sol, aura qui pulse.', tier: Rare },
      { id: CompanionAnimation.Ninja, name: 'Ninja', description: 'Images rémanentes quand il file.', tier: Legendary },
      { id: CompanionAnimation.Teleport, name: 'Téléportation', description: 'S’étire en trait de lumière et réapparaît plus loin.', tier: Legendary },
      { id: CompanionAnimation.Disco, name: 'Disco', description: 'Danse sous des spots, sa couleur suit le rythme.', tier: Legendary },
    ],
  },
]

export const EMPTY_OUTFIT: CompanionOutfit = {}

export const sameOutfit = (first: CompanionOutfit, second: CompanionOutfit): boolean => WARDROBE.every(({ slot }) => first[slot] === second[slot])

export const dressed = (outfit: CompanionOutfit): boolean => WARDROBE.some(({ slot }) => outfit[slot] !== undefined)
