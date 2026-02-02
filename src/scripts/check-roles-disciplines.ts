// Script to check roles and disciplines from database
import { getRolprofielen, getDisciplines } from '../lib/data/adminService';
import { getMedewerkers } from '../lib/data/adminService';

async function checkRolesAndDisciplines() {
  console.log('='.repeat(80));
  console.log('CHECKING ROLLEN (ROLES) IN DATABASE');
  console.log('='.repeat(80));

  try {
    const rollen = await getRolprofielen();

    if (rollen.length === 0) {
      console.log('⚠️  GEEN ROLLEN GEVONDEN IN DATABASE');
    } else {
      rollen.forEach((rol) => {
        console.log(`\n📋 ROL #${rol.rol_nummer}: ${rol.rol_naam}`);
        console.log(`   Beschrijving: ${rol.beschrijving_rol || '❌ GEEN BESCHRIJVING'}`);
        console.log(`   Taken: ${rol.taken_rol || '❌ GEEN TAKEN'}`);
      });
    }
  } catch (error) {
    console.error('❌ Error fetching roles:', error);
  }

  console.log('\n' + '='.repeat(80));
  console.log('CHECKING DISCIPLINES IN DATABASE');
  console.log('='.repeat(80));

  try {
    const disciplines = await getDisciplines();

    if (disciplines.length === 0) {
      console.log('⚠️  GEEN DISCIPLINES GEVONDEN IN DATABASE');
    } else {
      disciplines.forEach((disc) => {
        console.log(`\n🎨 DISCIPLINE #${disc.id}: ${disc.discipline_naam}`);
        console.log(`   Beschrijving: ${disc.beschrijving || '❌ GEEN BESCHRIJVING'}`);
        console.log(`   Kleur: ${disc.kleur_hex || '❌ GEEN KLEUR'}`);
      });
    }
  } catch (error) {
    console.error('❌ Error fetching disciplines:', error);
  }

  console.log('\n' + '='.repeat(80));
  console.log('CHECKING MEDEWERKERS (SAMPLE)');
  console.log('='.repeat(80));

  try {
    const medewerkers = await getMedewerkers();

    if (medewerkers.length === 0) {
      console.log('⚠️  GEEN MEDEWERKERS GEVONDEN IN DATABASE');
    } else {
      console.log(`\nTotaal aantal medewerkers: ${medewerkers.length}`);

      // Show first 5 as sample
      medewerkers.slice(0, 5).forEach((medew) => {
        console.log(`\n👤 ${medew.naam_werknemer} (#${medew.werknemer_id})`);
        console.log(`   Primaire rol: ${medew.primaire_rol || '-'}`);
        console.log(`   Tweede rol: ${medew.tweede_rol || '-'}`);
        console.log(`   Derde rol: ${medew.derde_rol || '-'}`);
        console.log(`   Discipline: ${medew.discipline || '-'}`);
        console.log(`   Display order: ${medew.display_order || '-'}`);
      });
    }
  } catch (error) {
    console.error('❌ Error fetching medewerkers:', error);
  }

  console.log('\n' + '='.repeat(80));
}

checkRolesAndDisciplines();
