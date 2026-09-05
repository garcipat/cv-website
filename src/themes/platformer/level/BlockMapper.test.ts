import { mapCVDataToBlocks, placeBlocks, isBlockOccupied, blockIdAt } from './BlockMapper';
import { tileToPixel } from './Terrain';
import type { CVData } from '@/types/cv';

const cv: CVData = {
  personality: { name: 'Test', tagline: 'Test', summary: '' },
  experience: [
    {
      company: 'Tech Innovations Inc.',
      role: 'Staff Frontend Engineer',
      startDate: '2021-04',
      highlights: ['Led the redesign.'],
    },
  ],
  skills: [],
  courses: [],
  education: [
    { degree: 'B.Sc. Computer Science', institution: 'Technical University Berlin', startDate: '2016-10' },
  ],
  activities: [{ name: 'Volunteering', startDate: '2019-01', endDate: '2019-06' }],
  certificates: [{ name: 'AWS Solutions Architect', issuer: 'AWS', date: '2023-06' }],
  languages: [],
  projects: [{ name: 'Open Source Task Runner', description: 'A CLI task runner.' }],
};

describe('mapCVDataToBlocks', () => {
  it('called-returns-oneCratePerEducationPlusActivityPlusLanguage', () => {
    const defs = mapCVDataToBlocks(cv);
    // 1 education + 1 activity + 0 languages (fixture's languages is [])
    expect(defs.filter((d) => d.blockKind === 'crate')).toHaveLength(2);
  });

  it('called-returns-uniqueIds', () => {
    const defs = mapCVDataToBlocks(cv);
    const ids = defs.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('experienceEntries-produceNoCrateBlocks', () => {
    // Experience lives on chests, not crates (see ChestMapper.ts) —
    // mapCVDataToBlocks must never build an experience-sourced crate.
    const defs = mapCVDataToBlocks(cv);
    expect(defs.some((d) => d.fact?.sectionId === 'experience')).toBe(false);
  });

  it('educationEntry-buildsEducationFact', () => {
    const defs = mapCVDataToBlocks(cv);
    const edu = defs.find((d) => d.fact && 'degree' in d.fact.data);
    expect(edu).toBeDefined();
    expect(edu?.fact?.sectionId).toBe('education');
    expect(edu?.fact?.sourceType).toBe('block');
    expect(edu?.blockKind).toBe('crate');
  });

  it('activityEntry-buildsActivityFact', () => {
    const defs = mapCVDataToBlocks(cv);
    const activity = defs.find((d) => d.fact && d.fact.sectionId === 'activities');
    expect(activity).toBeDefined();
    expect(activity?.fact?.sourceType).toBe('block');
    expect(activity?.blockKind).toBe('crate');
  });

  it('languageEntry-buildsLanguageFact', () => {
    const cvWithLanguage = { ...cv, languages: [{ name: 'German', level: 90, flag: '🇩🇪' }] };
    const defs = mapCVDataToBlocks(cvWithLanguage);
    const language = defs.find((d) => d.fact && d.fact.sectionId === 'languages');
    expect(language).toBeDefined();
    expect(language?.fact?.sourceType).toBe('block');
    expect(language?.blockKind).toBe('crate');
  });

  it('noEducationActivitiesOrLanguages-returnsNoCrateBlocks', () => {
    const defs = mapCVDataToBlocks({ ...cv, education: [], activities: [], languages: [] });
    expect(defs.filter((d) => d.blockKind === 'crate')).toHaveLength(0);
  });

  it('everyFactId-matchesItsBlockId', () => {
    const defs = mapCVDataToBlocks(cv);
    expect(defs.every((d) => d.fact && d.id === d.fact.id)).toBe(true);
  });

  // Certificates and Projects live on question-mark blocks' bonus fruit,
  // not on enemies — see EnemyMapper.ts's courseToEnemy comment.
  it('called-returns-oneQuestionMarkPerCertificatePlusOneQuestionMarkPerProject', () => {
    const defs = mapCVDataToBlocks(cv);
    expect(defs.filter((d) => d.blockKind === 'questionMark')).toHaveLength(2);
  });

  it('certificateEntry-buildsCertificatesFactOnQuestionMark', () => {
    const defs = mapCVDataToBlocks(cv);
    const cert = defs.find((d) => d.fact && 'issuer' in d.fact.data);
    expect(cert).toBeDefined();
    expect(cert?.fact?.sectionId).toBe('certificates');
    expect(cert?.fact?.sourceType).toBe('block');
    expect(cert?.blockKind).toBe('questionMark');
  });

  it('projectEntry-buildsProjectsFactOnQuestionMark', () => {
    const defs = mapCVDataToBlocks(cv);
    const project = defs.find((d) => d.fact && d.fact.sectionId === 'projects');
    expect(project).toBeDefined();
    expect(project?.fact?.sourceType).toBe('block');
    expect(project?.blockKind).toBe('questionMark');
  });

  it('noCertificatesOrProjects-returnsNoQuestionMarkBlocks', () => {
    const defs = mapCVDataToBlocks({ ...cv, certificates: [], projects: [] });
    expect(defs.filter((d) => d.blockKind === 'questionMark')).toHaveLength(0);
  });
});

/** Every fact a crate placement owns, in the order `placeBlocks` assigns
 *  them — see EnemyMapper.test.ts's identical helper for the reasoning. */
function factsOf(placement: { fact?: unknown; extraFacts?: unknown[] }): unknown[] {
  return [...(placement.fact ? [placement.fact] : []), ...(placement.extraFacts ?? [])];
}

describe('placeBlocks', () => {
  // A crate no longer carries a fixed fact bound to a specific CVData-derived
  // def — placement assigns each crate marker its own fixed slice of the
  // Education/Activity/Language pool, based on its position among every
  // crate marker (independent of the order the player later breaks them in),
  // the same proportional formula `level/SkillFactPacing.ts`'s
  // `revealedFactCountFor` already uses for coins (see EnemyMapper.ts's
  // placeGreenSlimes for the enemy-side equivalent).

  it('crateMarkerCountEqualsCrateFactCount-oneFactPerMarkerInOrder', () => {
    const defs = mapCVDataToBlocks(cv); // 2 crate defs (education + activity)
    const crateDefs = defs.filter((d) => d.blockKind === 'crate');
    const crateMarkers = [
      { col: 5, row: 2 },
      { col: 6, row: 2 },
    ];
    const placed = placeBlocks(defs, { crate: crateMarkers, questionMark: [], fragileRock: [] });

    expect(placed.map((p) => p.fact)).toEqual(crateDefs.map((d) => d.fact));
    expect(placed.every((p) => p.extraFacts === undefined)).toBe(true);
    expect(placed[0]).toMatchObject(tileToPixel(crateMarkers[0].col, crateMarkers[0].row));
    expect(placed[1]).toMatchObject(tileToPixel(crateMarkers[1].col, crateMarkers[1].row));
  });

  it('onlyOneCrateMarker-thatOneCrateOwnsEveryEducationActivityAndLanguageFact', () => {
    // The example this feature was designed around: with only one crate on
    // the map, breaking it must reveal every education/activity/language
    // fact the CV has.
    const defs = mapCVDataToBlocks(cv); // 2 crate defs
    const placed = placeBlocks(defs, { crate: [{ col: 1, row: 0 }], questionMark: [], fragileRock: [] });
    const crateDefs = defs.filter((d) => d.blockKind === 'crate');

    const crates = placed.filter((p) => p.blockKind === 'crate');
    expect(crates).toHaveLength(1);
    expect(factsOf(crates[0])).toEqual(crateDefs.map((d) => d.fact));
  });

  it('moreCrateMarkersThanCrateFacts-everyFactStillReachableButSomeCratesGetNone', () => {
    const defs = mapCVDataToBlocks(cv); // 2 crate defs
    const crateDefs = defs.filter((d) => d.blockKind === 'crate');
    const crateMarkers = [
      { col: 1, row: 0 },
      { col: 2, row: 0 },
      { col: 3, row: 0 },
    ]; // 3 markers, 2 facts
    const placed = placeBlocks(defs, { crate: crateMarkers, questionMark: [], fragileRock: [] });
    const crates = placed.filter((p) => p.blockKind === 'crate');

    expect(crates).toHaveLength(3);
    expect(crates.some((p) => p.fact === undefined)).toBe(true);
    expect(crates.flatMap(factsOf)).toEqual(crateDefs.map((d) => d.fact));
  });

  it('noCrateMarkers-noCrateDefsPlaced', () => {
    const defs = mapCVDataToBlocks(cv);
    const placed = placeBlocks(defs, { crate: [], questionMark: [], fragileRock: [] });
    expect(placed).toHaveLength(0);
  });

  it('questionMarkMarkers-noDefsProvided-eachBecomesAPlacementWithNoFact', () => {
    const markers = [
      { col: 2, row: 1 },
      { col: 3, row: 1 },
    ];
    const placed = placeBlocks([], { crate: [], questionMark: markers, fragileRock: [] });
    expect(placed).toHaveLength(2);
    for (const p of placed) {
      expect(p.blockKind).toBe('questionMark');
      expect(p.fact).toBeUndefined();
    }
    expect(placed[0]).toMatchObject(tileToPixel(markers[0].col, markers[0].row));
    expect(placed[1]).toMatchObject(tileToPixel(markers[1].col, markers[1].row));
  });

  it('enoughQuestionMarkMarkers-returnsQuestionMarkPlacementsWithFactsInDefsOrder', () => {
    const defs = mapCVDataToBlocks(cv); // includes [cert(questionMark), project(questionMark)]
    const questionMarkDefs = defs.filter((d) => d.blockKind === 'questionMark');
    const markers = [
      { col: 2, row: 1 },
      { col: 3, row: 1 },
    ];
    const placed = placeBlocks(defs, { crate: [], questionMark: markers, fragileRock: [] });

    const questionMarkPlacements = placed.filter((p) => p.blockKind === 'questionMark');
    expect(questionMarkPlacements.map((p) => p.id)).toEqual(questionMarkDefs.map((d) => d.id));
    expect(questionMarkPlacements[0]).toMatchObject(tileToPixel(markers[0].col, markers[0].row));
    expect(questionMarkPlacements[1].fact).toBeDefined();
  });

  it('fewerQuestionMarkMarkersThanDefs-onlyMarkedCountGetsAFact', () => {
    const defs = mapCVDataToBlocks(cv); // 2 questionMark defs
    const placed = placeBlocks(defs, { crate: [], questionMark: [{ col: 2, row: 1 }], fragileRock: [] });
    const questionMarkPlacements = placed.filter((p) => p.blockKind === 'questionMark');
    expect(questionMarkPlacements).toHaveLength(1);
    expect(questionMarkPlacements[0].fact).toBeDefined();
  });

  it('moreQuestionMarkMarkersThanDefs-excessMarkerStillPlacedWithNoFact', () => {
    const defs = mapCVDataToBlocks({ ...cv, certificates: [], projects: [] }); // 0 questionMark defs
    const markers = [{ col: 2, row: 1 }];
    const placed = placeBlocks(defs, { crate: [], questionMark: markers, fragileRock: [] });
    const questionMarkPlacements = placed.filter((p) => p.blockKind === 'questionMark');
    expect(questionMarkPlacements).toHaveLength(1);
    expect(questionMarkPlacements[0].fact).toBeUndefined();
    expect(questionMarkPlacements[0]).toMatchObject(tileToPixel(markers[0].col, markers[0].row));
  });

  it('fragileRockMarkers-eachBecomesAPlacementWithNoFact', () => {
    const markers = [{ col: 4, row: 1 }];
    const placed = placeBlocks([], { crate: [], questionMark: [], fragileRock: markers });
    expect(placed).toHaveLength(1);
    expect(placed[0].blockKind).toBe('fragileRock');
    expect(placed[0].fact).toBeUndefined();
    expect(placed[0]).toMatchObject(tileToPixel(markers[0].col, markers[0].row));
  });

  it('questionMarkAndFragileRockPlacements-haveUniqueIdsDerivedFromPosition', () => {
    const placed = placeBlocks([], {
      crate: [],
      questionMark: [{ col: 2, row: 1 }],
      fragileRock: [{ col: 4, row: 1 }],
    });
    const ids = placed.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('noMarkersAtAll-noDefs-returnsEmptyArray', () => {
    expect(placeBlocks([], { crate: [], questionMark: [], fragileRock: [] })).toEqual([]);
  });
});

describe('isBlockOccupied', () => {
  it('tileMatchesABlockPlacement-returnsTrue', () => {
    const placed = placeBlocks([], { crate: [], questionMark: [{ col: 5, row: 2 }], fragileRock: [] });
    expect(isBlockOccupied(placed, 5, 2)).toBe(true);
  });

  it('tileDoesNotMatchAnyBlockPlacement-returnsFalse', () => {
    const placed = placeBlocks([], { crate: [], questionMark: [{ col: 5, row: 2 }], fragileRock: [] });
    expect(isBlockOccupied(placed, 6, 2)).toBe(false);
    expect(isBlockOccupied(placed, 5, 3)).toBe(false);
  });

  it('noPlacements-returnsFalse', () => {
    expect(isBlockOccupied([], 5, 2)).toBe(false);
  });
});

describe('blockIdAt', () => {
  it('tileMatchesABlockPlacement-returnsItsId', () => {
    const placed = placeBlocks([], { crate: [], questionMark: [{ col: 5, row: 2 }], fragileRock: [] });
    expect(blockIdAt(placed, 5, 2)).toBe(placed[0].id);
  });

  it('tileDoesNotMatchAnyBlockPlacement-returnsUndefined', () => {
    const placed = placeBlocks([], { crate: [], questionMark: [{ col: 5, row: 2 }], fragileRock: [] });
    expect(blockIdAt(placed, 6, 2)).toBeUndefined();
  });

  it('noPlacements-returnsUndefined', () => {
    expect(blockIdAt([], 5, 2)).toBeUndefined();
  });
});

describe('placeBlocks — coinPot markers', () => {
  // coinPot carries no CVData mapping at all (same convention as
  // fragileRock) — which fact (if any) its dropped coin eventually reveals
  // is resolved dynamically at pickup time (see CollectibleMapper.ts's
  // mapCVDataToSkillFactPool), never bound to the block itself.
  it('coinPotMarker-producesAPlacementWithNoFact', () => {
    const placed = placeBlocks([], { crate: [], questionMark: [], fragileRock: [], coinPot: [{ col: 5, row: 2 }] });
    expect(placed).toHaveLength(1);
    expect(placed[0].blockKind).toBe('coinPot');
    expect(placed[0].fact).toBeUndefined();
  });

  it('multipleCoinPotMarkers-eachGetsAPositionDerivedId', () => {
    const placed = placeBlocks([], {
      crate: [],
      questionMark: [],
      fragileRock: [],
      coinPot: [
        { col: 5, row: 2 },
        { col: 6, row: 2 },
      ],
    });
    expect(placed).toHaveLength(2);
    const ids = placed.map((p) => p.id);
    expect(new Set(ids).size).toBe(2);
  });

  it('coinPotOmittedFromMarkers-behavesAsEmptyArray', () => {
    // BlockMarkerPositions.coinPot is optional so every pre-existing call
    // site (production and test) that doesn't know about coin-pots yet
    // keeps compiling unchanged.
    expect(placeBlocks([], { crate: [], questionMark: [], fragileRock: [] })).toEqual([]);
  });
});
