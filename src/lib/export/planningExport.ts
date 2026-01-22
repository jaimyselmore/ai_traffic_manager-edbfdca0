import { format } from 'date-fns';
import { nl } from 'date-fns/locale';
import html2pdf from 'html2pdf.js';

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
  primaryRole?: string;
  secondaryRole?: string;
}

const dayNamesShort = ['Ma', 'Di', 'Wo', 'Do', 'Vr'];
const timeSlots = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

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
 * Get the role display text for an employee
 * For duo teams, this shows the role of the first person
 * For individual employees, shows their primary role
 */
function getEmployeeRole(employee: EmployeeData): string {
  return employee.primaryRole || employee.role || '';
}

/**
 * Get task for a specific cell (employee, day, hour)
 */
function getTaskForCell(
  tasks: TaskData[],
  employeeName: string,
  dayOfWeek: number,
  hour: number
): TaskData | null {
  return tasks.find((task) => {
    if (task.werknemer_naam !== employeeName || task.dag_van_week !== dayOfWeek) return false;
    const endHour = task.start_uur + task.duur_uren;
    return hour >= task.start_uur && hour < endHour;
  }) || null;
}

/**
 * Check if this hour is the start of a task
 */
function isTaskStart(task: TaskData, hour: number): boolean {
  return task.start_uur === hour;
}

/**
 * Export planning data to CSV format (grid layout)
 */
