import { useQuery } from '@tanstack/react-query';
import { getRolprofielen, getDisciplines, getMedewerkers } from '@/lib/data/adminService';

export default function CheckData() {
  const { data: rollen = [] } = useQuery({
    queryKey: ['rolprofielen'],
    queryFn: getRolprofielen,
  });

  const { data: disciplines = [] } = useQuery({
    queryKey: ['disciplines'],
    queryFn: getDisciplines,
  });

  const { data: medewerkers = [] } = useQuery({
    queryKey: ['medewerkers'],
    queryFn: getMedewerkers,
  });

  return (
    <div className="p-8 space-y-8 max-w-6xl mx-auto">
      <h1 className="text-3xl font-bold">Database Data Check</h1>

      {/* ROLLEN */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">
          📋 Rollen ({rollen.length})
        </h2>
        {rollen.length === 0 ? (
          <p className="text-red-500">⚠️ GEEN ROLLEN GEVONDEN</p>
        ) : (
          <div className="grid gap-4">
            {rollen.map((rol) => (
              <div key={rol.rol_nummer} className="border rounded-lg p-4 bg-card">
                <h3 className="font-bold text-lg">
                  #{rol.rol_nummer}: {rol.rol_naam}
                </h3>
                <div className="mt-2 space-y-2">
                  <div>
                    <span className="font-semibold">Beschrijving: </span>
                    {rol.beschrijving_rol ? (
                      <span className="text-green-600">{rol.beschrijving_rol}</span>
                    ) : (
                      <span className="text-red-500">❌ GEEN BESCHRIJVING</span>
                    )}
                  </div>
                  <div>
                    <span className="font-semibold">Taken: </span>
                    {rol.taken_rol ? (
                      <span className="text-green-600">{rol.taken_rol}</span>
                    ) : (
                      <span className="text-red-500">❌ GEEN TAKEN</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* DISCIPLINES */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">
          🎨 Disciplines ({disciplines.length})
        </h2>
        {disciplines.length === 0 ? (
          <p className="text-red-500">⚠️ GEEN DISCIPLINES GEVONDEN</p>
        ) : (
          <div className="grid gap-4">
            {disciplines.map((disc) => (
              <div key={disc.id} className="border rounded-lg p-4 bg-card">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded border"
                    style={{ backgroundColor: disc.kleur_hex || '#gray' }}
                  />
                  <h3 className="font-bold text-lg">
                    #{disc.id}: {disc.discipline_naam}
                  </h3>
                </div>
                <div className="mt-2">
                  <span className="font-semibold">Beschrijving: </span>
                  {disc.beschrijving ? (
                    <span className="text-green-600">{disc.beschrijving}</span>
                  ) : (
                    <span className="text-red-500">❌ GEEN BESCHRIJVING</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* MEDEWERKERS SAMPLE */}
      <section className="space-y-4">
        <h2 className="text-2xl font-semibold border-b pb-2">
          👤 Medewerkers Sample ({medewerkers.length} totaal, eerste 5 getoond)
        </h2>
        {medewerkers.length === 0 ? (
          <p className="text-red-500">⚠️ GEEN MEDEWERKERS GEVONDEN</p>
        ) : (
          <div className="grid gap-4">
            {medewerkers.slice(0, 5).map((medew) => (
              <div key={medew.werknemer_id} className="border rounded-lg p-4 bg-card">
                <h3 className="font-bold">
                  {medew.naam_werknemer} (#{medew.werknemer_id})
                </h3>
                <div className="mt-2 space-y-1 text-sm">
                  <div>
                    <span className="font-semibold">Primaire rol:</span> {medew.primaire_rol || '-'}
                  </div>
                  <div>
                    <span className="font-semibold">Tweede rol:</span> {medew.tweede_rol || '-'}
                  </div>
                  <div>
                    <span className="font-semibold">Derde rol:</span> {medew.derde_rol || '-'}
                  </div>
                  <div>
                    <span className="font-semibold">Discipline:</span> {medew.discipline || '-'}
                  </div>
                  <div>
                    <span className="font-semibold">Display order:</span> {medew.display_order || '-'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
