import { format } from 'date-fns';

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
  plan_status: 'concept' | 'vast' | 'wacht_klant';
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
 * Escape HTML special characters to prevent XSS attacks
 * Uses DOM-based escaping for safety
 */
function escapeHtml(text: string | undefined | null): string {
  if (text === null || text === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(text);
  return div.innerHTML;
}

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
  // Calculate row height so everything fits on one A4 landscape page
  // Available height after header (~70px) and body padding (20mm ≈ 76px): ~648px
  const availableHeight = 648;
  const totalRows = employees.length * timeSlots.length;
  const cellHeight = totalRows > 0 ? Math.max(16, Math.min(28, Math.floor(availableHeight / totalRows))) : 28;
  // Generate weekday headers with dates
  const weekDates = dayNamesShort.map((name, index) => {
    const date = getDayDate(weekStart, index);
    return { name, date: format(date, 'd/M') };
  });

  // Task colors matching the app legend
  const taskColors: Record<string, { bg: string; text: string }> = {
    concept: { bg: '#8B5CF6', text: '#fff' },
    review: { bg: '#F59E0B', text: '#fff' },
    uitwerking: { bg: '#3B82F6', text: '#fff' },
    productie: { bg: '#10B981', text: '#fff' },
    extern: { bg: '#EC4899', text: '#fff' },
    optie: { bg: '#6B7280', text: '#fff' },
    verlof: { bg: '#94A3B8', text: '#fff' },
    ziek: { bg: '#F87171', text: '#fff' },
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
                <div class="task-client">${escapeHtml(task.klant_naam)}</div>
                <div class="task-phase">${escapeHtml(task.fase_naam)}</div>
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
              <div class="employee-name">${escapeHtml(employee.name)}</div>
              <div class="employee-role">${escapeHtml(getEmployeeRole(employee))}</div>
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
    @page {
      size: A4 landscape;
      margin: 0;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    html, body {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 10px;
      line-height: 1.3;
      padding: 10mm;
      background: white;
    }
    .header {
      margin-bottom: 10px;
      padding-bottom: 8px;
      border-bottom: 2px solid #333;
    }
    .header h1 {
      font-size: 15px;
      font-weight: 600;
      color: #333;
    }
    .header p {
      font-size: 10px;
      color: #666;
      margin-top: 2px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    th, td {
      border: 1px solid #e5e7eb;
      padding: 2px 3px;
      text-align: center;
      vertical-align: middle;
    }
    th {
      background: #f3f4f6 !important;
      font-weight: 600;
      font-size: 9px;
      color: #374151;
      padding: 4px 3px;
    }
    th.employee-header {
      width: 110px;
      text-align: left;
    }
    th.time-header {
      width: 42px;
    }
    .employee-cell {
      background: #fff !important;
      text-align: left;
      vertical-align: top;
      padding: 5px;
      border-right: 2px solid #d1d5db;
    }
    .employee-name {
      font-weight: 600;
      font-size: 9px;
      color: #111827;
      margin-bottom: 1px;
    }
    .employee-role {
      font-size: 7px;
      color: #6b7280;
    }
    .time-cell {
      background: #fff !important;
      font-size: 7px;
      color: #6b7280;
      font-weight: 500;
      width: 42px;
    }
    .day-cell {
      height: ${cellHeight}px;
      padding: 1px;
      vertical-align: top;
    }
    .lunch-cell {
      background: #fef3c7 !important;
    }
    .task-block {
      border-radius: 2px;
      padding: 1px 3px;
      height: 100%;
      min-height: ${cellHeight - 2}px;
      overflow: hidden;
    }
    .task-continue {
      height: 100%;
      min-height: ${cellHeight - 2}px;
    }
    .task-client {
      font-size: 7px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .task-phase {
      font-size: 6px;
      opacity: 0.9;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .no-employees {
      text-align: center;
      padding: 40px;
      color: #6b7280;
      font-style: italic;
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
 * Export planning data to PDF using browser print functionality
 * This is a safe alternative that doesn't require vulnerable dependencies
 */
export function exportToPDF(
  tasks: TaskData[],
  employees: EmployeeData[],
  weekStart: Date,
  weekNumber: number,
  dateRange: string
): void {
  const htmlContent = generatePlanningHTML(tasks, employees, weekStart, weekNumber, dateRange);

  // Use a blob URL so the browser print footer doesn't show "about:blank"
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const blobUrl = URL.createObjectURL(blob);

  const printWindow = window.open(blobUrl, '_blank', 'width=1400,height=900');

  if (!printWindow) {
    // Fallback: download the HTML file if popup was blocked
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `planning-week-${weekNumber}-${format(weekStart, 'yyyy-MM-dd')}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
    return;
  }

  // Wait for content to load, then trigger print
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
    // Clean up blob URL after printing
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
  };
}