export function exportToCSV(
  tasks: TaskData[],
  employees: EmployeeData[],
  weekStart: Date,
  weekNumber: number
): void {
  // Build header row: Medewerker | Rol | Uur | Ma date | Di date | Wo date | Do date | Vr date
  const weekDates = dayNamesShort.map((name, index) => {
    const date = getDayDate(weekStart, index);
    return `${name} ${format(date, 'd/M')}`;
  });
  
  const headers = ['Medewerker', 'Rol', 'Uur', ...weekDates];
  
  const rows: string[][] = [];
  
  // For each employee, create rows for each time slot
  employees.forEach((employee) => {
    timeSlots.forEach((hour, hourIndex) => {
      const row: string[] = [];
      
      // Employee name only on first row
      if (hourIndex === 0) {
        row.push(employee.name);
        row.push(getEmployeeRole(employee));
      } else {
        row.push('');
        row.push('');
      }
      
      // Time column
      if (hour === 13) {
        row.push('Lunch');
      } else {
        row.push(formatHour(hour));
      }
      
      // For each day, check if there's a task
      dayNamesShort.forEach((_, dayIndex) => {
        const task = getTaskForCell(tasks, employee.name, dayIndex, hour);
        
        if (task && isTaskStart(task, hour)) {
          // Show task info: Klant - Fase (Status)
          const status = task.plan_status === 'concept' ? ' [C]' : '';
          row.push(`${task.klant_naam} - ${task.fase_naam}${status}`);
        } else if (task) {
          // Task continues from previous hour
          row.push('↓');
        } else if (hour === 13) {
          // Lunch hour
          row.push('—');
        } else {
          // Empty cell
          row.push('');
        }
      });
      
      rows.push(row);
    });
    
    // Add empty row between employees for readability
    rows.push(['', '', '', '', '', '', '', '']);
  });

  // Build CSV content
  const csvContent = [
    // Title row
    [`Planning Week ${weekNumber}`, '', '', '', '', '', '', ''].join(';'),
    // Empty row
    ['', '', '', '', '', '', '', ''].join(';'),
    // Headers
    headers.join(';'),
    // Data rows
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
 * Generate HTML content for PDF export (grid layout matching the planner view)
 */
function generatePlanningHTML(
  tasks: TaskData[],
  employees: EmployeeData[],
  weekStart: Date,
  weekNumber: number,
  dateRange: string
): string {
  // Generate weekday headers with dates
  const weekDates = dayNamesShort.map((name, index) => {
    const date = getDayDate(weekStart, index);
    return { name, date: format(date, 'd/M') };
  });

  // Task colors matching the app
  const taskColors: Record<string, { bg: string; text: string }> = {
    concept: { bg: '#8B5CF6', text: '#fff' },
    review: { bg: '#F59E0B', text: '#fff' },
    uitwerking: { bg: '#3B82F6', text: '#fff' },
    productie: { bg: '#10B981', text: '#fff' },
    extern: { bg: '#EC4899', text: '#fff' },
    optie: { bg: '#6B7280', text: '#fff' },
  };

  // Generate employee rows with time slots
  const employeeRowsHTML = employees.map((employee) => {
    const timeRowsHTML = timeSlots.map((hour, hourIndex) => {
      const isLunch = hour === 13;
      const timeLabel = isLunch ? 'Lunch' : formatHour(hour);
      
      const dayCellsHTML = weekDates.map((_, dayIndex) => {
        const task = getTaskForCell(tasks, employee.name, dayIndex, hour);
        
        if (task && isTaskStart(task, hour)) {
          const colors = taskColors[task.werktype] || taskColors.optie;
          const isConcept = task.plan_status === 'concept';
          const opacity = isConcept ? '0.6' : '1';
          
          return `
            <td class="day-cell" style="background: ${isLunch ? '#fef3c7' : '#fff'};">
              <div class="task-block" style="background: ${colors.bg}; color: ${colors.text}; opacity: ${opacity};">
                <div class="task-client">${task.klant_naam}</div>
                <div class="task-phase">${task.fase_naam}</div>
              </div>
            </td>
          `;
        } else if (task) {
          // Task continues
          const colors = taskColors[task.werktype] || taskColors.optie;
          const isConcept = task.plan_status === 'concept';
          const opacity = isConcept ? '0.6' : '1';
          return `
            <td class="day-cell" style="background: ${isLunch ? '#fef3c7' : '#fff'};">
              <div class="task-block task-continue" style="background: ${colors.bg}; opacity: ${opacity};"></div>
            </td>
          `;
        } else {
          return `<td class="day-cell ${isLunch ? 'lunch-cell' : ''}"></td>`;
        }
      }).join('');
      
      return `
        <tr>
          ${hourIndex === 0 ? `
            <td rowspan="${timeSlots.length}" class="employee-cell">
              <div class="employee-name">${employee.name}</div>
              <div class="employee-role">${getEmployeeRole(employee)}</div>
            </td>
          ` : ''}
          <td class="time-cell ${isLunch ? 'lunch-cell' : ''}">${timeLabel}</td>
          ${dayCellsHTML}
        </tr>
      `;
    }).join('');
    
    return timeRowsHTML;
  }).join('');

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
      font-size: 10px;
      line-height: 1.3;
      padding: 15px;
      background: white;
    }
    .header {
      margin-bottom: 15px;
      padding-bottom: 10px;
      border-bottom: 2px solid #333;
    }
    .header h1 {
      font-size: 16px;
      font-weight: 600;
      color: #333;
    }
    .header p {
      font-size: 11px;
      color: #666;
      margin-top: 3px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid #e5e7eb;
      padding: 4px;
      text-align: center;
      vertical-align: middle;
    }
    th {
      background: #f3f4f6;
      font-weight: 600;
      font-size: 9px;
      color: #374151;
      padding: 6px 4px;
    }
    th.employee-header {
      width: 120px;
      text-align: left;
    }
    th.time-header {
      width: 50px;
    }
    .employee-cell {
      background: #fff;
      text-align: left;
      vertical-align: top;
      padding: 8px;
      border-right: 2px solid #d1d5db;
    }
    .employee-name {
      font-weight: 600;
      font-size: 10px;
      color: #111827;
      margin-bottom: 2px;
    }
    .employee-role {
      font-size: 8px;
      color: #6b7280;
    }
    .time-cell {
      background: #fff;
      font-size: 8px;
      color: #6b7280;
      font-weight: 500;
      width: 50px;
    }
    .day-cell {
      height: 24px;
      padding: 2px;
      vertical-align: top;
    }
    .lunch-cell {
      background: #fef3c7 !important;
    }
    .task-block {
      border-radius: 3px;
      padding: 2px 4px;
      height: 100%;
      min-height: 18px;
      overflow: hidden;
    }
    .task-continue {
      height: 100%;
      min-height: 18px;
    }
    .task-client {
      font-size: 8px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .task-phase {
      font-size: 7px;
      opacity: 0.85;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .print-footer {
      margin-top: 20px;
      font-size: 8px;
      color: #9ca3af;
      text-align: center;
    }
    .no-employees {
      text-align: center;
      padding: 40px;
      color: #6b7280;
      font-style: italic;
    }
    @media print {
      body { padding: 10px; }
      .header { margin-bottom: 10px; }
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
        <th class="employee-header">Medewerker</th>
        <th class="time-header">Uur</th>
        ${weekDates.map(d => `<th>${d.name}<br/><span style="font-weight: normal;">${d.date}</span></th>`).join('')}
      </tr>
    </thead>
    <tbody>
      ${employees.length > 0 ? employeeRowsHTML : `
        <tr>
          <td colspan="7" class="no-employees">Geen medewerkers in de planning</td>
        </tr>
      `}
    </tbody>
  </table>
</body>
</html>
  `;
}

/**
 * Export planning data to PDF (downloads directly to Downloads folder)
 */
export function exportToPDF(
  tasks: TaskData[],
  employees: EmployeeData[],
  weekStart: Date,
  weekNumber: number,
  dateRange: string
): void {
  const htmlContent = generatePlanningHTML(tasks, employees, weekStart, weekNumber, dateRange);
  
  // Create a temporary container for html2pdf
  const container = document.createElement('div');
  container.innerHTML = htmlContent;
  document.body.appendChild(container);
  
  const filename = `planning-week-${weekNumber}-${format(weekStart, 'yyyy-MM-dd')}.pdf`;
  
  const options = {
    margin: 10,
    filename: filename,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { 
      scale: 2,
      useCORS: true,
      letterRendering: true,
    },
    jsPDF: { 
      unit: 'mm', 
      format: 'a3', 
      orientation: 'portrait' as const,
    },
  };
  
  html2pdf()
    .set(options)
    .from(container)
    .save()
    .then(() => {
      // Clean up the temporary container
      document.body.removeChild(container);
    })
    .catch((error: Error) => {
      console.error('PDF generation failed:', error);
      document.body.removeChild(container);
      throw error;
    });
}
