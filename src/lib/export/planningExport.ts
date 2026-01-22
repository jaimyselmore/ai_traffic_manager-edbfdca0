import { format } from 'date-fns';
import { nl } from 'date-fns/locale';

interface TaskData {
  id: string;
  werknemer_naam: string;
  klant_naam: string;
  project_nummer: string;
  fase_naam: string;
  werktype: string;
  discipline: string;
  week_start: string;
  dag_van_week: number;
  start_uur: number;
  duur_uren: number;
  plan_status: 'concept' | 'vast';
  is_hard_lock: boolean;
}

interface EmployeeData {
  id: string;
  name: string;
  role?: string;
}

const dayNames = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag'];

/**
 * Convert day of week number and week start to actual date
 */
function getDayDate(weekStart: Date, dayOfWeek: number): Date {
  const date = new Date(weekStart);
  date.setDate(date.getDate() + dayOfWeek);
  return date;
}

/**
 * Format hour to time string (e.g., 9 -> "09:00")
 */
function formatHour(hour: number): string {
  return `${hour.toString().padStart(2, '0')}:00`;
}

/**
 * Export planning data to CSV format
 */
export function exportToCSV(
  tasks: TaskData[],
  employees: EmployeeData[],
  weekStart: Date,
  weekNumber: number
): void {
  // CSV headers
  const headers = [
    'Medewerker',
    'Dag',
    'Datum',
    'Starttijd',
    'Eindtijd',
    'Duur (uren)',
    'Klant',
    'Projectnummer',
    'Fase',
    'Werktype',
    'Discipline',
    'Status',
  ];

  // Convert tasks to CSV rows
  const rows = tasks.map((task) => {
    const dayDate = getDayDate(weekStart, task.dag_van_week);
    const endHour = task.start_uur + task.duur_uren;
    
    return [
      task.werknemer_naam,
      dayNames[task.dag_van_week] || `Dag ${task.dag_van_week}`,
      format(dayDate, 'dd-MM-yyyy', { locale: nl }),
      formatHour(task.start_uur),
      formatHour(endHour),
      task.duur_uren.toString(),
      task.klant_naam,
      task.project_nummer,
      task.fase_naam,
      task.werktype,
      task.discipline,
      task.plan_status === 'concept' ? 'Concept' : 'Vast',
    ];
  });

  // Build CSV content
  const csvContent = [
    headers.join(';'),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(';')),
  ].join('\n');

  // Add BOM for Excel UTF-8 compatibility
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  // Create download link
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `planning-week-${weekNumber}-${format(weekStart, 'yyyy-MM-dd')}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Generate HTML content for PDF export
 */
function generatePlanningHTML(
  tasks: TaskData[],
  employees: EmployeeData[],
  weekStart: Date,
  weekNumber: number,
  dateRange: string
): string {
  // Group tasks by employee
  const tasksByEmployee = new Map<string, TaskData[]>();
  
  tasks.forEach((task) => {
    const existing = tasksByEmployee.get(task.werknemer_naam) || [];
    existing.push(task);
    tasksByEmployee.set(task.werknemer_naam, existing);
  });

  // Sort tasks within each employee by day and hour
  tasksByEmployee.forEach((empTasks, empName) => {
    empTasks.sort((a, b) => {
      if (a.dag_van_week !== b.dag_van_week) return a.dag_van_week - b.dag_van_week;
      return a.start_uur - b.start_uur;
    });
  });

  // Generate weekday headers with dates
  const weekDates = dayNames.map((name, index) => {
    const date = getDayDate(weekStart, index);
    return `${name} ${format(date, 'd/M')}`;
  });

  return `
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <title>Planning Week ${weekNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 11px;
      line-height: 1.4;
      padding: 20px;
      background: white;
    }
    .header {
      margin-bottom: 20px;
      border-bottom: 2px solid #333;
      padding-bottom: 10px;
    }
    .header h1 {
      font-size: 18px;
      font-weight: 600;
      color: #333;
    }
    .header p {
      font-size: 12px;
      color: #666;
      margin-top: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f5f5f5;
      font-weight: 600;
      font-size: 10px;
      text-transform: uppercase;
      color: #555;
    }
    .employee-row {
      background: #fafafa;
      font-weight: 600;
    }
    .employee-row td {
      padding: 8px;
      border-top: 2px solid #ccc;
    }
    .task-row td {
      font-size: 10px;
    }
    .status-concept {
      color: #888;
      font-style: italic;
    }
    .status-vast {
      color: #333;
      font-weight: 500;
    }
    .no-tasks {
      color: #999;
      font-style: italic;
    }
    .print-footer {
      margin-top: 30px;
      font-size: 9px;
      color: #999;
      text-align: center;
    }
    @media print {
      body { padding: 10px; }
      .header { margin-bottom: 15px; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Planning Week ${weekNumber}</h1>
    <p>${dateRange}</p>
  </div>
  
  <table>
    <thead>
      <tr>
        <th style="width: 120px;">Medewerker</th>
        <th style="width: 80px;">Dag</th>
        <th style="width: 70px;">Tijd</th>
        <th>Klant</th>
        <th>Project</th>
        <th>Fase</th>
        <th style="width: 60px;">Status</th>
      </tr>
    </thead>
    <tbody>
      ${Array.from(tasksByEmployee.entries()).map(([empName, empTasks]) => {
        const rows = empTasks.map((task, index) => {
          const dayDate = getDayDate(weekStart, task.dag_van_week);
          const endHour = task.start_uur + task.duur_uren;
          const statusClass = task.plan_status === 'concept' ? 'status-concept' : 'status-vast';
          
          return `
            <tr class="task-row">
              ${index === 0 ? `<td rowspan="${empTasks.length}" class="employee-row">${empName}</td>` : ''}
              <td>${dayNames[task.dag_van_week]} ${format(dayDate, 'd/M')}</td>
              <td>${formatHour(task.start_uur)} - ${formatHour(endHour)}</td>
              <td>${task.klant_naam}</td>
              <td>${task.project_nummer}</td>
              <td>${task.fase_naam}</td>
              <td class="${statusClass}">${task.plan_status === 'concept' ? 'Concept' : 'Vast'}</td>
            </tr>
          `;
        });
        
        return rows.join('');
      }).join('')}
      ${tasksByEmployee.size === 0 ? `
        <tr>
          <td colspan="7" class="no-tasks">Geen taken gepland voor deze week</td>
        </tr>
      ` : ''}
    </tbody>
  </table>
  
  <div class="print-footer">
    Gegenereerd op ${format(new Date(), 'dd-MM-yyyy HH:mm', { locale: nl })}
  </div>
</body>
</html>
  `;
}

/**
 * Export planning data to PDF (opens print dialog)
 */
export function exportToPDF(
  tasks: TaskData[],
  employees: EmployeeData[],
  weekStart: Date,
  weekNumber: number,
  dateRange: string
): void {
  const htmlContent = generatePlanningHTML(tasks, employees, weekStart, weekNumber, dateRange);
  
  // Open new window with print dialog
  const printWindow = window.open('', '_blank', 'width=900,height=700');
  
  if (printWindow) {
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    // Wait for content to load, then trigger print
    printWindow.onload = () => {
      printWindow.focus();
      printWindow.print();
    };
  }
}
