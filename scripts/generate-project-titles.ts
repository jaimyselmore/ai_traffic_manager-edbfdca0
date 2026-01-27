/**
 * Migration Script: Generate Project Titles
 *
 * This script generates titles for existing projects that don't have one yet.
 * Format: {klantnaam}_{volledigProjectId}
 * Example: "Selmore_12345601"
 *
 * Run this AFTER adding the titel column to projecten table.
 *
 * Usage:
 *   ts-node scripts/generate-project-titles.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in environment variables');
  console.error('Required: VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface Project {
  id: string;
  projectnummer: string;
  titel: string | null;
  klant_id: string;
  klanten?: {
    naam: string;
    klantnummer: string;
  };
}

async function generateProjectTitles() {
  console.log('🔄 Starting project title generation...\n');

  try {
    // 1. Fetch all projects without a titel
    console.log('📊 Fetching projects without titles...');
    const { data: projecten, error: fetchError } = await supabase
      .from('projecten')
      .select(`
        id,
        projectnummer,
        titel,
        klant_id,
        klanten (
          naam,
          klantnummer
        )
      `)
      .is('titel', null);

    if (fetchError) {
      throw new Error(`Failed to fetch projects: ${fetchError.message}`);
    }

    if (!projecten || projecten.length === 0) {
      console.log('✅ No projects found without titles. All done!');
      return;
    }

    console.log(`Found ${projecten.length} projects without titles\n`);

    // 2. Generate titles for each project
    let successCount = 0;
    let errorCount = 0;

    for (const project of projecten as Project[]) {
      try {
        // Skip if project has no client relation
        if (!project.klanten) {
          console.warn(`⚠️  Skipping project ${project.id}: No client relation found`);
          errorCount++;
          continue;
        }

        // Skip if missing projectnummer
        if (!project.projectnummer) {
          console.warn(`⚠️  Skipping project ${project.id}: No projectnummer found`);
          errorCount++;
          continue;
        }

        const klantnaam = project.klanten.naam;
        const projectNummer = project.projectnummer;
        const titel = `${klantnaam}_${projectNummer}`;

        // Update project with titel
        const { error: updateError } = await supabase
          .from('projecten')
          .update({ titel })
          .eq('id', project.id);

        if (updateError) {
          console.error(`❌ Failed to update project ${project.id}: ${updateError.message}`);
          errorCount++;
        } else {
          console.log(`✅ Generated titel for project ${project.id}: "${titel}"`);
          successCount++;
        }

      } catch (error) {
        console.error(`❌ Error processing project ${project.id}:`, error);
        errorCount++;
      }
    }

    // 3. Summary
    console.log('\n📊 Migration Summary:');
    console.log(`   Total projects: ${projecten.length}`);
    console.log(`   ✅ Successfully updated: ${successCount}`);
    console.log(`   ❌ Errors: ${errorCount}`);

    if (successCount > 0) {
      console.log('\n✅ Migration completed successfully!');
    } else {
      console.log('\n⚠️  No titles were generated. Check the errors above.');
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

// Run migration
generateProjectTitles()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
