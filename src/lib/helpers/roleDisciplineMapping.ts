// Role to Discipline mapping helper
// Maps roles to their corresponding disciplines for automatic assignment

export const ROLE_DISCIPLINE_MAP: Record<string, string> = {
  // Creatie discipline - creatieve rollen
  'Creatief team': 'Creatie',
  'Creative Director': 'Creatie',
  'Art Director': 'Creatie',
  'Copywriter': 'Creatie',

  // Studio discipline - post-productie rollen
  'Studio': 'Studio',
  'Editor': 'Studio',
  'Designer': 'Studio',

  // Account discipline
  'Account': 'Account',

  // Productie discipline
  'Productie': 'Productie',

  // Strategie discipline
  'Strategie': 'Strategie',

  // Stagiair has no fixed discipline - depends on selected roles
};

/**
 * Derives disciplines from selected roles
 * Returns up to 3 disciplines based on the roles
 */
export function deriveDisciplinesFromRoles(
  primaireRol: string | null,
  tweedeRol: string | null,
  derdeRol: string | null
): {
  discipline: string;
  discipline_2: string;
  discipline_3: string;
} {
  const disciplines: string[] = [];

  // Add disciplines for each role (skip duplicates and Stagiair)
  if (primaireRol && primaireRol !== 'Stagiair' && ROLE_DISCIPLINE_MAP[primaireRol]) {
    disciplines.push(ROLE_DISCIPLINE_MAP[primaireRol]);
  }

  if (tweedeRol && tweedeRol !== 'Stagiair' && ROLE_DISCIPLINE_MAP[tweedeRol]) {
    const disc = ROLE_DISCIPLINE_MAP[tweedeRol];
    if (!disciplines.includes(disc)) {
      disciplines.push(disc);
    }
  }

  if (derdeRol && derdeRol !== 'Stagiair' && ROLE_DISCIPLINE_MAP[derdeRol]) {
    const disc = ROLE_DISCIPLINE_MAP[derdeRol];
    if (!disciplines.includes(disc)) {
      disciplines.push(disc);
    }
  }

  return {
    discipline: disciplines[0] || '',
    discipline_2: disciplines[1] || '',
    discipline_3: disciplines[2] || '',
  };
}

/**
 * Common roles available for selection
 * Grouped by discipline for clarity
 */
export const AVAILABLE_ROLES = [
  // Creatie rollen
  'Creatief team',
  'Creative Director',
  'Art Director',
  'Copywriter',

  // Studio rollen
  'Studio',
  'Editor',
  'Designer',

  // Overige rollen
  'Account',
  'Productie',
  'Strategie',
  'Stagiair',
];
